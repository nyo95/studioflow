"use server";

import { createAction } from "@/lib/action-wrapper";
import { LibraryService } from "../services/library-service";
import { Sku } from "@/generated/prisma";
// Library gates are permission-based (see assertLibraryPermission below), so the
// role-name helpers assertAdmin / assertAdminOrStaff are deliberately not used here.
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
  ReceiveProductRequestInput,
  ProductMetadataSchema,
  LibraryItemStatusSchema,
  LibraryAccess,
  LibrarySampleRow
} from "../types";
import type { CatalogSampleStatus } from "../types";
import { ProductRequestStatus, SampleAction, ProductType, SampleMovement, Sample, Role } from "@/generated/prisma";
import { LibraryItemStatus } from "../types";
import { REVALIDATE_LIBRARY, REVALIDATE_PROJECT } from "@/lib/revalidation-tags";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import { getProjectMembershipOrThrow } from "@/core/rbac/permissions";

/**
 * Library authorization helper.
 *
 * STAFF maintains the list while admin-level roles (ADMIN, DEVELOPER) own its
 * quality gate. Gating on permissions rather than role names keeps server
 * checks and UI affordances aligned and lets admin-level roles inherit both
 * capabilities without special cases.
 */
function assertLibraryPermission(role: Role, permission: PERMISSION) {
  if (!hasPermission(role, permission)) {
    throw new ActionError(`Unauthorized: missing ${permission}`, "UNAUTHORIZED_ACTION");
  }
}

/** Explicit Material-curation capability: admin-level (ADMIN, DEVELOPER) only. */
function canApproveMaterial(role: Role) {
  return hasPermission(role, PERMISSION.MASTERDATA_MATERIAL_APPROVE);
}

// Promotion-request queue (project draft -> global Master Data) was removed
// 2026-08-10: it operated on MaterialCandidate/SampleCandidate-era concepts
// that Master Data v2 dropped, and FEATURE_PROMOTION_QUEUE_ENABLED was already
// `false` (see src/core/platform/feature-flags.ts) — no live caller depended
// on it. See docs/PLAN-MASTERDATA-V2.md Q13.

// --- VENDOR ACTIONS ---

export const getVendorsAction = createAction<void, LibraryVendor[]>(async ({ tx }) => {
  return LibraryService.getAllVendors(tx);
}, { useTransaction: false });

