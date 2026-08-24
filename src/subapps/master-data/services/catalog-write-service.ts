import { Prisma, ProductType, SampleAction, SampleStatus, MediaKind, Role } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { settingsService } from "@/lib/services/settings-service";
import {
  ProductCatalogInput,
  LibraryVendorInput,
  ProductCatalogValidationSchema,
  CatalogApprovalValidationSchema,
  ProductCatalogWithRelations,
  attachDerivedCatalogFields,
  catalogStatusToSkuStatus,
  LibraryItemStatus,
  type CatalogSampleStatus,
  type LibraryVendor,
} from "@/subapps/master-data/contracts/catalog";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit/types";
import { isOfferChange, recordSkuPrice } from "@/subapps/master-data/services/sku-price-service";
import { recordAudit, diffFields } from "@/subapps/master-data/services/audit-service";
import { assertPriceSourceParty } from "@/subapps/master-data/services/party-role-service";
import { resolveCategoryPath } from "@/subapps/master-data/services/category-tree-service";
import { dropAncestorTags, productParentFor } from "@/subapps/master-data/services/category-tree-rules";
import { slugify } from "@/subapps/master-data/lib/slug";
import { createSkuCore } from "@/subapps/master-data/services/sku-core-service";
import { normalizeSearchText, trimOrNull } from "@/core/utilities/normalize";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";

const SKU_FULL_INCLUDE = {
  brand: {
    include: {
      scoped_contacts: true,
      links: true,
      owner: { select: { legal_name: true, address: true } },
    },
  },
  samples: { where: { deleted_at: null } },
  media: true,
  prices: {
    orderBy: [{ price_net: "asc" }, { updated_at: "desc" }, { created_at: "desc" }],
    include: { supplier: { select: { id: true, name: true } } },
  },
  categories: { include: { category: true } },
} satisfies Prisma.SkuInclude;

function catalogSampleStatusToV2(status?: CatalogSampleStatus): SampleStatus {
  return status ? (status as SampleStatus) : SampleStatus.AVAILABLE;
}

export class CatalogWriteService {
  private static slugify(value: string) {
    return slugify(value);
  }

  private static slugifyTag(tag: string) {
    return slugify(tag);
  }

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

