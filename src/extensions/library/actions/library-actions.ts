"use server";

import { createAction } from "@/lib/action-wrapper";
import { LibraryService } from "../services/library-service";
import { ProductCatalog } from "@/generated/prisma";
import { assertAdmin, assertAdminOrStaff } from "@/core/rbac/permissions";
import { ActionError } from "@/lib/error-types";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_CUSTOM } from "@/lib/revalidation-tags";
import { 
  ProductCatalogInput, 
  ProductCatalogWithRelations, 
  LibraryVendor, 
  LibraryVendorInput,
  ProjectProductRequestWithDetails,
  ProjectProductRequestInput,
  ProductMetadataSchema,
  LibraryItemStatusSchema
} from "../types";
import { ProductRequestStatus, LibraryItemStatus, SampleAction, ProductType, SampleMovementLog, PromotionRequest } from "@/generated/prisma";
import { REVALIDATE_LIBRARY } from "@/lib/revalidation-tags";
import { RBAC } from "@/core/rbac/rbac";
import { getProjectMembershipOrThrow } from "@/core/rbac/permissions";

interface PromotionRequestWithRelations {
  id: string;
  project_id: string;
  schedule_option_id: string;
  requested_by_id: string;
  snapshot_data: unknown;
  notes: string | null;
  status: string;
  reviewed_by_id: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
  project?: { id: string; name: string };
  schedule_option?: { id: string; option_label: string };
  requested_by?: { id: string; name: string };
}

export const getPromotionRequestsAction = createAction<void, PromotionRequestWithRelations[]>(async ({ ctx, tx }) => {
  assertAdmin(ctx.role);
  const results = await LibraryService.getPromotionRequestsWithDetails(tx);
  return results as unknown as PromotionRequestWithRelations[];
});

export const reviewPromotionRequestAction = createAction<{ requestId: string; action: "APPROVED" | "REJECTED"; notes?: string }, PromotionRequestWithRelations>(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await LibraryService.reviewPromotionRequest(tx, input.requestId, input.action, ctx.userId, input.notes);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result as unknown as PromotionRequestWithRelations;
  }
);

export const createPromotionRequestAction = createAction<{ 
  schedule_option_id: string; 
  project_id: string; 
  notes?: string 
}, PromotionRequest>(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.project_id, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.schedule.manage", ctx.role);

    const option = await tx.projectScheduleOption.findUnique({
      where: { id: input.schedule_option_id },
      include: { entry: true }
    });

    if (!option) throw new Error("Schedule option not found");
    if (option.entry.project_id !== input.project_id) {
      throw new Error("Ownership mismatch: Schedule option does not belong to this project.");
    }
    if (!option.data_snapshot) throw new Error("Cannot promote option without snapshot data");

    const result = await LibraryService.createPromotionRequest(tx, {
      project_id: input.project_id,
      schedule_option_id: input.schedule_option_id,
      requested_by_id: ctx.userId,
      snapshot_data: option.data_snapshot,
      notes: input.notes
    });

    if (ctx.role === "ADMIN") {
      await LibraryService.reviewPromotionRequest(tx, result.id, "APPROVED", ctx.userId, "Auto-approved for ADMIN");
    }

    return result;
  }
);

// --- VENDOR ACTIONS ---

export const getVendorsAction = createAction<void, LibraryVendor[]>(async ({ tx }) => {
  return LibraryService.getAllVendors(tx);
});

export const createVendorAction = createAction<LibraryVendorInput, LibraryVendor>(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);

    const result = await LibraryService.createVendor(input, ctx.userId, tx);

    // LibraryService.createVendor() handles audit logging

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const updateVendorAction = createAction<{ id: string; data: Partial<LibraryVendorInput> }, LibraryVendor>(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);

    const result = await LibraryService.updateVendor(input.id, input.data, ctx.userId, tx);
    // LibraryService.updateVendor() handles audit logging

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const deleteVendorAction = createAction<{ id: string }, LibraryVendor>(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await LibraryService.deleteVendor(input.id, ctx.userId, tx);
    // LibraryService.deleteVendor() handles audit logging
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const mergeVendorsAction = createAction<{ sourceVendorId: string; targetVendorId: string }, { success: boolean }>(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    await LibraryService.mergeVendors(tx, input.sourceVendorId, input.targetVendorId, ctx.userId);

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return { success: true };
  }
);

// --- PRODUCT CATALOG ACTIONS ---

export const getProductsAction = createAction<
  { 
    category?: string; 
    vendorId?: string; 
    search?: string; 
    hasPhysicalOnly?: boolean; 
    status?: LibraryItemStatus | LibraryItemStatus[];
    type?: ProductType;
    page?: number;
    pageSize?: number;
  },
  { items: ProductCatalogWithRelations[]; total: number }
>(
  async ({ input, tx }) => {
    return LibraryService.getAllProducts(tx, input) as Promise<{ items: ProductCatalogWithRelations[]; total: number }>;
  }
);

/**
 * Returns unique values for sub_category and finishing fields in the catalog.
 * Used to power the smart-suggest dropdowns in LibraryFormModal.
 */
export const getProductMetadataAction = createAction<void, { subCategories: string[]; finishings: string[] }>(
  async ({ tx }) => {
    return LibraryService.getProductMetadata(tx);
  }
);



