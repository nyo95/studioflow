"use server";

import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { ScheduleService } from "@/extensions/schedule/services/schedule-service";
import { 
  AddScheduleEntrySchema, 
  AddScheduleEntryInstantSchema,
  AddScheduleEntryWithProductSchema,
  AddScheduleOptionSchema, 
  ApproveScheduleOptionSchema, 
  DeleteScheduleEntrySchema,
  UpdateScheduleEntrySchema, 
  ReorderScheduleSchema,
  MoveBetweenCategoriesSchema,
  UpdateScheduleOptionSnapshotSchema,
  IdSchema,
  BulkDeleteScheduleSchema,
  SwapScheduleEntriesSchema
} from "@/lib/validations";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_PROJECT } from "@/lib/revalidation-tags";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit/types";
import { evaluateAccess, PERMISSION, RBAC } from "@/core/rbac/rbac";
import { ActionError } from "@/lib/error-types";
import { getProjectMembershipOrThrow } from "@/core/rbac/permissions";
import { Role, ProductType } from "@/generated/prisma";
import { parseGSheetsProductCsv } from "@/lib/schedule/csv-parse";
import { importScheduleFromCsv } from "@/lib/schedule/csv-import";
import { LibraryService } from "@/extensions/library/services/library-service";

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
  { schema: z.object({ projectId: IdSchema, section: z.nativeEnum(ProductType).optional() }) }
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
  { schema: z.object({ section: z.nativeEnum(ProductType) }) }
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
      (input.mode === "create_catalog" || input.mode === "manual") ? input.catalogCreateData : undefined,
      input.section,
      ctx.userId
    );

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_CREATE_ENTRY, "Project", input.projectId, ctx.userId, {
      entryId: entry.id,
      category: input.schedule_category,
      mode: input.mode,
      section: input.section
    });

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

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_CREATE_ENTRY, "Project", input.projectId, ctx.userId, {
      entryId: entry.id,
      category: input.schedule_category,
      mode: "reserve",
      section: input.section,
      instant: true
    });

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

export const addScheduleEntryWithProductAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_ADD);

    // Get product from catalog via Facade
    const product = await LibraryService.getProductById(tx, input.product_catalog_id);
    if (!product) throw new ActionError("Product not found in Catalog", "NOT_FOUND");

    // Create entry with category from product (in same transaction)
    const { entry } = await ScheduleService.addEntryToSchedule(
      tx,
      input.projectId,
      product.catalog_category,
      "catalog",
      product.id,
      undefined,
      input.section,
      ctx.userId
    );

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_CREATE_ENTRY, "Project", input.projectId, ctx.userId, {
      entryId: entry.id,
      productId: product.id,
      category: product.catalog_category,
      section: input.section
    });

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });

    // Return entry with options
    return tx.projectScheduleEntry.findUnique({
      where: { id: entry.id },
      include: { options: true },
    });
  },
  { schema: AddScheduleEntryWithProductSchema }
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
      (input.mode === "create_catalog" || input.mode === "manual") ? input.catalogCreateData : undefined,
      ctx.userId
    );

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_ADD_OPTION, "Project", entry.project_id, ctx.userId, {
      entryId: input.entryId,
      optionId: option.id,
      mode: input.mode
    });

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

    // Validate ownership
    await ScheduleService.validateOwnership(tx, option.entry.project_id, input.entryId, input.optionId);

    const result = await ScheduleService.approveOption(tx, input.optionId, input.entryId, ctx.userId);

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_APPROVE_OPTION, "Project", option.entry.project_id, ctx.userId, {
      entryId: input.entryId,
      optionId: input.optionId
    });

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

    // Validate ownership
    await ScheduleService.validateOwnership(tx, input.projectId, input.entryId);

    const result = await ScheduleService.updateEntry(tx, input.entryId, input.data, ctx.userId);

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_ENTRY, "Project", input.projectId, ctx.userId, {
      entryId: input.entryId,
      updatedFields: Object.keys(input.data)
    });

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

    // Validate ownership
    await ScheduleService.validateOwnership(tx, option.entry.project_id, undefined, input.optionId);

    const result = await ScheduleService.updateOptionSnapshot(tx, input.optionId, input.data, ctx.userId);

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_SNAPSHOT, "Project", option.entry.project_id, ctx.userId, {
      optionId: input.optionId,
      updatedFields: Object.keys(input.data)
    });

    invalidateCache({ scope: REVALIDATE_PROJECT, id: option.entry.project_id });
    return result;
  },
  { schema: UpdateScheduleOptionSnapshotSchema }
);


