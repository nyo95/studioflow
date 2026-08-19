import { Prisma, ProductRequestStatus, ProductType, SampleAction, SampleStatus, MediaKind, Role } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import { settingsService } from "@/lib/services/settings-service";
import {
  ProductCatalogInput,
  LibraryVendorInput,
  ProjectProductRequestInput,
  ProductCatalogValidationSchema,
  CatalogApprovalValidationSchema,
  ProductCatalogWithRelations,
  attachDerivedCatalogFields,
  catalogStatusToSkuStatus,
  LibraryItemStatus,
} from "../types";
import type { CatalogSampleStatus } from "../types";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit/types";
import { isOfferChange, recordSkuPrice } from "@/subapps/master-data/services/sku-price-service";
import { recordAudit, diffFields } from "@/subapps/master-data/services/audit-service";
import { assertPriceSourceParty } from "@/subapps/master-data/services/party-role-service";
import { resolveCategoryPath } from "@/subapps/master-data/services/category-tree-service";
import { dropAncestorTags, productParentFor } from "@/subapps/master-data/services/category-tree-rules";
import { slugify } from "@/subapps/master-data/lib/slug";
import { createSkuCore } from "@/subapps/master-data/services/sku-core-service";

/**
 * The one include shape every Library read uses. Kept in a single constant so
 * `SkuWithRelations` and every query that feeds `attachDerivedCatalogFields`
 * cannot drift apart — a missing relation here is a runtime crash there.
 *
 * Master Data v2: no more `catalog_*` columns on Sku. Pricing lives in
 * `SkuPrice` (history — only the current row is pulled here), images in
 * `SkuMedia`, categories in `SkuCategory` -> `Category`.
 *
 * `prices` is NOT capped at one row any more. Since suppliers became real
 * (`SkuPrice.supplier_party_id`), one SKU can legitimately have several current
 * prices — one per shop, plus the manufacturer's own list price. `take: 1` with
 * no `orderBy` used to pick whichever row Postgres happened to return, so the
 * price shown on a card could change between two page loads without anything
 * being edited.
 *
 * Ordered cheapest-first so `prices[0]` has a defined meaning: **the best
 * current offer**. That is the number a catalog should show, and the same one
 * `v_bq_material_rate` would pick.
 */
const SKU_FULL_INCLUDE = {
  brand: { include: { scoped_contacts: true, links: true, owner: { select: { legal_name: true, address: true } } } },
  samples: { where: { deleted_at: null } },
  media: true,
  prices: {
    where: { is_current: true },
    orderBy: [{ price_net: "asc" }, { valid_from: "desc" }],
    include: { supplier: { select: { id: true, name: true } } },
  },
  categories: { include: { category: true } },
} satisfies Prisma.SkuInclude;

/**
 * Status sample dari input katalog. Sejak 2026-08-18 ini bukan lagi penerjemah.
 *
 * Sebelumnya baris keduanya berbunyi `if (status === "BORROWED" || status ===
 * "SENT_TO_CLIENT") return SampleStatus.BORROWED` — kompensasi untuk enum
 * `schema.prisma` yang tertinggal dari database (migrasi 20260812120000).
 * Selama itu, memilih "Di klien" MENYIMPAN "Dipinjam", dan MEMFILTER "Di klien"
 * di `getPhysicalSamples` mencari baris BORROWED — dua kesalahan yang saling
 * menutupi sehingga tidak ada yang terlihat salah di layar.
 *
 * Sekarang nilainya diteruskan apa adanya; yang tersisa hanyalah default untuk
 * input yang tidak menyebut status sama sekali.
 */
function catalogSampleStatusToV2(status?: CatalogSampleStatus): SampleStatus {
  return status ? (status as SampleStatus) : SampleStatus.AVAILABLE;
}

export class LibraryService {
  /**
   * Converts a free-text category tag to a URL-safe slug for Category.slug.
   *
   * Delegates to the shared `slugify` in `@/subapps/master-data/lib/slug`.
   * MUST stay byte-identical to `categorySlug` in `category-tree-rules.ts`.
   * The two resolve the same `Category` rows from different call sites, and a
   * slug that differs by one character creates a duplicate category rather than
   * finding the existing one — silently, because both writes succeed.
   */
  private static slugifyTag(tag: string): string {
    return slugify(tag);
  }

  /**
   * Resolves a tag to its Category row (kind=PRODUCT), creating it only when
   * neither the slug nor the name is already taken in that kind.
   */
  private static async resolveCategoryRow(
    tx: PrismaTransaction,
    tag: string,
    slug: string,
    actor?: { id?: string | null; name: string }
  ) {
    void slug;
    const resolved = await resolveCategoryPath(tx, "PRODUCT", productParentFor(tag), tag, actor);
    return tx.category.findUniqueOrThrow({ where: { id: resolved.id } });
  }

  /**
   * Sinkronisasi kategori ke SkuCategory join table. Index 0 = kategori
   * primer (dijaga partial unique index `SkuCategory_primary_uniq`).
   */
  private static async upsertSkuCategories(
    tx: PrismaTransaction,
    skuId: string,
    tags: string[],
    actor?: { id?: string | null; name: string }
  ): Promise<void> {
    const keptCategoryIds: string[] = [];

    const leafTags = dropAncestorTags(tags);

    for (const [index, tag] of leafTags.entries()) {
      const slug = this.slugifyTag(tag);
      if (!slug) continue;
      const category = await this.resolveCategoryRow(tx, tag, slug, actor);
      keptCategoryIds.push(category.id);
      await tx.skuCategory.upsert({
        where: { sku_id_category_id: { sku_id: skuId, category_id: category.id } },
        create: { sku_id: skuId, category_id: category.id, sort_order: index, is_primary: index === 0 },
        update: { sort_order: index, is_primary: index === 0 },
      });
    }

    // Reconcile — drop rows for categories no longer in the tag list. Safe
    // here: this table is written exclusively by this method.
    await tx.skuCategory.deleteMany({
      where: { sku_id: skuId, category_id: { notIn: keptCategoryIds } },
    });
  }

  /**
   * Sinkronisasi kategori ke Library (BrandCategory). SENGAJA HANYA
   * MENAMBAH — tidak pernah menghapus, sama seperti v1: baris ini bisa juga
   * datang dari kurasi manusia (source=SEED) yang tidak boleh direkonsiliasi
   * begitu saja terhadap tag SKU aktif.
   */
  private static async upsertBrandCategories(
    tx: PrismaTransaction,
    brandId: string,
    tags: string[],
    actor?: { id?: string | null; name: string }
  ): Promise<void> {
    const keptIds: string[] = [];
    for (const [index, tag] of tags.entries()) {
      const slug = this.slugifyTag(tag);
      if (!slug) continue;
      const category = await this.resolveCategoryRow(tx, tag, slug, actor);
      keptIds.push(category.id);
      await tx.brandCategory.upsert({
        where: { brand_id_category_id: { brand_id: brandId, category_id: category.id } },
        create: { brand_id: brandId, category_id: category.id, sort_order: index, source: "DERIVED_FROM_SKU" },
        update: { sort_order: index },
      });
    }
    // A4b: remove stale DERIVED_FROM_SKU entries — categories that were once
    // attached to a SKU of this brand but no longer are. SEED rows (manual
    // curation) are intentionally left untouched.
    await tx.brandCategory.deleteMany({
      where: {
        brand_id: brandId,
        source: "DERIVED_FROM_SKU",
        category_id: { notIn: keptIds },
      },
    });
  }

  /**
   * Sinkronisasi kategori SEED ke BrandCategory (dari form Brand, bukan dari SKU).
   * Berbeda dari `upsertBrandCategories` (additive-only for DERIVED_FROM_SKU):
   * - Baris SEED yang tidak ada di `tags` akan DIHAPUS (user eksplisit memilih)
   * - Baris DERIVED_FROM_SKU tidak disentuh sama sekali
   */
  private static async syncSeedBrandCategories(
    tx: PrismaTransaction,
    brandId: string,
    tags: string[],
    actor?: { id?: string | null; name: string }
  ): Promise<void> {
    const keptIds: string[] = [];

    /**
     * Dedup sebelum menulis — "anti typo, anti case sensitive" (owner,
     * 2026-08-14). Tag adalah hashtag: "HPL", "hpl", dan "HPL " adalah satu
     * kategori yang sama.
     *
     * Pertahanan lapis kedua, bukan satu-satunya: `categorySlug` sudah membuat
     * ketiganya jatuh ke baris `Category` yang sama, jadi tanpa ini pun tidak
     * ada kategori kembar yang tercipta. Yang dicegah di sini adalah akibatnya
     * yang lebih halus — dua tag yang menunjuk baris sama akan meng-upsert
     * `BrandCategory` yang sama dua kali, dan `sort_order` terakhir menang.
     * Artinya urutan yang dilihat user bukan urutan yang ia ketik.
     *
     * Yang dipertahankan adalah kemunculan PERTAMA: itu yang diketik lebih
     * dulu, dan mengganti ejaan seseorang dengan ejaan berikutnya di baris yang
     * sama adalah koreksi yang tidak diminta.
     */
    const seen = new Set<string>();
    const uniqueTags: string[] = [];
    for (const raw of tags) {
      const tag = raw.trim();
      if (!tag) continue;
      const key = tag.toLocaleLowerCase("id-ID");
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueTags.push(tag);
    }

    for (const [index, tag] of uniqueTags.entries()) {
      const slug = this.slugifyTag(tag);
      if (!slug) continue;
      const category = await this.resolveCategoryRow(tx, tag, slug, actor);
      keptIds.push(category.id);
      await tx.brandCategory.upsert({
        where: { brand_id_category_id: { brand_id: brandId, category_id: category.id } },
        create: { brand_id: brandId, category_id: category.id, sort_order: index, source: "SEED" },
        update: { sort_order: index, source: "SEED" },
      });
    }

    // Hapus SEED entries yang tidak lagi dipilih user (DERIVED_FROM_SKU dibiarkan)
    await tx.brandCategory.deleteMany({
      where: { brand_id: brandId, source: "SEED", category_id: { notIn: keptIds } },
    });
  }

