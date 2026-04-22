"use server";

import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { ScheduleService } from "@/lib/services/schedule-service";
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
import { insertAuditLog } from "./_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit/types";
import { evaluateAccess, PERMISSION, RBAC } from "@/lib/rbac";
import { ActionError } from "@/lib/error-types";
import { getProjectMembershipOrThrow } from "@/lib/permissions";
import { Role, ProductType } from "@/generated/prisma";
import { parseGSheetsProductCsv } from "@/lib/schedule/csv-parse";
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

export const addScheduleEntryWithProductAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_ADD);

    // Get product from catalog
    const product = await tx.productCatalog.findUniqueOrThrow({
      where: { id: input.product_catalog_id },
      include: { vendor: true },
    });

    // Create entry with category from product (in same transaction)
    const { entry } = await ScheduleService.addEntryToSchedule(
      tx,
      input.projectId,
      product.catalog_category,
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

    // Update option with product data in same transaction
    await ScheduleService.updateOptionSnapshot(
      tx,
      option.id,
      {
        catalog_product_name: product.catalog_product_name || "Unnamed Product",
        catalog_brand: product.vendor?.brand_name || "Generic",
        specs: {
          catalog_sku: product.catalog_sku,
          catalog_color: product.catalog_color || undefined,
          catalog_finishing: product.catalog_finishing || undefined,
          catalog_product_name: product.catalog_motif || undefined,
        },
        catalog_image_url: product.catalog_image_url || undefined,
        catalog_reference_url: product.catalog_reference_url || undefined,
        catalog_price: product.catalog_price || undefined,
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


export const deleteScheduleOptionAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_DELETE);

    const option = await tx.projectScheduleOption.findUniqueOrThrow({
      where: { id: input.optionId },
      include: { entry: true },
    });

    // Delete the option
    await tx.projectScheduleOption.delete({ where: { id: input.optionId } });

    // Audit log
    await insertAuditLog(
      tx,
      AUDIT_ACTIONS.SCHEDULE_DELETE_OPTION,
      "ProjectScheduleOption",
      input.optionId,
      ctx.userId,
      { project_id: option.entry.project_id, entry_id: option.entry_id }
    );

    return { success: true };
  },
  { schema: z.object({ projectId: IdSchema, optionId: IdSchema }) }
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

export const moveEntryToCategoryAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_EDIT);

    await ScheduleService.moveEntryToCategory(
      tx,
      input.entryId,
      input.toCategory,
      input.newIndex + 1, // normalize to 1-based sort order
      ctx.userId
    );

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return { success: true };
  },
  { schema: MoveBetweenCategoriesSchema }
);

const ImportScheduleSchema = z.object({
  projectId: IdSchema,
  section: z.nativeEnum(ProductType),
  csvContent: z.string(),
  source: z.literal("gsheets").default("gsheets"),
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

    const snapshot = option.data_snapshot;
    if (!snapshot) {
      throw new ActionError("Cannot promote option without snapshot data", "SNAPSHOT_MISSING");
    }

    const existingRequest = await tx.promotionRequest.findFirst({
      where: {
        schedule_option_id: input.optionId,
        status: "PENDING"
      }
    });

    if (existingRequest) {
      throw new ActionError("There's already a pending request for this option", "DUPLICATE_REQUEST");
    }

    const result = await tx.promotionRequest.create({
      data: {
        project_id: option.entry.project_id,
        schedule_option_id: input.optionId,
        requested_by_id: ctx.userId,
        snapshot_data: snapshot as any,
        notes: input.notes,
        status: "PENDING",
      }
    });

    await insertAuditLog(
      tx,
      AUDIT_ACTIONS.LIBRARY_CREATE_PROMOTION_REQUEST,
      "PromotionRequest",
      result.id,
      ctx.userId,
      { 
        project_id: option.entry.project_id, 
        schedule_option_id: input.optionId,
        catalog_sku: (snapshot as any).specs?.catalog_sku,
        catalog_product_name: (snapshot as any).catalog_product_name
      }
    );

    invalidateCache({ scope: REVALIDATE_PROJECT, id: option.entry.project_id });
    return { success: true, requestId: result.id, message: "Promotion request submitted for approval" };
  },
  { schema: z.object({ optionId: IdSchema, notes: z.string().optional() }) }
);

export const getScheduleSuggestionsAction = createAction(
  async ({ input, tx }) => {
    const [vendors, products] = await Promise.all([
      tx.vendor.findMany({
        where: { deleted_at: null },
        select: { id: true, brand_name: true },
        orderBy: { brand_name: "asc" }
      }),
      tx.productCatalog.findMany({
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
      products: products.map(m => {
        const sku = m.catalog_sku || "";
        const name = m.catalog_product_name || "";
        
        // Logical Format: [SKU] - [Name] or fallback
        let label = "";
        if (sku && name) label = `[${sku}] - ${name}`;
        else label = sku || name || "Unnamed Product";

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

export const swapScheduleEntriesAction = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);
    assertScheduleAccess(ctx, PERMISSION.PLUGIN_SCHEDULE_EDIT);

    await ScheduleService.swapEntries(tx, input.projectId, input.idA, input.idB, ctx.userId);

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    return { success: true };
  },
  { schema: SwapScheduleEntriesSchema }
);

