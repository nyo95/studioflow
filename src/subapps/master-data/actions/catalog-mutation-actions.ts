"use server";

import { createAction } from "@/lib/action-wrapper";
import { PERMISSION } from "@/core/rbac/constants";
import { hasPermission } from "@/core/rbac/guards";
import { ActionError } from "@/lib/error-types";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_LIBRARY } from "@/lib/revalidation-tags";
import { CatalogWriteService } from "@/subapps/master-data/services/catalog-write-service";
import {
  LibraryItemStatus,
  LibraryItemStatusSchema,
  ProductMetadataSchema,
} from "@/subapps/master-data/contracts/catalog";
import type {
  LibraryVendor,
  LibraryVendorInput,
  ProductCatalogInput,
  ProductCatalogWithRelations,
} from "@/subapps/master-data/contracts/catalog";

function assertCatalogPermission(role: Parameters<typeof hasPermission>[0], permission: PERMISSION) {
  if (!hasPermission(role, permission)) {
    throw new ActionError(`Unauthorized: missing ${permission}`, "UNAUTHORIZED_ACTION");
  }
}

function canApproveMaterial(role: Parameters<typeof hasPermission>[0]) {
  return hasPermission(role, PERMISSION.MASTERDATA_MATERIAL_APPROVE);
}

export const createVendorAction = createAction<LibraryVendorInput, LibraryVendor>(
  async ({ input, ctx, tx }) => {
    assertCatalogPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_VENDORS);
    const result = await CatalogWriteService.createVendor(input, ctx.userId, tx);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const updateVendorAction = createAction<
  { id: string; data: Partial<LibraryVendorInput> },
  LibraryVendor
>(async ({ input, ctx, tx }) => {
  assertCatalogPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_VENDORS);
  const result = await CatalogWriteService.updateVendor(input.id, input.data, ctx.userId, tx);
  invalidateCache({ scope: REVALIDATE_LIBRARY });
  return result;
});

export const deleteVendorAction = createAction<{ id: string }, LibraryVendor>(
  async ({ input, ctx, tx }) => {
    assertCatalogPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_VENDORS);
    const result = await CatalogWriteService.deleteVendor(input.id, ctx.userId, tx);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const createProductAction = createAction<ProductCatalogInput, ProductCatalogWithRelations>(
  async ({ input, ctx, tx }) => {
    assertCatalogPermission(ctx.role, PERMISSION.LIBRARY_CREATE_ITEM);

    const validatedInput: ProductCatalogInput = {
      ...input,
      catalog_status: LibraryItemStatus.PENDING,
      catalog_metadata: input.catalog_metadata
        ? ProductMetadataSchema.parse(input.catalog_metadata)
        : undefined,
    };

    const result = await CatalogWriteService.createProduct(validatedInput, ctx.userId, tx);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const updateProductAction = createAction<
  { id: string; data: Partial<ProductCatalogInput> },
  ProductCatalogWithRelations
>(async ({ input, ctx, tx }) => {
  assertCatalogPermission(ctx.role, PERMISSION.LIBRARY_EDIT_ITEM);

  const { catalog_status: requestedStatus, ...dataWithoutStatus } = input.data;
  const statusToApply =
    canApproveMaterial(ctx.role) && requestedStatus
      ? LibraryItemStatusSchema.parse(requestedStatus)
      : undefined;

  const validatedData: Partial<ProductCatalogInput> = {
    ...dataWithoutStatus,
    ...(statusToApply !== undefined ? { catalog_status: statusToApply } : {}),
    catalog_metadata: input.data.catalog_metadata
      ? ProductMetadataSchema.parse(input.data.catalog_metadata)
      : undefined,
  };

  const result = await CatalogWriteService.updateProduct(
    input.id,
    validatedData,
    ctx.userId,
    tx,
    ctx.role
  );
  invalidateCache({ scope: REVALIDATE_LIBRARY });
  return result;
});