export const deleteScheduleOptionAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_DELETE);

    // Validate ownership before smart delete
    await ScheduleService.validateOwnership(tx, input.projectId, undefined, input.optionId);

    const result = await ScheduleService.smartDeleteOption(tx, input.optionId, ctx.userId);

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_DELETE_OPTION, "Project", input.projectId, ctx.userId, {
      optionId: input.optionId
    });

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return result;
  },
  { schema: z.object({ projectId: IdSchema, optionId: IdSchema }) }
);

export const deleteScheduleEntryAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_DELETE);

    // Validate ownership
    await ScheduleService.validateOwnership(tx, input.projectId, input.entryId);

    const deletedEntry = await ScheduleService.deleteEntry(tx, input.entryId, ctx.userId);

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_DELETE_ENTRY, "Project", input.projectId, ctx.userId, {
      entryId: input.entryId,
      code: `${deletedEntry.schedule_prefix}-${String(deletedEntry.schedule_increment).padStart(2, "0")}`
    });

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

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_DELETE_ENTRY, "Project", input.projectId, ctx.userId, {
      count: result.count,
      category: input.schedule_category,
      section: input.section
    });

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

    // Validate all items belong to this project and category
    const count = await tx.projectScheduleEntry.count({
      where: {
        id: { in: input.items.map(i => i.id) },
        project_id: input.projectId,
        section: input.section,
        schedule_category: input.schedule_category.trim().toUpperCase()
      }
    });
    if (count !== input.items.length) {
      throw new ActionError("One or more items do not belong to this project or category.", "OWNERSHIP_VIOLATION");
    }

    await ScheduleService.reorderEntries(tx, input.projectId, input.section, input.schedule_category, input.items, ctx.userId);

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_REORDER, "Project", input.projectId, ctx.userId, {
      category: input.schedule_category,
      section: input.section,
      itemCount: input.items.length
    });

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return { success: true };
  },
  { schema: ReorderScheduleSchema }
);

export const moveEntryToCategoryAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_EDIT);

    // Validate ownership
    await ScheduleService.validateOwnership(tx, input.projectId, input.entryId);

    await ScheduleService.moveEntryToCategory(
      tx,
      input.entryId,
      input.toCategory,
      input.newIndex + 1, // normalize to 1-based sort order
      ctx.userId
    );

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_UPDATE_ENTRY, "Project", input.projectId, ctx.userId, {
      entryId: input.entryId,
      move: { toCategory: input.toCategory }
    });

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return { success: true };
  },
  { schema: MoveBetweenCategoriesSchema }
);

const ImportScheduleSchema = z.object({
  projectId: IdSchema,
  section: z.nativeEnum(ProductType),
  csvContent: z.string(),
  source: z.enum(["gsheets", "sketchup"]).default("gsheets"),
});

export const importScheduleAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_ADD);

    const rows = parseGSheetsProductCsv(input.csvContent, input.section);

    if (rows.length === 0) {
      throw new ActionError("No valid rows found in CSV", "VALIDATION_FAILED");
    }

    const sourceOrigin = input.source === "sketchup" ? "sketchup_plugin" : "gsheets_import";

    const result = await importScheduleFromCsv(tx, { 
      projectId: input.projectId, 
      section: input.section, 
      rows,
      sourceOrigin 
    });

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



export const getScheduleSuggestionsAction = createAction(
  async ({ tx }) => {
    return LibraryService.getSuggestions(tx);
  },
  { schema: z.object({ projectId: IdSchema.optional() }) }
);

export const swapScheduleEntriesAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_EDIT);

    await ScheduleService.swapEntries(tx, input.projectId, input.idA, input.idB);

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_REORDER, "Project", input.projectId, ctx.userId, {
      idA: input.idA,
      idB: input.idB,
      type: "SWAP"
    });

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return { success: true };
  },
  { schema: SwapScheduleEntriesSchema }
);
