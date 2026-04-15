"use server";

import { createAction } from "@/lib/action-wrapper";
import { LibraryService } from "../services/library-service";
import { assertAdmin, assertAdminOrStaff } from "@/lib/permissions";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_LIBRARY, REVALIDATE_CUSTOM } from "@/lib/revalidation-tags";
import { 
  MaterialCatalogInput, 
  LibraryVendorInput,
  ProjectMaterialRequestInput,
  MaterialMetadataSchema,
  LibraryItemStatusSchema
} from "../types";
import { MaterialRequestStatus } from "@/generated/prisma";

export const getVendorsAction = createAction(async ({ tx }) => {
  return LibraryService.getAllVendors(tx);
});

export const createVendorAction = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);
    const result = await LibraryService.createVendor(input as LibraryVendorInput, ctx.userId, tx);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const getMaterialsAction = createAction(
  async ({ input, tx }) => {
    return LibraryService.getAllMaterials(tx, input as any);
  }
);

export const createMaterialAction = createAction(
  async ({ input, ctx, tx }) => {
    assertAdminOrStaff(ctx.role);
    const result = await LibraryService.createMaterial(input as MaterialCatalogInput, ctx.userId, tx);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const createProjectMaterialRequestAction = createAction(
  async ({ input, ctx, tx }) => {
    const result = await LibraryService.createProjectMaterialRequest(input as ProjectMaterialRequestInput, ctx.userId, tx);
    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${(input as ProjectMaterialRequestInput).project_id}` });
    return result;
  }
);
