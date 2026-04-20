"use server";

import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { ScheduleService } from "@/lib/services/schedule-service";
import { 
  AddScheduleEntrySchema, 
  AddScheduleEntryInstantSchema,
  AddScheduleEntryWithMaterialSchema,
  AddScheduleOptionSchema, 
  ApproveScheduleOptionSchema, 
  DeleteScheduleEntrySchema,
  UpdateScheduleEntrySchema, 
  ReorderScheduleSchema,
  UpdateScheduleOptionSnapshotSchema,
  IdSchema,
  BulkDeleteScheduleSchema,
} from "@/lib/validations";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_PROJECT } from "@/lib/revalidation-tags";
import { insertAuditLog } from "./_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit/types";
import { evaluateAccess, PERMISSION, RBAC } from "@/lib/rbac";
import { ActionError } from "@/lib/error-types";
import { getProjectMembershipOrThrow } from "@/lib/permissions";
import { Role, ScheduleSection } from "@/generated/prisma";
import { parseGSheetsMaterialCsv } from "@/lib/schedule/csv-parse";
import { importScheduleFromCsv } from "@/lib/schedule/csv-import";

/**
 * RBAC Helper for Scheduler
 */
function assertScheduleAccess(
  ctx: { userId: string; role: Role },
  permission: PERMISSION
) {
  const hasAccess = evaluateAccess(ctx.role, permission, {
    userId: ctx.userId,
  });
  if (!hasAccess) throw new ActionError("Unauthorized Scheduler Action", "UNAUTHORIZED");
}

export const getProjectScheduleAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_VIEW);
    return ScheduleService.getProjectScheduleSheet(tx, input.projectId, input.section);
  },
  { schema: z.object({ projectId: IdSchema, section: z.nativeEnum(ScheduleSection).optional() }) }
);

export const getScheduleCategoriesAction = createAction(
  async ({ input, tx }) => {
    const [templates, prefixes] = await Promise.all([
      tx.scheduleTemplate.findMany({
        where: { section: input.section, is_active: true },
        select: { schedule_category: true },
        distinct: ["schedule_category"],
      }),
      tx.prefixDictionary.findMany({
        where: { section: input.section },
        select: { schedule_category: true },
        distinct: ["schedule_category"],
      }),
    ]);

    const allCategories = new Set([
      ...templates.map(t => t.schedule_category.toUpperCase()),
      ...prefixes.map(p => p.schedule_category.toUpperCase())
    ]);

    return Array.from(allCategories)
      .sort()
      .map(category => ({ category }));
  },
  { schema: z.object({ section: z.nativeEnum(ScheduleSection) }) }
);

export const addScheduleEntryAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_ADD);
    
    const { entry } = await ScheduleService.addEntryToSchedule(
      tx,
      input.projectId,
      input.schedule_category,
      input.mode,
      input.mode === "catalog" ? input.catalogItemId : undefined,
      input.mode === "create_catalog" ? input.catalogCreateData : undefined,
      input.section,
      ctx.userId
    );

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return entry;
  },
  { schema: AddScheduleEntrySchema }
);

export const addScheduleEntryInstantAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_ADD);
    
    const { entry } = await ScheduleService.addEntryToSchedule(
      tx,
      input.projectId,
      input.schedule_category,
      "reserve",
      undefined,
      undefined,
      input.section,
      ctx.userId
    );

    // Fetch entry with options for immediate use
    const entryWithOptions = await tx.projectScheduleEntry.findUnique({
      where: { id: entry.id },
      include: { options: true },
    });

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return entryWithOptions;
  },
  { schema: AddScheduleEntryInstantSchema }
);

export const addScheduleEntryWithMaterialAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_ADD);

    // Get material from catalog
    const material = await tx.materialCatalog.findUniqueOrThrow({
      where: { id: input.materialId },
      include: { vendor: true },
    });

    // Create entry with category from material (in same transaction)
    const { entry } = await ScheduleService.addEntryToSchedule(
      tx,
      input.projectId,
      material.catalog_category,
      "reserve",
      undefined,
      undefined,
      input.section,
      ctx.userId
    );

    // Get the first option (created automatically)
    const option = await tx.projectScheduleOption.findFirst({
      where: { entry_id: entry.id },
      orderBy: { created_at: "asc" },
    });

    if (!option) {
      throw new ActionError("Failed to create option for entry", "CREATION_FAILED");
    }

    // Update option with material data in same transaction
    await ScheduleService.updateOptionSnapshot(
      tx,
      option.id,
      {
        catalog_product_name: material.catalog_product_name || "Unnamed Material",
        catalog_brand: material.vendor?.brand_name || "Generic",
        specs: {
          catalog_sku: material.catalog_sku,
          catalog_color: material.catalog_color || undefined,
          catalog_finishing: material.catalog_finishing || undefined,
          catalog_product_name: material.catalog_motif || undefined,
        },
        catalog_image_url: material.catalog_image_url || undefined,
        catalog_reference_url: material.catalog_reference_url || undefined,
        catalog_price: material.catalog_price || undefined,
      },
      ctx.userId
    );

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });

    // Return entry with options
    return tx.projectScheduleEntry.findUnique({
      where: { id: entry.id },
      include: { options: true },
    });
  },
  { schema: AddScheduleEntryWithMaterialSchema }
);

