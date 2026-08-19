import { ProjectScheduleEntry, ProjectScheduleOption, ProductType } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit/types";


import { LibraryService } from "@/extensions/library/services/library-service";
import { ScheduleSnapshotSchema, type ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
import { createScheduleOption, updateScheduleOptionSnapshot } from "./schedule-option-writer";
export { deriveScheduleSpecFields } from "./schedule-spec-fields";

export type SourceOrigin = "library" | "manual" | "gsheets_import" | "sketchup_plugin";

export interface ScheduleManualDataInput {
  catalog_product_name: string;
  catalog_brand: string;
  schedule_category?: string;
  catalog_sub_category?: string | null;
  catalog_motif?: string | null;
  catalog_color?: string | null;
  catalog_finishing?: string | null;
  catalog_dimension_p?: string | null;
  catalog_dimension_l?: string | null;
  catalog_dimension_t?: string | null;
  catalog_dimension_unit?: string | null;
  catalog_structured_tags?: string[];
  catalog_image_url?: string | null;
  catalog_reference_url?: string | null;
  catalog_price?: number | null;
  catalog_notes?: string | null;
  catalog_contact_name?: string | null;
  catalog_contact_phone?: string | null;
  catalog_contact_email?: string | null;
  catalog_has_sample?: boolean | null;
  catalog_initials_type?: string | null;
  schedule_location?: string | null;
  source_external_id?: string | null;
  catalog_metadata?: unknown;
}

export interface ScheduleCatalogCreateInput {
  catalog_sku: string;
  catalog_brand: string;
  catalog_product_name: string;
  catalog_sub_category?: string | null;
  catalog_motif?: string | null;
  catalog_color?: string | null;
  catalog_finishing?: string | null;
  catalog_dimension_p?: string | null;
  catalog_dimension_l?: string | null;
  catalog_dimension_t?: string | null;
  catalog_dimension_unit?: string | null;
  catalog_structured_tags?: string[];
  catalog_image_url?: string | null;
  catalog_reference_url?: string | null;
  catalog_price?: number | null;
  catalog_notes?: string | null;
  catalog_dimension?: string | null;
  catalog_type?: ProductType;
}



/**
 * Helper to calculate initials_type for snapshots.
 * Based on motif / color / finishing as per SSOT v1.5.
 */
function calculateInitialsType(data: { catalog_motif?: string | null; catalog_color?: string | null; catalog_finishing?: string | null }) {
  return Array.from(new Set([data.catalog_motif, data.catalog_color, data.catalog_finishing])).filter(Boolean).join(" / ") || null;
}

/**
 * Builds an immutable snapshot from a ProductCatalog item or manual data
 */
export async function buildScheduleSnapshot(
  tx: PrismaTransaction,
  catalogId?: string | null,
  manualData?: Partial<ScheduleSnapshot>,
  sourceOrigin?: SourceOrigin,
): Promise<ScheduleSnapshot> {
  if (catalogId) {
    // Master Data terputus dari StudioFlow (M5, 2026-08-10): Schedule no
    // longer joins master_data.Sku/Brand directly. LibraryService.getProductById
    // already loads the v2 Sku (brand/media/prices/categories) and derives the
    // legacy `catalog_*` display fields this function was written against, so
    // reuse that instead of re-deriving them here — this is a one-time read at
    // selection time to freeze into the snapshot, not an ongoing join.
    const item = await LibraryService.getProductById(tx, catalogId);

    if (!item) throw new ActionError("Catalog item not found", "ITEM_NOT_FOUND");

    const defaultContact = item.brand?.scoped_contacts?.[0];
    const requestedCategory = manualData?.schedule_category?.trim();
    const scheduleCategory =
      item.catalog_tags.find(
        (tag) => tag.toLocaleUpperCase("id-ID") === requestedCategory?.toLocaleUpperCase("id-ID")
      ) ??
      item.catalog_tags[0];
    if (!scheduleCategory) {
      throw new ActionError(
        "Material has no category tag and cannot be scheduled.",
        "CATEGORY_REQUIRED"
      );
    }

    return {
      snapshot_source_kind: "catalog",
      snapshot_source_origin: sourceOrigin || "library",
      snapshot_source_external_id: null,
      product_catalog_id: item.id,
      catalog_type: item.catalog_type,
      // The snapshot keeps writing flat strings — it is frozen JSON that every
      // existing project already reads. They are now resolved from the Category,
      // Product and Brand rows rather than copied from text columns.
      schedule_category: scheduleCategory,
      catalog_sub_category: null,
      catalog_product_name: item.catalog_product_name,
      catalog_brand: item.catalog_brand,
      catalog_vendor_id: item.brand_id,
      catalog_vendor_name: item.brand?.name ?? null,
      catalog_initials_type: calculateInitialsType({
        catalog_motif: item.catalog_motif,
        catalog_color: item.catalog_color,
        catalog_finishing: item.catalog_finishing
      }),
      catalog_price: item.catalog_price ?? null,
      catalog_notes: null,
      catalog_image_url: item.catalog_image_url,
      catalog_reference_url: item.catalog_reference_url,
      catalog_contact_name: defaultContact?.person_name ?? null,
      catalog_contact_phone: defaultContact?.phone ?? null,
      catalog_contact_email: defaultContact?.email ?? null,
      catalog_has_sample: item.samples?.length ? true : false,
      specs: {
        catalog_sku: item.catalog_sku,
        catalog_motif: item.catalog_motif,
        catalog_structured_tags: item.catalog_tags,
        catalog_dimensions: `${item.catalog_dimension_p ?? ""} x ${item.catalog_dimension_l ?? ""} x ${item.catalog_dimension_t ?? ""} ${item.catalog_dimension_unit ?? "cm"}`,
        catalog_dimension_p: item.catalog_dimension_p,
        catalog_dimension_l: item.catalog_dimension_l,
        catalog_dimension_t: item.catalog_dimension_t,
        catalog_dimension_unit: item.catalog_dimension_unit,
        catalog_color: item.catalog_color,
        catalog_finishing: item.catalog_finishing,
        catalog_reference_url: item.catalog_reference_url,
        catalog_metadata: (item.catalog_metadata as Record<string, unknown>) || {},
      },
      snapshot_source_payload: undefined,
      snapshot_captured_at: new Date().toISOString(),
    };
  }

  // Manual fallback
  return {
    snapshot_source_kind: "manual",
    snapshot_source_origin: sourceOrigin || manualData?.snapshot_source_origin || "manual",
    snapshot_source_external_id: manualData?.snapshot_source_external_id ?? null,
    product_catalog_id: null,
    catalog_type: manualData?.catalog_type || ProductType.material,
    schedule_category: manualData?.schedule_category ?? "",
    catalog_sub_category: manualData?.catalog_sub_category ?? null,
    catalog_product_name: manualData?.catalog_product_name || "Manual Item",
    catalog_brand: manualData?.catalog_brand || "Custom",
    catalog_initials_type: manualData?.catalog_initials_type || calculateInitialsType({
      catalog_motif: manualData?.specs?.catalog_motif,
      catalog_color: manualData?.specs?.catalog_color,
      catalog_finishing: manualData?.specs?.catalog_finishing
    }),
    catalog_price: manualData?.catalog_price ?? null,
    catalog_notes: manualData?.catalog_notes ?? null,
    catalog_image_url: manualData?.catalog_image_url || null,
    catalog_reference_url: manualData?.catalog_reference_url || null,
    catalog_contact_name: manualData?.catalog_contact_name ?? null,
    catalog_contact_phone: manualData?.catalog_contact_phone ?? null,
    catalog_contact_email: manualData?.catalog_contact_email ?? null,
    catalog_has_sample: manualData?.catalog_has_sample ?? false,
    specs: {
      catalog_sku: manualData?.specs?.catalog_sku || "Generic",
      catalog_motif: manualData?.specs?.catalog_motif ?? null,
      catalog_structured_tags: manualData?.specs?.catalog_structured_tags ?? [],
      catalog_dimensions: manualData?.specs?.catalog_dimensions || "N/A",
      catalog_dimension_p: manualData?.specs?.catalog_dimension_p ?? null,
      catalog_dimension_l: manualData?.specs?.catalog_dimension_l ?? null,
      catalog_dimension_t: manualData?.specs?.catalog_dimension_t ?? null,
      catalog_dimension_unit: manualData?.specs?.catalog_dimension_unit ?? null,
      catalog_color: manualData?.specs?.catalog_color ?? null,
      catalog_finishing: manualData?.specs?.catalog_finishing ?? null,
      catalog_reference_url: manualData?.specs?.catalog_reference_url ?? null,
      catalog_metadata: (manualData?.specs?.catalog_metadata as Record<string, unknown>) || {},
    },
    snapshot_source_payload: manualData?.snapshot_source_payload || undefined,
    snapshot_captured_at: new Date().toISOString(),
  };
}


// deriveScheduleSpecFields is defined in ./schedule-spec-fields and re-exported
// at the top of this file. The implementation was moved there to ensure it
// is the single source of truth used exclusively via schedule-option-writer.

async function resolveCatalogItemForMode(
  tx: PrismaTransaction,
  category: string,
  mode: "catalog" | "manual",
  userId: string,
  catalogItemId?: string | null,
  catalogCreateData?: ScheduleCatalogCreateInput
) {
  if (mode === "catalog") {
    return catalogItemId ?? null;
  }

  // Pure manual entries don't have a catalog link (yet)
  if (mode === "manual") {
    return null;
  }

  return null;
}

/**
 * Uniqueness Guard: Prevents duplicate catalog items within a single project schedule.
 */
async function checkDuplicateProduct(
  tx: PrismaTransaction,
  projectId: string,
  mode: "catalog" | "manual" | "reserve",
  catalogId?: string | null,
  snapshot?: Partial<ScheduleSnapshot>
) {
  if (mode === "reserve") return;

  if (mode === "catalog" && catalogId) {
    const duplicate = await tx.projectScheduleOption.findFirst({
      where: {
        entry: { project_id: projectId },
        sku_id: catalogId,
      },
    });
    if (duplicate) {
      throw new ActionError("Duplicate product in project schedule.", "DUPLICATE_PRODUCT");
    }
  }

  if (mode === "manual" && snapshot) {
    const sku = snapshot.specs?.catalog_sku?.trim();
    const color = snapshot.specs?.catalog_color?.trim();
    const brand = snapshot.catalog_brand?.trim();

    // Smart Input Guard: Use SKU as primary, fallback to Color if SKU is missing
    const effectiveSku = sku || color;
    if (!effectiveSku) {
      throw new ActionError(
        "At least one identifier (SKU or Color) is required."
      );
    }

    if (effectiveSku && brand) {
      // For manual, uniqueness is defined by composite of catalog_sku/color AND catalog_brand (case-insensitive)
      const existingOptions = await tx.projectScheduleOption.findMany({
        where: { entry: { project_id: projectId } },
        select: { data_snapshot: true }
      });

      const isDuplicate = existingOptions.some(opt => {
        const s = opt.data_snapshot as ScheduleSnapshot | null;
        if (!s) return false;
        
        const optSku = s.specs?.catalog_sku?.trim();
        const optColor = s.specs?.catalog_color?.trim();
        const optBrand = s.catalog_brand?.trim();
        
        const optEffectiveSku = optSku || optColor;
        
        return optEffectiveSku?.toLowerCase() === effectiveSku.toLowerCase() &&
               optBrand?.toLowerCase() === brand.toLowerCase();
      });

      if (isDuplicate) {
        throw new ActionError("Duplicate product (with same SKU/Color & Brand) already exists in this project.", "DUPLICATE_PRODUCT");
      }
    }
  }
}




export class ScheduleService {
  /**
   * Ownership Validation: Verifies that an entry or option belongs to the specified project.
   */
  static async validateOwnership(tx: PrismaTransaction, projectId: string, entryId?: string, optionId?: string) {
    if (entryId) {
      const entry = await tx.projectScheduleEntry.findUnique({
        where: { id: entryId },
        select: { project_id: true }
      });
      if (!entry || entry.project_id !== projectId) {
        throw new ActionError("Ownership Validation Failed: Entry does not belong to this project", "UNAUTHORIZED");
      }
    }

    if (optionId) {
      const option = await tx.projectScheduleOption.findUnique({
        where: { id: optionId },
        include: { entry: { select: { project_id: true } } }
      });
      if (!option || option.entry.project_id !== projectId) {
        throw new ActionError("Ownership Validation Failed: Option does not belong to this project", "UNAUTHORIZED");
      }
    }
  }

  /**
   * Returns a preferred prefix for a category, falling back to first 2 letters.
   */
  private static getPreferredPrefix(category: string): string {
    const map: Record<string, string> = {
      "PAINT": "PT",
    };
    return map[category.toUpperCase()] || category.substring(0, 2).toUpperCase();
  }


  /**
   * Returns active schedule templates for one section.
   * @param tx Prisma transaction client.
   * @param section material or fixture.
   * @returns Active template rows.
   */
  static async getActiveScheduleTemplates(tx: PrismaTransaction, section: ProductType) {
    return tx.scheduleTemplate.findMany({
      where: { section, is_active: true },
      orderBy: { schedule_category: "asc" },
    });
  }

  /**
   * Recurring schedule template (PLAN-AUDIT-ROADMAP-2026Q3.md §2.1 R1):
   * materializes every active `is_default_entry` category into an empty
   * "reserve" entry on `projectId` — one blank placeholder row per category,
   * for the team to fill in, exactly like a manually-created reserve slot.
   * Reuses addEntryToSchedule's normal creation path (prefix resolution,
   * sort order, code normalization) rather than inserting rows directly, so
   * a templated project's schedule is indistinguishable from a hand-built one.
   *
   * Additive and idempotent by design: a category is only materialized if
   * the project doesn't already have an entry in that section+category.
   * Safe to call both on brand-new projects and, via the explicit "Apply
   * template" action, on existing ones without duplicating anything.
   */
  static async applyDefaultTemplateEntries(
    tx: PrismaTransaction,
    projectId: string,
    userId?: string
  ): Promise<{ createdCategories: string[]; createdItems: string[]; noDefaultsConfigured: boolean }> {
    // Ambil item template aktif (baru) + kategori default (lama, is_default_entry)
    const [templateItems, defaultCategories] = await Promise.all([
      tx.scheduleTemplateItem.findMany({
        where: { is_active: true },
        orderBy: [{ section: "asc" }, { schedule_category: "asc" }, { sort_order: "asc" }],
      }),
      tx.scheduleTemplate.findMany({
        where: { is_active: true, is_default_entry: true },
        orderBy: [{ section: "asc" }, { schedule_category: "asc" }],
      }),
    ]);

    const noDefaultsConfigured = templateItems.length === 0 && defaultCategories.length === 0;
    if (noDefaultsConfigured) return { createdCategories: [], createdItems: [], noDefaultsConfigured: true };

    // Kunci idempotensi: per template_item_id (bukan per kategori)
    const existingTemplateEntries = await tx.projectScheduleEntry.findMany({
      where: { project_id: projectId, template_item_id: { not: null } },
      select: { template_item_id: true },
    });
    const appliedItemIds = new Set(existingTemplateEntries.map((e) => e.template_item_id!));

    // Kategori yang sudah ada (untuk idempotensi entri kosong / is_default_entry lama)
    const existing = await tx.projectScheduleEntry.findMany({
      where: { project_id: projectId },
      select: { section: true, schedule_category: true },
    });
    const existingCategoryKeys = new Set(
      existing.map((e) => `${e.section}:${e.schedule_category.toUpperCase()}`)
    );

    const createdItems: string[] = [];
    const createdCategories: string[] = [];

    // 1. Item template (spesifikasi sudah terisi)
    for (const item of templateItems) {
      if (appliedItemIds.has(item.id)) continue; // sudah ada di proyek ini

      await this.addEntryToSchedule(
        tx, projectId, item.schedule_category, "template",
        undefined, undefined, item.section, userId,
        undefined, // sourceOptionId
        item.id    // templateItemId
      );
      appliedItemIds.add(item.id);
      createdItems.push(`${item.section}:${item.schedule_category}:${item.id}`);
    }

    // 2. Kategori default lama (is_default_entry — entri kosong / reserve)
    //    Perilaku lama dipertahankan: lewati kategori yang sudah punya baris APA PUN
    for (const template of defaultCategories) {
      const key = `${template.section}:${template.schedule_category.toUpperCase()}`;
      if (existingCategoryKeys.has(key)) continue;
      // Juga skip kalau sudah dibuat item template untuk kategori ini di loop atas
      const hasTemplateItemInCategory = templateItems.some(
        (i) => i.section === template.section &&
                i.schedule_category.toUpperCase() === template.schedule_category.toUpperCase()
      );
      if (
        hasTemplateItemInCategory &&
        createdItems.some((c) => c.startsWith(`${template.section}:${template.schedule_category.toUpperCase()}`))
      ) {
        continue; // kategori sudah terisi oleh item template
      }
      if (existingCategoryKeys.has(key)) continue;

      await this.addEntryToSchedule(
        tx, projectId, template.schedule_category, "reserve",
        undefined, undefined, template.section, userId
      );
      existingCategoryKeys.add(key);
      createdCategories.push(`${template.section}:${template.schedule_category}`);
    }

    if (userId && (createdItems.length > 0 || createdCategories.length > 0)) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_APPLY_TEMPLATE, "Project", projectId, userId, {
        project_id: projectId,
        created_categories: createdCategories,
        created_items: createdItems.length,
      });
    }

    return { createdCategories, createdItems, noDefaultsConfigured: false };
  }

  /**
   * Fetches the complete schedule sheet payload for a project
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param section Schedule section (defaults Material).
   * @returns Grouped schedule sheet payload used by UI.
   */
  static async getProjectScheduleSheet(
    tx: PrismaTransaction,
    projectId: string,
    section: ProductType = ProductType.material
  ) {
    const [project, templates, entriesRaw] = await Promise.all([
      tx.project.findUniqueOrThrow({
        where: { id: projectId },
        select: {
          name: true,
          client_contact: true,
          address: true,
          client: { select: { name: true } },
        },
      }),
      this.getActiveScheduleTemplates(tx, section),
      tx.projectScheduleEntry.findMany({
        where: {
          project_id: projectId,
          section,
        },
        include: {
          options: {
            orderBy: { option_label: "asc" },
            include: {
              // Requests linked directly to this option (covers custom/manual products)
              product_requests: {
                where: { project_id: projectId },
                select: { status: true, project_id: true, id: true },
                orderBy: { created_at: "desc" },
                take: 1,
              }
            },
          },
          prefix_ref: true,
        },
        orderBy: { schedule_sort_order: "asc" },
      }),
    ]);

    // Master Data terputus (M5): ProjectScheduleOption.sku_id is a plain
    // column now, not a relation, so a request tied to the same catalog Sku
    // (but not directly linked to this option) can no longer be pulled via a
    // nested `include`. Fetch it separately and merge below.
    const skuIds = Array.from(
      new Set(
        entriesRaw.flatMap((entry) =>
          entry.options.map((option) => option.sku_id).filter((id): id is string => !!id)
        )
      )
    );
    const skuProductRequests = skuIds.length > 0
      ? await tx.projectProductRequest.findMany({
          where: { project_id: projectId, sku_id: { in: skuIds } },
          select: { status: true, project_id: true, sku_id: true },
          orderBy: { created_at: "desc" },
        })
      : [];
    const latestRequestBySkuId = new Map<string, { status: string; project_id: string }>();
    for (const request of skuProductRequests) {
      if (request.sku_id && !latestRequestBySkuId.has(request.sku_id)) {
        latestRequestBySkuId.set(request.sku_id, { status: request.status, project_id: request.project_id });
      }
    }

    const entries = entriesRaw.map(entry => ({
      ...entry,
      schedule_code: `${entry.schedule_prefix}-${String(entry.schedule_increment).padStart(2, "0")}`,
      options: entry.options.map((option) => ({
        ...option,
        // Replaces the old `option.sku.product_requests` nested read.
        sku_product_requests: option.sku_id && latestRequestBySkuId.has(option.sku_id)
          ? [latestRequestBySkuId.get(option.sku_id)!]
          : [],
      })),
    }));

    const byCategory = new Map<string, (typeof entries)[number][]>();
    for (const entry of entries) {
      const normalizedCat = entry.schedule_category.toUpperCase();
      const current = byCategory.get(normalizedCat) ?? [];
      current.push(entry);
      byCategory.set(normalizedCat, current);
    }

    const allPossibleCategories = [
      ...templates.map((template) => template.schedule_category.toUpperCase()),
      ...Array.from(byCategory.keys()),
    ].filter((category, index, all) => all.indexOf(category) === index);

    // Only show categories that have actual entries for THIS project.
    // allPossibleCategories (including templates) is still passed to availableCategories
    // for use in the category picker dropdown — but empty template groups should NOT render.
    const orderedCategories = allPossibleCategories.filter((category) => {
      return (byCategory.get(category)?.length ?? 0) > 0;
    });

    const groups = orderedCategories
      .map((category) => ({
        schedule_category: category,
        schedule_section: section,
        entries: byCategory.get(category) ?? [],
      }));

    return {
      section,
      project: {
        projectName: project.name,
        clientName: project.client?.name ?? null,
        clientContact: project.client_contact ?? null,
        address: project.address ?? null,
      },
      availableCategories: allPossibleCategories,
      groups,
    };
  }

  /**
   * Alias for getProjectScheduleSheet with default Material section.
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param section Optional schedule section.
   * @returns Schedule sheet payload.
   */
  static async getProjectSchedule(tx: PrismaTransaction, projectId: string, section?: ProductType) {
    return this.getProjectScheduleSheet(tx, projectId, section ?? ProductType.material);
  }

  /**
   * Fetches the complete schedule entries for a project
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param section Optional schedule section filter.
   * @returns Raw schedule entries with options.
   */
  static async getProjectScheduleEntries(tx: PrismaTransaction, projectId: string, section?: ProductType) {
    const entries = await tx.projectScheduleEntry.findMany({
      where: { 
        project_id: projectId,
        ...(section ? { section } : {})
      },
      include: {
        options: {
          orderBy: { option_label: "asc" },
        },
        prefix_ref: true,
      },
      orderBy: { schedule_sort_order: "asc" },
    });

    return entries.map(entry => ({
      ...entry,
      schedule_code: `${entry.schedule_prefix}-${String(entry.schedule_increment).padStart(2, "0")}`
    }));
  }

  /**
   * Creates a new row (Entry) and its first Option
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param category Category name.
   * @param mode Entry creation mode.
   * @param catalogItemId Optional selected catalog id.
   * @param catalogCreateData Optional new-catalog payload.
   * @param section Schedule section.
   * @param userId Optional actor user id for audit.
   * @returns Created entry and optional created catalog id.
   */
  static async addEntryToSchedule(
    tx: PrismaTransaction,
    projectId: string,
    category: string,
    mode: "catalog" | "manual" | "reserve" | "reuse" | "template",
    catalogItemId?: string | null,
    catalogCreateData?: ScheduleCatalogCreateInput & { catalog_type?: ProductType },
    section: ProductType = ProductType.material,
    userId?: string,
    /**
     * Required when mode === "reuse". Id of a ProjectScheduleOption (from
     * any project) whose snapshot becomes this new entry's first option —
     * same copy semantics as addOptionFromReuse below, just at entry-creation
     * time instead of adding an alternative to an existing entry. See
     * PLAN-AUDIT-ROADMAP-2026Q3.md §2.2 R2.
     */
    sourceOptionId?: string,
    /**
     * Required when mode === "template". Id of a ScheduleTemplateItem whose
     * frozen snapshot is copied into this entry's first option.
     */
    templateItemId?: string
  ): Promise<{ entry: ProjectScheduleEntry; createdCatalogId: string | null }> {

    const normalizedCategory = category.trim().toUpperCase();
    if (!normalizedCategory || normalizedCategory.toLowerCase() === "general") {
      throw new ActionError("Valid product category is required. 'General' is no longer supported.", "VALIDATION_FAILED");
    }

    // Validate Catalog Item if provided. Master Data terputus (M5): go
    // through LibraryService's derived catalog_* view instead of a raw
    // tx.sku.findUnique select, since the v2 Sku model no longer carries
    // catalog_type/catalog_tags columns directly.
    if (mode === "catalog" && catalogItemId) {
      const catalogItem = await LibraryService.getProductById(tx, catalogItemId);
      if (!catalogItem) {
        throw new ActionError("Product not found in catalog", "NOT_FOUND");
      }
      if (catalogItem.catalog_type !== section) {
        throw new ActionError(
          `Type mismatch: schedule section is "${section}" but product is "${catalogItem.catalog_type}"`,
          "VALIDATION_FAILED"
        );
      }
      const itemCategories = catalogItem.catalog_tags.map((tag) => tag.trim().toUpperCase());
      if (!itemCategories.includes(normalizedCategory)) {
        throw new ActionError(
          `Category mismatch: schedule category is "${normalizedCategory}" but Material tags are "${catalogItem.catalog_tags.join(", ")}"`,
          "VALIDATION_FAILED"
        );
      }
    }

    // 1. Get Prefix
    const preferredPrefix = this.getPreferredPrefix(normalizedCategory);
    let prefixDict = await tx.prefixDictionary.findFirst({
      where: {
        schedule_category: { equals: normalizedCategory, mode: "insensitive" },
        section,
      },
    });

    if (!prefixDict) {
      prefixDict = await tx.prefixDictionary.create({
        data: {
          schedule_category: normalizedCategory,
          prefix: preferredPrefix,
          section,
        },
      });
    }


    // 2. Determine sort order
    const lastEntry = await tx.projectScheduleEntry.findFirst({
      where: { project_id: projectId, section, schedule_category: normalizedCategory },
      orderBy: { schedule_sort_order: "desc" },
    });
    const nextSortOrder = (lastEntry?.schedule_sort_order ?? 0) + 1;

    const tempIncrement = -Math.floor(Math.random() * 1_000_000) - 1;

    // 3. Create Entry with temporary sequence
    const entry = await tx.projectScheduleEntry.create({
      data: {
        project_id: projectId,
        schedule_category: normalizedCategory,
        section,
        schedule_sort_order: nextSortOrder,
        index_number: tempIncrement,
        schedule_prefix: prefixDict.prefix,
        schedule_increment: tempIncrement,
        prefix_id: prefixDict.id,
        ...(mode === "template" && templateItemId ? { template_item_id: templateItemId } : {}),
      },
    });

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_CREATE_ENTRY, "ProjectScheduleEntry", entry.id, userId, {
        project_id: projectId,
        schedule_category: normalizedCategory
      });
    }

    // 4. Create first Option with snapshot
    let resolvedCatalogId = null;
    let finalSnapshot: ScheduleSnapshot;
    let isFinal = true;
    let optionStatus: "DRAFT" | "APPROVED" | "NOT_USED" = "APPROVED";

    if (mode === "reserve") {
      finalSnapshot = await buildScheduleSnapshot(tx, null, {
        schedule_category: normalizedCategory,
        catalog_product_name: "[RESERVED]",
        catalog_brand: "PENDING",
        catalog_initials_type: "-",
      }, "manual");
      isFinal = false; // Reserved slots are not final selections
      optionStatus = "DRAFT"; // Use DRAFT for reserved, not APPROVED
    } else if (mode === "manual") {
      // Manual mode creates a snapshot directly from provided data
      // It is considered APPROVED immediately in the project context
      finalSnapshot = await buildScheduleSnapshot(tx, null, (catalogCreateData as unknown as Partial<ScheduleSnapshot>), "manual");
      isFinal = true;
      optionStatus = "APPROVED";
    } else if (mode === "reuse") {
      // Cross-project reuse pool (§6.14 / PLAN-AUDIT-ROADMAP-2026Q3.md §2.2
      // R2): copy a past option's snapshot verbatim, same as
      // addOptionFromReuse below, but as the first option on a brand-new
      // entry rather than an alternative on an existing one.
      if (!sourceOptionId) {
        throw new ActionError("sourceOptionId is required for reuse mode", "VALIDATION_FAILED");
      }
      const source = await tx.projectScheduleOption.findUniqueOrThrow({
        where: { id: sourceOptionId },
        select: { sku_id: true, data_snapshot: true },
      });
      resolvedCatalogId = source.sku_id;
      finalSnapshot = {
        ...(source.data_snapshot as unknown as ScheduleSnapshot),
        snapshot_captured_at: new Date().toISOString(),
      };
      isFinal = true;
      optionStatus = "APPROVED";
    } else if (mode === "template") {
      if (!templateItemId) {
        throw new ActionError("templateItemId is required for template mode", "VALIDATION_FAILED");
      }
      const templateItem = await tx.scheduleTemplateItem.findUniqueOrThrow({
        where: { id: templateItemId },
        select: { data_snapshot: true, sku_id: true },
      });
      resolvedCatalogId = templateItem.sku_id;
      finalSnapshot = {
        ...(templateItem.data_snapshot as unknown as ScheduleSnapshot),
        schedule_category: normalizedCategory,
        snapshot_captured_at: new Date().toISOString(),
      };
      isFinal = true;
      optionStatus = "APPROVED";
    } else {
      resolvedCatalogId = await resolveCatalogItemForMode(
        tx,
        normalizedCategory,
        mode,
        userId || "SYSTEM",
        catalogItemId,
        catalogCreateData
      );
      finalSnapshot = await buildScheduleSnapshot(
        tx,
        resolvedCatalogId,
        { schedule_category: normalizedCategory },
        "library"
      );
    }

    // checkDuplicateProduct doesn't know about "reuse" or "template" — they are
    // not distinct duplicate-check strategies, just catalog/manual sourced from
    // elsewhere. Same translation addOptionFromReuse already uses below.
    const duplicateCheckMode = (mode === "reuse" || mode === "template")
      ? (resolvedCatalogId ? "catalog" : "manual")
      : mode;
    await checkDuplicateProduct(tx, projectId, duplicateCheckMode, resolvedCatalogId, finalSnapshot);

    // Validate Snapshot before save
    const validatedSnapshot = ScheduleSnapshotSchema.parse(finalSnapshot);

    await createScheduleOption(tx, {
      entry_id: entry.id,
      sku_id: resolvedCatalogId,
      option_label: "A",
      is_final: isFinal,
      status: optionStatus,
      data_snapshot: validatedSnapshot,
    });


    // 6. Normalize codes (Global category-wide uniqueness)
    await this.normalizeCodes(tx, projectId, section, normalizedCategory);

    return { entry, createdCatalogId: null };
  }

  /**
   * Adds a new alternative option to an existing entry
   * @param tx Prisma transaction client.
   * @param entryId Entry id.
   * @param mode Option creation mode.
   * @param category Category name.
   * @param catalogItemId Optional selected catalog id.
   * @param catalogCreateData Optional new-catalog payload.
   * @param userId Optional actor user id for audit.
   * @returns Created option and optional created catalog id.
   */
  static async addOptionToEntry(
    tx: PrismaTransaction,
    entryId: string,
    mode: "catalog" | "manual" | "reserve",
    category: string,
    catalogItemId?: string | null,
    catalogCreateData?: ScheduleCatalogCreateInput,
    userId?: string
  ): Promise<{ option: ProjectScheduleOption; createdCatalogId: string | null }> {
    const normalizedCategory = category.trim().toUpperCase();
    const existingOptions = await tx.projectScheduleOption.findMany({
      where: { entry_id: entryId },
      orderBy: { option_label: "asc" },
    });


    const lastLabel = existingOptions[existingOptions.length - 1]?.option_label || "@";
    const nextLabel = String.fromCharCode(lastLabel.charCodeAt(0) + 1);

    // Validate Catalog Item if provided
    if (mode === "catalog" && catalogItemId) {
      const entry = await tx.projectScheduleEntry.findUnique({
        where: { id: entryId },
        select: { section: true }
      });
      if (!entry) throw new ActionError("Entry not found", "NOT_FOUND");

      const catalogItem = await LibraryService.getProductById(tx, catalogItemId);
      if (!catalogItem) {
        throw new ActionError("Product not found in catalog", "NOT_FOUND");
      }
      if (catalogItem.catalog_type !== entry.section) {
        throw new ActionError(
          `Type mismatch: entry section is "${entry.section}" but product is "${catalogItem.catalog_type}"`,
          "VALIDATION_FAILED"
        );
      }
      const itemCategories = catalogItem.catalog_tags.map((tag) => tag.trim().toUpperCase());
      if (!itemCategories.includes(normalizedCategory)) {
        throw new ActionError(
          `Category mismatch: entry category is "${normalizedCategory}" but Material tags are "${catalogItem.catalog_tags.join(", ")}"`,
          "VALIDATION_FAILED"
        );
      }
    }

    let resolvedCatalogId = null;
    let finalSnapshot: ScheduleSnapshot;

    if (mode === "reserve") {
      finalSnapshot = await buildScheduleSnapshot(tx, null, {
        schedule_category: normalizedCategory,
        catalog_product_name: "[RESERVED]",
        catalog_brand: "PENDING",
        catalog_initials_type: "-",
      }, "manual");
    } else if (mode === "manual") {
        finalSnapshot = await buildScheduleSnapshot(tx, null, (catalogCreateData as unknown as Partial<ScheduleSnapshot>), "manual");
    } else {
      resolvedCatalogId = await resolveCatalogItemForMode(
        tx,
        category,
        mode,
        userId || "SYSTEM",
        catalogItemId,
        catalogCreateData
      );
      finalSnapshot = await buildScheduleSnapshot(
        tx,
        resolvedCatalogId,
        { schedule_category: normalizedCategory },
        "library"
      );
    }

    const entryData = await tx.projectScheduleEntry.findUniqueOrThrow({
      where: { id: entryId },
      select: { project_id: true }
    });
    await checkDuplicateProduct(tx, entryData.project_id, mode, resolvedCatalogId, finalSnapshot);

    // Validate Snapshot before save
    const validatedSnapshot = ScheduleSnapshotSchema.parse(finalSnapshot);

    const option = await createScheduleOption(tx, {
      entry_id: entryId,
      sku_id: resolvedCatalogId,
      option_label: nextLabel,
      is_final: false,
      status: "DRAFT",
      data_snapshot: validatedSnapshot,
    });
    const optionWithEntry = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: option.id },
      include: { entry: true },
    });

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_ADD_OPTION, "ProjectScheduleOption", option.id, userId, {
        project_id: optionWithEntry.entry.project_id,
        entry_id: entryId
      });
    }


    return { option: optionWithEntry, createdCatalogId: null };
  }

  /**
   * §6.14 Brand-First Library reuse pool (PLAN §3, §9 step 5). Copies a
   * PAST option's snapshot into a NEW option on a different entry — "pilih
   * satu → nilainya dikopi ke opsi baru". The source option is never
   * mutated (immutable snapshots stay immutable); this only ever produces a
   * new, independent row. sku_id is carried over only when the source was
   * catalog-linked, so a reused catalog pick still resolves back to its
   * Sku the same way addOptionToEntry's "catalog" mode would.
   */
  static async addOptionFromReuse(
    tx: PrismaTransaction,
    entryId: string,
    sourceOptionId: string,
    userId?: string
  ): Promise<{ option: ProjectScheduleOption }> {
    const source = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: sourceOptionId },
      select: { sku_id: true, data_snapshot: true },
    });

    const existingOptions = await tx.projectScheduleOption.findMany({
      where: { entry_id: entryId },
      orderBy: { option_label: "asc" },
    });
    const lastLabel = existingOptions[existingOptions.length - 1]?.option_label || "@";
    const nextLabel = String.fromCharCode(lastLabel.charCodeAt(0) + 1);

    const reusedSnapshot: ScheduleSnapshot = {
      ...(source.data_snapshot as unknown as ScheduleSnapshot),
      snapshot_captured_at: new Date().toISOString(),
    };
    const validatedSnapshot = ScheduleSnapshotSchema.parse(reusedSnapshot);

    const entryData = await tx.projectScheduleEntry.findUniqueOrThrow({
      where: { id: entryId },
      select: { project_id: true },
    });
    await checkDuplicateProduct(
      tx,
      entryData.project_id,
      source.sku_id ? "catalog" : "manual",
      source.sku_id,
      validatedSnapshot
    );

    const option = await createScheduleOption(tx, {
      entry_id: entryId,
      sku_id: source.sku_id,
      option_label: nextLabel,
      is_final: false,
      status: "DRAFT",
      data_snapshot: validatedSnapshot,
    });
    const optionWithEntry = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: option.id },
      include: { entry: true },
    });

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_ADD_OPTION, "ProjectScheduleOption", option.id, userId, {
        project_id: optionWithEntry.entry.project_id,
        entry_id: entryId,
        source: "reuse_pool",
        source_option_id: sourceOptionId,
      });
    }

    return { option: optionWithEntry };
  }

  /**
   * Deletes an option with smart logic:
   * - If the option is FINAL (active), promote a sibling (if any) to FINAL.
   * - Prevent deleting the last option in an entry.
   */
  static async smartDeleteOption(tx: PrismaTransaction, optionId: string, userId?: string) {
    const option = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: optionId },
      include: { entry: { include: { options: true } } }
    });

    const siblings = option.entry.options;
    if (siblings.length <= 1) {
      throw new ActionError("Cannot delete the last option of a schedule entry.", "DELETE_RESTRICTED");
    }

    const wasFinal = option.is_final;

    // Delete the target option
    const result = await tx.projectScheduleOption.delete({
      where: { id: optionId }
    });

    // If it was final, promote the next available sibling
    const remainingSiblings = siblings.filter(o => o.id !== optionId).sort((a, b) => a.option_label.localeCompare(b.option_label));
    if (wasFinal) {
      if (remainingSiblings.length > 0) {
        const nextPromoted = remainingSiblings[0];
        // eslint-disable-next-line no-restricted-syntax -- non-snapshot update: only promotes is_final/status, no data_snapshot
        await tx.projectScheduleOption.update({
          where: { id: nextPromoted.id },
          data: { is_final: true, status: "APPROVED" }
        });
        
        const remainingOptions = await tx.projectScheduleOption.findMany({
          where: { entry_id: option.entry_id },
          orderBy: { option_label: "asc" },
        });
        const promotedIndex = remainingOptions.findIndex(
          (o) => o.id === nextPromoted.id
        );

        await tx.projectScheduleEntry.update({
          where: { id: option.entry_id },
          data: { 
            active_index: promotedIndex >= 0 ? promotedIndex : 0 
          },
        });
      }
    } else {
      const entry = await tx.projectScheduleEntry.findUnique({ where: { id: option.entry_id } });
      if (entry) {
        const finalOptIndex = remainingSiblings.findIndex(o => o.is_final);
        if (finalOptIndex !== -1) {
          await tx.projectScheduleEntry.update({
            where: { id: option.entry_id },
            data: { active_index: finalOptIndex }
          });
        } else if (entry.active_index >= remainingSiblings.length) {
          await tx.projectScheduleEntry.update({
            where: { id: option.entry_id },
            data: { active_index: Math.max(0, remainingSiblings.length - 1) }
          });
        }
      }
    }

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_DELETE_OPTION, "ProjectScheduleOption", optionId, userId, {
        project_id: option.entry.project_id,
        entry_id: option.entry_id,
        was_final: wasFinal
      });
    }

    return result;
  }

  /**
   * Approves one option and marks all sibling options as NOT_USED.
   * @param tx Prisma transaction client.
   * @param optionId Option id to approve.
   * @param entryId Parent entry id.
   * @param userId Optional actor user id for audit.
   * @returns Updated approved option.
   */
  static async approveOption(tx: PrismaTransaction, optionId: string, entryId: string, userId?: string) {
    const target = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: optionId },
      include: { entry: true }
    });

    if (target.entry_id !== entryId) {
      throw new ActionError("Option does not belong to the specified entry", "VALIDATION_FAILED");
    }

    // Reset others
    await tx.projectScheduleOption.updateMany({
      where: { entry_id: target.entry_id },
      data: { is_final: false, status: "NOT_USED" },
    });

    // Approve target
    // eslint-disable-next-line no-restricted-syntax -- non-snapshot update: only sets is_final/status, no data_snapshot
    const result = await tx.projectScheduleOption.update({
      where: { id: optionId },
      data: { is_final: true, status: "APPROVED" },
    });

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_APPROVE_OPTION, "ProjectScheduleOption", optionId, userId, {
        project_id: target.entry.project_id,
        entry_id: entryId,
      });
    }

    return result;
  }

  /**
   * Updates entry metadata
   * @param tx Prisma transaction client.
   * @param entryId Entry id.
   * @param data Mutable entry fields.
   * @param userId Optional actor user id for audit.
   * @returns Updated entry.
   */
  static async updateEntry(
    tx: PrismaTransaction,
    entryId: string,
    data: { schedule_qty?: number; schedule_unit?: string | null; schedule_location?: string | null },
    userId?: string
  ) {
    // Retrieve existing entry to enforce material qty rule
    const existingEntry = await tx.projectScheduleEntry.findUniqueOrThrow({ where: { id: entryId } });
    if (existingEntry.section === ProductType.material && data.schedule_qty !== undefined) {
      throw new ActionError("Materials cannot have schedule_qty updates.", "TYPE_RULE_VIOLATION");
    }
    const entry = await tx.projectScheduleEntry.update({
      where: { id: entryId },
      data,
    });

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_ENTRY, "ProjectScheduleEntry", entryId, userId, {
        project_id: entry.project_id,
        ...data
      });
    }

    return entry;
  }

  /**
   * Deletes one schedule entry and writes audit log.
   * @param tx Prisma transaction client.
   * @param entryId Entry id.
   * @param userId Optional actor user id for audit.
   * @returns Deleted entry row.
   */
  static async deleteEntry(tx: PrismaTransaction, entryId: string, userId?: string) {
    const entry = await tx.projectScheduleEntry.delete({
      where: { id: entryId },
    });

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_DELETE_ENTRY, "ProjectScheduleEntry", entryId, userId, {
        project_id: entry.project_id,
        schedule_category: entry.schedule_category,
        schedule_code: `${entry.schedule_prefix}-${String(entry.schedule_increment).padStart(2, "0")}`,
      });
    }

    await this.normalizeCodes(tx, entry.project_id, entry.section, entry.schedule_category);

    return entry;
  }

  /**
   * Bulk-deletes entries in one category and re-normalizes codes.
   * @param tx Prisma transaction client.
   * @param entryIds Entry ids to delete.
   * @param projectId Project id.
   * @param section Schedule section.
   * @param category Category name.
   * @param userId Optional actor user id for audit.
   * @returns Prisma deleteMany result.
   */
  static async deleteEntries(
    tx: PrismaTransaction,
    entryIds: string[],
    projectId: string,
    section: ProductType,
    category: string,
    userId?: string
  ) {
    const normalizedCategory = category.trim().toUpperCase();
    const result = await tx.projectScheduleEntry.deleteMany({
      where: {
        id: { in: entryIds },
        project_id: projectId,
        section,
        schedule_category: normalizedCategory,
      },
    });

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_DELETE_ENTRY, "ProjectScheduleEntry", "BULK", userId, {
        project_id: projectId,
        section,
        schedule_category: normalizedCategory,
        count: entryIds.length,
      });
    }

    await this.normalizeCodes(tx, projectId, section, normalizedCategory);
    return result;
  }

  /**
   * Merges all entries from a source category into a target category within a project.
   * This is useful for correcting classification errors (e.g., Brand mistakenly used as Category).
   */
  static async mergeCategories(
    tx: PrismaTransaction,
    projectId: string,
    section: ProductType,
    sourceCategory: string,
    targetCategory: string,
    userId: string
  ) {
    const src = sourceCategory.trim().toUpperCase();
    const dst = targetCategory.trim().toUpperCase();

    if (src === dst) throw new ActionError("Source and target categories must be different", "VALIDATION_FAILED");

    // 1. Get destination prefix reference
    const dstPrefix = await tx.prefixDictionary.findFirst({
      where: { 
        schedule_category: { equals: dst, mode: "insensitive" },
        section
      }
    });

    if (!dstPrefix) {
      throw new ActionError(`Target category "${dst}" does not have a registered prefix. Please create it first in Scheduler Config.`, "NOT_FOUND");
    }

    // 2. Find max sort order in destination to append entries
    const lastEntry = await tx.projectScheduleEntry.findFirst({
      where: { project_id: projectId, section, schedule_category: dst },
      orderBy: { schedule_sort_order: "desc" },
    });
    let currentSortOrder = (lastEntry?.schedule_sort_order ?? 0);

    // 3. Find all entries in source category
    const entries = await tx.projectScheduleEntry.findMany({
      where: { project_id: projectId, section, schedule_category: src },
      orderBy: { schedule_sort_order: "asc" }
    });

    if (entries.length === 0) return { count: 0 };

    // 4. Batch update entries. The moved entries keep the source category's
    // increments, which will almost always collide with the destination
    // category's own numbering (both commonly start at 1) — so each moved
    // entry gets a temporary negative placeholder here. normalizeCodes
    // (gentle) below only ever assigns fresh numbers to entries it doesn't
    // recognize as already valid, so it will leave the destination's
    // existing entries untouched and append the incoming ones after them.
    for (const entry of entries) {
      currentSortOrder++;
      await tx.projectScheduleEntry.update({
        where: { id: entry.id },
        data: {
          schedule_category: dst,
          prefix_id: dstPrefix.id,
          schedule_prefix: dstPrefix.prefix,
          schedule_sort_order: currentSortOrder,
          schedule_increment: -currentSortOrder,
        }
      });
    }

    // 5. Normalize codes for the target category to fix increments (e.g. ACP-01, ACP-02)
    await this.normalizeCodes(tx, projectId, section, dst);

    // 6. Audit Log
    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_MERGE_CATEGORIES, "ProjectScheduleEntry", "BULK", userId, {
      project_id: projectId,
      source_category: src,
      target_category: dst,
      entries_moved: entries.length
    });

    return { count: entries.length };
  }

  /**
   * Safe normalization of codes using temporary values first.
   * Optimized to minimize DB round-trips during re-indexing.
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param section Schedule section.
   * @param category Category name.
   */
  /**
   * Safe normalization of codes using split prefix and increment.
   * Enforces global uniqueness within the category.
   */
  // GENTLE. Only assigns a number to entries that don't have a valid one yet
  // (schedule_increment <= 0 — the temporary placeholder every entry-creation
  // path uses before its real code is settled, e.g. addEntryToSchedule's
  // tempIncrement). An entry that already holds a valid positive increment is
  // left exactly as-is: the DB's unique constraint on
  // (project, section, schedule_prefix, schedule_increment) means a live,
  // valid increment cannot already collide with anything, so there is
  // nothing to "fix" by touching it.
  //
  // This used to force-renumber EVERY entry in the category to 1..N on every
  // call (see resequenceCategory below, which still does that for the
  // explicit-reorder callers that actually want it). That forced renumber
  // ran as a side effect of unrelated operations too — adding one item,
  // deleting one item, a SketchUp material linking — silently discarding
  // intentional non-sequential numbering (codes moved to make room, etc.)
  // every time ANYTHING in the category changed. Combined with the SketchUp
  // code-convergence queue (see catalog-ownership.ts), that produced a real
  // oscillation: schedule renumbers back to 1..N -> looks like a divergence
  // from the model's already-renamed materials -> a rename gets queued to
  // revert the model -> next sync renumbers again -> repeat.
  static async normalizeCodes(tx: PrismaTransaction, projectId: string, section: ProductType, category: string) {
    const normalizedCategory = category.trim().toUpperCase();
    if (!normalizedCategory || normalizedCategory.toLowerCase() === "general") {
      return;
    }

    const entries = await tx.projectScheduleEntry.findMany({
      where: { project_id: projectId, section, schedule_category: normalizedCategory },
      orderBy: { schedule_sort_order: "asc" },
      include: { prefix_ref: true },
    });

    if (entries.length === 0) return;

    // Prefix drift correction is independent of numbering — still applied to
    // every entry with a valid number, but only written when it actually
    // differs from the category's PrefixDictionary entry.
    const usedIncrements = new Set<number>();
    const needsAssignment: typeof entries = [];
    for (const entry of entries) {
      if (entry.schedule_increment > 0) {
        usedIncrements.add(entry.schedule_increment);
        const canonicalPrefix = entry.prefix_ref?.prefix || entry.schedule_prefix || "ITEM";
        if (entry.schedule_prefix !== canonicalPrefix) {
          await tx.projectScheduleEntry.update({
            where: { id: entry.id },
            data: { schedule_prefix: canonicalPrefix },
          });
        }
      } else {
        needsAssignment.push(entry);
      }
    }

    if (needsAssignment.length === 0) return;

    let nextNumber = 1;
    for (const entry of needsAssignment) {
      while (usedIncrements.has(nextNumber)) nextNumber += 1;
      const prefix = entry.prefix_ref?.prefix || entry.schedule_prefix || "ITEM";
      usedIncrements.add(nextNumber);
      await tx.projectScheduleEntry.update({
        where: { id: entry.id },
        data: {
          schedule_prefix: prefix,
          schedule_increment: nextNumber,
          index_number: nextNumber,
        },
      });
      nextNumber += 1;
    }
  }

  // FORCEFUL. The original normalizeCodes behavior: every entry in the
  // category is renumbered 1..N to match schedule_sort_order, regardless of
  // what it held before. Reserved ONLY for callers where the user explicitly
  // reviewed and confirmed a complete new order for the whole category
  // (drag-reorder, the Code Manager "apply reviewed order" and "apply
  // reviewed swaps" flows) — never called as a side effect of an unrelated
  // add/delete/link, which is what normalizeCodes (gentle, above) is for.
  static async resequenceCategory(tx: PrismaTransaction, projectId: string, section: ProductType, category: string) {
    const normalizedCategory = category.trim().toUpperCase();
    if (!normalizedCategory || normalizedCategory.toLowerCase() === "general") {
      return;
    }

    const entries = await tx.projectScheduleEntry.findMany({
      where: { project_id: projectId, section, schedule_category: normalizedCategory },
      orderBy: { schedule_sort_order: "asc" },
      include: { prefix_ref: true },
    });

    if (entries.length === 0) return;

    // Phase 1: Move all to temporary negative increments to prevent P2002 unique collisions
    // during the re-indexing process
    for (let i = 0; i < entries.length; i++) {
      await tx.projectScheduleEntry.update({
        where: { id: entries[i].id },
        data: { schedule_increment: -(i + 1) }
      });
    }

    // Phase 2: Update each entry with correct final prefix and positive increment
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const prefix = entry.prefix_ref?.prefix || "ITEM";

      await tx.projectScheduleEntry.update({
        where: { id: entry.id },
        data: {
          schedule_prefix: prefix,
          schedule_increment: i + 1,
          index_number: i + 1
        }
      });
    }
  }

  /**
   * Swaps the active option index for a schedule entry.
   * Pillars 2 Resilience: Ensures index is valid and within bounds.
   */
  static async switchActiveOption(tx: PrismaTransaction, entryId: string, targetIndex: number, userId: string) {
    const entry = await tx.projectScheduleEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: { options: true }
    });

    if (targetIndex < 0 || targetIndex >= entry.options.length) {
      throw new ActionError(`Invalid option index: ${targetIndex}. Range is 0 to ${entry.options.length - 1}`, "INDEX_OUT_OF_BOUNDS");
    }

    const updated = await tx.projectScheduleEntry.update({
      where: { id: entryId },
      data: { active_index: targetIndex },
      include: { options: true }
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_SWITCH_OPTION, "ProjectScheduleEntry", entryId, userId, {
      project_id: entry.project_id,
      previous_index: entry.active_index,
      new_index: targetIndex,
      option_id: entry.options[targetIndex].id
    });

    return updated;
  }


  /**
   * Updates the immutable snapshot of a specific option
   * @param tx Prisma transaction client.
   * @param optionId Option id.
   * @param data Snapshot patch payload.
   * @param userId Actor user id for audit.
   * @returns Updated option.
   */
  static async updateOptionSnapshot(
    tx: PrismaTransaction,
    optionId: string,
    data: {
      catalog_product_name?: string;
      catalog_brand?: string;
      catalog_initials_type?: string | null;
      catalog_reference_url?: string | null;
      catalog_image_url?: string | null;
      catalog_price?: number | null;
      catalog_notes?: string | null;
      catalog_contact_name?: string | null;
      catalog_contact_phone?: string | null;
      catalog_contact_email?: string | null;
      catalog_has_sample?: boolean;
      specs?: Record<string, unknown>;
    },
    userId: string
  ) {
    const option = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: optionId },
      include: { entry: true }
    });

    const currentSnapshot = (option.data_snapshot as unknown as ScheduleSnapshot) || {} as ScheduleSnapshot;

    // Stage 1 Gatekeeping: catalog_color is mandatory for local snapshot updates
    // UX Decision: Changed from hard block to warning (soft validation) per User Feedback
    // The UI now shows a warning toast but allows saving without color
    const colorToSave = data.specs?.hasOwnProperty('catalog_color') ? (data.specs.catalog_color as string) : currentSnapshot.specs?.catalog_color;
    if (!colorToSave || colorToSave.trim() === "") {
      // Converted to soft warning - log for audit but don't block
      console.warn(`[ScheduleService] Soft validation: catalog_color is empty for option ${optionId}`);
    }
    
    // Auto-calculate catalog_initials_type from specs if not explicitly provided
    // This ensures the initials are always in sync with the actual specs
    const initialsValue = data.catalog_initials_type !== undefined ? data.catalog_initials_type : currentSnapshot.catalog_initials_type;
    const calculatedInitials = calculateInitialsType({
      catalog_motif: data.specs?.catalog_motif as string || currentSnapshot.specs?.catalog_motif as string || null,
      catalog_color: data.specs?.catalog_color as string || currentSnapshot.specs?.catalog_color as string || null,
      catalog_finishing: data.specs?.catalog_finishing as string || currentSnapshot.specs?.catalog_finishing as string || null,
    });
    const initialsToSave = initialsValue !== undefined ? (initialsValue || null) : (calculatedInitials || currentSnapshot.catalog_initials_type);
    
    // Merge new data into snapshot using namespaced fields
    const updatedSnapshot: ScheduleSnapshot = {
      ...currentSnapshot,
      catalog_type: currentSnapshot.catalog_type || option.entry.section,
      catalog_product_name: data.catalog_product_name !== undefined ? data.catalog_product_name : currentSnapshot.catalog_product_name,
      catalog_brand: data.catalog_brand !== undefined ? data.catalog_brand : currentSnapshot.catalog_brand,
      catalog_initials_type: initialsToSave,
      catalog_reference_url: data.catalog_reference_url !== undefined ? (data.catalog_reference_url || null) : (currentSnapshot.catalog_reference_url ?? null),
      catalog_image_url: data.catalog_image_url !== undefined ? (data.catalog_image_url || null) : (currentSnapshot.catalog_image_url ?? null),
      catalog_price: data.catalog_price !== undefined ? data.catalog_price : (currentSnapshot.catalog_price ?? null),
      catalog_notes: data.catalog_notes !== undefined ? data.catalog_notes : (currentSnapshot.catalog_notes ?? null),
      catalog_contact_name: data.catalog_contact_name !== undefined ? (data.catalog_contact_name || null) : (currentSnapshot.catalog_contact_name ?? null),
      catalog_contact_phone: data.catalog_contact_phone !== undefined ? (data.catalog_contact_phone || null) : (currentSnapshot.catalog_contact_phone ?? null),
      catalog_contact_email: data.catalog_contact_email !== undefined ? (data.catalog_contact_email || null) : (currentSnapshot.catalog_contact_email ?? null),
      catalog_has_sample: data.catalog_has_sample !== undefined ? data.catalog_has_sample : (currentSnapshot.catalog_has_sample ?? false),
      specs: {
        catalog_sku: data.specs?.hasOwnProperty('catalog_sku') ? (data.specs.catalog_sku as string || "") : (currentSnapshot.specs?.catalog_sku as string || ""),
        catalog_motif: data.specs?.hasOwnProperty('catalog_motif') ? (data.specs.catalog_motif as string || null) : (currentSnapshot.specs?.catalog_motif as string || null),
        catalog_structured_tags: data.specs?.hasOwnProperty('catalog_structured_tags') ? (data.specs.catalog_structured_tags as string[] || []) : (currentSnapshot.specs?.catalog_structured_tags as string[] || []),
        catalog_dimensions: data.specs?.hasOwnProperty('catalog_dimensions') ? (data.specs.catalog_dimensions as string || "") : (currentSnapshot.specs?.catalog_dimensions as string || ""),
        catalog_color: data.specs?.hasOwnProperty('catalog_color') ? (data.specs.catalog_color as string || null) : (currentSnapshot.specs?.catalog_color as string || null),
        catalog_finishing: data.specs?.hasOwnProperty('catalog_finishing') ? (data.specs.catalog_finishing as string || null) : (currentSnapshot.specs?.catalog_finishing as string || null),
        catalog_reference_url: data.specs?.hasOwnProperty('catalog_reference_url') ? (data.specs.catalog_reference_url as string || null) : (currentSnapshot.specs?.catalog_reference_url as string || null),
        catalog_metadata: {
          ...((currentSnapshot.specs?.catalog_metadata as Record<string, unknown>) || {}),
          ...((data.specs?.catalog_metadata as Record<string, unknown>) || {}),
        },
      },
    };

    // Validate before update
    const validatedSnapshot = ScheduleSnapshotSchema.parse(updatedSnapshot);

    const result = await updateScheduleOptionSnapshot(tx, optionId, validatedSnapshot);

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_SNAPSHOT, "Project", option.entry.project_id, userId, {
      option_id: optionId,
      field: "snapshot",
      changes: data
    });

    return result;
  }

  /**
   * §6.14 Brand-First Library — "pernah dipakai" reuse pool
   * (PLAN-LIBRARY-BRAND-FIRST.md §3). Searches spec_search_key across every
   * ProjectScheduleOption in the office, not just the current project: the
   * point is "material kantor sudah pernah pakai", grouped by
   * brand+product+color+finishing so the same spec picked in five different
   * projects shows up once, with a usage count and last-used date.
   *
   * Deliberately no curation gate — PLAN §3 accepts that this pool reflects
   * exactly what was typed, typos included, over a curated catalog that
   * never finishes. Ordered by frequency then recency, never filtered, per
   * the same section's reasoning: let the ranking do the work, not a
   * deletion rule.
   */
  static async searchReusableSpecs(
    tx: PrismaTransaction,
    query: string,
    limit = 20,
    /**
     * Restrict results to one section (material/fixture). Without this, a
     * search from the Fixture tab could surface a Material result and create
     * an entry under the wrong section when reused — see
     * PLAN-AUDIT-ROADMAP-2026Q3.md §2.2 R2.
     */
    section?: ProductType
  ): Promise<
    Array<{
      spec_search_key: string;
      spec_brand_id: string | null;
      spec_brand_name: string | null;
      spec_product_name: string | null;
      spec_color: string | null;
      spec_finishing: string | null;
      catalog_image_url: string | null;
      usage_count: number;
      last_used_at: Date;
      sample_option_id: string;
    }>
  > {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) return [];

    const options = await tx.projectScheduleOption.findMany({
      where: {
        spec_search_key: { not: null, contains: trimmed },
        ...(section ? { entry: { section } } : {}),
      },
      select: {
        id: true,
        spec_search_key: true,
        spec_brand_id: true,
        spec_product_name: true,
        spec_color: true,
        spec_finishing: true,
        data_snapshot: true,
        created_at: true,
      },
      orderBy: { created_at: "desc" },
      take: 500, // Cap the raw scan; grouped/ranked below. Revisit with a
      // real GROUP BY once this runs against a live database — see PLAN §9
      // step 8's regression-check note on spec_* being plain columns.
    });

    const groups = new Map<
      string,
      {
        spec_search_key: string;
        spec_brand_id: string | null;
        spec_brand_name: string | null;
        spec_product_name: string | null;
        spec_color: string | null;
        spec_finishing: string | null;
        catalog_image_url: string | null;
        usage_count: number;
        last_used_at: Date;
        sample_option_id: string;
      }
    >();

    for (const opt of options) {
      const key = opt.spec_search_key!;
      const snapshot = opt.data_snapshot as unknown as ScheduleSnapshot | null;
      const existing = groups.get(key);
      if (existing) {
        existing.usage_count += 1;
        if (opt.created_at > existing.last_used_at) {
          existing.last_used_at = opt.created_at;
        }
        continue;
      }
      groups.set(key, {
        spec_search_key: key,
        spec_brand_id: opt.spec_brand_id,
        // Master Data terputus (M5): no more spec_brand relation to join for
        // the brand's display name — read it back out of the frozen snapshot
        // instead (catalog_vendor_name is written from the same Brand at the
        // time the option was created, see buildScheduleSnapshot above).
        spec_brand_name: snapshot?.catalog_vendor_name ?? null,
        spec_product_name: opt.spec_product_name,
        spec_color: opt.spec_color,
        spec_finishing: opt.spec_finishing,
        catalog_image_url: snapshot?.catalog_image_url ?? null,
        usage_count: 1,
        last_used_at: opt.created_at,
        sample_option_id: opt.id,
      });
    }

    return [...groups.values()]
      .sort((a, b) => {
        if (b.usage_count !== a.usage_count) return b.usage_count - a.usage_count;
        return b.last_used_at.getTime() - a.last_used_at.getTime();
      })
      .slice(0, limit);
  }

  /**
   * Reorders entries and normalizes codes
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param section Schedule section.
   * @param category Category name.
   * @param items Ordered list with sort values.
   * @param userId Optional actor user id for audit.
   * @returns True when operation completed.
   */
  static async reorderEntries(
    tx: PrismaTransaction,

    projectId: string,
    section: ProductType,
    category: string,
    items: { id: string; schedule_sort_order: number }[],
    userId?: string
  ) {
    const normalizedCategory = category.trim().toUpperCase();
    
    if (items.length > 0) {
      // Use individual updates instead of raw SQL to avoid type issues
      await Promise.all(
        items.map(item => 
          tx.projectScheduleEntry.update({
            where: { id: item.id },
            data: { schedule_sort_order: item.schedule_sort_order }
          })
        )
      );
    }

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_REORDER, "Project", projectId, userId, {
        section,
        schedule_category: normalizedCategory,
        item_count: items.length
      });
    }

    // Explicit drag-reorder: the user just set a new visual order, so codes
    // must follow it exactly — this is the one case that wants the forceful
    // 1..N resequence, not the gentle gap-fill.
    await this.resequenceCategory(tx, projectId, section, normalizedCategory);
    return true;
  }

  /**
   * Normalizes codes across ALL projects for a specific category.
   * Useful when global prefix settings change.
   * @param tx Prisma transaction client.
   * @param category Category name.
   * @param section Schedule section.
   */
  /**
   * Moves an entry from one category to another and re-normalizes both.
   */
  static async moveEntryToCategory(
    tx: PrismaTransaction,
    entryId: string,
    targetCategory: string,
    newSortOrder: number,
    userId?: string
  ) {
    const entry = await tx.projectScheduleEntry.findUniqueOrThrow({
      where: { id: entryId },
    });

    const sourceCategory = entry.schedule_category;
    const normalizedTarget = targetCategory.trim().toUpperCase();

    if (sourceCategory === normalizedTarget) {
      // Just a reorder within same category, though usually handled by reorderEntries
      await tx.projectScheduleEntry.update({
        where: { id: entryId },
        data: { schedule_sort_order: newSortOrder }
      });
      await this.resequenceCategory(tx, entry.project_id, entry.section, normalizedTarget);
      return;
    }

    // DEVIATION PREVENTION: Do not allow moving schedule entries to another category to preserve semantic ID integrity.
    throw new Error("Moving items between categories is prohibited to maintain schedule code integrity.");
  }

  static async normalizeAllProjectsCodesForCategory(tx: PrismaTransaction, category: string, section: ProductType, userId?: string) {
    const normalizedCategory = category.trim().toUpperCase();
    const projectIds = await tx.projectScheduleEntry.findMany({
      where: { schedule_category: normalizedCategory, section },
      select: { project_id: true },
      distinct: ["project_id"],
    });

    for (const { project_id } of projectIds) {
      await this.normalizeCodes(tx, project_id, section, normalizedCategory);
    }

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SYSTEM_MAINTENANCE, "ProjectScheduleEntry", "BULK_NORMALIZE", userId, {
        category: normalizedCategory,
        section,
        project_count: projectIds.length
      });
    }
  }

  /**
   * Reorders one complete schedule category and normalizes it once.
   *
   * Unlike a pair swap, this operation intentionally accepts a category with
   * gaps because the user is explicitly reviewing a complete normalized order.
   * Every entry in the category must be present, preventing hidden additions,
   * deletions, or partial renumbering.
   */
  static async applyReviewedEntryOrder(
    tx: PrismaTransaction,
    projectId: string,
    orderedEntryIds: string[],
    userId: string
  ) {
    if (orderedEntryIds.length === 0 || new Set(orderedEntryIds).size !== orderedEntryIds.length) {
      throw new ActionError("The reviewed code order is invalid.", "INVALID_REORDER");
    }

    const selectedEntries = await tx.projectScheduleEntry.findMany({
      where: { id: { in: orderedEntryIds }, project_id: projectId },
    });
    if (selectedEntries.length !== orderedEntryIds.length) {
      throw new ActionError("One or more entries were not found.", "NOT_FOUND");
    }

    const firstEntry = selectedEntries[0];
    if (
      selectedEntries.some(
        (entry) =>
          entry.section !== firstEntry.section ||
          entry.schedule_category !== firstEntry.schedule_category ||
          entry.schedule_prefix.toUpperCase() !== firstEntry.schedule_prefix.toUpperCase()
      )
    ) {
      throw new ActionError(
        "A code order can only contain one category.",
        "CROSS_CATEGORY_REORDER_BLOCKED"
      );
    }

    const categoryEntries = await tx.projectScheduleEntry.findMany({
      where: {
        project_id: projectId,
        section: firstEntry.section,
        schedule_category: firstEntry.schedule_category,
      },
      orderBy: [
        { schedule_increment: "asc" },
        { created_at: "asc" },
        { id: "asc" },
      ],
      include: { prefix_ref: true },
    });
    const categoryEntryIds = new Set(categoryEntries.map((entry) => entry.id));
    if (
      categoryEntries.length !== orderedEntryIds.length ||
      orderedEntryIds.some((entryId) => !categoryEntryIds.has(entryId))
    ) {
      throw new ActionError(
        "The category changed while reviewing this draft. Nothing was applied.",
        "STALE_REORDER_DRAFT"
      );
    }

    const currentPrefixes = new Set(
      categoryEntries.map((entry) => entry.schedule_prefix.trim().toUpperCase())
    );
    const normalizedPrefixes = new Set(
      categoryEntries.map((entry) => (entry.prefix_ref?.prefix || "ITEM").trim().toUpperCase())
    );
    if (
      currentPrefixes.size !== 1 ||
      normalizedPrefixes.size !== 1 ||
      [...currentPrefixes][0] !== [...normalizedPrefixes][0]
    ) {
      throw new ActionError(
        `The ${firstEntry.schedule_category} prefix configuration is inconsistent. Nothing was applied.`,
        "CATEGORY_PREFIX_MISMATCH"
      );
    }

    const beforeById = new Map(
      categoryEntries.map((entry) => [entry.id, entry.schedule_increment])
    );
    for (let index = 0; index < orderedEntryIds.length; index++) {
      await tx.projectScheduleEntry.update({
        where: { id: orderedEntryIds[index] },
        data: { schedule_sort_order: index + 1 },
      });
    }

    // The whole point here is the user reviewed a complete new order for this
    // category — force the full 1..N resequence to match it exactly.
    await this.resequenceCategory(
      tx,
      projectId,
      firstEntry.section,
      firstEntry.schedule_category
    );

    const normalizedEntries = await tx.projectScheduleEntry.findMany({
      where: { id: { in: orderedEntryIds } },
      select: { id: true, schedule_increment: true },
    });
    const normalizedById = new Map(normalizedEntries.map((entry) => [entry.id, entry]));
    const changes: { id: string; beforeIncrement: number; afterIncrement: number }[] = [];

    for (let index = 0; index < orderedEntryIds.length; index++) {
      const entryId = orderedEntryIds[index];
      const normalized = normalizedById.get(entryId);
      if (!normalized || normalized.schedule_increment !== index + 1) {
        throw new ActionError(
          "The category changed while applying this draft. Nothing was applied.",
          "STALE_REORDER_DRAFT"
        );
      }
      changes.push({
        id: entryId,
        beforeIncrement: beforeById.get(entryId)!,
        afterIncrement: normalized.schedule_increment,
      });
    }

    await insertAuditLog(
      tx,
      AUDIT_ACTIONS.SCHEDULE_SWAP_ENTRIES,
      "ProjectScheduleEntry",
      firstEntry.id,
      userId,
      {
        project_id: projectId,
        section: firstEntry.section,
        category: firstEntry.schedule_category,
        prefix: firstEntry.schedule_prefix,
        action: "REORDER_AND_NORMALIZE_SEQUENCE",
        ordered_entry_ids: orderedEntryIds,
        changes,
      }
    );

    return {
      section: firstEntry.section,
      category: firstEntry.schedule_category,
      prefix: firstEntry.schedule_prefix,
      changes,
    };
  }

  /**
   * Applies disjoint code swaps as one deterministic batch.
   *
   * The browser preview is based on the codes currently visible to the user,
   * not legacy `schedule_sort_order` values. Rebuild the internal ordering
   * from that visible sequence first, apply every requested position swap,
   * then normalize each affected category exactly once.
   */
  static async swapEntriesBatch(
    tx: PrismaTransaction,
    projectId: string,
    swaps: { idA: string; idB: string }[],
    userId: string
  ) {
    if (swaps.length === 0) {
      return { changes: [] as { id: string; beforeIncrement: number; afterIncrement: number }[] };
    }

    const usedEntryIds = new Set<string>();
    for (const swap of swaps) {
      if (swap.idA === swap.idB) {
        throw new ActionError("Choose two different items to swap.", "INVALID_SWAP");
      }
      for (const entryId of [swap.idA, swap.idB]) {
        if (usedEntryIds.has(entryId)) {
          throw new ActionError("An item can only appear in one pending swap.", "DUPLICATE_SWAP_ENTRY");
        }
        usedEntryIds.add(entryId);
      }
    }

    const selectedEntries = await tx.projectScheduleEntry.findMany({
      where: { id: { in: [...usedEntryIds] }, project_id: projectId },
    });
    if (selectedEntries.length !== usedEntryIds.size) {
      throw new ActionError("One or more entries were not found.", "NOT_FOUND");
    }

    const selectedById = new Map(selectedEntries.map((entry) => [entry.id, entry]));
    const groupedSwaps = new Map<
      string,
      {
        section: ProductType;
        category: string;
        pairs: { idA: string; idB: string }[];
      }
    >();

    for (const swap of swaps) {
      const entryA = selectedById.get(swap.idA);
      const entryB = selectedById.get(swap.idB);
      if (!entryA || !entryB) {
        throw new ActionError("One or more entries were not found.", "NOT_FOUND");
      }
      if (entryA.section !== entryB.section) {
        throw new ActionError(
          "Cannot swap entries: Different product types (Material vs Fixture)",
          "CROSS_SECTION_SWAP_BLOCKED"
        );
      }
      if (
        entryA.schedule_category !== entryB.schedule_category ||
        entryA.schedule_prefix.toUpperCase() !== entryB.schedule_prefix.toUpperCase()
      ) {
        throw new ActionError("Cannot swap entries: Different categories", "CROSS_CATEGORY_SWAP_BLOCKED");
      }

      const groupKey = JSON.stringify([entryA.section, entryA.schedule_category]);
      const group = groupedSwaps.get(groupKey) ?? {
        section: entryA.section,
        category: entryA.schedule_category,
        pairs: [],
      };
      group.pairs.push(swap);
      groupedSwaps.set(groupKey, group);
    }

    const changes: { id: string; beforeIncrement: number; afterIncrement: number }[] = [];

    for (const group of groupedSwaps.values()) {
      const categoryEntries = await tx.projectScheduleEntry.findMany({
        where: {
          project_id: projectId,
          section: group.section,
          schedule_category: group.category,
        },
        orderBy: [
          { schedule_increment: "asc" },
          { created_at: "asc" },
          { id: "asc" },
        ],
        include: { prefix_ref: true },
      });
      if (categoryEntries.length === 0) {
        throw new ActionError("The category is no longer available.", "NOT_FOUND");
      }

      const categoryEntryById = new Map(categoryEntries.map((entry) => [entry.id, entry]));
      if (
        group.pairs.some(
          (pair) => !categoryEntryById.has(pair.idA) || !categoryEntryById.has(pair.idB)
        )
      ) {
        throw new ActionError(
          "The category changed while reviewing this draft. Nothing was applied.",
          "STALE_SWAP_DRAFT"
        );
      }

      // A drag preview promises that only the two displayed codes exchange.
      // Normalizing a category with gaps would renumber unrelated cards, so
      // stop safely and ask for explicit normalization instead.
      const hasSequentialVisibleCodes = categoryEntries.every(
        (entry, index) => entry.schedule_increment === index + 1
      );
      if (!hasSequentialVisibleCodes) {
        throw new ActionError(
          `Codes in ${group.category} are not sequential. Normalize this category first, then review the swap again. Nothing was applied.`,
          "CATEGORY_NORMALIZATION_REQUIRED"
        );
      }

      const currentPrefixes = new Set(
        categoryEntries.map((entry) => entry.schedule_prefix.trim().toUpperCase())
      );
      const normalizedPrefixes = new Set(
        categoryEntries.map((entry) => (entry.prefix_ref?.prefix || "ITEM").trim().toUpperCase())
      );
      if (
        currentPrefixes.size !== 1 ||
        normalizedPrefixes.size !== 1 ||
        [...currentPrefixes][0] !== [...normalizedPrefixes][0]
      ) {
        throw new ActionError(
          `The ${group.category} prefix configuration is inconsistent. Nothing was applied.`,
          "CATEGORY_PREFIX_MISMATCH"
        );
      }

      // Start from the visible code order, deliberately ignoring stale legacy
      // sort values. Because pairs are disjoint, their position swaps commute.
      const desiredOrder = categoryEntries.map((entry) => entry.id);
      for (const pair of group.pairs) {
        const indexA = desiredOrder.indexOf(pair.idA);
        const indexB = desiredOrder.indexOf(pair.idB);
        if (indexA < 0 || indexB < 0) {
          throw new ActionError(
            "The category changed while reviewing this draft. Nothing was applied.",
            "STALE_SWAP_DRAFT"
          );
        }
        [desiredOrder[indexA], desiredOrder[indexB]] = [desiredOrder[indexB], desiredOrder[indexA]];
      }

      for (let index = 0; index < desiredOrder.length; index++) {
        await tx.projectScheduleEntry.update({
          where: { id: desiredOrder[index] },
          data: { schedule_sort_order: index + 1 },
        });
      }

      for (const pair of group.pairs) {
        const entryA = categoryEntryById.get(pair.idA);
        const entryB = categoryEntryById.get(pair.idB);
        if (!entryA || !entryB) {
          throw new ActionError("One or more entries were not found.", "NOT_FOUND");
        }
        await insertAuditLog(
          tx,
          AUDIT_ACTIONS.SCHEDULE_SWAP_ENTRIES,
          "ProjectScheduleEntry",
          entryA.id,
          userId,
          {
            project_id: projectId,
            entry_a_id: entryA.id,
            entry_b_id: entryB.id,
            action: "SWAP_POSITIONS",
            entry_a_before_code: `${entryA.schedule_prefix}-${entryA.schedule_increment}`,
            entry_b_before_code: `${entryB.schedule_prefix}-${entryB.schedule_increment}`,
            source: "deterministic_batch",
          }
        );
      }

      // Same reasoning as applyReviewedEntryOrder: a reviewed swap plan
      // implies the full new order, so this needs the forceful resequence.
      await this.resequenceCategory(tx, projectId, group.section, group.category);

      const normalizedEntries = await tx.projectScheduleEntry.findMany({
        where: { id: { in: categoryEntries.map((entry) => entry.id) } },
        select: { id: true, schedule_increment: true },
      });
      const normalizedById = new Map(normalizedEntries.map((entry) => [entry.id, entry]));

      for (const entry of categoryEntries) {
        const normalized = normalizedById.get(entry.id);
        const expectedIncrement = desiredOrder.indexOf(entry.id) + 1;
        if (!normalized || normalized.schedule_increment !== expectedIncrement) {
          throw new ActionError(
            "The category changed while applying this draft. Nothing was applied.",
            "STALE_SWAP_DRAFT"
          );
        }
        changes.push({
          id: entry.id,
          beforeIncrement: entry.schedule_increment,
          afterIncrement: normalized.schedule_increment,
        });
      }
    }

    return { changes };
  }

  /**
   * Swaps two entries in the same category.
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param idA First entry id.
   * @param idB Second entry id.
   * @param userId Actor user id for audit.
   */
  static async swapEntries(tx: PrismaTransaction, projectId: string, idA: string, idB: string, userId: string) {
    return this.swapEntriesBatch(tx, projectId, [{ idA, idB }], userId);
  }


}
