"use server";

import { createAction } from "@/lib/action-wrapper";
import { LibraryService } from "../services/library-service";
import { MaterialCatalog } from "@/generated/prisma";
import { assertAdmin, assertAdminOrStaff } from "@/lib/permissions";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_CUSTOM } from "@/lib/revalidation-tags";
import { 
  MaterialCatalogInput, 
  MaterialCatalogWithRelations, 
  LibraryVendor, 
  LibraryVendorInput,
  ProjectMaterialRequestWithDetails,
  ProjectMaterialRequestInput,
  MaterialMetadataSchema,
  LibraryItemStatusSchema
} from "../types";
import { MaterialRequestStatus, LibraryItemStatus } from "@/generated/prisma";
import { REVALIDATE_LIBRARY } from "@/lib/revalidation-tags";

// --- VENDOR ACTIONS ---

export const getVendorsAction = createAction<void, LibraryVendor[]>(async ({ tx }) => {
  return LibraryService.getAllVendors(tx);
});

export const createVendorAction = createAction<LibraryVendorInput, LibraryVendor>(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await LibraryService.createVendor(input, ctx.userId, tx);

    // LibraryService.createVendor() handles audit logging

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const updateVendorAction = createAction<{ id: string; data: Partial<LibraryVendorInput> }, LibraryVendor>(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

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

// --- MATERIAL CATALOG ACTIONS ---

export const getMaterialsAction = createAction<
  { 
    category?: string; 
    vendorId?: string; 
    search?: string; 
    hasPhysicalOnly?: boolean; 
    status?: LibraryItemStatus;
    page?: number;
    pageSize?: number;
  } | undefined,
  { items: MaterialCatalogWithRelations[]; total: number }
>(
  async ({ input, tx }) => {
    return LibraryService.getAllMaterials(tx, input);
  }
);

/**
 * Returns unique values for sub_category and finishing fields in the catalog.
 * Used to power the smart-suggest dropdowns in LibraryFormModal.
 */
export const getMaterialMetadataAction = createAction<void, { subCategories: string[]; finishings: string[] }>(
  async ({ tx }) => {
    const [subCats, finishings] = await Promise.all([
      tx.materialCatalog.findMany({
        select: { catalog_sub_category: true },
        distinct: ["catalog_sub_category"],
        where: { catalog_sub_category: { not: null } },
        orderBy: { catalog_sub_category: "asc" },
      }),
      tx.materialCatalog.findMany({
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



export const createMaterialAction = createAction<MaterialCatalogInput, MaterialCatalogWithRelations>(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);
    const validatedInput: MaterialCatalogInput = {
      ...input,
      status: input.status ? LibraryItemStatusSchema.parse(input.status) : undefined,
      metadata: input.metadata ? MaterialMetadataSchema.parse(input.metadata) : undefined,
    };

    const result = await LibraryService.createMaterial(validatedInput, ctx.userId, tx);
    
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const updateMaterialAction = createAction<{ id: string; data: Partial<MaterialCatalogInput> }, MaterialCatalogWithRelations>(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);
    const validatedData: Partial<MaterialCatalogInput> = {
      ...input.data,
      status: input.data.status ? LibraryItemStatusSchema.parse(input.data.status) : undefined,
      metadata: input.data.metadata ? MaterialMetadataSchema.parse(input.data.metadata) : undefined,
    };

    const result = await LibraryService.updateMaterial(input.id, validatedData, ctx.userId, tx);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const deleteMaterialAction = createAction<{ id: string }, MaterialCatalog>(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);

    const result = await LibraryService.deleteMaterial(input.id, ctx.userId, tx);
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
  { material: string[]; fixture: string[] }
>(async ({ tx }) => {
  const rows = await tx.prefixDictionary.findMany({
    select: { schedule_category: true, section: true },
    distinct: ["schedule_category", "section"],
    orderBy: { schedule_category: "asc" },
  });

  const material: string[] = [];
  const fixture: string[] = [];

  for (const r of rows) {
    if (r.section === "FIXTURE") fixture.push(r.schedule_category.toUpperCase());
    else material.push(r.schedule_category.toUpperCase());
  }

  return { material, fixture };
});



export const getMyRoleAction = createAction<void, string>(async ({ ctx }) => {
  return ctx.role;
});

// --- PROJECT MATERIAL REQUEST ACTIONS ---

export const getAllMaterialRequestsAction = createAction<void, ProjectMaterialRequestWithDetails[]>(
  async ({ tx }) => {
    return LibraryService.getAllMaterialRequests(tx);
  }
);

export const getProjectMaterialRequestsAction = createAction<{ projectId: string }, ProjectMaterialRequestWithDetails[]>(
  async ({ input, tx }) => {
    return LibraryService.getProjectMaterialRequests(input.projectId, tx);
  }
);

export const createProjectMaterialRequestAction = createAction<ProjectMaterialRequestInput, ProjectMaterialRequestWithDetails>(
  async ({ input, ctx, tx }) => {
    const result = await LibraryService.createProjectMaterialRequest(input, ctx.userId, tx);
    
    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${input.project_id}` });
    return result;
  }
);

export const updateMaterialRequestStatusAction = createAction<{ id: string; status: MaterialRequestStatus; staffName?: string | null }, ProjectMaterialRequestWithDetails>(
  async ({ input, ctx, tx }) => {
    // If RECEIVED and no name provided, use the current user's name
    const staffToRecord = input.staffName || (input.status === "RECEIVED" ? (ctx.user.name ?? null) : null);
    const result = (await LibraryService.updateProjectMaterialRequestStatus(input.id, input.status, staffToRecord, ctx.userId, tx)) as ProjectMaterialRequestWithDetails;

    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${result.project_id}` });
    return result;
  }
);

export const deleteProjectMaterialRequestAction = createAction<{ id: string }, ProjectMaterialRequestWithDetails>(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await LibraryService.deleteProjectMaterialRequest(input.id, ctx.userId, tx);
    
    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${result.project_id}` });
    return result;
  }
);
