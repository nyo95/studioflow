import { Prisma, ProjectScheduleEntry, ProjectScheduleOption, ScheduleSection } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit/types";


import { LibraryService } from "@/extensions/library/services/library-service";
import { ScheduleSnapshotSchema, type ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";

// Pillar 2 Configuration - Auto-Harvesting
// Set to "true" to enable automatic sync to Library (PENDING materials)
// Set to "false" to require explicit user action for promotion (SSOT §5.2 compliant)
const SCHEDULE_AUTO_HARVEST_ENABLED = process.env.SCHEDULE_AUTO_HARVEST === "true";

// Reserved brands that should NOT be synced to Library
const RESERVED_BRANDS = (process.env.SCHEDULE_RESERVED_BRANDS || "PENDING,RESERVED,[RESERVED]")
  .split(",")
  .map(b => b.trim().toUpperCase());

export type SourceOrigin = "web_catalog" | "web_manual" | "gsheets_import" | "sketchup_plugin";

export interface ScheduleManualDataInput {
  name: string;
  brand: string;
  category?: string;
  sub_category?: string | null;
  motif_or_color?: string | null;
  color?: string | null;
  finishing?: string | null;
  dimension_p?: string | null;
  dimension_l?: string | null;
  dimension_t?: string | null;
  dimension_unit?: string | null;
  tags?: string[];
  digital_catalog_url?: string | null;
  source_external_id?: string | null;
  reference_url?: string | null;
  location?: string | null;
  image_url?: string | null;
  price?: number | null;
  has_sample?: boolean | null;
  initials_type?: string | null;

  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  metadata?: unknown;
}

export interface ScheduleCatalogCreateInput {
  name: string;
  brand: string;
  sub_category?: string | null;
  motif_or_color?: string | null;
  color?: string | null;
  finishing?: string | null;
  dimension_p?: string | null;
  dimension_l?: string | null;
  dimension_t?: string | null;
  dimension_unit?: string | null;
  tags?: string[];
  digital_catalog_url?: string | null;
  reference_url?: string | null;
  image_url?: string | null;
  price?: number | null;
}



/**
 * Builds an immutable snapshot from a MaterialCatalog item or manual data
 */
export async function buildScheduleSnapshot(
  tx: PrismaTransaction,

  catalogId?: string | null,
  manualData?: ScheduleManualDataInput,
  sourceOrigin: SourceOrigin = "web_catalog"
): Promise<ScheduleSnapshot> {
  if (catalogId) {
    const item = await tx.materialCatalog.findUnique({
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
      source_kind: "catalog",
      source_origin: sourceOrigin,
      source_external_id: null,
      material_catalog_id: item.id,
      category: item.category,
      sub_category: item.sub_category,
      name: item.product_type,
      brand: item.vendor.brand_name,
      initials_type: Array.from(new Set([item.color, item.motif_or_color, item.finishing])).filter(Boolean).join(" / ") || null,
      price: item.price ?? null,
      image_url: item.cover_url,
      reference_url: item.original_url,
      contact_name: defaultContact?.contact_person ?? null,
      contact_phone: defaultContact?.phone_number ?? null,
      contact_email: defaultContact?.email ?? null,
      has_sample: item.physical_samples?.length ? true : false,
      specs: {

        product_type: item.product_type,
        motif_or_color: item.motif_or_color,
        tags: item.tags,
        dimensions: `${item.dimension_p ?? ""} x ${item.dimension_l ?? ""} x ${item.dimension_t ?? ""} ${item.dimension_unit ?? "cm"}`,
        color: item.color,
        finishing: item.finishing,
        digital_catalog_url: item.digital_catalog_url,
        metadata: item.metadata || {},
      },
      source_payload: null,
      captured_at: new Date().toISOString(),
    };
  }

  // Manual fallback
  return {
    source_kind: "manual",
    source_origin: sourceOrigin === "web_catalog" ? "web_manual" : sourceOrigin,
    source_external_id: manualData?.source_external_id ?? null,
    material_catalog_id: null,
    category: manualData?.category ?? "",
    sub_category: null,
    name: manualData?.name || "Manual Item",
    brand: manualData?.brand || "Custom",
    initials_type: manualData?.initials_type || Array.from(new Set([manualData?.color, manualData?.motif_or_color, manualData?.finishing])).filter(Boolean).join(" / ") || null,
    price: manualData?.price ?? null,
    image_url: manualData?.image_url || null,
    reference_url: manualData?.reference_url || null,
    contact_name: manualData?.contact_name ?? null,
    contact_phone: manualData?.contact_phone ?? null,
    contact_email: manualData?.contact_email ?? null,
    has_sample: manualData?.has_sample ?? false,
    specs: {

      product_type: manualData?.name || "Generic",
      motif_or_color: manualData?.motif_or_color ?? null,
      tags: manualData?.tags ?? [],
      dimensions: manualData?.dimension_p ? `${manualData.dimension_p} x ${manualData.dimension_l ?? ""} x ${manualData.dimension_t ?? ""} ${manualData.dimension_unit ?? "cm"}` : "N/A",
      color: manualData?.color ?? null,
      finishing: manualData?.finishing ?? null,
      digital_catalog_url: manualData?.digital_catalog_url ?? null,
      metadata: manualData?.metadata || {},
    },
    source_payload: manualData?.metadata ?? null,
    captured_at: new Date().toISOString(),
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

  if (mode !== "create_catalog") {
    return null;
  }

  const normalizedBrand = catalogCreateData?.brand?.trim() || "Custom";
  const normalizedName = catalogCreateData?.name?.trim();
  if (!normalizedName) {
    throw new ActionError("Catalog item name is required", "VALIDATION_FAILED");
  }

  // Use LibraryService instead of bypassing via tx
  const vendor = await LibraryService.createVendor(
    { brand_name: normalizedBrand, contacts: [] },
    userId,
    tx
  );

  const created = await LibraryService.createMaterial(
    {
      vendor_id: vendor.id,
      category,
      sub_category: catalogCreateData?.sub_category ?? undefined,
      product_type: normalizedName,
      motif_or_color: catalogCreateData?.motif_or_color ?? undefined,
      color: catalogCreateData?.color ?? undefined,
      finishing: catalogCreateData?.finishing ?? undefined,
      dimension_p: catalogCreateData?.dimension_p ?? undefined,
      dimension_l: catalogCreateData?.dimension_l ?? undefined,
      dimension_t: catalogCreateData?.dimension_t ?? undefined,
      dimension_unit: catalogCreateData?.dimension_unit ?? "cm",
      tags: catalogCreateData?.tags ?? [],
      digital_catalog_url: catalogCreateData?.digital_catalog_url ?? undefined,
      original_url: catalogCreateData?.reference_url ?? undefined,
      cover_url: catalogCreateData?.image_url ?? undefined,
      price: catalogCreateData?.price ?? null,
    },
    userId,
    tx
  );

  return created.id;
}


/**
 * Helper to sync a project option's snapshot to the global library.
 * Part of the Pillar 2 "Auto-Harvesting" workflow.
 */
async function syncOptionToLibrary(tx: PrismaTransaction, optionId: string, snapshot: ScheduleSnapshot, userId?: string) {
  const syncedMaterial = await LibraryService.ensureMaterialInLibrary(tx, {
    name: snapshot.name,
    brand: snapshot.brand,
    category: snapshot.category,
    image_url: snapshot.image_url,
    price: snapshot.price,
    original_url: snapshot.reference_url,
    color: snapshot.specs?.color,
    finishing: snapshot.specs?.finishing,
    motif_or_color: snapshot.specs?.motif_or_color,
  });

  // Skip if material could not be synced (e.g., reserved brands)
  if (!syncedMaterial) {
    console.warn(`[syncOptionToLibrary] Skipped syncing reserved/pending material for option=${optionId}`);
    return null;
  }

  // Update original option if the link was established or updated
  const updatedSnapshot = {
    ...snapshot,
    material_catalog_id: syncedMaterial.id
  };

  const updatedOption = await tx.projectScheduleOption.update({
    where: { id: optionId },
    data: {
      material_catalog_id: syncedMaterial.id,
      data_snapshot: updatedSnapshot as unknown as Prisma.InputJsonValue
    },
    include: { entry: true }
  });

  if (userId && syncedMaterial.status === "PENDING") {
    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_PROMOTE_TO_LIBRARY, "MaterialCatalog", syncedMaterial.id, userId, {
      harvested_from_option: optionId,
      project_id: updatedOption.entry.project_id
    });
  }

  return updatedOption;
}

export class ScheduleService {
  /**
   * Explicitly promotes a project material snapshot to the global library.
   * This is part of the Pillar 2 Resilience strategy to prevent data pollution.
   * @param tx Prisma transaction client.
   * @param optionId Option id to promote.
   * @param userId Actor user id for audit.
   * @returns Updated option linked to a library material.
   */
  static async executePromoteToLibrary(tx: PrismaTransaction, optionId: string, userId: string) {
    const option = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: optionId },
      include: { entry: true }
    });

    const snapshot = option.data_snapshot as unknown as ScheduleSnapshot;
    if (!snapshot) throw new ActionError("Cannot promote option without valid snapshot", "SNAPSHOT_MISSING");

    // Perform promotion using existing helper
    const updatedOption = await syncOptionToLibrary(tx, optionId, snapshot);

    if (!updatedOption) {
      throw new ActionError("Cannot promote reserved/pending material to library", "PROMOTION_FAILED");
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_PROMOTE_TO_LIBRARY, "ProjectScheduleOption", optionId, userId, {
      project_id: option.entry.project_id,
      entry_id: option.entry_id,
      catalog_id: updatedOption.material_catalog_id,
      brand: snapshot.brand,
      name: snapshot.name
    });

    return updatedOption;
  }

  /**
   * Returns active schedule templates for one section.
   * @param tx Prisma transaction client.
   * @param section MATERIAL or FIXTURE.
   * @returns Active template rows.
   */
  static async getActiveScheduleTemplates(tx: PrismaTransaction, section: ScheduleSection) {
    return tx.scheduleTemplate.findMany({
      where: { section, is_active: true },
      orderBy: { category: "asc" },
    });
  }

  /**
   * Fetches the complete schedule sheet payload for a project
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param section Schedule section (defaults MATERIAL).
   * @returns Grouped schedule sheet payload used by UI.
   */
  static async getProjectScheduleSheet(
    tx: PrismaTransaction,

    projectId: string,
    section: ScheduleSection = ScheduleSection.MATERIAL
  ) {
    const [project, templates, prefixes, entries] = await Promise.all([
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
      tx.prefixDictionary.findMany({
        where: { section },
        orderBy: { category: "asc" },
        select: { category: true },
      }),
      tx.projectScheduleEntry.findMany({
        where: {
          project_id: projectId,
          section,
        },
        include: {
          options: {
            orderBy: { option_label: "asc" },
            include: { 
              material_catalog: {
                include: {
                  material_requests: {
                    where: { project_id: projectId },
                    select: { status: true, project_id: true }
                  }
                }
              } 
            },
          },
          prefix_ref: true,
        },
        orderBy: { sort_order: "asc" },
      }),
    ]);

    const byCategory = new Map<string, (typeof entries)[number][]>();
    for (const entry of entries) {
      const normalizedCat = entry.category.toUpperCase();
      const current = byCategory.get(normalizedCat) ?? [];
      current.push(entry);
      byCategory.set(normalizedCat, current);
    }

    const allPossibleCategories = [
      ...templates.map((template) => template.category.toUpperCase()),
      ...prefixes.map((prefix) => prefix.category.toUpperCase()),
      ...Array.from(byCategory.keys()),
    ].filter((category, index, all) => all.indexOf(category) === index);

    const orderedCategories = allPossibleCategories.filter((category) => {
      const hasEntries = (byCategory.get(category)?.length ?? 0) > 0;
      return hasEntries || category.trim().toLowerCase() !== "general";
    });

    const groups = allPossibleCategories
      .filter((category) => (byCategory.get(category)?.length ?? 0) > 0)
      .map((category) => ({
        category,
        section,
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
   * Alias for getProjectScheduleSheet with default MATERIAL section.
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param section Optional schedule section.
   * @returns Schedule sheet payload.
   */
  static async getProjectSchedule(tx: PrismaTransaction, projectId: string, section?: ScheduleSection) {
    return this.getProjectScheduleSheet(tx, projectId, section ?? ScheduleSection.MATERIAL);
  }

  /**
   * Fetches the complete schedule entries for a project
   * @param tx Prisma transaction client.
   * @param projectId Project id.
   * @param section Optional schedule section filter.
   * @returns Raw schedule entries with options.
   */
  static async getProjectScheduleEntries(tx: PrismaTransaction, projectId: string, section?: ScheduleSection) {
    return tx.projectScheduleEntry.findMany({
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
      orderBy: { sort_order: "asc" },
    });
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
    mode: "catalog" | "create_catalog" | "reserve",
    catalogItemId?: string | null,
    catalogCreateData?: ScheduleCatalogCreateInput,
    section: ScheduleSection = ScheduleSection.MATERIAL,
    userId?: string
  ): Promise<{ entry: ProjectScheduleEntry; createdCatalogId: string | null }> {
    const normalizedCategory = category.trim().toUpperCase();
    if (!normalizedCategory || normalizedCategory.toLowerCase() === "general") {
      throw new ActionError("Valid material category is required. 'General' is no longer supported.", "VALIDATION_FAILED");
    }

    // 1. Get Prefix
    let prefixDict = await tx.prefixDictionary.findFirst({
      where: {
        category: { equals: normalizedCategory, mode: "insensitive" },
        section,
      },
    });

    if (!prefixDict) {
      prefixDict = await tx.prefixDictionary.create({
        data: {
          category: normalizedCategory,
          prefix: normalizedCategory.substring(0, 2).toUpperCase(),
          section,
        },
      });
    }

    // 2. Determine sort order
    const lastEntry = await tx.projectScheduleEntry.findFirst({
      where: { project_id: projectId, section, category: normalizedCategory },
      orderBy: { sort_order: "desc" },
    });
    const nextSortOrder = (lastEntry?.sort_order ?? 0) + 1;

    // 3. Create Entry
    const entry = await tx.projectScheduleEntry.create({
      data: {
        project_id: projectId,
        category: normalizedCategory,
        section,
        sort_order: nextSortOrder,
        index_number: 9999, // Temp, will be normalized
        code: `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        prefix_id: prefixDict.id,
      },
    });

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_CREATE_ENTRY, "ProjectScheduleEntry", entry.id, userId, {
        project_id: projectId,
        category: normalizedCategory
      });
    }

    // 4. Create first Option with snapshot
    let resolvedCatalogId = null;
    let finalSnapshot: ScheduleSnapshot;
    let isFinal = true;
    let optionStatus: "DRAFT" | "APPROVED" | "NOT_USED" = "APPROVED";

    if (mode === "reserve") {
      finalSnapshot = await buildScheduleSnapshot(tx, null, {
        name: "[RESERVED]",
        brand: "PENDING",
        category: normalizedCategory,
        initials_type: "-",
      });
      isFinal = false; // Reserved slots are not final selections
      optionStatus = "DRAFT"; // Use DRAFT for reserved, not APPROVED
    } else {
      resolvedCatalogId = await resolveCatalogItemForMode(
        tx,
        normalizedCategory,
        mode,
        userId || "SYSTEM",
        catalogItemId,
        catalogCreateData
      );
      finalSnapshot = await buildScheduleSnapshot(tx, resolvedCatalogId, undefined);
    }

    // Validate Snapshot before save
    const validatedSnapshot = ScheduleSnapshotSchema.parse(finalSnapshot);

    const option = await tx.projectScheduleOption.create({
      data: {
        entry_id: entry.id,
        material_catalog_id: resolvedCatalogId,
        data_snapshot: validatedSnapshot as unknown as Prisma.InputJsonValue,
        option_label: "A",
        is_final: isFinal,
        status: optionStatus,
      },
    });

    // 5. Automatic Sync to Library (Auto-Harvesting)
    // Skip for: RESERVE (reserved slots), CATALOG (already in library), CREATE_CATALOG (already created above)
    // Controlled by SCHEDULE_AUTO_HARVEST_ENABLED env var (SSOT §5.2 compliance)
    if (SCHEDULE_AUTO_HARVEST_ENABLED && mode !== "reserve" && mode !== "catalog" && mode !== "create_catalog") {
      await syncOptionToLibrary(tx, option.id, validatedSnapshot, userId);
    }

    // 6. Normalize codes
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
    mode: "catalog" | "create_catalog" | "reserve",
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

    let resolvedCatalogId = null;
    let finalSnapshot: ScheduleSnapshot;

    if (mode === "reserve") {
      finalSnapshot = await buildScheduleSnapshot(tx, null, {
        name: "[RESERVED]",
        brand: "PENDING",
        category: normalizedCategory,
        initials_type: "-",
      });
    } else {
      resolvedCatalogId = await resolveCatalogItemForMode(
        tx,
        category,
        mode,
        userId || "SYSTEM",
        catalogItemId,
        catalogCreateData
      );
      finalSnapshot = await buildScheduleSnapshot(tx, resolvedCatalogId, undefined);
    }

    // Validate Snapshot before save
    const validatedSnapshot = ScheduleSnapshotSchema.parse(finalSnapshot);

    const option = await tx.projectScheduleOption.create({
      data: {
        entry_id: entryId,
        material_catalog_id: resolvedCatalogId,
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

    // 5. Automatic Sync (Auto-Harvesting) - Controlled by env var
    // Skip for: CATALOG (already in library), RESERVE (reserved slots)
    if (SCHEDULE_AUTO_HARVEST_ENABLED && mode !== "catalog" && mode !== "reserve") {
      await syncOptionToLibrary(tx, option.id, validatedSnapshot, userId);
    }

    return { option, createdCatalogId: mode === "create_catalog" ? resolvedCatalogId : null };
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
    data: { qty?: number; unit?: string | null; location?: string | null },
    userId?: string
  ) {
    const entry = await tx.projectScheduleEntry.update({
      where: { id: entryId },
      data: {
        ...(data.qty !== undefined ? { qty: data.qty } : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
      },
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
        category: entry.category,
        code: entry.code,
      });
    }

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
    section: ScheduleSection,
    category: string,
    userId?: string
  ) {
    const normalizedCategory = category.trim().toUpperCase();
    const result = await tx.projectScheduleEntry.deleteMany({
      where: {
        id: { in: entryIds },
        project_id: projectId,
        section,
        category: normalizedCategory,
      },
    });

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_DELETE_ENTRY, "ProjectScheduleEntry", "BULK", userId, {
        project_id: projectId,
        section,
        category: normalizedCategory,
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
  static async normalizeCodes(tx: PrismaTransaction, projectId: string, section: ScheduleSection, category: string) {
    const normalizedCategory = category.trim().toUpperCase();
    if (!normalizedCategory || normalizedCategory.toLowerCase() === "general") {
      console.warn(`[normalizeCodes] Skipped invalid category: "${normalizedCategory || category}"`);
      return;
    }

    const entries = await tx.projectScheduleEntry.findMany({
      where: { project_id: projectId, section, category: normalizedCategory },
      orderBy: { sort_order: "asc" },
      include: { prefix_ref: true },
    });

    if (entries.length === 0) {
      console.warn(`[normalizeCodes] No entries found for project=${projectId} category=${normalizedCategory}`);
      return;
    }

    // Update each entry with correct code and index
    // We update by unique ID so no conflict issues
    await Promise.all(
      entries.map((entry, index) => {
        const prefix = entry.prefix_ref?.prefix || "ITEM";
        const newCode = `${prefix}-${index + 1}`;
        return tx.projectScheduleEntry.update({
          where: { id: entry.id },
          data: { 
            code: newCode,
            index_number: index + 1
          }
        });
      })
    );
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
      name?: string;
      brand?: string;
      initials_type?: string | null;
      reference_url?: string | null;
      image_url?: string | null;
      price?: number | null;
      contact_name?: string | null;
      contact_phone?: string | null;
      contact_email?: string | null;
      specs?: Record<string, unknown>;
      has_sample?: boolean;
    },
    userId: string
  ) {
    const option = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: optionId },
      include: { entry: true }
    });

    const currentSnapshot = (option.data_snapshot as unknown as ScheduleSnapshot) || {} as ScheduleSnapshot;
    
    // Merge new data into snapshot
    const updatedSnapshot: ScheduleSnapshot = {
      ...currentSnapshot,
      name: data.name ?? currentSnapshot.name,
      brand: data.brand ?? currentSnapshot.brand,
      initials_type: data.initials_type !== undefined ? data.initials_type : currentSnapshot.initials_type ?? null,
      reference_url: data.reference_url !== undefined ? data.reference_url : currentSnapshot.reference_url ?? null,
      image_url: data.image_url !== undefined ? data.image_url : currentSnapshot.image_url ?? null,
      price: data.price !== undefined ? data.price : currentSnapshot.price ?? null,
      contact_name: data.contact_name !== undefined ? data.contact_name : currentSnapshot.contact_name ?? null,
      contact_phone: data.contact_phone !== undefined ? data.contact_phone : currentSnapshot.contact_phone ?? null,
      contact_email: data.contact_email !== undefined ? data.contact_email : currentSnapshot.contact_email ?? null,
      has_sample: data.has_sample !== undefined ? data.has_sample : currentSnapshot.has_sample ?? false,
      specs: {
        product_type: (data.specs?.product_type as string) || (currentSnapshot.specs?.product_type as string) || "Unknown",
        motif_or_color: (data.specs?.motif_or_color as string) || (currentSnapshot.specs?.motif_or_color as string) || null,
        tags: (data.specs?.tags as string[]) || (currentSnapshot.specs?.tags as string[]) || [],
        dimensions: (data.specs?.dimensions as string) || (currentSnapshot.specs?.dimensions as string) || "N/A",
        color: (data.specs?.color as string) || (currentSnapshot.specs?.color as string) || null,
        finishing: (data.specs?.finishing as string) || (currentSnapshot.specs?.finishing as string) || null,
        digital_catalog_url: (data.specs?.digital_catalog_url as string) || (currentSnapshot.specs?.digital_catalog_url as string) || null,
        metadata: {
          ...((currentSnapshot.specs?.metadata as Record<string, unknown>) || {}),
          ...((data.specs?.metadata as Record<string, unknown>) || {}),
        },
      },
      source_kind: currentSnapshot.source_kind || "manual",
      source_origin: currentSnapshot.source_origin || "web_manual",
      source_external_id: currentSnapshot.source_external_id || null,
      material_catalog_id: currentSnapshot.material_catalog_id || null,
      category: currentSnapshot.category || "",
      source_payload: currentSnapshot.source_payload || null,
      captured_at: currentSnapshot.captured_at || new Date().toISOString(),
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
    section: ScheduleSection,
    category: string,
    items: { id: string; sort_order: number }[],
    userId?: string
  ) {
    const normalizedCategory = category.trim().toUpperCase();
    
    if (items.length > 0) {
      // Use individual updates instead of raw SQL to avoid type issues
      await Promise.all(
        items.map(item => 
          tx.projectScheduleEntry.update({
            where: { id: item.id },
            data: { sort_order: item.sort_order }
          })
        )
      );
    }

    if (userId) {
      await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_REORDER, "Project", projectId, userId, {
        section,
        category: normalizedCategory,
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
  static async normalizeAllProjectsCodesForCategory(tx: PrismaTransaction, category: string, section: ScheduleSection) {
    const normalizedCategory = category.trim().toUpperCase();
    const projectIds = await tx.projectScheduleEntry.findMany({
      where: { category: normalizedCategory, section },
      select: { project_id: true },
      distinct: ["project_id"],
    });

    for (const { project_id } of projectIds) {
      await this.normalizeCodes(tx, project_id, section, normalizedCategory);
    }
  }


}
