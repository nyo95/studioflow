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
  SwapScheduleEntriesSchema,
  MergeScheduleCategoriesSchema
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
      input.mode === "manual" ? input.catalogCreateData : undefined,
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

export const addScheduleEntryWithProductAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_ADD);

    // Get product from catalog via Facade
    const product = await LibraryService.getProductById(tx, input.product_catalog_id);
    if (!product) throw new ActionError("Product not found in Catalog", "NOT_FOUND");

    if (product.catalog_status !== "APPROVED") {
      throw new ActionError(
        "Cannot use non-approved items in schedule. Status: " + product.catalog_status,
        "INVALID_CATALOG_STATE"
      );
    }

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
      select: { id: true, project_id: true, schedule_category: true, section: true },
    });
    await getProjectMembershipOrThrow(tx, entry.project_id, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_ADD);

    if (input.mode === "catalog" && input.catalogItemId) {
      const catalogItem = await tx.productCatalog.findUnique({
        where: { id: input.catalogItemId },
        select: { catalog_category: true, catalog_type: true, catalog_status: true },
      });
      if (!catalogItem) {
        throw new ActionError("Product not found in catalog", "NOT_FOUND");
      }
      if (catalogItem.catalog_status !== "APPROVED") {
        throw new ActionError(
          "Cannot use non-approved items in schedule. Status: " + catalogItem.catalog_status,
          "INVALID_CATALOG_STATE"
        );
      }
      if (catalogItem.catalog_type !== entry.section) {
        throw new ActionError(
          `Type mismatch: entry is "${entry.section}" but product is "${catalogItem.catalog_type}"`,
          "VALIDATION_FAILED"
        );
      }
      const entryCategory = entry.schedule_category.trim().toUpperCase();
      const itemCategory = catalogItem.catalog_category.trim().toUpperCase();
      if (entryCategory !== itemCategory) {
        throw new ActionError(
          `Category mismatch: entry is "${entry.schedule_category}" but product is in "${catalogItem.catalog_category}"`,
          "VALIDATION_FAILED"
        );
      }
    }

    const { option } = await ScheduleService.addOptionToEntry(
      tx,
      input.entryId,
      input.mode,
      entry.schedule_category,
      input.mode === "catalog" ? input.catalogItemId : undefined,
      input.mode === "manual" ? input.catalogCreateData : undefined,
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

    // Validate ownership
    await ScheduleService.validateOwnership(tx, option.entry.project_id, input.entryId, input.optionId);

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

    // Validate ownership
    await ScheduleService.validateOwnership(tx, input.projectId, input.entryId);

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

    // Validate ownership
    await ScheduleService.validateOwnership(tx, option.entry.project_id, undefined, input.optionId);

    const result = await ScheduleService.updateOptionSnapshot(tx, input.optionId, input.data, ctx.userId);

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

    // DEVIATION PREVENTION: Do not allow moving schedule entries to another category to preserve semantic ID integrity.
    throw new ActionError("Moving items between categories is prohibited to maintain code integrity.", "VALIDATION_FAILED");
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
    const [entryA, entryB] = await Promise.all([
      tx.projectScheduleEntry.findUnique({ where: { id: input.idA } }),
      tx.projectScheduleEntry.findUnique({ where: { id: input.idB } })
    ]);

    if (!entryA || !entryB) {
      throw new ActionError("One or both entries not found", "NOT_FOUND");
    }

    // Verify ownership and project context
    if (entryA.project_id !== input.projectId) {
      throw new ActionError("Unauthorized: Entry belongs to a different project", "UNAUTHORIZED");
    }

    await getProjectMembershipOrThrow(tx, entryA.project_id, ctx.userId, ctx.role);
    
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_EDIT);

    await ScheduleService.swapEntries(tx, input.projectId, input.idA, input.idB, ctx.userId);

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return { success: true };
  },
  { schema: SwapScheduleEntriesSchema }
);

export const mergeScheduleCategoriesAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_EDIT);

    const result = await ScheduleService.mergeCategories(
      tx,
      input.projectId,
      input.section,
      input.sourceCategory,
      input.targetCategory,
      ctx.userId
    );

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return result;
  },
  { schema: MergeScheduleCategoriesSchema }
);

