"use server";

import { createAction } from "@/lib/action-wrapper";
import { LibraryService } from "../services/library-service";
import { ProductCatalog } from "@/generated/prisma";
import { assertAdmin, assertAdminOrStaff } from "@/lib/permissions";
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
  LibraryItemStatusSchema,
  PromotionRequestWithDetails
} from "../types";
import { ProductRequestStatus, LibraryItemStatus, SampleAction, ProductType } from "@/generated/prisma";
import { REVALIDATE_LIBRARY } from "@/lib/revalidation-tags";

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

export const getPromotionRequestsAction = createAction<void, PromotionRequestWithRelations[]>(async ({ tx }) => {
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
}, any>(
  async ({ input, ctx, tx }) => {
    const option = await tx.projectScheduleOption.findUnique({
      where: { id: input.schedule_option_id },
      include: { entry: true }
    });

    if (!option) throw new Error("Schedule option not found");
    if (!option.data_snapshot) throw new Error("Cannot promote option without snapshot data");

    const result = await LibraryService.createPromotionRequest(tx, {
      project_id: input.project_id,
      schedule_option_id: input.schedule_option_id,
      requested_by_id: ctx.userId,
      snapshot_data: option.data_snapshot,
      notes: input.notes
    });

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
    assertAdminOrStaff(ctx.role);

    const result = await LibraryService.deleteVendor(input.id, ctx.userId, tx);
    // LibraryService.deleteVendor() handles audit logging
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const mergeVendorsAction = createAction<{ sourceVendorId: string; targetVendorId: string }, { success: boolean; productsUpdated: number }>(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);

    if (input.sourceVendorId === input.targetVendorId) {
      throw new Error("Cannot merge vendor with itself");
    }

    const [sourceVendor, targetVendor] = await Promise.all([
      tx.vendor.findUnique({ where: { id: input.sourceVendorId } }),
      tx.vendor.findUnique({ where: { id: input.targetVendorId } })
    ]);

    if (!sourceVendor || !targetVendor) {
      throw new Error("One or both vendors not found");
    }

    const productsUpdated = await tx.productCatalog.updateMany({
      where: { vendor_id: input.sourceVendorId },
      data: { vendor_id: input.targetVendorId }
    });

    await tx.vendor.update({
      where: { id: input.targetVendorId },
      data: {
        company_name: targetVendor.company_name || sourceVendor.company_name,
        company_pt: targetVendor.company_pt || sourceVendor.company_pt,
        address: targetVendor.address || sourceVendor.address,
        website_url: targetVendor.website_url || sourceVendor.website_url,
        instagram_url: targetVendor.instagram_url || sourceVendor.instagram_url,
      }
    });

    await tx.vendor.update({
      where: { id: input.sourceVendorId },
      data: { deleted_at: new Date() }
    });

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return { success: true, productsUpdated: productsUpdated.count };
  }
);

// --- PRODUCT CATALOG ACTIONS ---

export const getProductsAction = createAction<
  any,
  { items: ProductCatalogWithRelations[]; total: number }
>(
  async ({ input, tx }) => {
    return LibraryService.getAllProducts(tx, input);
  }
);

/**
 * Returns unique values for sub_category and finishing fields in the catalog.
 * Used to power the smart-suggest dropdowns in LibraryFormModal.
 */
export const getProductMetadataAction = createAction<void, { subCategories: string[]; finishings: string[] }>(
  async ({ tx }) => {
    const [subCats, finishings] = await Promise.all([
      tx.productCatalog.findMany({
        select: { catalog_sub_category: true },
        distinct: ["catalog_sub_category"],
        where: { catalog_sub_category: { not: null } },
        orderBy: { catalog_sub_category: "asc" },
      }),
      tx.productCatalog.findMany({
        select: { catalog_finishing: true },
        distinct: ["catalog_finishing"],
        where: { catalog_finishing: { not: null } },
        orderBy: { catalog_finishing: "asc" },
      }),
    ]);

    return {
      subCategories: subCats.map((r) => r.catalog_sub_category as string).filter(Boolean),
      finishings: finishings.map((r) => r.catalog_finishing as string).filter(Boolean),
    };
  }
);



export const createProductAction = createAction<ProductCatalogInput, ProductCatalog>(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);
    const validatedInput: ProductCatalogInput = {
      ...input,
      status: input.status ? LibraryItemStatusSchema.parse(input.status) : undefined,
      metadata: input.metadata ? ProductMetadataSchema.parse(input.metadata) : undefined,
    };

    const result = await LibraryService.createProduct(validatedInput, ctx.userId, tx);
    
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const updateProductAction = createAction<{ id: string; data: Partial<ProductCatalogInput> }, ProductCatalogWithRelations>(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);
    const validatedData: Partial<ProductCatalogInput> = {
      ...input.data,
      status: input.data.status ? LibraryItemStatusSchema.parse(input.data.status) : undefined,
      metadata: input.data.metadata ? ProductMetadataSchema.parse(input.data.metadata) : undefined,
    };

    const result = await LibraryService.updateProduct(input.id, validatedData, ctx.userId, tx);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const deleteProductAction = createAction<{ id: string }, ProductCatalog>(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);

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
  { architectural: string[]; ffe: string[] }
>(async ({ tx }) => {
  const rows = await tx.prefixDictionary.findMany({
    select: { schedule_category: true, section: true },
    distinct: ["schedule_category", "section"],
    orderBy: { schedule_category: "asc" },
  });

  const architectural: string[] = [];
  const ffe: string[] = [];

  for (const r of rows) {
    if (r.section === ProductType.fixture) ffe.push(r.schedule_category.toUpperCase());
    else architectural.push(r.schedule_category.toUpperCase());
  }

  return { architectural, ffe };
});



export const getMyRoleAction = createAction<void, string>(async ({ ctx }) => {
  return ctx.role;
});

// --- PROJECT PRODUCT REQUEST ACTIONS ---

export const getAllProductRequestsAction = createAction<void, ProjectProductRequestWithDetails[]>(
  async ({ tx }) => {
    return LibraryService.getAllProductRequests(tx);
  }
);

export const getProjectProductRequestsAction = createAction<{ projectId: string }, ProjectProductRequestWithDetails[]>(
  async ({ input, tx }) => {
    return LibraryService.getProjectProductRequests(input.projectId, tx);
  }
);

export const createProjectProductRequestAction = createAction<ProjectProductRequestInput, ProjectProductRequestWithDetails>(
  async ({ input, ctx, tx }) => {
    const result = await LibraryService.createProjectProductRequest(input, ctx.userId, tx);
    
    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${input.project_id}` });
    return result;
  }
);

export const updateProductRequestStatusAction = createAction<{ id: string; status: ProductRequestStatus; staffName?: string | null }, ProjectProductRequestWithDetails>(
  async ({ input, ctx, tx }) => {
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
}, any>(
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