export const createProductAction = createAction<ProductCatalogInput, ProductCatalog>(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);

    // GATEKEEPING: Only ADMIN can approve global library items directly.
    // STAFF entries default to PENDING.
    const statusToApply = ctx.role === "ADMIN" 
      ? (input.catalog_status ? LibraryItemStatusSchema.parse(input.catalog_status) : "APPROVED")
      : "PENDING";

    const validatedInput: ProductCatalogInput = {
      ...input,
      catalog_status: statusToApply,
      catalog_metadata: input.catalog_metadata ? ProductMetadataSchema.parse(input.catalog_metadata) : undefined,
    };

    const result = await LibraryService.createProduct(validatedInput, ctx.userId, tx);
    
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const updateProductAction = createAction<{ id: string; data: Partial<ProductCatalogInput> }, ProductCatalogWithRelations>(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);
    const validatedData: Partial<ProductCatalogInput> = {
      ...input.data,
      catalog_status: input.data.catalog_status ? LibraryItemStatusSchema.parse(input.data.catalog_status) : undefined,
      catalog_metadata: input.data.catalog_metadata ? ProductMetadataSchema.parse(input.data.catalog_metadata) : undefined,
    };

    const result = await LibraryService.updateProduct(input.id, validatedData, ctx.userId, tx, ctx.role);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const deleteProductAction = createAction<{ id: string }, ProductCatalog>(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await LibraryService.deleteProduct(input.id, ctx.userId, tx);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const getLibraryCategoriesAction = createAction<void, string[]>(async ({ tx }) => {
  return LibraryService.getCategories(tx);
});

/**
 * Returns categories grouped by section (MATERIAL / FIXTURE) from PrefixDictionary.
 * Used to power the grouped CreatableSearch in LibraryFormModal.
 */
export const getGroupedCategoriesAction = createAction<
  void,
  { materials: string[]; fixtures: string[] }
>(async ({ tx }) => {
  const rows = await tx.prefixDictionary.findMany({
    select: { schedule_category: true, section: true },
    distinct: ["schedule_category", "section"],
    orderBy: { schedule_category: "asc" },
  });

  const materials: string[] = [];
  const fixtures: string[] = [];

  for (const r of rows) {
    if (r.section === ProductType.fixture) fixtures.push(r.schedule_category.toUpperCase());
    else materials.push(r.schedule_category.toUpperCase());
  }

  return { materials, fixtures };
});

export const getMyRoleAction = createAction<void, string>(async ({ ctx }) => {
  return ctx.role;
});

export const getCatalogSuggestionsAction = createAction<void, Awaited<ReturnType<typeof LibraryService.getSuggestions>>>(
  async ({ tx }) => {
    return LibraryService.getSuggestions(tx);
  }
);

// --- PROJECT PRODUCT REQUEST ACTIONS ---

export const getAllProductRequestsAction = createAction<void, ProjectProductRequestWithDetails[]>(
  async ({ ctx, tx }) => {
    assertAdmin(ctx.role);
    return LibraryService.getAllProductRequests(tx);
  }
);

export const getProjectProductRequestsAction = createAction<{ projectId: string }, ProjectProductRequestWithDetails[]>(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    return LibraryService.getProjectProductRequests(input.projectId, tx);
  }
);

export const createProjectProductRequestAction = createAction<ProjectProductRequestInput, ProjectProductRequestWithDetails>(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.project_id, ctx.userId, ctx.role);
    const result = await LibraryService.createProjectProductRequest(input, ctx.userId, tx);
    
    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${input.project_id}` });
    return result;
  }
);

export const updateProductRequestStatusAction = createAction<{ id: string; status: ProductRequestStatus; staffName?: string | null }, ProjectProductRequestWithDetails>(
  async ({ input, ctx, tx }) => {
    // AUTHORIZATION GATE: Verify project membership before update
    const request = await tx.projectProductRequest.findUnique({
      where: { id: input.id },
      select: { project_id: true }
    });
    if (!request) throw new ActionError("Product request not found", "NOT_FOUND");
    
    await getProjectMembershipOrThrow(tx, request.project_id, ctx.userId, ctx.role);
    RBAC.assert(tx, "plugin.library.manage", ctx.role);

    // If RECEIVED and no name provided, use the current user's name
    const staffToRecord = input.staffName || (input.status === "RECEIVED" ? (ctx.user.name ?? null) : null);
    const result = (await LibraryService.updateProjectProductRequestStatus(input.id, input.status, staffToRecord, ctx.userId, tx)) as ProjectProductRequestWithDetails;

    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${result.project_id}` });
    return result;
  }
);

export const deleteProjectProductRequestAction = createAction<{ id: string }, ProjectProductRequestWithDetails>(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await LibraryService.deleteProjectProductRequest(input.id, ctx.userId, tx);
    
    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${result.project_id}` });
    return result;
  }
);

export const recordSampleMovementAction = createAction<{ 
  sampleId: string; 
  action: SampleAction; 
  notes?: string | null 
}, SampleMovementLog>(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);

    const result = await LibraryService.logSampleAction(tx, {
      sample_id: input.sampleId,
      action: input.action,
      notes: input.notes,
      userId: ctx.userId
    });

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);