export const addScheduleOptionAction = createAction(
  async ({ input, ctx, tx }) => {
    const entry = await tx.projectScheduleEntry.findUniqueOrThrow({
      where: { id: input.entryId },
      select: { id: true, project_id: true, schedule_category: true },
    });
    await getProjectMembershipOrThrow(tx, entry.project_id, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_ADD);

    const { option } = await ScheduleService.addOptionToEntry(
      tx,
      input.entryId,
      input.mode,
      entry.schedule_category,
      input.mode === "catalog" ? input.catalogItemId : undefined,
      input.mode === "create_catalog" ? input.catalogCreateData : undefined,
      ctx.userId
    );

    invalidateCache({ scope: REVALIDATE_PROJECT, id: entry.project_id });
    return option;
  },
  { schema: AddScheduleOptionSchema }
);

export const approveScheduleOptionAction = createAction(
  async ({ input, ctx, tx }) => {
    const option = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: input.optionId },
      include: { entry: { select: { project_id: true } } },
    });
    if (option.entry_id !== input.entryId) {
      throw new ActionError("Option does not belong to this entry", "VALIDATION_FAILED");
    }
    await getProjectMembershipOrThrow(tx, option.entry.project_id, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_APPROVE);

    const result = await ScheduleService.approveOption(tx, input.optionId, input.entryId, ctx.userId);

    invalidateCache({ scope: REVALIDATE_PROJECT, id: option.entry.project_id });
    return result;
  },
  { schema: ApproveScheduleOptionSchema }
);

export const updateScheduleEntryAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_EDIT);

    const result = await ScheduleService.updateEntry(tx, input.entryId, input.data, ctx.userId);

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return result;
  },
  { schema: UpdateScheduleEntrySchema }
);

export const updateScheduleOptionSnapshotAction = createAction(
  async ({ input, ctx, tx }) => {
    const option = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: input.optionId },
      include: { entry: { select: { project_id: true } } },
    });
    await getProjectMembershipOrThrow(tx, option.entry.project_id, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_EDIT);

    const result = await ScheduleService.updateOptionSnapshot(tx, input.optionId, input.data, ctx.userId);

    invalidateCache({ scope: REVALIDATE_PROJECT, id: option.entry.project_id });
    return result;
  },
  { schema: UpdateScheduleOptionSnapshotSchema }
);


export const deleteScheduleEntryAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_DELETE);

    const deletedEntry = await ScheduleService.deleteEntry(tx, input.entryId, ctx.userId);

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return deletedEntry;
  },
  { schema: DeleteScheduleEntrySchema }
);

export const bulkDeleteScheduleEntriesAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_DELETE);

    const result = await ScheduleService.deleteEntries(
      tx,
      input.entryIds,
      input.projectId,
      input.section,
      input.schedule_category,
      ctx.userId
    );

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return result;
  },
  { schema: BulkDeleteScheduleSchema }
);

export const reorderScheduleEntriesAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_EDIT);

    await ScheduleService.reorderEntries(tx, input.projectId, input.section, input.schedule_category, input.items, ctx.userId);

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return { success: true };
  },
  { schema: ReorderScheduleSchema }
);

const ImportScheduleSchema = z.object({
  projectId: IdSchema,
  section: z.nativeEnum(ScheduleSection),
  csvContent: z.string(),
  source: z.literal("gsheets").default("gsheets"),
});

export const importScheduleAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_ADD);

    const rows = parseGSheetsMaterialCsv(input.csvContent, input.section);

    if (rows.length === 0) {
      throw new ActionError("No valid rows found in CSV", "VALIDATION_FAILED");
    }

    const result = await importScheduleFromCsv(tx, { projectId: input.projectId, section: input.section, rows });

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_IMPORT, "Project", input.projectId, ctx.userId, {
      section: input.section,
      source: input.source,
      created: result.created,
      updated: result.updated,
    });

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });

    return result;
  },
  { schema: ImportScheduleSchema }
);

export const promoteToLibraryAction = createAction(
  async ({ input, ctx, tx }) => {
    const option = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: input.optionId },
      include: { entry: true }
    });
    
    await getProjectMembershipOrThrow(tx, option.entry.project_id, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    
    const result = await ScheduleService.executePromoteToLibrary(tx, input.optionId, ctx.userId);


    invalidateCache({ scope: REVALIDATE_PROJECT, id: option.entry.project_id });
    return result;
  },
  { schema: z.object({ optionId: IdSchema }) }
);

export const getScheduleSuggestionsAction = createAction(
  async ({ input, tx }) => {
    const [vendors, materials] = await Promise.all([
      tx.vendor.findMany({
        where: { deleted_at: null },
        select: { id: true, brand_name: true },
        orderBy: { brand_name: "asc" }
      }),
      tx.materialCatalog.findMany({
        where: { 
          deleted_at: null,
          status: "APPROVED" 
        },
        include: { vendor: true },
        orderBy: { created_at: "desc" }
      })
    ]);

    return {
      brands: vendors.map(v => ({
        id: v.id,
        name: v.brand_name
      })),
      products: materials.map(m => {
        const sku = m.catalog_sku || "";
        const name = m.catalog_product_name || "";
        
        // Logical Format: [SKU] - [Name] or fallback
        let label = "";
        if (sku && name) label = `[${sku}] - ${name}`;
        else label = sku || name || "Unnamed Material";

        return {
          id: m.id,
          name: label,
          brand: m.vendor.brand_name,
          catalog_category: m.catalog_category,
          metadata: {
            catalog_sku: sku,
            catalog_product_name: name,
            catalog_motif: m.catalog_motif,
            catalog_color: m.catalog_color,
            catalog_finishing: m.catalog_finishing,
            catalog_dimensions: `${m.catalog_dimension_p || "X"} x ${m.catalog_dimension_l || "X"} x ${m.catalog_dimension_t || "X"} ${m.catalog_dimension_unit}`.replace(/X/g, "x"),
            catalog_reference_url: m.catalog_reference_url
          }
        };
      })
    };
  },
  { schema: z.object({ projectId: IdSchema.optional() }) }
);