  private static normalizeOptional(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  /**
   * Category and the former sub-category are one ordered tag collection.
   * The first tag is the primary schedule category.
   */
  private static normalizeCategoryTags(data: {
    catalog_category?: string | null;
    catalog_sub_category?: string | null;
    catalog_tags?: string[] | null;
  }) {
    const raw = [
      data.catalog_category,
      ...(data.catalog_tags ?? []),
      data.catalog_sub_category,
    ];
    const seen = new Set<string>();
    const tags: string[] = [];
    for (const value of raw) {
      const normalized = value?.trim();
      if (!normalized) continue;
      const key = normalized.toLocaleLowerCase("id-ID");
      if (seen.has(key)) continue;
      seen.add(key);
      tags.push(normalized);
    }
    if (tags.length === 0) {
      throw new ActionError("At least one category tag is required.", "CATEGORY_REQUIRED");
    }
    return tags;
  }

  private static parseDecimal(value?: string | null): number | null {
    if (!value) return null;
    const n = parseFloat(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  private static buildDimDisplay(p?: string | null, l?: string | null, t?: string | null, unit?: string | null) {
    const parts = [p, l, t].filter((v) => v && v.trim());
    if (parts.length === 0) return null;
    return `${parts.join(" x ")} ${unit || ""}`.trim();
  }

  /** Folds pattern/motif/color/finishing/metadata into the single `spec` JSON column. */
  private static buildSpec(
    data: Partial<ProductCatalogInput>,
    existingSpec?: Record<string, unknown> | null
  ): Record<string, unknown> {
    const spec: Record<string, unknown> = { ...(existingSpec ?? {}) };
    if (data.catalog_pattern !== undefined) spec.pattern = this.normalizeOptional(data.catalog_pattern) ?? undefined;
    if (data.catalog_motif !== undefined) spec.motif = this.normalizeOptional(data.catalog_motif) ?? undefined;
    if (data.catalog_color !== undefined) spec.color = this.normalizeOptional(data.catalog_color) ?? undefined;
    if (data.catalog_finishing !== undefined) spec.finishing = this.normalizeOptional(data.catalog_finishing) ?? undefined;
    if (data.catalog_metadata !== undefined) Object.assign(spec, data.catalog_metadata ?? {});
    for (const key of Object.keys(spec)) {
      if (spec[key] === undefined) delete spec[key];
    }
    return spec;
  }

  private static buildMediaCreates(data: Partial<ProductCatalogInput>) {
    const entries: { kind: MediaKind; url: string }[] = [];
    const push = (kind: MediaKind, url?: string | null) => {
      const v = this.normalizeOptional(url);
      if (v) entries.push({ kind, url: v });
    };
    push(MediaKind.IMAGE, data.catalog_image_url);
    push(MediaKind.THUMBNAIL, data.catalog_image_thumbnail_url);
    push(MediaKind.ORIGINAL, data.catalog_image_original_url);
    push(MediaKind.REFERENCE, data.catalog_reference_url);
    push(MediaKind.FOLDER, data.catalog_folder_url);
    return entries;
  }

  /**
   * Records a movement or change in the physical inventory logs.
   * `actor_name` is required by v2's SampleMovement (unlike v1's plain
   * `user_id`) — resolved here so callers keep passing only a userId.
   */
  static async logSampleAction(
    tx: PrismaTransaction,
    data: {
      sample_id: string;
      action: SampleAction;
      notes?: string | null;
      userId: string;
      taken_by?: string;
      date_out?: Date;
      date_return?: Date;
    }
  ) {
    const actor = await tx.user.findUnique({ where: { id: data.userId }, select: { name: true } });
    return tx.sampleMovement.create({
      data: {
        sample_id: data.sample_id,
        actor_id: data.userId,
        actor_name: actor?.name ?? "Unknown",
        action: data.action,
        notes: data.notes,
        taken_by: data.taken_by,
        date_out: data.date_out,
        date_return: data.date_return
      }
    });
  }

  /**
   * CRITICAL RUNTIME ASSERTION: Blocks mutation if item is a Source of Truth (Catalog)
   *
   * Permission-based, not role-based. Roles holding LIBRARY_EDIT_ITEM may edit
   * ACTIVE (approved) rows. The action layer returns non-curator edits to
   * DRAFT (pending); designers (DIC/DRIC) remain blocked from mutation entirely.
   */
  static async assertEditable(tx: PrismaTransaction, productId: string, role?: Role) {
    const product = await tx.sku.findUnique({
      where: { id: productId }
    });

    if (product?.status !== "ACTIVE") return;
    if (role && hasPermission(role, PERMISSION.LIBRARY_EDIT_ITEM)) return;

    throw new ActionError(
      "APPROVED global items are read-only for your role.",
      "CATALOG_LOCKED"
    );
  }

  /**
   * CRITICAL RUNTIME ASSERTION: Validates product identity and catalog readiness
   */
  static async assertValidProduct(data: ProductCatalogInput, context: "SNAPSHOT" | "CATALOG") {
    if (context === "CATALOG") {
      const result = CatalogApprovalValidationSchema.safeParse(data);
      if (!result.success) {
        throw new ActionError(result.error.issues[0].message, "CATALOG_VALIDATION_ERROR");
      }
    } else {
      const result = ProductCatalogValidationSchema.safeParse(data);
      if (!result.success) {
        throw new ActionError(result.error.issues[0].message, "SNAPSHOT_VALIDATION_ERROR");
      }
    }

    // IDENTITY RULE: At least one primary identifier must be non-placeholder
    const placeholders = ["N/A", "UNKNOWN", "PENDING", "-", "—", "[RESERVED]"];
    const isPlaceholder = (val?: string | null) => !val || placeholders.includes(val.trim().toUpperCase());

    const skuInvalid = isPlaceholder(data.catalog_sku);
    const nameInvalid = isPlaceholder(data.catalog_product_name);

    if (skuInvalid && nameInvalid) {
      throw new ActionError("Product requires at least one valid identity (SKU or Name). Placeholders in both are FORBIDDEN.", "PLACEHOLDER_VIOLATION");
    }
  }

  /**
   * CRITICAL RUNTIME ASSERTION: Validates model integrity based on ProductType
   */
  static async assertCatalogTypeRules(
    type: ProductType,
    data: { qty?: number; location?: string },
    isProjectContext: boolean
  ) {
    if (type === "material") {
      if (data.qty !== undefined) {
        throw new ActionError("Materials are forbidden from having quantity data.", "TYPE_RULE_VIOLATION");
      }
    } else if (type === "fixture") {
      if (isProjectContext) {
        if (!data.qty || data.qty <= 0) throw new ActionError("Fixtures in projects REQUIRE a quantity > 0.", "TYPE_RULE_VIOLATION");
        if (!data.location?.trim()) throw new ActionError("Fixtures in projects REQUIRE a location.", "TYPE_RULE_VIOLATION");
      }
    }
  }

  /** Returns all active (non-deleted) vendors including contacts, links, and seed categories. */
  static async getAllVendors(tx: PrismaTransaction) {
    const rows = await tx.brand.findMany({
      where: { deleted_at: null },
      include: {
        scoped_contacts: true,
        links: true,
        owner: {
          select: {
            id: true, name: true, legal_name: true, address: true,
            // Excel Table 1 column K. The Suppliers page splits by these
            // (§Halaman baris 39–43 / E9).
            roles: { select: { role: true } },
          },
        },
        // Excel Table 1 column J. Needed here because the Brand form shows it,
        // and the form is fed from this one list.
        suppliers: { select: { party_id: true } },
        // Excel Table 1 "Category" — manually assigned (SEED) at brand level.
        categories: {
          where: { source: "SEED" },
          orderBy: { sort_order: "asc" },
          include: { category: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    /**
     * `seed_categories` is what `LibraryVendor` declares and what the Brand
     * dialog reads; the query returns the join rows under `categories`. The two
     * were never bridged, so opening a brand for EDIT showed an empty Category
     * field even when the brand had categories — and saving that empty field
     * would have wiped them. Flattened here rather than in the dialog so every
     * consumer of this list sees the same shape.
     */
    return rows.map((row) => ({
      ...row,
      seed_categories: row.categories.map((link) => link.category),
    }));
  }

  /** Returns one active vendor by id with related products and contacts. */
  static async getVendorById(id: string, tx: PrismaTransaction) {
    return tx.brand.findFirst({
      where: { id, deleted_at: null },
      include: { skus: true, scoped_contacts: true, links: true },
    });
  }

  /** Delegates to the shared `slugify` in `@/subapps/master-data/lib/slug`. */
  private static slugify(value: string) {
    return slugify(value);
  }

  /**
   * Creates a vendor (Brand). Master Data v2 moved legal_name/address/contacts
   * off Brand onto Party — when any of those are supplied and no `company_id`
   * (owning Party) was given, a Party is auto-created and set as owner so the
   * old "one form, one save" UX keeps working without a separate step.
   */
  static async createVendor(data: LibraryVendorInput, userId: string, tx: PrismaTransaction) {
    let ownerPartyId = data.company_id || null;

    if (!ownerPartyId && (data.legal_name || data.address || data.contacts.length > 0)) {
      const party = await tx.party.create({
        data: {
          name: data.brand_name,
          slug: this.slugify(data.brand_name),
          legal_name: this.normalizeOptional(data.legal_name),
          address: this.normalizeOptional(data.address),
        },
      });
      ownerPartyId = party.id;
      await recordAudit(tx, { entity: "Party", entity_id: party.id, action: "CREATE", actor: { id: userId, name: "system" } });
    }

    const vendor = await tx.brand.create({
      data: {
        name: data.brand_name,
        slug: this.slugify(data.brand_name),
        notes: this.normalizeOptional(data.notes),
        owner_party_id: ownerPartyId,
        // Free-form hashtags (owner feedback 2026-08-18, item 5) — separate
        // from `syncSeedBrandCategories` below, which handles the curated
        // Category checklist instead.
        tags: [...new Set((data.tags ?? []).map((t) => t.trim()).filter(Boolean))],
        // Excel Table 1 column J — who SELLS this brand, which is a different
        // question from who owns it. `suppliers` is a list because a brand is
        // normally stocked in several places.
        suppliers: {
          create: [...new Set(data.supplier_party_ids ?? [])].map((party_id) => ({ party_id })),
        },
        links: {
          create: (data.links ?? [])
            .filter((l) => l.url.trim().length > 0)
            .map((l, i) => ({
              kind: l.kind,
              url: l.url.trim(),
              label: this.normalizeOptional(l.label),
              sort_order: i,
            })),
        },
      },
    });

    await recordAudit(tx, { entity: "Brand", entity_id: vendor.id, action: "CREATE", actor: { id: userId, name: "system" } });

    if ((data.links ?? []).some((link) => link.url.trim().length > 0)) {
      const createdLinks = await tx.brandLink.findMany({
        where: { brand_id: vendor.id },
        orderBy: { sort_order: "asc" },
      });
      for (const link of createdLinks) {
        await recordAudit(tx, {
          entity: "BrandLink",
          entity_id: link.id,
          action: "CREATE",
          actor: { id: userId, name: "system" },
          changes: {
            brand_id: vendor.id,
            kind: link.kind,
            url: link.url,
            label: link.label,
          },
        });
      }
    }

    if (ownerPartyId && data.contacts.length > 0) {
      await tx.partyContact.createMany({
        data: data.contacts.map((c) => ({
          party_id: ownerPartyId!,
          brand_id: vendor.id,
          person_name: c.contact_person,
          job_title: c.contact_role,
          phone: this.normalizeOptional(c.phone_number),
          email: this.normalizeOptional(c.email),
        })),
      });
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_VENDOR, "VENDOR", vendor.id, userId, {
      brand_name: vendor.name
    });

    // Excel Table 1 "Category" — seed categories explicitly set at brand level.
    if (data.brand_category_tags && data.brand_category_tags.length > 0) {
      await this.syncSeedBrandCategories(tx, vendor.id, data.brand_category_tags, { id: userId, name: "system" });
    }

    const created = await tx.brand.findUniqueOrThrow({
      where: { id: vendor.id },
      include: {
        scoped_contacts: true,
        links: true,
        owner: { select: { id: true, name: true, legal_name: true, address: true } },
        categories: { where: { source: "SEED" }, orderBy: { sort_order: "asc" }, include: { category: { select: { id: true, name: true } } } },
      },
    });
    return {
      ...created,
      seed_categories: created.categories.map((link) => link.category),
    };
  }

  /** Updates vendor fields and replaces contact/link lists, then writes audit log. */
  static async updateVendor(id: string, data: Partial<LibraryVendorInput>, userId: string, tx: PrismaTransaction) {
    const existing = await tx.brand.findUniqueOrThrow({
      where: { id },
      include: {
        links: { orderBy: { sort_order: "asc" } },
        categories: {
          where: { source: "SEED" },
          orderBy: { sort_order: "asc" },
          include: { category: { select: { id: true, name: true } } },
        },
      },
    });
    let ownerPartyId = data.company_id !== undefined ? data.company_id : existing.owner_party_id;

    const normalizedBrandName = data.brand_name?.trim();
    if (data.brand_name !== undefined && !normalizedBrandName) {
      throw new ActionError("Brand name is required.", "VALIDATION_ERROR");
    }

    if (!ownerPartyId && (data.legal_name || data.address || (data.contacts && data.contacts.length > 0))) {
      const party = await tx.party.create({
        data: {
          name: data.brand_name ?? existing.name,
          slug: this.slugify(data.brand_name ?? existing.name),
          legal_name: this.normalizeOptional(data.legal_name),
          address: this.normalizeOptional(data.address),
        },
      });
      ownerPartyId = party.id;
      await recordAudit(tx, { entity: "Party", entity_id: party.id, action: "CREATE", actor: { id: userId, name: "system" } });
    } else if (ownerPartyId && (data.legal_name !== undefined || data.address !== undefined)) {
      await tx.party.update({
        where: { id: ownerPartyId },
        data: {
          ...(data.legal_name !== undefined ? { legal_name: this.normalizeOptional(data.legal_name) } : {}),
          ...(data.address !== undefined ? { address: this.normalizeOptional(data.address) } : {}),
        },
      });
      await recordAudit(tx, { entity: "Party", entity_id: ownerPartyId, action: "UPDATE", actor: { id: userId, name: "system" } });
    }

    const existingLinkState = existing.links.map((link) => ({
      kind: link.kind,
      url: link.url,
      label: link.label,
    }));
    const requestedLinks = data.links
      ?.filter((link) => link.url.trim().length > 0)
      .map((link, index) => ({
        id: link.id,
        kind: link.kind,
        url: link.url.trim(),
        label: this.normalizeOptional(link.label),
        sort_order: index,
      }));
    const requestedLinkState = requestedLinks?.map(({ kind, url, label }) => ({
      kind,
      url,
      label,
    }));
    const linksChanged =
      requestedLinkState !== undefined &&
      JSON.stringify(existingLinkState) !== JSON.stringify(requestedLinkState);

    if (linksChanged && requestedLinks) {
      const existingById = new Map(existing.links.map((link) => [link.id, link]));
      const requestedIds = new Set(requestedLinks.flatMap((link) => (link.id ? [link.id] : [])));
      const unknownId = [...requestedIds].find((linkId) => !existingById.has(linkId));
      if (unknownId) {
        throw new ActionError("Brand link not found.", "NOT_FOUND");
      }

      for (const link of existing.links) {
        if (requestedIds.has(link.id)) continue;
        await tx.brandLink.delete({ where: { id: link.id } });
        await recordAudit(tx, {
          entity: "BrandLink",
          entity_id: link.id,
          action: "DELETE",
          actor: { id: userId, name: "system" },
          changes: {
            link: {
              from: {
                kind: link.kind,
                url: link.url,
                label: link.label,
                sort_order: link.sort_order,
              },
              to: null,
            },
          },
        });
      }

      for (const link of requestedLinks) {
        const current = link.id ? existingById.get(link.id) : undefined;
        if (!current) {
          const created = await tx.brandLink.create({
            data: {
              brand_id: id,
              kind: link.kind,
              url: link.url,
              label: link.label,
              sort_order: link.sort_order,
            },
          });
          await recordAudit(tx, {
            entity: "BrandLink",
            entity_id: created.id,
            action: "CREATE",
            actor: { id: userId, name: "system" },
            changes: { brand_id: id, kind: created.kind, url: created.url, label: created.label },
          });
          continue;
        }

        const changed =
          current.kind !== link.kind ||
          current.url !== link.url ||
          current.label !== link.label ||
          current.sort_order !== link.sort_order;
        if (!changed) continue;
        const updatedLink = await tx.brandLink.update({
          where: { id: current.id },
          data: {
            kind: link.kind,
            url: link.url,
            label: link.label,
            sort_order: link.sort_order,
          },
        });
        await recordAudit(tx, {
          entity: "BrandLink",
          entity_id: current.id,
          action: "UPDATE",
          actor: { id: userId, name: "system" },
          changes: {
            link: {
              from: { kind: current.kind, url: current.url, label: current.label, sort_order: current.sort_order },
              to: { kind: updatedLink.kind, url: updatedLink.url, label: updatedLink.label, sort_order: updatedLink.sort_order },
            },
          },
        });
      }
    }

    const brandData: Prisma.BrandUpdateInput = {
      ...(normalizedBrandName !== undefined
        ? { name: normalizedBrandName, slug: this.slugify(normalizedBrandName) }
        : {}),
      ...(data.notes !== undefined ? { notes: this.normalizeOptional(data.notes) } : {}),
      ...(ownerPartyId !== existing.owner_party_id ? { owner: ownerPartyId ? { connect: { id: ownerPartyId } } : { disconnect: true } } : {}),
      ...(data.tags !== undefined
        ? { tags: [...new Set(data.tags.map((tag) => tag.trim()).filter(Boolean))] }
        : {}),
    };
    if (Object.keys(brandData).length > 0) {
      await tx.brand.update({ where: { id }, data: brandData });
    }

    // Replaced wholesale, like contacts and links. `BrandSupplier` carries
    // `is_authorized` and `notes`, which the Brand form does not expose yet —
    // clearing them on every save would lose curation nobody entered through
    // this screen, so the columns are carried forward per party.
    if (data.supplier_party_ids !== undefined) {
      const wanted = [...new Set(data.supplier_party_ids)];
      const existingLinks = await tx.brandSupplier.findMany({
        where: { brand_id: id },
        select: { party_id: true },
      });
      const have = new Set(existingLinks.map((l) => l.party_id));
      const toRemove = [...have].filter((pid) => !wanted.includes(pid));
      const toAdd = wanted.filter((pid) => !have.has(pid));
      if (toRemove.length > 0) {
        await tx.brandSupplier.deleteMany({ where: { brand_id: id, party_id: { in: toRemove } } });
      }
      if (toAdd.length > 0) {
        await tx.brandSupplier.createMany({
          data: toAdd.map((party_id) => ({ brand_id: id, party_id })),
        });
      }
    }

    if (data.contacts && ownerPartyId) {
      await tx.partyContact.deleteMany({ where: { brand_id: id } });
      if (data.contacts.length > 0) {
        await tx.partyContact.createMany({
          data: data.contacts.map((c) => ({
            party_id: ownerPartyId!,
            brand_id: id,
            person_name: c.contact_person,
            job_title: c.contact_role,
            phone: this.normalizeOptional(c.phone_number),
            email: this.normalizeOptional(c.email),
          })),
        });
      }
    }

    // Sync seed categories when provided explicitly from the Brand form.
    if (data.brand_category_tags !== undefined) {
      await this.syncSeedBrandCategories(tx, id, data.brand_category_tags, { id: userId, name: "system" });
    }

    const updated = await tx.brand.findUniqueOrThrow({
      where: { id },
      include: {
        scoped_contacts: true,
        links: { orderBy: { sort_order: "asc" } },
        owner: { select: { id: true, name: true, legal_name: true, address: true } },
        categories: { where: { source: "SEED" }, orderBy: { sort_order: "asc" }, include: { category: { select: { id: true, name: true } } } },
      },
    });

    // Tags and curated categories are Brand data too. Before #37, a save that
    // changed only one of these wrote master_data without any MasterDataAudit
    // record because the diff considered only name/notes/owner.
    const brandChanges = diffFields(
      {
        name: existing.name,
        notes: existing.notes,
        owner_party_id: existing.owner_party_id,
        tags: existing.tags,
        seed_categories: existing.categories.map((link) => link.category.name),
      },
      {
        name: updated.name,
        notes: updated.notes,
        owner_party_id: updated.owner_party_id,
        tags: updated.tags,
        seed_categories: updated.categories.map((link) => link.category.name),
      },
      ["name", "notes", "owner_party_id", "tags", "seed_categories"]
    );
    if (Object.keys(brandChanges).length > 0) {
      await recordAudit(tx, { entity: "Brand", entity_id: id, action: "UPDATE", actor: { id: userId, name: "system" }, changes: brandChanges });
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_VENDOR, "VENDOR", id, userId, {
      changes: { brand_name: updated.name }
    });

    return {
      ...updated,
      seed_categories: updated.categories.map((link) => link.category),
    };
  }

  /**
   * Performs a soft-delete on a vendor after orphan-safety check.
   * @throws {ActionError} VENDOR_HAS_ITEMS when vendor still owns active products.
   */
  static async deleteVendor(id: string, userId: string, tx: PrismaTransaction) {
    const productCount = await tx.sku.count({ where: { brand_id: id, deleted_at: null } });

    if (productCount > 0) {
      throw new ActionError(
        "Cannot delete vendor with associated products. Move or delete products first.",
        "VENDOR_HAS_ITEMS"
      );
    }

    const vendor = await tx.brand.update({
      where: { id },
      data: { deleted_at: new Date() }
    });

    await recordAudit(tx, { entity: "Brand", entity_id: id, action: "DELETE", actor: { id: userId, name: "system" }, changes: { name: { from: vendor.name, to: null } } });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_DELETE_VENDOR, "VENDOR", id, userId, {
      brand_name: vendor.name
    });

    return vendor;
  }

  /**
   * Returns a consolidated object of brands and products for UI suggestions/search.
   */
  static async getSuggestions(tx: PrismaTransaction) {
    const [vendors, products] = await Promise.all([
      tx.brand.findMany({
        where: { deleted_at: null },
        select: { id: true, name: true },
        orderBy: { name: "asc" }
      }),
      tx.sku.findMany({
        where: {
          deleted_at: null,
          status: { in: [LibraryItemStatus.PENDING, LibraryItemStatus.APPROVED].map(catalogStatusToSkuStatus) },
        },
        include: { brand: true, categories: { include: { category: true } } },
        orderBy: { created_at: "desc" }
      })
    ]);

    return {
      // v2 has no separate "commercial brand" text column — the relational
      // Brand.name IS the commercial brand now, so this collapses to the
      // same list as `vendors` (kept as its own key for caller compatibility).
      brands: vendors.map((v) => ({ id: v.name, name: v.name })),
      vendors: vendors.map((vendor) => ({
        id: vendor.id,
        name: vendor.name,
      })),
      products: products.map(m => {
        const sku = m.code || "";
        const name = m.name || "";

        let label = "";
        if (sku && name) label = `[${sku}] - ${name}`;
        else label = sku || name || "Unnamed Product";

        return {
          id: m.id,
          name: label,
          brand: m.brand?.name ?? "",
          vendor: m.brand?.name ?? "",
          catalog_category: m.categories[0]?.category.name ?? "",
          metadata: {
            catalog_sku: sku,
            catalog_product_name: name,
            catalog_motif: (m.spec as Record<string, unknown> | null)?.motif ?? null,
            catalog_color: (m.spec as Record<string, unknown> | null)?.color ?? null,
            catalog_finishing: (m.spec as Record<string, unknown> | null)?.finishing ?? null,
            catalog_dimensions: this.buildDimDisplay(
              m.dim_length?.toString(), m.dim_width?.toString(), m.dim_height?.toString(), m.dim_unit
            ) ?? "",
            catalog_reference_url: null,
          }
        };
      })
    };
  }

  /** Reads product catalog list with optional filters. */
  static async getAllProducts(
    tx: PrismaTransaction,
    filters?: {
      category?: string;
      vendorId?: string;
      search?: string;
      hasPhysicalOnly?: boolean;
      status?: LibraryItemStatus | LibraryItemStatus[];
      type?: ProductType;
      tags?: string[];
      /**
       * "BQ readiness". `SkuPrice.price_net` and `.unit` are both NON-NULL in
       * the schema, so "has a usable price" reduces to "has at least one
       * current price row with a non-empty unit" — expressible in SQL, which
       * is why this lives here rather than as a post-filter in the caller.
       */
      price?: "ALL" | "READY" | "INCOMPLETE";
      /** Whether at least one current SkuPrice exists, regardless of unit. */
      pricePresence?: "ALL" | "WITH" | "WITHOUT";
      /** Core SKU identity completeness; code and brand stay optional by Q7. */
      completeness?: "ALL" | "COMPLETE" | "INCOMPLETE";
      sort?: "sku" | "newest" | "updated" | "name" | "brand";
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ items: ProductCatalogWithRelations[]; total: number }> {
    const where: Prisma.SkuWhereInput = {
      deleted_at: null
    };
    const and: Prisma.SkuWhereInput[] = [];

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      where.status = { in: statuses.map(catalogStatusToSkuStatus) };
    }
    if (filters?.category && filters.category !== "all") {
      and.push({
        categories: {
          some: { category: { kind: "PRODUCT", name: filters.category } },
        },
      });
    }
    if (filters?.vendorId) where.brand_id = filters.vendorId;
    if (filters?.type) where.kind = filters.type === "fixture" ? "FIXTURE" : "MATERIAL";

    // A priced SKU is one with a current price row carrying a unit. `some` and
    // `none` are exact complements here, so READY + INCOMPLETE always partition
    // the full set — the two counts add up to the unfiltered total.
    if (filters?.price === "READY") {
      and.push({ prices: { some: { is_current: true, unit: { not: "" } } } });
    } else if (filters?.price === "INCOMPLETE") {
      and.push({ prices: { none: { is_current: true, unit: { not: "" } } } });
    }

    if (filters?.pricePresence === "WITH") {
      and.push({ prices: { some: { is_current: true } } });
    } else if (filters?.pricePresence === "WITHOUT") {
      and.push({ prices: { none: { is_current: true } } });
    }

    const completeSku: Prisma.SkuWhereInput = {
      AND: [
        { name: { not: "" } },
        { base_unit: { not: "" } },
        {
          categories: {
            some: { category: { kind: "PRODUCT", is_active: true } },
          },
        },
      ],
    };
    if (filters?.completeness === "COMPLETE") {
      and.push(completeSku);
    } else if (filters?.completeness === "INCOMPLETE") {
      and.push({ NOT: completeSku });
    }

    if (filters?.search) {
      const search = filters.search;
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { brand: { name: { contains: search, mode: "insensitive" } } },
        { code: { contains: search, mode: "insensitive" } },
        {
          categories: {
            some: {
              category: {
                kind: "PRODUCT",
                name: { contains: search, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }
    if (filters?.hasPhysicalOnly) {
      where.samples = { some: { deleted_at: null } };
    }
    if (filters?.tags?.length) {
      and.push({
        categories: {
          some: { category: { kind: "PRODUCT", name: { in: filters.tags } } },
        },
      });
    }
    if (and.length > 0) where.AND = and;

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 24;
    const skip = (page - 1) * pageSize;

    const orderBy: Prisma.SkuOrderByWithRelationInput[] =
      filters?.sort === "newest"
        ? [{ created_at: "desc" }]
        : filters?.sort === "updated"
          ? [{ updated_at: { sort: "desc", nulls: "last" } }, { created_at: "desc" }]
          : filters?.sort === "name"
            ? [{ name: "asc" }, { code: "asc" }]
            : filters?.sort === "brand"
              ? [{ brand: { name: "asc" } }, { code: "asc" }]
              : [{ code: { sort: "asc", nulls: "last" } }, { created_at: "desc" }];

    const [items, total] = await Promise.all([
      tx.sku.findMany({
        where,
        include: SKU_FULL_INCLUDE,
        orderBy,
        skip,
        take: pageSize,
      }),
      tx.sku.count({ where }),
    ]);

    return { items: items.map(attachDerivedCatalogFields), total };
  }

  /** Retrieves a single product by ID. */
  static async getProductById(tx: PrismaTransaction, id: string) {
    const sku = await tx.sku.findUnique({
      where: { id, deleted_at: null },
      include: SKU_FULL_INCLUDE,
    });
    return sku ? attachDerivedCatalogFields(sku) : null;
  }

  /**
   * Returns unique values for finishing and category-tag facets.
   * Categories are a real table now, so this reads `Category` directly
   * instead of DISTINCT-ing a free-text array column.
   */
  static async getProductMetadata(tx: PrismaTransaction) {
    const [liveSkus, categories] = await Promise.all([
      tx.sku.findMany({
        select: { spec: true },
        where: { deleted_at: null },
      }),
      tx.category.findMany({
        where: { kind: "PRODUCT", is_active: true },
        orderBy: { name: "asc" },
        select: { name: true },
      }),
    ]);

    const finishings = Array.from(
      new Set(
        liveSkus
          .map((s) => (s.spec as Record<string, unknown> | null)?.finishing)
          .filter((v): v is string => typeof v === "string" && v.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    return {
      subCategories: [],
      finishings,
      tags: categories.map((c) => c.name),
    };
  }

  /**
   * Returns which categories each brand actually carries.
   * A brand is not bound to one category — Taco supplies HPL and SPC alike.
   */
  static async getBrandCategoryCoverage(tx: PrismaTransaction) {
    const rows = await tx.skuCategory.findMany({
      where: { sku: { deleted_at: null } },
      include: { category: { select: { name: true } }, sku: { select: { brand_id: true, kind: true } } },
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.sku.brand_id) continue;
      const section: ProductType = row.sku.kind === "MATERIAL" ? "material" : "fixture";
      const key = `${row.sku.brand_id}::${section}::${row.category.name}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const byVendor = new Map<
      string,
      { category: string; section: ProductType; count: number }[]
    >();
    for (const [key, count] of counts) {
      const [vendorId, section, category] = key.split("::");
      const list = byVendor.get(vendorId) ?? [];
      list.push({ category, section: section as ProductType, count });
      byVendor.set(vendorId, list);
    }

    return Object.fromEntries(
      Array.from(byVendor.entries()).map(([vendorId, list]) => [
        vendorId,
        list.sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
      ])
    );
  }

  /** Physical sample inventory, queried in its own right. */
  static async getPhysicalSamples(
    tx: PrismaTransaction,
    filters?: {
      search?: string;
      status?: CatalogSampleStatus;
      vendorId?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const where: Prisma.SampleWhereInput = {
      deleted_at: null,
      sku: { deleted_at: null, ...(filters?.vendorId ? { brand_id: filters.vendorId } : {}) },
    };

    if (filters?.status) where.status = catalogSampleStatusToV2(filters.status);

    if (filters?.search) {
      const search = filters.search;
      where.OR = [
        { rack_number: { contains: search, mode: "insensitive" } },
        { box_number: { contains: search, mode: "insensitive" } },
        { borrower_name: { contains: search, mode: "insensitive" } },
        { sku: { code: { contains: search, mode: "insensitive" } } },
        { sku: { name: { contains: search, mode: "insensitive" } } },
        { sku: { brand: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 50;

    const [items, total] = await Promise.all([
      tx.sample.findMany({
        where,
        include: {
          sku: { include: { brand: { include: { scoped_contacts: true } } } },
        },
        orderBy: [{ rack_number: "asc" }, { box_number: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tx.sample.count({ where }),
    ]);

    return { items, total };
  }

  /**
   * Resolves a vendor by brand name, reviving it if soft-deleted, creating
   * it (with a derived slug) otherwise.
   */
  private static async resolveVendor(vendorName: string, userId: string, tx: PrismaTransaction) {
    const normalized = vendorName.trim().toUpperCase();
    if (!normalized) throw new ActionError("Vendor name is required", "VENDOR_REQUIRED");

    const existing = await tx.brand.findFirst({
      where: { name: { equals: normalized, mode: "insensitive" } }
    });

    if (existing) {
      if (existing.deleted_at) {
        await tx.brand.update({ where: { id: existing.id }, data: { deleted_at: null } });
        await recordAudit(tx, { entity: "Brand", entity_id: existing.id, action: "RESTORE", actor: { id: userId, name: "system" } });
        await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_VENDOR, "VENDOR", existing.id, userId, {
          brand_name: existing.name,
          action: "REVIVE_VIA_RESOLUTION"
        });
      }
      return existing.id;
    }

    const vendor = await tx.brand.create({
      data: { name: normalized, slug: this.slugify(normalized) },
    });

    await recordAudit(tx, { entity: "Brand", entity_id: vendor.id, action: "CREATE", actor: { id: userId, name: "system" } });
    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_VENDOR, "VENDOR", vendor.id, userId, {
      brand_name: normalized,
      source: "RESOLUTION_AUTO_CREATE"
    });

    return vendor.id;
  }

  /** @returns Created product with relations. */
  static async createProduct(data: ProductCatalogInput, userId: string, tx: PrismaTransaction): Promise<ProductCatalogWithRelations> {
    // Brandless is legal (Q7 / X23), so an empty brand must NOT reach
    // `resolveVendor` — that function throws "Vendor name is required" on an
    // empty string, which is how the 2026-08-11 "brand is optional" change was
    // only half done: the form let it through and the server rejected it two
    // frames later with a message about a field the user had deliberately left
    // blank.
    const typedBrandName = (data.vendor_name || "").trim();
    const resolvedVendorId =
      data.brand_id ||
      (typedBrandName ? await this.resolveVendor(typedBrandName, userId, tx) : null);
    const categoryTags = this.normalizeCategoryTags(data);
    const catalogSku = data.catalog_sku.trim();
    const productName = data.catalog_product_name.trim();
    // Validated with the SAME rule the Pricing page uses. Before this the
    // material dialog could attach any Party id at all: one form checked the
    // party's categories, the other did not, and the one that did not was the
    // one most people use.
    const supplierId = await assertPriceSourceParty(tx, data.supplier_party_id);

    const isApproved = (data.catalog_status || LibraryItemStatus.PENDING) === LibraryItemStatus.APPROVED;

    await this.assertValidProduct(
      {
        ...data,
        catalog_type: data.catalog_type || ProductType.material,
        catalog_tags: categoryTags,
        brand_id: resolvedVendorId || undefined,
      },
      isApproved ? "CATALOG" : "SNAPSHOT"
    );
    await this.assertCatalogTypeRules(data.catalog_type || ProductType.material, {}, false);

    // Brand is OPTIONAL (Q7). Excel Table 2 column D says so outright —
    // "apabila tidak ada brand bisa dikosongkan" — and `03_invariants.sql`
    // creates two indexes (`Sku_slug_nobrand_uniq`, `Sku_code_nobrand_uniq`)
    // whose only purpose is guarding brandless rows. Rejecting them here made
    // both indexes unreachable and forced generic stock ("plywood 9mm") to be
    // filed under a junk brand named "-".
    if (resolvedVendorId) {
      const vendor = await tx.brand.findUnique({ where: { id: resolvedVendorId } });
      if (!vendor || vendor.deleted_at) throw new ActionError("Invalid brand.", "VENDOR_REQUIRED");
    }

    const slug = this.slugify(productName || catalogSku || "product");

    // Mirrors the partial unique indexes exactly, brandless case included.
    // Doing the check here as well as in the database is not redundancy: the
    // index produces a Postgres error string, this produces a message the
    // person filling the form can act on.
    const existingDup = await tx.sku.findFirst({
      where: {
        brand_id: resolvedVendorId || null,
        deleted_at: null,
        ...(catalogSku ? { code: { equals: catalogSku, mode: "insensitive" } } : { slug }),
      }
    });
    if (existingDup) {
      throw new ActionError(
        resolvedVendorId
          ? "A product with the same code and brand already exists."
          : "A brandless product with the same name already exists.",
        'DUPLICATE_PRODUCT'
      );
    }

    const dimP = this.parseDecimal(data.catalog_dimension_p);
    const dimL = this.parseDecimal(data.catalog_dimension_l);
    const dimT = this.parseDecimal(data.catalog_dimension_t);
    const dimUnit = data.catalog_dimension_unit || "cm";
    const spec = this.buildSpec(data);
    const priceUnit = this.normalizeOptional(data.catalog_price_unit);

    // B5 (2026-08-18): create + audit now go through `createSkuCore` — see
    // its doc comment for what it guarantees. Media and samples stay as
    // nested creates in the same write (still one insert, still one
    // transaction); `include` only needs to be wide enough to read back
    // `product.samples` below, which is what `createSkuCore` already returns.
    const product = await createSkuCore(
      tx,
      {
        data: {
          brand_id: resolvedVendorId || null,
          code: catalogSku || null,
          name: productName,
          kind: (data.catalog_type || ProductType.material) === "fixture" ? "FIXTURE" : "MATERIAL",
          status: catalogStatusToSkuStatus(data.catalog_status || LibraryItemStatus.PENDING),
          spec: Object.keys(spec).length > 0 ? (spec as Prisma.InputJsonValue) : Prisma.JsonNull,
          dim_length: dimP ?? undefined,
          dim_width: dimL ?? undefined,
          dim_height: dimT ?? undefined,
          dim_unit: dimUnit,
          dim_display: this.buildDimDisplay(data.catalog_dimension_p, data.catalog_dimension_l, data.catalog_dimension_t, dimUnit),
          base_unit: priceUnit || "pcs",
          media: { create: this.buildMediaCreates(data) },
          // Price is deliberately NOT created inline any more. It goes through
          // `recordSkuPrice` below, in this same transaction, so that exactly one
          // piece of code decides what a price row means — see
          // `subapps/master-data/services/sku-price-service.ts`. The inline
          // version defaulted `price_net` to 0 and never touched the supplier.
          samples: data.samples ? {
            create: data.samples.map(s => ({
              rack_number: s.catalog_rack_number,
              box_number: s.catalog_box_number,
              notes: this.normalizeOptional(s.catalog_notes),
              status: catalogSampleStatusToV2(s.catalog_status),
              borrower_name: this.normalizeOptional(s.current_borrower_name),
            }))
          } : undefined,
        },
        slugSeed: productName || catalogSku || "product",
        // Category tags are attached below via `upsertSkuCategories`, which
        // already applies the same is-first-primary rule for the full
        // multi-tag list AND reconciles an existing sku's tags — a job
        // `createSkuCore` has no reason to duplicate for a brand-new row.
      },
      { id: userId, name: "system" }
    );

    // Same transaction as the SKU insert. Before this, the dialog saved the
    // material in one action and its price in a second, so a failure in the
    // second left a material saved without the price the user had just typed —
    // the UI even had a toast for it ("Material tersimpan, tetapi harga gagal
    // disimpan"). A torn write with an apology attached is still a torn write.
    await recordSkuPrice(tx, {
      sku_id: product.id,
      supplier_party_id: supplierId,
      price: data.catalog_price ?? null,
      unit: priceUnit,
      notes: null,
    }, { id: userId, name: "" });

    // Only when there IS a brand. `BrandCategory` answers "which categories
    // does this brand cover" for the Library's brand cards; a brandless SKU has
    // no card to feed, and passing a null brand id here would throw.
    if (resolvedVendorId) {
      await this.upsertBrandCategories(tx, resolvedVendorId, categoryTags, { id: userId, name: "" });
    }
    await this.upsertSkuCategories(tx, product.id, categoryTags, { id: userId, name: "" });

    if (product.samples.length > 0) {
      await Promise.all(product.samples.map(sample =>
        this.logSampleAction(tx, {
          sample_id: sample.id,
          action: SampleAction.IN,
          notes: "Initial inventory registration",
          userId
        })
      ));
    }

    const withCategories = await tx.sku.findUniqueOrThrow({ where: { id: product.id }, include: SKU_FULL_INCLUDE });
    return attachDerivedCatalogFields(withCategories);
  }

  /**
   * Updates one product and writes audit log.
   * Registers schedule category only when status becomes APPROVED.
   */
  static async updateProduct(id: string, data: Partial<ProductCatalogInput>, userId: string, tx: PrismaTransaction, role?: Role): Promise<ProductCatalogWithRelations> {
    await this.assertEditable(tx, id, role);

    const existing = await tx.sku.findUnique({
      where: { id },
      // Every current price, not just one: the update below has to find the row
      // belonging to the supplier being edited, and `take: 1` would hand it a
      // different shop's row as often as not.
      include: { samples: { select: { id: true } }, prices: { where: { is_current: true } } },
    });
    if (!existing) throw new ActionError("Product not found", "NOT_FOUND");
    const preExistingSampleIds = new Set(existing.samples.map((s) => s.id));
    const nextCategoryTags =
      data.catalog_category !== undefined ||
      data.catalog_sub_category !== undefined ||
      data.catalog_tags !== undefined
        ? this.normalizeCategoryTags(data)
        : undefined;
    const nextCatalogSku = data.catalog_sku?.trim() ?? existing.code ?? "";
    const nextProductName = data.catalog_product_name?.trim() ?? existing.name;

    if (!nextProductName) {
      throw new ActionError(
        "Vendor, brand, SKU, dan nama produk wajib diisi.",
        "MATERIAL_IDENTITY_REQUIRED"
      );
    }

    // STRICT: Type Immutability
    if (data.catalog_type !== undefined) {
      const nextKind = data.catalog_type === "fixture" ? "FIXTURE" : "MATERIAL";
      const existingIsFixture = existing.kind !== "MATERIAL";
      if ((nextKind === "FIXTURE") !== existingIsFixture) {
        throw new ActionError("Product TYPE is immutable after creation.", "IMMUTABILITY_VIOLATION");
      }
    }

    // NON-DESTRUCTIVE sample reconciliation — same rules as v1:
    //   undefined  -> samples untouched.
    //   []         -> samples untouched.
    //   with id    -> update in place; movement history survives.
    //   without id -> create a new row.
    const incomingSamples = data.samples?.filter(
      (s) => s.catalog_rack_number?.trim() || s.catalog_box_number?.trim() || s.id
    );

    const sampleOps = incomingSamples && incomingSamples.length > 0 ? {
      update: incomingSamples
        .filter((s): s is typeof s & { id: string } => !!s.id)
        .map((s) => ({
          where: { id: s.id },
          data: {
            rack_number: s.catalog_rack_number,
            box_number: s.catalog_box_number,
            notes: this.normalizeOptional(s.catalog_notes),
            ...(s.catalog_status !== undefined ? { status: catalogSampleStatusToV2(s.catalog_status) } : {}),
            ...(s.current_borrower_name !== undefined
              ? { borrower_name: this.normalizeOptional(s.current_borrower_name) }
              : {}),
          },
        })),
      create: incomingSamples
        .filter((s) => !s.id)
        .map((s) => ({
          rack_number: s.catalog_rack_number,
          box_number: s.catalog_box_number,
          notes: this.normalizeOptional(s.catalog_notes),
          status: catalogSampleStatusToV2(s.catalog_status),
          borrower_name: this.normalizeOptional(s.current_borrower_name),
        })),
    } : undefined;

    const dimP = data.catalog_dimension_p !== undefined ? this.parseDecimal(data.catalog_dimension_p) : undefined;
    const dimL = data.catalog_dimension_l !== undefined ? this.parseDecimal(data.catalog_dimension_l) : undefined;
    const dimT = data.catalog_dimension_t !== undefined ? this.parseDecimal(data.catalog_dimension_t) : undefined;
    const dimChanged = data.catalog_dimension_p !== undefined || data.catalog_dimension_l !== undefined ||
      data.catalog_dimension_t !== undefined || data.catalog_dimension_unit !== undefined;
    const specChanged = data.catalog_pattern !== undefined || data.catalog_motif !== undefined ||
      data.catalog_color !== undefined || data.catalog_finishing !== undefined || data.catalog_metadata !== undefined;
    const nextSpec = specChanged ? this.buildSpec(data, existing.spec as Record<string, unknown> | null) : undefined;

    const updated = await tx.sku.update({
      where: { id },
      data: {
        ...(data.brand_id ? { brand_id: data.brand_id } : {}),
        ...(data.catalog_sku !== undefined ? { code: nextCatalogSku || null } : {}),
        ...(data.catalog_product_name !== undefined ? { name: nextProductName } : {}),
        ...(data.catalog_type !== undefined ? { kind: data.catalog_type === "fixture" ? "FIXTURE" : "MATERIAL" } : {}),
        ...(nextSpec ? { spec: nextSpec as Prisma.InputJsonValue } : {}),
        ...(dimP !== undefined ? { dim_length: dimP ?? null } : {}),
        ...(dimL !== undefined ? { dim_width: dimL ?? null } : {}),
        ...(dimT !== undefined ? { dim_height: dimT ?? null } : {}),
        ...(data.catalog_dimension_unit !== undefined ? { dim_unit: data.catalog_dimension_unit } : {}),
        ...(dimChanged ? {
          dim_display: this.buildDimDisplay(
            data.catalog_dimension_p, data.catalog_dimension_l, data.catalog_dimension_t, data.catalog_dimension_unit
          ),
        } : {}),
        ...(data.catalog_status !== undefined ? { status: catalogStatusToSkuStatus(data.catalog_status) } : {}),
        // BQ costing fields
        ...(data.usage_unit !== undefined ? { usage_unit: data.usage_unit || null } : {}),
        ...(data.purchase_unit !== undefined ? { purchase_unit: data.purchase_unit || null } : {}),
        ...(data.conversion !== undefined ? { conversion: data.conversion ?? null } : {}),
        ...(data.default_waste_pct !== undefined ? { default_waste_pct: data.default_waste_pct ?? null } : {}),
        ...(data.minimum_order !== undefined ? { minimum_order: data.minimum_order ?? null } : {}),
        ...(data.rounding_increment !== undefined ? { rounding_increment: data.rounding_increment ?? null } : {}),
        ...(data.preferred_supplier_party_id !== undefined ? { preferred_supplier_party_id: data.preferred_supplier_party_id || null } : {}),
        samples: sampleOps,
      },
      include: SKU_FULL_INCLUDE
    });

    await recordAudit(tx, { entity: "Sku", entity_id: updated.id, action: "UPDATE", actor: { id: userId, name: "system" } });

    // Images: replace whichever kinds were explicitly sent in this call.
    const mediaTouched = this.buildMediaCreates(data);
    const mediaKindsProvided = ([
      ["catalog_image_url", MediaKind.IMAGE],
      ["catalog_image_thumbnail_url", MediaKind.THUMBNAIL],
      ["catalog_image_original_url", MediaKind.ORIGINAL],
      ["catalog_reference_url", MediaKind.REFERENCE],
      ["catalog_folder_url", MediaKind.FOLDER],
    ] as const).filter(([field]) => data[field as keyof ProductCatalogInput] !== undefined).map(([, kind]) => kind);
    if (mediaKindsProvided.length > 0) {
      await tx.skuMedia.deleteMany({ where: { sku_id: id, kind: { in: mediaKindsProvided } } });
      const toCreate = mediaTouched.filter((m) => mediaKindsProvided.includes(m.kind));
      if (toCreate.length > 0) {
        await tx.skuMedia.createMany({ data: toCreate.map((m) => ({ ...m, sku_id: id })) });
      }
    }

    // Price: v2 models pricing as history, so a changed price becomes a new
    // current row rather than an in-place edit of the old one.
    //
    // Scoped to ONE supplier. The previous version demoted every current row
    // for the SKU — harmless while every price was supplier-less, and quietly
    // destructive the moment suppliers became real: editing one shop's quote
    // would have retired every other shop's, leaving the comparison the split
    // between `Sku` and `SkuPrice` exists to enable with a single row in it.
    if (
      data.catalog_price !== undefined ||
      data.catalog_price_unit !== undefined ||
      data.supplier_party_id !== undefined
    ) {
      const supplierId = data.supplier_party_id !== undefined
        ? await assertPriceSourceParty(tx, data.supplier_party_id)
        : (existing.prices[0]?.supplier_party_id ?? null);
      // Carry forward only from the row being replaced — the one belonging to
      // the same supplier. Falling back to `prices[0]` here would copy a
      // different shop's number into this shop's offer.
      const currentPrice = existing.prices.find((p) => p.supplier_party_id === supplierId);

      const nextPrice = {
        price: data.catalog_price !== undefined
          ? (data.catalog_price ?? null)
          : (currentPrice?.price_net != null ? Number(currentPrice.price_net) : null),
        unit: this.normalizeOptional(data.catalog_price_unit) || currentPrice?.unit || null,
        supplier_party_id: supplierId,
      };

      // Only supersede when the offer actually moved.
      //
      // Without this guard every material save wrote a fresh price row, because
      // the dialog always sends every price field — including the ones it
      // just loaded unchanged. Correcting a typo in a product name would retire
      // the current price and file an identical one behind it, so a week of
      // spelling fixes buries the real price changes under duplicates. The
      // Pricing page already had this guard; the material dialog did not.
      const offerMoved =
        !currentPrice ||
        isOfferChange(
          {
            price_net: currentPrice.price_net,
            unit: currentPrice.unit,
            supplier_party_id: currentPrice.supplier_party_id,
          },
          nextPrice
        );

      if (offerMoved) {
        await recordSkuPrice(tx, {
          sku_id: id,
          ...nextPrice,
          notes: currentPrice?.notes ?? null,
        }, { id: userId, name: "" });
      }
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.CATALOG_UPDATE, "Sku", updated.id, userId, {
      changes: data
    });

    if (sampleOps) {
      const touchedIds = new Set(
        (incomingSamples ?? []).map((s) => s.id).filter((v): v is string => !!v)
      );
      const samplesToLog = updated.samples.filter(
        (s) => touchedIds.has(s.id) || !preExistingSampleIds.has(s.id)
      );

      await Promise.all(samplesToLog.map(sample => {
        const isNew = !preExistingSampleIds.has(sample.id);
        return this.logSampleAction(tx, {
          sample_id: sample.id,
          action: SampleAction.IN,
          notes: isNew
            ? `Sample registered: Rack ${sample.rack_number}, Box ${sample.box_number}`
            : `Inventory updated: Rack ${sample.rack_number}, Box ${sample.box_number}`,
          userId
        });
      }));
    }

    if (nextCategoryTags) {
      await this.upsertBrandCategories(tx, updated.brand_id ?? "", nextCategoryTags, { id: userId, name: "" });
      await this.upsertSkuCategories(tx, updated.id, nextCategoryTags, { id: userId, name: "" });
    }

    const refetched = await tx.sku.findUniqueOrThrow({ where: { id: updated.id }, include: SKU_FULL_INCLUDE });

    // CRITICAL: Category registration ONLY on APPROVE
    if (data.catalog_status === LibraryItemStatus.APPROVED) {
      const primaryCategory = refetched.categories.find((c) => c.is_primary)?.category.name ?? refetched.categories[0]?.category.name;
      await this.assertValidProduct(
        { ...data, catalog_sku: refetched.code ?? "", catalog_product_name: refetched.name, catalog_brand: refetched.brand?.name ?? "", catalog_type: data.catalog_type || ProductType.material, catalog_category: primaryCategory } as ProductCatalogInput,
        "CATALOG"
      );

      await settingsService.executeUpsertScheduleCategoryConfig(tx, {
        section: data.catalog_type || ProductType.material,
        category: primaryCategory,
        userId,
      });
    }

    return attachDerivedCatalogFields(refetched);
  }

  /** Consolidates duplicate brands/vendors into one target vendor. */
  static async mergeVendors(tx: PrismaTransaction, sourceId: string, targetId: string, userId: string) {
    if (sourceId === targetId) throw new ActionError("Cannot merge vendor into itself.", "MERGE_ERROR");

    const [source, target] = await Promise.all([
      tx.brand.findUnique({ where: { id: sourceId } }),
      tx.brand.findUnique({ where: { id: targetId } })
    ]);

    if (!source || !target) throw new ActionError("One or both vendors not found.", "NOT_FOUND");

    const skusToMove = await tx.sku.findMany({ where: { brand_id: sourceId }, select: { id: true } });

    await tx.sku.updateMany({
      where: { brand_id: sourceId },
      data: { brand_id: targetId }
    });

    for (const sku of skusToMove) {
      await recordAudit(tx, { entity: "Sku", entity_id: sku.id, action: "UPDATE", actor: { id: userId, name: "system" }, changes: { brand_id: { from: sourceId, to: targetId } } });
    }

    await tx.brand.update({
      where: { id: sourceId },
      data: { deleted_at: new Date() }
    });

    await recordAudit(tx, { entity: "Brand", entity_id: sourceId, action: "DELETE", actor: { id: userId, name: "system" }, changes: { name: { from: source.name, to: null } } });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_MERGE_VENDOR, "VENDOR", targetId, userId, {
      merged_source_id: sourceId,
      source_brand: source.name,
      target_brand: target.name
    });
  }

  /** Performs a soft-delete on one product catalog item. */
  static async deleteProduct(id: string, userId: string, tx: PrismaTransaction) {
    const product = await tx.sku.update({
      where: { id },
      data: { deleted_at: new Date() },
      include: { brand: true }
    });

    await recordAudit(tx, { entity: "Sku", entity_id: id, action: "DELETE", actor: { id: userId, name: "system" }, changes: { code: { from: product.code, to: null } } });

    await insertAuditLog(tx, AUDIT_ACTIONS.CATALOG_DELETE, "Sku", id, userId, {
      catalog_sku: product.code,
      brand: product.brand?.name ?? null,
    });

    return product;
  }

  /**
   * Soft-deletes ONE physical sample. This is the only sanctioned removal
   * path — `updateProduct` deliberately never deletes samples.
   */
  static async deletePhysicalSample(tx: PrismaTransaction, sampleId: string, userId: string) {
    const sample = await tx.sample.findUnique({
      where: { id: sampleId },
      include: { sku: { select: { id: true, code: true } } },
    });

    if (!sample) throw new ActionError("Sample not found", "NOT_FOUND");
    if (sample.deleted_at) return sample;

    if (sample.status !== "AVAILABLE") {
      throw new ActionError(
        `Sample is currently ${sample.status.toLowerCase().replace(/_/g, " ")}${
          sample.borrower_name ? ` (${sample.borrower_name})` : ""
        }. Check it back in before removing it.`,
        "SAMPLE_NOT_AVAILABLE"
      );
    }

    const removed = await tx.sample.update({
      where: { id: sampleId },
      data: { deleted_at: new Date() },
    });

    await recordAudit(tx, { entity: "Sample", entity_id: sampleId, action: "DELETE", actor: { id: userId, name: "system" }, changes: { rack_number: sample.rack_number, box_number: sample.box_number } });

    await this.logSampleAction(tx, {
      sample_id: sampleId,
      action: SampleAction.OUT,
      notes: `Sample removed from inventory (Rack ${sample.rack_number}, Box ${sample.box_number})`,
      userId,
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.CATALOG_UPDATE, "PhysicalSample", sampleId, userId, {
      action: "SOFT_DELETE_SAMPLE",
      material_id: sample.sku.id,
      catalog_sku: sample.sku.code,
    });

    return removed;
  }

  /** Returns available schedule categories from settings service. */
  static async getCategories(tx: PrismaTransaction) {
    return settingsService.getAvailableCategories(tx);
  }

  private static async resolveBrandNameSnapshot(tx: PrismaTransaction, brandId?: string | null) {
    if (!brandId) return null;
    const brand = await tx.brand.findUnique({ where: { id: brandId }, select: { name: true } });
    return brand?.name ?? null;
  }

  private static async resolveSkuNameSnapshot(tx: PrismaTransaction, skuId?: string | null) {
    if (!skuId) return null;
    const sku = await tx.sku.findUnique({ where: { id: skuId }, select: { name: true } });
    return sku?.name ?? null;
  }

  /**
   * Master Data terputus dari StudioFlow (M5) — `ProjectProductRequest.brand_id`
   * / `sku_id` bukan lagi relasi Prisma. `brand`/`sku` di sini dibangun dari
   * `brand_name_snapshot`/`sku_name_snapshot` yang dibekukan saat request
   * dibuat/diterima, BUKAN dari pembacaan langsung ke master_data.
   */
  private static withRequestSnapshot<T extends { brand_id: string | null; brand_name_snapshot: string | null; sku_id: string | null; sku_name_snapshot: string | null }>(
    request: T
  ) {
    return {
      ...request,
      brand: request.brand_id ? { id: request.brand_id, name: request.brand_name_snapshot ?? "(unknown)" } : null,
      sku: request.sku_id ? { id: request.sku_id, name: request.sku_name_snapshot ?? "(unknown)" } : null,
    };
  }

  static async getAllProductRequests(tx: PrismaTransaction) {
    const requests = await tx.projectProductRequest.findMany({
      include: { requested_by: true, project: true, schedule_entry: true, schedule_option: true },
      orderBy: { created_at: "desc" },
    });
    return requests.map((r) => this.withRequestSnapshot(r));
  }

  static async getProjectProductRequests(projectId: string, tx: PrismaTransaction) {
    const requests = await tx.projectProductRequest.findMany({
      where: { project_id: projectId },
      include: { requested_by: true, project: true, schedule_entry: true, schedule_option: true },
      orderBy: { created_at: "desc" },
    });
    return requests.map((r) => this.withRequestSnapshot(r));
  }

  /** Creates a project product request. Strictly project-local. */
  static async createProjectProductRequest(
    data: ProjectProductRequestInput,
    userId: string,
    tx: PrismaTransaction
  ) {
    const [brandName, skuName] = await Promise.all([
      this.resolveBrandNameSnapshot(tx, data.brand_id),
      this.resolveSkuNameSnapshot(tx, data.sku_id),
    ]);

    const request = await tx.projectProductRequest.create({
      data: {
        project_id: data.project_id,
        brand_id: data.brand_id || undefined,
        brand_name_snapshot: brandName,
        sku_id: data.sku_id || undefined,
        sku_name_snapshot: skuName,
        schedule_entry_id: data.schedule_entry_id || undefined,
        schedule_option_id: data.schedule_option_id || undefined,
        custom_product_name: this.normalizeOptional(data.custom_product_name),
        reference_url: this.normalizeOptional(data.reference_url),
        requested_by_id: userId,
        status: ProductRequestStatus.REQUESTED,
        area_location: this.normalizeOptional(data.area_location),
        is_scheduled: data.is_scheduled ?? true,
        notes: this.normalizeOptional(data.notes),
      },
      include: { requested_by: true, project: true, schedule_entry: true, schedule_option: true },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_REQUEST, "ProjectProductRequest", request.id, userId, {
      project_id: data.project_id,
      brand_id: data.brand_id,
      sku_id: data.sku_id
    });

    return this.withRequestSnapshot(request);
  }

  /**
   * §6.14 / PLAN-LIBRARY-BRAND-FIRST.md §9 step 6. The ONLY place a Sku is
   * allowed to originate from a StudioFlow-initiated request: the item has
   * physically arrived, so its article code can honestly be read off the box.
   */
  static async receiveProjectProductRequest(
    input: {
      request_id: string;
      catalog_sku: string;
      catalog_product_name: string;
      catalog_color?: string | null;
      catalog_motif?: string | null;
      catalog_finishing?: string | null;
      rack_number: string;
      box_number: string;
      quantity?: number;
      location_note?: string | null;
    },
    userId: string,
    tx: PrismaTransaction
  ) {
    const request = await tx.projectProductRequest.findUniqueOrThrow({
      where: { id: input.request_id },
      select: { id: true, brand_id: true, project_id: true },
    });
    if (!request.brand_id) {
      throw new ActionError(
        "This request has no Brand — a sample can't be received without a relational brand.",
        "BRAND_REQUIRED"
      );
    }

    const brand = await tx.brand.findUnique({ where: { id: request.brand_id } });
    if (!brand || brand.deleted_at) {
      throw new ActionError("Invalid brand.", "VENDOR_REQUIRED");
    }

    const catalogSku = input.catalog_sku.trim();
    const catalogProductName = input.catalog_product_name.trim();
    if (!catalogSku || !catalogProductName) {
      throw new ActionError("SKU and product name are required when receiving a sample.", "VALIDATION_FAILED");
    }

    let sku = await tx.sku.findFirst({
      where: { brand_id: brand.id, code: { equals: catalogSku, mode: "insensitive" }, deleted_at: null },
    });

    if (!sku) {
      const spec = this.buildSpec({
        catalog_color: input.catalog_color ?? undefined,
        catalog_motif: input.catalog_motif ?? undefined,
        catalog_finishing: input.catalog_finishing ?? undefined,
      });
      // B5 (2026-08-18): same createSkuCore consolidation as the main "add
      // material" path above — see its doc comment. This site used to call
      // BOTH recordAudit AND insertAuditLog for the same creation, double
      // writing the event (once correctly to master_data.MasterDataAudit,
      // once wrongly to studioflow.AuditLog) — that second call is gone now.
      sku = await createSkuCore(
        tx,
        {
          data: {
            brand_id: brand.id,
            code: catalogSku,
            name: catalogProductName,
            base_unit: "pcs",
            spec: Object.keys(spec).length > 0 ? (spec as Prisma.InputJsonValue) : Prisma.JsonNull,
            status: "DRAFT",
          },
          slugSeed: catalogProductName || catalogSku,
        },
        { id: userId, name: "system" }
      );
    }

    const sample = await tx.sample.create({
      data: {
        sku_id: sku.id,
        rack_number: input.rack_number.trim(),
        box_number: input.box_number.trim(),
        location_note: this.normalizeOptional(input.location_note),
        quantity: input.quantity ?? 1,
        status: "AVAILABLE",
      },
    });
    await this.logSampleAction(tx, { sample_id: sample.id, action: SampleAction.IN, userId, notes: `Diterima dari ProjectProductRequest ${request.id}` });

    const updatedRequest = await tx.projectProductRequest.update({
      where: { id: request.id },
      data: {
        sku_id: sku.id,
        sku_name_snapshot: sku.name,
        linked_sample_id: sample.id,
        status: ProductRequestStatus.RECEIVED,
      },
      include: { requested_by: true, project: true, schedule_entry: true, schedule_option: true },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_REQUEST_STATUS, "ProjectProductRequest", request.id, userId, {
      status: ProductRequestStatus.RECEIVED,
      project_id: request.project_id,
      sku_id: sku.id,
      sample_id: sample.id,
    });

    return this.withRequestSnapshot(updatedRequest);
  }

  /** Updates request status and optional receiver name, then writes audit log. */
  static async updateProjectProductRequestStatus(
    id: string,
    status: ProductRequestStatus,
    staffName: string | null,
    userId: string,
    tx: PrismaTransaction
  ) {
    const req = await tx.projectProductRequest.update({
      where: { id },
      data: {
        status: status,
        staff_name_override: this.normalizeOptional(staffName),
      },
      include: { requested_by: true, project: true, schedule_entry: true, schedule_option: true },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_REQUEST_STATUS, "ProjectProductRequest", id, userId, {
      status,
      project_id: req.project_id,
      staff_name: staffName || "Logged-in User",
    });

    return this.withRequestSnapshot(req);
  }

  /** Deletes one project material request and writes audit log. */
  static async deleteProjectProductRequest(id: string, userId: string, tx: PrismaTransaction) {
    const request = await tx.projectProductRequest.delete({
      where: { id },
      include: { requested_by: true, project: true, schedule_entry: true, schedule_option: true },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_DELETE_REQUEST, "ProjectProductRequest", id, userId, {
      project_id: request.project_id,
      sku_id: request.sku_id
    });

    return this.withRequestSnapshot(request);
  }
}
