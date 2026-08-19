"use server";

import { createAction } from "@/lib/action-wrapper";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import { ActionError } from "@/lib/error-types";
import {
  BrandLibraryService,
  type BrandSearchResult,
  type BrandDetail,
} from "../services/brand-library-service";

/**
 * §6.14 Brand-First Library actions. Gated on LIBRARY_VIEW — the permission
 * DIC/DRIC already hold (MASTER_SSOT §6.2 rule 6) — because this is a
 * read-only re-presentation of Library, not a new capability. No write action
 * is defined here on purpose: this surface is search + browse only.
 */

function assertCanViewLibrary(role: import("@/generated/prisma").Role) {
  if (!hasPermission(role, PERMISSION.LIBRARY_VIEW)) {
    throw new ActionError("Unauthorized: missing LIBRARY_VIEW", "UNAUTHORIZED_ACTION");
  }
}

/** Search a material/category term, get the brands that supply it. */
export const searchBrandsAction = createAction<string, BrandSearchResult[]>(
  async ({ input, ctx, tx }) => {
    assertCanViewLibrary(ctx.role);
    return BrandLibraryService.searchBrands(tx, input ?? "");
  },
  { useTransaction: false },
);

/** Chips for the empty state. Category is an affordance, not navigation. */
export const suggestedCategoriesAction = createAction<void, string[]>(
  async ({ ctx, tx }) => {
    assertCanViewLibrary(ctx.role);
    return BrandLibraryService.suggestedCategories(tx);
  },
  { useTransaction: false },
);

export const getBrandDetailAction = createAction<string, BrandDetail | null>(
  async ({ input, ctx, tx }) => {
    assertCanViewLibrary(ctx.role);
    if (!input) throw new ActionError("brandId wajib diisi", "VALIDATION_ERROR");
    return BrandLibraryService.getBrandDetail(tx, input);
  },
  { useTransaction: false },
);