export const createVendorAction = createAction<LibraryVendorInput, LibraryVendor>(
  async ({ input, ctx, tx }) => {
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_VENDORS);

    const result = await LibraryService.createVendor(input, ctx.userId, tx);

    // LibraryService.createVendor() handles audit logging

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const updateVendorAction = createAction<{ id: string; data: Partial<LibraryVendorInput> }, LibraryVendor>(
  async ({ input, ctx, tx }) => {
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_VENDORS);

    const result = await LibraryService.updateVendor(input.id, input.data, ctx.userId, tx);
    // LibraryService.updateVendor() handles audit logging

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const deleteVendorAction = createAction<{ id: string }, LibraryVendor>(
  async ({ input, ctx, tx }) => {
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_VENDORS);

    const result = await LibraryService.deleteVendor(input.id, ctx.userId, tx);
    // LibraryService.deleteVendor() handles audit logging
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const mergeVendorsAction = createAction<{ sourceVendorId: string; targetVendorId: string }, void>(
  async ({ input, ctx, tx }) => {
    // Consolidating duplicate brands is list curation, so it follows brand
    // management. Note this is the one bulk write in the Library: it re-points
    // every product of the source vendor. Project snapshots stay untouched.
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_BRANDS);

    await LibraryService.mergeVendors(tx, input.sourceVendorId, input.targetVendorId, ctx.userId);

    invalidateCache({ scope: REVALIDATE_LIBRARY });
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
    tags?: string[];
    sort?: "sku" | "newest" | "updated" | "name" | "brand";
    page?: number;
    pageSize?: number;
  },
  { items: ProductCatalogWithRelations[]; total: number }
>(
  async ({ input, ctx, tx }) => {
    // Pending is usable and therefore visible wherever Approved is visible.
    // Rejected remains curator-only. A caller cannot widen its own visibility
    // by requesting REJECTED explicitly.
    const requestedStatuses = input?.status
      ? Array.isArray(input.status)
        ? input.status
        : [input.status]
      : null;
    const status = canApproveMaterial(ctx.role)
      ? input?.status
      : requestedStatuses
        ? requestedStatuses.filter(
            (candidate) =>
              candidate === LibraryItemStatus.PENDING ||
              candidate === LibraryItemStatus.APPROVED
          )
        : [LibraryItemStatus.PENDING, LibraryItemStatus.APPROVED];

    return LibraryService.getAllProducts(tx, { ...input, status }) as Promise<{
      items: ProductCatalogWithRelations[];
      total: number;
    }>;
  },
  { useTransaction: false }
);

/**
 * One SKU with every relation, fetched by id.
 *
 * Exists so a LIST does not have to carry detail. The Master Data materials
 * table used to embed the whole `ProductCatalogWithRelations` object in every
 * row purely so the edit dialog would have it on click — which meant shipping
 * ~200 full object graphs to render one dialog. The table now sends scalars
 * only and calls this when a row is actually opened.
 *
 * Thin on purpose: `LibraryService.getProductById` already existed and does the
 * work. This adds the permission gate and nothing else.
 */
export const getSkuDetailAction = createAction<
  { id: string },
  ProductCatalogWithRelations | null
>(
  async ({ input, ctx, tx }) => {
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_VIEW);
    return LibraryService.getProductById(tx, input.id) as Promise<ProductCatalogWithRelations | null>;
  },
  { useTransaction: false }
);

/**
 * Returns unique values for sub_category, finishing and tags in the catalog.
 * Used to power the smart-suggest dropdowns and the filter facets.
 */
export const getProductMetadataAction = createAction<void, { subCategories: string[]; finishings: string[]; tags: string[] }>(
  async ({ tx }) => {
    return LibraryService.getProductMetadata(tx);
  },
  { useTransaction: false }
);

/**
 * Which categories each brand actually carries — Taco supplies HPL and SPC alike.
 * Powers suggestion + filtering only; new categories remain allowed.
 */
export const getBrandCategoryCoverageAction = createAction<
  void,
  Record<string, { category: string; section: ProductType; count: number }[]>
>(async ({ tx }) => {
  return LibraryService.getBrandCategoryCoverage(tx);
}, { useTransaction: false });

/**
 * Physical sample inventory, queried directly rather than derived from the
 * paginated catalog list.
 */
export const getPhysicalSamplesAction = createAction<
  {
    search?: string;
    status?: CatalogSampleStatus;
    vendorId?: string;
    page?: number;
    pageSize?: number;
  },
  { items: LibrarySampleRow[]; total: number }
>(async ({ input, ctx, tx }) => {
  assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_VIEW);
  return LibraryService.getPhysicalSamples(tx, input) as Promise<{
    items: LibrarySampleRow[];
    total: number;
  }>;
}, { useTransaction: false });

/**
 * The caller's effective Library rights, resolved from the permission matrix.
 *
 * The UI must gate on this rather than comparing role strings. Previously the
 * tabs and buttons were derived from `role === "STAFF" || …` while the server
 * gated on permissions, so STAFF was shown a Requests tab that was always empty
 * and a Modify button whose save always failed.
 */
export const getMyLibraryAccessAction = createAction<void, LibraryAccess>(async ({ ctx }) => {
  const can = (p: PERMISSION) => hasPermission(ctx.role, p);
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
    canApproveMaterial: canApproveMaterial(ctx.role),
    canApprovePromotions: can(PERMISSION.MASTERDATA_PROMOTION_APPROVE),
  };
}, { useTransaction: false });



export const createProductAction = createAction<ProductCatalogInput, Sku>(
  async ({ input, ctx, tx }) => {
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_CREATE_ITEM);

    // Direct intake always starts Pending, including intake by an approver.
    // Approval is a separate, audited update. Pending remains usable.
    const validatedInput: ProductCatalogInput = {
      ...input,
      catalog_status: LibraryItemStatus.PENDING,
      catalog_metadata: input.catalog_metadata ? ProductMetadataSchema.parse(input.catalog_metadata) : undefined,
    };

    const result = await LibraryService.createProduct(validatedInput, ctx.userId, tx);
    
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const updateProductAction = createAction<{ id: string; data: Partial<ProductCatalogInput> }, ProductCatalogWithRelations>(
  async ({ input, ctx, tx }) => {
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_EDIT_ITEM);

    // Editing preserves the current status unless an approver explicitly
    // changes it. A STAFF request may carry the status echoed by its form, but
    // the server strips that field so a crafted request still cannot approve
    // or reject a SKU.
    const { catalog_status: requestedStatus, ...dataWithoutStatus } = input.data;
    const statusToApply = canApproveMaterial(ctx.role) && requestedStatus
      ? LibraryItemStatusSchema.parse(requestedStatus)
      : undefined;

    const validatedData: Partial<ProductCatalogInput> = {
      ...dataWithoutStatus,
      ...(statusToApply !== undefined ? { catalog_status: statusToApply } : {}),
      catalog_metadata: input.data.catalog_metadata ? ProductMetadataSchema.parse(input.data.catalog_metadata) : undefined,
    };

    const result = await LibraryService.updateProduct(input.id, validatedData, ctx.userId, tx, ctx.role);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const deleteProductAction = createAction<{ id: string }, Sku>(
  async ({ input, ctx, tx }) => {
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_DELETE_ITEM);

    const result = await LibraryService.deleteProduct(input.id, ctx.userId, tx);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);

export const getLibraryCategoriesAction = createAction<void, string[]>(async ({ tx }) => {
  return LibraryService.getCategories(tx);
}, { useTransaction: false });

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
}, { useTransaction: false });

