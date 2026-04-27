import { Prisma, ProjectScheduleEntry, ProjectScheduleOption, ProductType } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit/types";


import { LibraryService } from "@/extensions/library/services/library-service";
import { ScheduleSnapshotSchema, type ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";

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
    const item = await tx.productCatalog.findUnique({
      where: { id: catalogId },
      include: { 
        vendor: {
          include: { contacts: true }
        },
        physical_samples: true
      },
    });

    if (!item) throw new ActionError("Catalog item not found", "ITEM_NOT_FOUND");

    const defaultContact = item.vendor.contacts[0];

    return {
      snapshot_source_kind: "catalog",
      snapshot_source_origin: sourceOrigin || "library",
      snapshot_source_external_id: null,
      product_catalog_id: item.id,
      catalog_type: item.catalog_type,
      schedule_category: item.catalog_category,
      catalog_sub_category: item.catalog_sub_category,
      catalog_product_name: item.catalog_product_name || item.catalog_sku,
      catalog_brand: item.catalog_brand || item.vendor?.brand_name || "Custom",
      catalog_initials_type: calculateInitialsType({
        catalog_motif: item.catalog_motif,
        catalog_color: item.catalog_color,
        catalog_finishing: item.catalog_finishing
      }),
      catalog_price: item.catalog_price ?? null,
      catalog_image_url: item.catalog_image_url,
      catalog_reference_url: item.catalog_reference_url,
      catalog_contact_name: defaultContact?.contact_person ?? null,
      catalog_contact_phone: defaultContact?.phone_number ?? null,
      catalog_contact_email: defaultContact?.email ?? null,
      catalog_has_sample: item.physical_samples?.length ? true : false,
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


async function resolveCatalogItemForMode(
  tx: PrismaTransaction,
  category: string,
  mode: "catalog" | "create_catalog" | "manual",
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

  if (mode !== "create_catalog") {
    return null;
  }

  const normalizedBrand = catalogCreateData?.catalog_brand?.trim() || "Custom";
  const normalizedName = catalogCreateData?.catalog_product_name?.trim();
  
  // Stage 2 Completeness Gatekeeper
  const hasImage = !!catalogCreateData?.catalog_image_url?.trim();
  const hasValidSku = !!catalogCreateData?.catalog_sku && catalogCreateData.catalog_sku !== "Generic";
  
  if (!normalizedName || !hasImage || !hasValidSku) {
    throw new ActionError("Promote to Library requires full Stage 2 completeness (Mandatory: SKU, Product Name, Brand, Image URL)", "VALIDATION_FAILED");
  }

// Use LibraryService for server-side operations
    const vendor = await LibraryService.createVendor(
      { brand_name: normalizedBrand, contacts: [] },
      userId,
      tx
    );

    const created = await LibraryService.createProduct(
    {
      vendor_id: vendor.id,
      catalog_category: category,
      catalog_type: catalogCreateData?.catalog_type || ProductType.material,
      catalog_sub_category: catalogCreateData?.catalog_sub_category ?? undefined,
      catalog_sku: catalogCreateData?.catalog_sku || normalizedName,
      catalog_product_name: normalizedName,
      catalog_motif: catalogCreateData?.catalog_motif ?? undefined,
      catalog_color: catalogCreateData?.catalog_color || "Standard",
      catalog_finishing: catalogCreateData?.catalog_finishing ?? undefined,
      catalog_dimension_p: catalogCreateData?.catalog_dimension_p ?? undefined,
      catalog_dimension_l: catalogCreateData?.catalog_dimension_l ?? undefined,
      catalog_dimension_t: catalogCreateData?.catalog_dimension_t ?? undefined,
      catalog_dimension_unit: catalogCreateData?.catalog_dimension_unit ?? "cm",
      catalog_tags: catalogCreateData?.catalog_structured_tags ?? [],
      catalog_reference_url: catalogCreateData?.catalog_reference_url ?? undefined,
      catalog_image_url: catalogCreateData?.catalog_image_url ?? undefined,
      catalog_price: catalogCreateData?.catalog_price ?? null,
    },
    userId,
    tx
  );

  return created.id;
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
   * Fetches the complete schedule sheet payload for a project
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param section Schedule section (defaults ARCHITECTURAL).
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
              product_catalog: {
                include: {
                  product_requests: {
                    where: { project_id: projectId },
                    select: { status: true, project_id: true }
                  }
                }
              } 
            },
          },
          prefix_ref: true,
        },
        orderBy: { schedule_sort_order: "asc" },
      }),
    ]);

    const entries = entriesRaw.map(entry => ({
      ...entry,
      schedule_code: `${entry.schedule_prefix}-${String(entry.schedule_increment).padStart(2, "0")}`
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
   * Alias for getProjectScheduleSheet with default ARCHITECTURAL section.
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
    mode: "catalog" | "create_catalog" | "manual" | "reserve",
    catalogItemId?: string | null,
    catalogCreateData?: ScheduleCatalogCreateInput & { catalog_type?: ProductType },
    section: ProductType = ProductType.material,
    userId?: string
  ): Promise<{ entry: ProjectScheduleEntry; createdCatalogId: string | null }> {

    const normalizedCategory = category.trim().toUpperCase();
    if (!normalizedCategory || normalizedCategory.toLowerCase() === "general") {
      throw new ActionError("Valid product category is required. 'General' is no longer supported.", "VALIDATION_FAILED");
    }

    // Validate Catalog Item if provided
    if (mode === "catalog" && catalogItemId) {
      const catalogItem = await tx.productCatalog.findUnique({
        where: { id: catalogItemId },
        select: { catalog_category: true, catalog_type: true },
      });
      if (!catalogItem) {
        throw new ActionError("Product not found in catalog", "NOT_FOUND");
      }
      if (catalogItem.catalog_type !== section) {
        throw new ActionError(
          `Type mismatch: schedule section is "${section}" but product is "${catalogItem.catalog_type}"`,
          "VALIDATION_FAILED"
        );
      }
      const itemCategory = catalogItem.catalog_category.trim().toUpperCase();
      if (normalizedCategory !== itemCategory) {
        throw new ActionError(
          `Category mismatch: schedule category is "${normalizedCategory}" but product is in "${catalogItem.catalog_category}"`,
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

    // 3. Create Entry with temporary sequence
    const entry = await tx.projectScheduleEntry.create({
      data: {
        project_id: projectId,
        schedule_category: normalizedCategory,
        section,
        schedule_sort_order: nextSortOrder,
        index_number: 9999, // Temp, will be normalized
        schedule_prefix: prefixDict.prefix,
        schedule_increment: 9999, // Temp, will be normalized
        prefix_id: prefixDict.id,
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
    } else {
      resolvedCatalogId = await resolveCatalogItemForMode(
        tx,
        normalizedCategory,
        mode,
        userId || "SYSTEM",
        catalogItemId,
        catalogCreateData
      );
      finalSnapshot = await buildScheduleSnapshot(tx, resolvedCatalogId, undefined, "library");
    }

    // Validate Snapshot before save
    const validatedSnapshot = ScheduleSnapshotSchema.parse(finalSnapshot);

    await tx.projectScheduleOption.create({
      data: {
        entry_id: entry.id,
        product_catalog_id: resolvedCatalogId,
        data_snapshot: validatedSnapshot as unknown as Prisma.InputJsonValue,
        option_label: "A",
        is_final: isFinal,
        status: optionStatus,
      },
    });


    // 6. Normalize codes (Global category-wide uniqueness)
    await this.normalizeCodes(tx, projectId, section, normalizedCategory);

    return { entry, createdCatalogId: mode === "create_catalog" ? resolvedCatalogId : null };
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
    mode: "catalog" | "create_catalog" | "manual" | "reserve",
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

      const catalogItem = await tx.productCatalog.findUnique({
        where: { id: catalogItemId },
        select: { catalog_category: true, catalog_type: true },
      });
      if (!catalogItem) {
        throw new ActionError("Product not found in catalog", "NOT_FOUND");
      }
      if (catalogItem.catalog_type !== entry.section) {
        throw new ActionError(
          `Type mismatch: entry section is "${entry.section}" but product is "${catalogItem.catalog_type}"`,
          "VALIDATION_FAILED"
        );
      }
      const itemCategory = catalogItem.catalog_category.trim().toUpperCase();
      if (normalizedCategory !== itemCategory) {
        throw new ActionError(
          `Category mismatch: entry category is "${normalizedCategory}" but product is in "${catalogItem.catalog_category}"`,
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
      finalSnapshot = await buildScheduleSnapshot(tx, resolvedCatalogId, undefined, "library");
    }

    // Validate Snapshot before save
    const validatedSnapshot = ScheduleSnapshotSchema.parse(finalSnapshot);

    const option = await tx.projectScheduleOption.create({
      data: {
        entry_id: entryId,
        product_catalog_id: resolvedCatalogId,
        data_snapshot: validatedSnapshot as unknown as Prisma.InputJsonValue,
        option_label: nextLabel,
        is_final: false,
        status: "DRAFT",
      },
      include: { entry: true }
    });

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_ADD_OPTION, "ProjectScheduleOption", option.id, userId, {
        project_id: option.entry.project_id,
        entry_id: entryId
      });
    }


    return { option, createdCatalogId: mode === "create_catalog" ? resolvedCatalogId : null };
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
    if (wasFinal) {
      const remainingSiblings = siblings.filter(o => o.id !== optionId).sort((a, b) => a.option_label.localeCompare(b.option_label));
      if (remainingSiblings.length > 0) {
        const nextPromoted = remainingSiblings[0];
        await tx.projectScheduleOption.update({
          where: { id: nextPromoted.id },
          data: { is_final: true, status: "APPROVED" }
        });
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

    const result = await tx.projectScheduleOption.update({
      where: { id: optionId },
      data: {
        data_snapshot: validatedSnapshot as unknown as Prisma.InputJsonValue,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_SNAPSHOT, "Project", option.entry.project_id, userId, {
      option_id: optionId,
      field: "snapshot",
      changes: data
    });

    return result;
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

    await this.normalizeCodes(tx, projectId, section, normalizedCategory);
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
      await this.normalizeCodes(tx, entry.project_id, entry.section, normalizedTarget);
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
   * Swaps two entries in the same category.
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param idA First entry id.
   * @param idB Second entry id.
   * @param userId Actor user id for audit.
   */
  static async swapEntries(tx: PrismaTransaction, projectId: string, idA: string, idB: string, userId: string) {
    const [entryA, entryB] = await Promise.all([
      tx.projectScheduleEntry.findUnique({ where: { id: idA } }),
      tx.projectScheduleEntry.findUnique({ where: { id: idB } })
    ]);

    if (!entryA || !entryB) {
      throw new Error("One or both entries not found");
    }

    if (entryA.project_id !== projectId || entryB.project_id !== projectId) {
      throw new Error("Entries do not belong to the specified project");
    }
    if (entryA.schedule_category !== entryB.schedule_category) {
      throw new Error("Cannot swap entries from different categories");
    }
    if (entryA.section !== entryB.section) {
      throw new Error("Cannot swap entries from different sections");
    }

    const sortOrderA = entryA.schedule_sort_order;
    const sortOrderB = entryB.schedule_sort_order;

    await Promise.all([
      tx.projectScheduleEntry.update({
        where: { id: idA },
        data: { schedule_sort_order: sortOrderB }
      }),
      tx.projectScheduleEntry.update({
        where: { id: idB },
        data: { schedule_sort_order: sortOrderA }
      })
    ]);

    await this.normalizeCodes(tx, projectId, entryA.section, entryA.schedule_category);
    
    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_REORDER, "Project", projectId, userId, {
      idA,
      idB,
      type: "SWAP"
    });
  }


}