    await tx.skuCategory.deleteMany({
      where: { sku_id: skuId, category_id: { notIn: keptCategoryIds } },
    });
  }

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

    await tx.brandCategory.deleteMany({
      where: {
        brand_id: brandId,
        source: "DERIVED_FROM_SKU",
        category_id: { notIn: keptIds },
      },
    });
  }

  private static async syncSeedBrandCategories(
    tx: PrismaTransaction,
    brandId: string,
    tags: string[],
    actor?: { id?: string | null; name: string }
  ): Promise<void> {
    const keptIds: string[] = [];
    const seen = new Set<string>();
    const uniqueTags: string[] = [];

    for (const raw of tags) {
      const tag = raw.trim();
      if (!tag) continue;
      const key = normalizeSearchText(tag);
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

    await tx.brandCategory.deleteMany({
      where: { brand_id: brandId, source: "SEED", category_id: { notIn: keptIds } },
    });
  }

  private static normalizeCategoryTags(data: {
    catalog_category?: string | null;
    catalog_sub_category?: string | null;
    catalog_tags?: string[] | null;
  }) {
    const raw = [data.catalog_category, ...(data.catalog_tags ?? []), data.catalog_sub_category];
    const seen = new Set<string>();
    const tags: string[] = [];

    for (const value of raw) {
      const normalized = value?.trim();
      if (!normalized) continue;
      const key = normalizeSearchText(normalized);
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

  private static buildSpec(
    data: Partial<ProductCatalogInput>,
    existingSpec?: Record<string, unknown> | null
  ): Record<string, unknown> {
    const spec: Record<string, unknown> = { ...(existingSpec ?? {}) };
    if (data.catalog_pattern !== undefined) spec.pattern = trimOrNull(data.catalog_pattern) ?? undefined;
    if (data.catalog_motif !== undefined) spec.motif = trimOrNull(data.catalog_motif) ?? undefined;
    if (data.catalog_color !== undefined) spec.color = trimOrNull(data.catalog_color) ?? undefined;
    if (data.catalog_finishing !== undefined) spec.finishing = trimOrNull(data.catalog_finishing) ?? undefined;
    if (data.catalog_metadata !== undefined) Object.assign(spec, data.catalog_metadata ?? {});
    for (const key of Object.keys(spec)) {
      if (spec[key] === undefined) delete spec[key];
    }
    return spec;
  }

  private static buildMediaCreates(data: Partial<ProductCatalogInput>) {
    const entries: { kind: MediaKind; url: string }[] = [];
    const push = (kind: MediaKind, url?: string | null) => {
      const v = trimOrNull(url);
      if (v) entries.push({ kind, url: v });
    };
    push(MediaKind.IMAGE, data.catalog_image_url);
    push(MediaKind.THUMBNAIL, data.catalog_image_thumbnail_url);
    push(MediaKind.ORIGINAL, data.catalog_image_original_url);
    push(MediaKind.REFERENCE, data.catalog_reference_url);
    push(MediaKind.FOLDER, data.catalog_folder_url);
    return entries;
  }

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
        date_return: data.date_return,
      },
    });
  }

  static async assertEditable(tx: PrismaTransaction, productId: string, role?: Role) {
    const product = await tx.sku.findUnique({
      where: { id: productId },
    });

    if (product?.status !== "ACTIVE") return;
    if (role && hasPermission(role, PERMISSION.LIBRARY_EDIT_ITEM)) return;

    throw new ActionError(
      "APPROVED global items are read-only for your role.",
      "CATALOG_LOCKED"
    );
  }

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

    const placeholders = ["N/A", "UNKNOWN", "PENDING", "-", "—", "[RESERVED]"];
    const isPlaceholder = (val?: string | null) => !val || placeholders.includes(val.trim().toUpperCase());
    const skuInvalid = isPlaceholder(data.catalog_sku);
    const nameInvalid = isPlaceholder(data.catalog_product_name);

    if (skuInvalid && nameInvalid) {
      throw new ActionError(
        "Product requires at least one valid identity (SKU or Name). Placeholders in both are FORBIDDEN.",
        "PLACEHOLDER_VIOLATION"
      );
    }
  }

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
        if (!data.qty || data.qty <= 0) {
          throw new ActionError("Fixtures in projects REQUIRE a quantity > 0.", "TYPE_RULE_VIOLATION");
        }
        if (!data.location?.trim()) {
          throw new ActionError("Fixtures in projects REQUIRE a location.", "TYPE_RULE_VIOLATION");
        }
      }
    }
  }

  private static async resolveVendor(name: string, userId: string, tx: PrismaTransaction): Promise<string> {
    const normalized = name.trim();
    if (!normalized) throw new ActionError("Vendor name is required", "VALIDATION_ERROR");

    const existing = await tx.brand.findFirst({
      where: { name: { equals: normalized, mode: "insensitive" } },
    });

    if (existing) {
      if (existing.deleted_at) {
        await tx.brand.update({ where: { id: existing.id }, data: { deleted_at: null } });
        await recordAudit(tx, { entity: "Brand", entity_id: existing.id, action: "RESTORE", actor: { id: userId, name: "system" } });
        await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_UPDATE_VENDOR, "VENDOR", existing.id, userId, {
          brand_name: existing.name,
          action: "REVIVE_VIA_RESOLUTION",
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
      source: "RESOLUTION_AUTO_CREATE",
    });

    return vendor.id;
  }

  static async createVendor(data: LibraryVendorInput, userId: string, tx: PrismaTransaction): Promise<LibraryVendor> {
    let ownerPartyId = data.company_id || null;

    if (!ownerPartyId && (data.legal_name || data.address || data.contacts.length > 0)) {
      const party = await tx.party.create({
        data: {
          name: data.brand_name,
          slug: this.slugify(data.brand_name),
          legal_name: trimOrNull(data.legal_name),
          address: trimOrNull(data.address),
        },
      });
      ownerPartyId = party.id;
      await recordAudit(tx, { entity: "Party", entity_id: party.id, action: "CREATE", actor: { id: userId, name: "system" } });
    }

    const vendor = await tx.brand.create({
      data: {
        name: data.brand_name,
        slug: this.slugify(data.brand_name),
        notes: trimOrNull(data.notes),
        owner_party_id: ownerPartyId,
        tags: [...new Set((data.tags ?? []).map((t) => t.trim()).filter(Boolean))],
        suppliers: {
          create: [...new Set(data.supplier_party_ids ?? [])].map((party_id) => ({ party_id })),
        },
        links: {
          create: (data.links ?? [])
            .filter((l) => l.url.trim().length > 0)
            .map((l, i) => ({
              kind: l.kind,
              url: l.url.trim(),
              label: trimOrNull(l.label),
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
          phone: trimOrNull(c.phone_number),
          email: trimOrNull(c.email),
        })),
      });
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_VENDOR, "VENDOR", vendor.id, userId, {
      brand_name: vendor.name,
    });

    if (data.brand_category_tags && data.brand_category_tags.length > 0) {
      await this.syncSeedBrandCategories(tx, vendor.id, data.brand_category_tags, { id: userId, name: "system" });
    }

    const created = await tx.brand.findUniqueOrThrow({
      where: { id: vendor.id },
      include: {
        scoped_contacts: true,
        links: true,
        owner: { select: { id: true, name: true, legal_name: true, address: true } },
        categories: {
          where: { source: "SEED" },
          orderBy: { sort_order: "asc" },
          include: { category: { select: { id: true, name: true } } },
        },
      },
    });
    return {
      ...created,
      seed_categories: created.categories.map((link) => link.category),
    };
  }

  static async updateVendor(id: string, data: Partial<LibraryVendorInput>, userId: string, tx: PrismaTransaction): Promise<LibraryVendor> {
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
          legal_name: trimOrNull(data.legal_name),
          address: trimOrNull(data.address),
        },
      });
      ownerPartyId = party.id;
      await recordAudit(tx, { entity: "Party", entity_id: party.id, action: "CREATE", actor: { id: userId, name: "system" } });
    } else if (ownerPartyId && (data.legal_name !== undefined || data.address !== undefined)) {
      await tx.party.update({
        where: { id: ownerPartyId },
        data: {
          ...(data.legal_name !== undefined ? { legal_name: trimOrNull(data.legal_name) } : {}),
          ...(data.address !== undefined ? { address: trimOrNull(data.address) } : {}),
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
        label: trimOrNull(link.label),
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
      ...(data.notes !== undefined ? { notes: trimOrNull(data.notes) } : {}),
      ...(ownerPartyId !== existing.owner_party_id ? { owner: ownerPartyId ? { connect: { id: ownerPartyId } } : { disconnect: true } } : {}),
      ...(data.tags !== undefined
        ? { tags: [...new Set(data.tags.map((tag) => tag.trim()).filter(Boolean))] }
        : {}),
    };
    if (Object.keys(brandData).length > 0) {
      await tx.brand.update({ where: { id }, data: brandData });
    }

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
            phone: trimOrNull(c.phone_number),
            email: trimOrNull(c.email),
          })),
        });
      }
    }

    if (data.brand_category_tags !== undefined) {
      await this.syncSeedBrandCategories(tx, id, data.brand_category_tags, { id: userId, name: "system" });
    }

    const updated = await tx.brand.findUniqueOrThrow({
      where: { id },
      include: {
        scoped_contacts: true,
        links: { orderBy: { sort_order: "asc" } },
        owner: { select: { id: true, name: true, legal_name: true, address: true } },
        categories: {
          where: { source: "SEED" },
          orderBy: { sort_order: "asc" },
          include: { category: { select: { id: true, name: true } } },
        },
      },
    });

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
      changes: { brand_name: updated.name },
    });

    return {
      ...updated,
      seed_categories: updated.categories.map((link) => link.category),
    };
  }

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
      data: { deleted_at: new Date() },
    });

    await recordAudit(tx, { entity: "Brand", entity_id: id, action: "DELETE", actor: { id: userId, name: "system" }, changes: { name: { from: vendor.name, to: null } } });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_DELETE_VENDOR, "VENDOR", id, userId, {
      brand_name: vendor.name,
    });

    return vendor;
  }

  static async createProduct(
    data: ProductCatalogInput,
    userId: string,
    tx: PrismaTransaction
  ): Promise<ProductCatalogWithRelations> {
    const typedBrandName = (data.vendor_name || "").trim();
    const resolvedVendorId =
      data.brand_id ||
      (typedBrandName ? await this.resolveVendor(typedBrandName, userId, tx) : null);
    const categoryTags = this.normalizeCategoryTags(data);
    const catalogSku = data.catalog_sku.trim();
    const productName = data.catalog_product_name.trim();
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

    if (resolvedVendorId) {
      const vendor = await tx.brand.findUnique({ where: { id: resolvedVendorId } });
      if (!vendor || vendor.deleted_at) throw new ActionError("Invalid brand.", "VENDOR_REQUIRED");
    }

    const slug = this.slugify(productName || catalogSku || "product");
    const existingDup = await tx.sku.findFirst({
      where: {
        brand_id: resolvedVendorId || null,
        deleted_at: null,
        ...(catalogSku ? { code: { equals: catalogSku, mode: "insensitive" } } : { slug }),
      },
    });
    if (existingDup) {
      throw new ActionError(
        resolvedVendorId
          ? "A product with the same code and brand already exists."
          : "A brandless product with the same name already exists.",
        "DUPLICATE_PRODUCT"
      );
    }

    const dimP = this.parseDecimal(data.catalog_dimension_p);
    const dimL = this.parseDecimal(data.catalog_dimension_l);
    const dimT = this.parseDecimal(data.catalog_dimension_t);
    const dimUnit = data.catalog_dimension_unit || "cm";
    const spec = this.buildSpec(data);
    const priceUnit = trimOrNull(data.catalog_price_unit);

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
          samples: data.samples
            ? {
                create: data.samples.map((s) => ({
                  rack_number: s.catalog_rack_number,
                  box_number: s.catalog_box_number,
                  notes: trimOrNull(s.catalog_notes),
                  status: catalogSampleStatusToV2(s.catalog_status),
                  borrower_name: trimOrNull(s.current_borrower_name),
                })),
              }
            : undefined,
        },
        slugSeed: productName || catalogSku || "product",
      },
      { id: userId, name: "system" }
    );

    await recordSkuPrice(
      tx,
      {
        sku_id: product.id,
        supplier_party_id: supplierId,
        price: data.catalog_price ?? null,
        unit: priceUnit,
        notes: null,
      },
      { id: userId, name: "" }
    );

    if (resolvedVendorId) {
      await this.upsertBrandCategories(tx, resolvedVendorId, categoryTags, { id: userId, name: "" });
    }
    await this.upsertSkuCategories(tx, product.id, categoryTags, { id: userId, name: "" });

    if (product.samples.length > 0) {
      await Promise.all(
        product.samples.map((sample) =>
          this.logSampleAction(tx, {
            sample_id: sample.id,
            action: SampleAction.IN,
            notes: "Initial inventory registration",
            userId,
          })
        )
      );
    }

    const withCategories = await tx.sku.findUniqueOrThrow({
      where: { id: product.id },
      include: SKU_FULL_INCLUDE,
    });
    return attachDerivedCatalogFields(withCategories);
  }

  static async updateProduct(
    id: string,
    data: Partial<ProductCatalogInput>,
    userId: string,
    tx: PrismaTransaction,
    role?: Role
  ): Promise<ProductCatalogWithRelations> {
    await this.assertEditable(tx, id, role);

    const existing = await tx.sku.findUnique({
      where: { id },
      include: { samples: { select: { id: true } }, prices: true, brand: true },
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
      throw new ActionError("Product name is required.", "MATERIAL_IDENTITY_REQUIRED");
    }

    if (data.catalog_type !== undefined) {
      const nextKind = data.catalog_type === "fixture" ? "FIXTURE" : "MATERIAL";
      const existingIsFixture = existing.kind !== "MATERIAL";
      if ((nextKind === "FIXTURE") !== existingIsFixture) {
        throw new ActionError("Product TYPE is immutable after creation.", "IMMUTABILITY_VIOLATION");
      }
    }

    const incomingSamples = data.samples?.filter(
      (s) => s.catalog_rack_number?.trim() || s.catalog_box_number?.trim() || s.id
    );

    const sampleOps =
      incomingSamples && incomingSamples.length > 0
        ? {
            update: incomingSamples
              .filter((s): s is typeof s & { id: string } => !!s.id)
              .map((s) => ({
                where: { id: s.id },
                data: {
                  rack_number: s.catalog_rack_number,
                  box_number: s.catalog_box_number,
                  notes: trimOrNull(s.catalog_notes),
                  ...(s.catalog_status !== undefined ? { status: catalogSampleStatusToV2(s.catalog_status) } : {}),
                  ...(s.current_borrower_name !== undefined
                    ? { borrower_name: trimOrNull(s.current_borrower_name) }
                    : {}),
                },
              })),
            create: incomingSamples
              .filter((s) => !s.id)
              .map((s) => ({
                rack_number: s.catalog_rack_number,
                box_number: s.catalog_box_number,
                notes: trimOrNull(s.catalog_notes),
                status: catalogSampleStatusToV2(s.catalog_status),
                borrower_name: trimOrNull(s.current_borrower_name),
              })),
          }
        : undefined;

    const dimP = data.catalog_dimension_p !== undefined ? this.parseDecimal(data.catalog_dimension_p) : undefined;
    const dimL = data.catalog_dimension_l !== undefined ? this.parseDecimal(data.catalog_dimension_l) : undefined;
    const dimT = data.catalog_dimension_t !== undefined ? this.parseDecimal(data.catalog_dimension_t) : undefined;
    const dimChanged =
      data.catalog_dimension_p !== undefined ||
      data.catalog_dimension_l !== undefined ||
      data.catalog_dimension_t !== undefined ||
      data.catalog_dimension_unit !== undefined;
    const specChanged =
      data.catalog_pattern !== undefined ||
      data.catalog_motif !== undefined ||
      data.catalog_color !== undefined ||
      data.catalog_finishing !== undefined ||
      data.catalog_metadata !== undefined;
    const nextSpec = specChanged ? this.buildSpec(data, existing.spec as Record<string, unknown> | null) : undefined;

    const nextBrandId =
      data.brand_id !== undefined ? data.brand_id || null : existing.brand_id;

    if (nextBrandId) {
      const vendor = await tx.brand.findUnique({ where: { id: nextBrandId } });
      if (!vendor || vendor.deleted_at) throw new ActionError("Invalid brand.", "VENDOR_REQUIRED");
    }

    const updated = await tx.sku.update({
      where: { id },
      data: {
        ...(data.brand_id !== undefined ? { brand_id: nextBrandId } : {}),
        ...(data.catalog_sku !== undefined ? { code: nextCatalogSku || null } : {}),
        ...(data.catalog_product_name !== undefined ? { name: nextProductName } : {}),
        ...(data.catalog_type !== undefined ? { kind: data.catalog_type === "fixture" ? "FIXTURE" : "MATERIAL" } : {}),
        ...(nextSpec ? { spec: nextSpec as Prisma.InputJsonValue } : {}),
        ...(dimP !== undefined ? { dim_length: dimP ?? null } : {}),
        ...(dimL !== undefined ? { dim_width: dimL ?? null } : {}),
        ...(dimT !== undefined ? { dim_height: dimT ?? null } : {}),
        ...(data.catalog_dimension_unit !== undefined ? { dim_unit: data.catalog_dimension_unit } : {}),
        ...(dimChanged
          ? {
              dim_display: this.buildDimDisplay(
                data.catalog_dimension_p,
                data.catalog_dimension_l,
                data.catalog_dimension_t,
                data.catalog_dimension_unit
              ),
            }
          : {}),
        ...(data.catalog_status !== undefined ? { status: catalogStatusToSkuStatus(data.catalog_status) } : {}),
        ...(data.usage_unit !== undefined ? { usage_unit: data.usage_unit || null } : {}),
        ...(data.purchase_unit !== undefined ? { purchase_unit: data.purchase_unit || null } : {}),
        ...(data.conversion !== undefined ? { conversion: data.conversion ?? null } : {}),
        ...(data.default_waste_pct !== undefined ? { default_waste_pct: data.default_waste_pct ?? null } : {}),
        ...(data.minimum_order !== undefined ? { minimum_order: data.minimum_order ?? null } : {}),
        ...(data.rounding_increment !== undefined ? { rounding_increment: data.rounding_increment ?? null } : {}),
        samples: sampleOps,
      },
      include: SKU_FULL_INCLUDE,
    });

    await recordAudit(tx, { entity: "Sku", entity_id: updated.id, action: "UPDATE", actor: { id: userId, name: "system" } });

    const mediaTouched = this.buildMediaCreates(data);
    const mediaKindsProvided = (
      [
        ["catalog_image_url", MediaKind.IMAGE],
        ["catalog_image_thumbnail_url", MediaKind.THUMBNAIL],
        ["catalog_image_original_url", MediaKind.ORIGINAL],
        ["catalog_reference_url", MediaKind.REFERENCE],
        ["catalog_folder_url", MediaKind.FOLDER],
      ] as const
    )
      .filter(([field]) => data[field as keyof ProductCatalogInput] !== undefined)
      .map(([, kind]) => kind);
    if (mediaKindsProvided.length > 0) {
      await tx.skuMedia.deleteMany({ where: { sku_id: id, kind: { in: mediaKindsProvided } } });
      const toCreate = mediaTouched.filter((m) => mediaKindsProvided.includes(m.kind));
      if (toCreate.length > 0) {
        await tx.skuMedia.createMany({ data: toCreate.map((m) => ({ ...m, sku_id: id })) });
      }
    }

    if (
      data.catalog_price !== undefined ||
      data.catalog_price_unit !== undefined ||
      data.supplier_party_id !== undefined
    ) {
      const supplierId =
        data.supplier_party_id !== undefined
          ? await assertPriceSourceParty(tx, data.supplier_party_id)
          : (existing.prices[0]?.supplier_party_id ?? null);
      const currentPrice = existing.prices.find((p) => p.supplier_party_id === supplierId);

      const nextPrice = {
        price:
          data.catalog_price !== undefined
            ? (data.catalog_price ?? null)
            : (currentPrice?.price_net != null ? Number(currentPrice.price_net) : null),
        unit: trimOrNull(data.catalog_price_unit) || currentPrice?.unit || null,
        supplier_party_id: supplierId,
      };

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
        await recordSkuPrice(
          tx,
          {
            sku_id: id,
            ...nextPrice,
            notes: currentPrice?.notes ?? null,
          },
          { id: userId, name: "" }
        );
      }
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.CATALOG_UPDATE, "Sku", updated.id, userId, {
      changes: data,
    });

    if (sampleOps) {
      const touchedIds = new Set(
        (incomingSamples ?? []).map((s) => s.id).filter((v): v is string => !!v)
      );
      const samplesToLog = updated.samples.filter(
        (s) => touchedIds.has(s.id) || !preExistingSampleIds.has(s.id)
      );

      await Promise.all(
        samplesToLog.map((sample) => {
          const isNew = !preExistingSampleIds.has(sample.id);
          return this.logSampleAction(tx, {
            sample_id: sample.id,
            action: SampleAction.IN,
            notes: isNew
              ? `Sample registered: Rack ${sample.rack_number}, Box ${sample.box_number}`
              : `Inventory updated: Rack ${sample.rack_number}, Box ${sample.box_number}`,
            userId,
          });
        })
      );
    }

    if (nextCategoryTags) {
      if (updated.brand_id) {
        await this.upsertBrandCategories(tx, updated.brand_id, nextCategoryTags, { id: userId, name: "" });
      }
      await this.upsertSkuCategories(tx, updated.id, nextCategoryTags, { id: userId, name: "" });
    }

    const refetched = await tx.sku.findUniqueOrThrow({
      where: { id: updated.id },
      include: SKU_FULL_INCLUDE,
    });

    if (data.catalog_status === LibraryItemStatus.APPROVED) {
      const primaryCategory =
        refetched.categories.find((c) => c.is_primary)?.category.name ??
        refetched.categories[0]?.category.name;
      await this.assertValidProduct(
        {
          ...data,
          catalog_sku: refetched.code ?? "",
          catalog_product_name: refetched.name,
          catalog_brand: refetched.brand?.name ?? "",
          catalog_type: data.catalog_type || ProductType.material,
          catalog_category: primaryCategory,
        } as ProductCatalogInput,
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
}