export const getMyRoleAction = createAction<void, string>(async ({ ctx }) => {
  return ctx.role;
}, { useTransaction: false });

export const getCatalogSuggestionsAction = createAction<void, Awaited<ReturnType<typeof LibraryService.getSuggestions>>>(
  async ({ tx }) => {
    return LibraryService.getSuggestions(tx);
  },
  { useTransaction: false }
);

// --- PROJECT PRODUCT REQUEST ACTIONS ---

export const getAllProductRequestsAction = createAction<void, ProjectProductRequestWithDetails[]>(
  async ({ ctx, tx }) => {
    // Fulfilling designers' sample requests is the administrative staff's job, so
    // this follows LIBRARY_PROCESS_REQUEST rather than admin level. Previously the
    // UI showed STAFF a Requests tab that this gate kept permanently empty.
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_PROCESS_REQUEST);
    return LibraryService.getAllProductRequests(tx);
  },
  { useTransaction: false }
);

export const getProjectProductRequestsAction = createAction<{ projectId: string }, ProjectProductRequestWithDetails[]>(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
    return LibraryService.getProjectProductRequests(input.projectId, tx);
  },
  { useTransaction: false }
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
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_PROCESS_REQUEST);

    // If RECEIVED and no name provided, use the current user's name
    const staffToRecord = input.staffName || (input.status === "RECEIVED" ? (ctx.user.name ?? null) : null);
    const result = (await LibraryService.updateProjectProductRequestStatus(input.id, input.status, staffToRecord, ctx.userId, tx)) as ProjectProductRequestWithDetails;

    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${result.project_id}` });
    return result;
  }
);

/**
 * §6.14 / PLAN-LIBRARY-BRAND-FIRST.md §9 step 6. Marks a brand-first request
 * RECEIVED by producing a Sku + Sample + rack/box from what STAFF read off
 * the physical box — the request itself only ever carried a Brand and free
 * text, never an SKU. Distinct from updateProductRequestStatusAction, which
 * flips status without creating anything and remains correct for requests
 * that already resolved a sku_id another way.
 */
export const receiveProjectProductRequestAction = createAction<
  ReceiveProductRequestInput,
  ProjectProductRequestWithDetails
>(async ({ input, ctx, tx }) => {
  const request = await tx.projectProductRequest.findUnique({
    where: { id: input.request_id },
    select: { project_id: true },
  });
  if (!request) throw new ActionError("Product request not found", "NOT_FOUND");

  await getProjectMembershipOrThrow(tx, request.project_id, ctx.userId, ctx.role);
  assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_MARK_RECEIVED);

  const result = (await LibraryService.receiveProjectProductRequest(
    input,
    ctx.userId,
    tx
  )) as ProjectProductRequestWithDetails;

  invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${result.project_id}` });
  return result;
});

export const deleteProjectProductRequestAction = createAction<{ id: string }, ProjectProductRequestWithDetails>(
  async ({ input, ctx, tx }) => {
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_PROCESS_REQUEST);

    const result = await LibraryService.deleteProjectProductRequest(input.id, ctx.userId, tx);
    
    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${result.project_id}` });
    return result;
  }
);

export const recordSampleMovementAction = createAction<{
  sampleId: string;
  action: SampleAction;
  notes?: string | null
}, SampleMovement>(
  async ({ input, ctx, tx }) => {
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_SAMPLES);

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

/**
 * Removes ONE physical sample (soft delete). This is the only sanctioned removal
 * path: saving a product never deletes samples, so a sample can no longer vanish
 * as a side effect of an unrelated edit.
 */
export const deletePhysicalSampleAction = createAction<{ sampleId: string }, Sample>(
  async ({ input, ctx, tx }) => {
    assertLibraryPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_SAMPLES);

    const result = await LibraryService.deletePhysicalSample(tx, input.sampleId, ctx.userId);

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return result;
  }
);
