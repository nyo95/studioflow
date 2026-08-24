"use server";

import { createAction } from "@/lib/action-wrapper";
import { PERMISSION } from "@/core/rbac/constants";
import { hasPermission } from "@/core/rbac/guards";
import { ActionError } from "@/lib/error-types";
import { CatalogReadService } from "@/subapps/master-data/services/catalog-read-service";
import type {
  BrandCategoryCoverage,
  LibraryAccess,
  LibrarySampleRow,
  LibraryVendor,
  ProductCatalogWithRelations,
} from "@/subapps/master-data/contracts/catalog";
import type { CatalogSampleStatus } from "@/subapps/master-data/contracts/catalog";

function assertCatalogView(canView: boolean) {
  if (!canView) {
    throw new ActionError("Access denied", "FORBIDDEN");
  }
}

export const getMyLibraryAccessAction = createAction<void, LibraryAccess>(
  async ({ ctx }) => {
    const can = (permission: PERMISSION) => hasPermission(ctx.role, permission);
    return {
      role: ctx.role,
      canView: can(PERMISSION.LIBRARY_VIEW),
      canCreate: can(PERMISSION.LIBRARY_CREATE_ITEM),
      canEdit: can(PERMISSION.LIBRARY_EDIT_ITEM),
      canDelete: can(PERMISSION.LIBRARY_DELETE_ITEM),
      canManageVendors: can(PERMISSION.LIBRARY_MANAGE_VENDORS),
      canManageBrands: can(PERMISSION.LIBRARY_MANAGE_BRANDS),
      canManageSamples: can(PERMISSION.LIBRARY_MANAGE_SAMPLES),
      canProcessRequests: can(PERMISSION.LIBRARY_PROCESS_REQUEST),
      canRequestMaterial: can(PERMISSION.LIBRARY_REQUEST_MATERIAL),
      canExport: can(PERMISSION.LIBRARY_EXPORT_LIST),
      canApproveMaterial: can(PERMISSION.MASTERDATA_MATERIAL_APPROVE),
      canApprovePromotions: can(PERMISSION.MASTERDATA_PROMOTION_APPROVE),
    };
  },
  { useTransaction: false }
);

export const getVendorsAction = createAction<void, LibraryVendor[]>(
  async ({ ctx, tx }) => {
    assertCatalogView(hasPermission(ctx.role, PERMISSION.LIBRARY_VIEW));
    return CatalogReadService.getAllVendors(tx);
  },
  { useTransaction: false }
);

export const getSkuDetailAction = createAction<
  { id: string },
  ProductCatalogWithRelations | null
>(
  async ({ input, ctx, tx }) => {
    assertCatalogView(hasPermission(ctx.role, PERMISSION.LIBRARY_VIEW));
    return CatalogReadService.getProductById(tx, input.id);
  },
  { useTransaction: false }
);

export const getProductMetadataAction = createAction<
  void,
  { subCategories: string[]; finishings: string[]; tags: string[] }
>(
  async ({ ctx, tx }) => {
    assertCatalogView(hasPermission(ctx.role, PERMISSION.LIBRARY_VIEW));
    return CatalogReadService.getProductMetadata(tx);
  },
  { useTransaction: false }
);

export const getBrandCategoryCoverageAction = createAction<
  void,
  BrandCategoryCoverage
>(
  async ({ ctx, tx }) => {
    assertCatalogView(hasPermission(ctx.role, PERMISSION.LIBRARY_VIEW));
    return CatalogReadService.getBrandCategoryCoverage(tx);
  },
  { useTransaction: false }
);

export const getPhysicalSamplesAction = createAction<
  {
    search?: string;
    status?: CatalogSampleStatus;
    vendorId?: string;
    page?: number;
    pageSize?: number;
  },
  { items: LibrarySampleRow[]; total: number }
>(
  async ({ input, ctx, tx }) => {
    assertCatalogView(hasPermission(ctx.role, PERMISSION.LIBRARY_VIEW));
    return CatalogReadService.getPhysicalSamples(tx, input) as Promise<{
      items: LibrarySampleRow[];
      total: number;
    }>;
  },
  { useTransaction: false }
);
