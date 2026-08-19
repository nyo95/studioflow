"use server";

/**
 * MASTER DATA — sample request follow-up.
 *
 * A designer files a ProjectProductRequest in StudioFlow; staff work it here.
 * The lifecycle this file owns:
 *
 *   REQUESTED  --vendorFollowUp-->  IN_PROGRESS  --receiveSample-->  RECEIVED
 *        \                               /
 *         `------ markUnavailable ------'  (both can be marked UNAVAILABLE)
 *
 * Master Data v2 (2026-08-10, M5): `ProjectProductRequest.brand_id`/`sku_id`
 * are plain columns now, not Prisma relations — Schedule/StudioFlow must not
 * join directly into `master_data`. This file batch-resolves Brand/Sku by id
 * instead of `include`-ing them, and writes `brand_name_snapshot`/
 * `sku_name_snapshot` alongside the ids so a later read never needs the join
 * even if the referenced row moves or disappears.
 *
 * A quoted price optionally upserts `master_data.SkuPrice` — but SkuPrice
 * requires a `sku_id` in v2 (MaterialPrice's brand-level, SKU-less rows are
 * gone), so syncing is only possible once the request already has a SKU.
 *
 * Reads require MASTERDATA_VIEW. Writes require LIBRARY_PROCESS_REQUEST.
 */

import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { PERMISSION } from "@/core/rbac/constants";
import { hasPermission } from "@/core/rbac/guards";
import { ActionError } from "@/lib/error-types";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit/types";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_LIBRARY } from "@/lib/revalidation-tags";
import { normaliseLocation } from "../lib/sample-location";
import { recordSkuPrice } from "../services/sku-price-service";
import { createSkuCore } from "../services/sku-core-service";
import type { Prisma } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import type {
  MarkUnavailableInput,
  ReceiveSampleInput,
  SampleRequestData,
  SampleRequestStatus,
  VendorFollowUpInput,
} from "../types/sample-request";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const VendorFollowUpSchema = z.object({
  requestId: z.string().min(1),
  vendorContactedAt: z.string().nullable().default(null),
  vendorQuotedPrice: z
    .union([z.number(), z.string(), z.null()])
    .transform((v) => (v === null || v === "" ? null : Number(v)))
    .nullable(),
  vendorQuotedUnit: z.string().default(""),
  vendorNotes: z.string().default(""),
  syncToMaterialPrice: z.boolean().default(false),
});

const ReceiveSampleSchema = z.object({
  requestId: z.string().min(1),
  catalogSku: z.string().min(1, "SKU is required"),
  catalogProductName: z.string().min(1, "Product name is required"),
  catalogColor: z.string().default(""),
  catalogMotif: z.string().default(""),
  catalogFinishing: z.string().default(""),
  rackNumber: z.string().min(1, "Rack number is required"),
  boxNumber: z.string().min(1, "Box number is required"),
  quantity: z.coerce.number().int().min(1).default(1),
  locationNote: z.string().default(""),
});

const MarkUnavailableSchema = z.object({
  requestId: z.string().min(1),
  reason: z.string().min(1, "A reason is required so the designer knows why"),
});

const ReopenSchema = z.object({ requestId: z.string().min(1) });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type RawRequest = {
  id: string;
  status: string;
  custom_product_name: string | null;
  area_location: string | null;
  reference_url: string | null;
  notes: string | null;
  brand_id: string | null;
  brand_name_snapshot: string | null;
  sku_id: string | null;
  sku_name_snapshot: string | null;
  project_id: string;
  staff_name_override: string | null;
  created_at: Date;
  vendor_contacted_by: string | null;
  vendor_contacted_at: Date | null;
  vendor_quoted_price: unknown;
  vendor_quoted_unit: string | null;
  vendor_notes: string | null;
  linked_sample_id: string | null;
  updated_at: Date;
  requested_by_id: string;
};

type BrandContext = {
  id: string;
  name: string;
  owner: { name: string } | null;
  scoped_contacts: { person_name: string; job_title: string | null; phone: string | null; email: string | null }[];
};

function trimOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Batch-resolves the Brand/Sku/User context a set of requests reference — no Prisma relation exists for these anymore (M5). */
async function loadRequestContext(tx: PrismaTransaction, requests: RawRequest[]) {
  const brandIds = [...new Set(requests.map((r) => r.brand_id).filter((v): v is string => !!v))];
  const userIds = [...new Set([
    ...requests.map((r) => r.requested_by_id),
  ])];
  const projectIds = [...new Set(requests.map((r) => r.project_id))];

  const [brands, users, projects] = await Promise.all([
    brandIds.length
      ? tx.brand.findMany({
          where: { id: { in: brandIds } },
          include: {
            owner: { select: { name: true } },
            scoped_contacts: { select: { person_name: true, job_title: true, phone: true, email: true } },
          },
        })
      : Promise.resolve([] as BrandContext[]),
    userIds.length ? tx.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
    projectIds.length ? tx.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);

  return {
    brandMap: new Map(brands.map((b) => [b.id, b])),
    userMap: new Map(users.map((u) => [u.id, u])),
    projectMap: new Map(projects.map((p) => [p.id, p])),
  };
}

function mapRequest(
  r: RawRequest,
  ctx: { brandMap: Map<string, BrandContext>; userMap: Map<string, { id: string; name: string }>; projectMap: Map<string, { id: string; name: string }> }
): SampleRequestData {
  const brand = r.brand_id ? ctx.brandMap.get(r.brand_id) ?? null : null;
  const requestedBy = ctx.userMap.get(r.requested_by_id) ?? null;
  const project = ctx.projectMap.get(r.project_id) ?? null;

  return {
    id: r.id,
    status: r.status as SampleRequestStatus,

    itemName:
      r.custom_product_name?.trim() ||
      r.sku_name_snapshot?.trim() ||
      "(tanpa nama)",
    areaLocation: r.area_location,
    referenceUrl: r.reference_url,
    notes: r.notes,

    brandId: r.brand_id,
    brandName: brand?.name ?? r.brand_name_snapshot,
    companyName: brand?.owner?.name ?? null,
    brandContacts: (brand?.scoped_contacts ?? []).map((c) => ({
      contact_person: c.person_name,
      contact_role: c.job_title ?? null,
      phone_number: c.phone ?? null,
      email: c.email ?? null,
    })),

    skuId: r.sku_id,
    skuCode: null,
    skuProductName: r.sku_name_snapshot,

    projectId: r.project_id,
    projectName: project?.name ?? "(project deleted)",
    requestedByName: r.staff_name_override || requestedBy?.name || "—",
    requestedAt: r.created_at,

    vendorContactedBy: r.vendor_contacted_by ?? null,
    vendorContactedAt: r.vendor_contacted_at ?? null,
    vendorQuotedPrice: r.vendor_quoted_price != null ? Number(r.vendor_quoted_price) : null,
    vendorQuotedUnit: r.vendor_quoted_unit ?? null,
    vendorNotes: r.vendor_notes ?? null,

    linkedSampleId: r.linked_sample_id,
    updatedAt: r.updated_at,
  };
}

/**
 * Mirrors a vendor quote into `master_data.SkuPrice`.
 *
 * v2's SkuPrice requires a sku_id — unlike v1's MaterialPrice, a quote cannot
 * be stored ahead of a registered SKU. Callers must check `args.skuId` first.
 *
 * Goes through `recordSkuPrice` like every other price write (2026-08-11).
 * The hand-rolled version this replaces demoted only supplier-less rows and
 * never stamped `valid_to`, so a quote synced from here would have collided
 * with `SkuPrice_current_uniq` the moment a supplier was attached.
 *
 * A quote taken over the phone has no supplier Party yet — the request records
 * WHO was contacted as free text, not as a relation. So this writes the
 * supplier-less row on purpose: it is the studio's own note of a quoted price,
 * and promoting it to a named supplier's offer would claim more than was
 * actually captured.
 */
async function syncSkuPrice(
  tx: PrismaTransaction,
  args: {
    skuId: string;
    price: number;
    unit: string | null;
    staffName: string;
    notes: string | null;
  },
  actor?: { id?: string | null; name: string }
) {
  return recordSkuPrice(tx, {
    sku_id: args.skuId,
    supplier_party_id: null,
    price: args.price,
    unit: args.unit,
    notes: args.notes,
    updated_by_name: args.staffName,
  }, actor);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export const getOpenSampleRequestsAction = createAction<undefined, SampleRequestData[]>(
  async ({ ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const rows = await tx.projectProductRequest.findMany({
      where: { status: { in: ["REQUESTED", "IN_PROGRESS"] } },
      orderBy: { created_at: "asc" },
    });
    const requestCtx = await loadRequestContext(tx, rows);
    return rows.map((r) => mapRequest(r, requestCtx));
  },
  { useTransaction: false }
);

export const getClosedSampleRequestsAction = createAction<
  { limit?: number },
  SampleRequestData[]
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const rows = await tx.projectProductRequest.findMany({
      where: { status: { in: ["RECEIVED", "UNAVAILABLE"] } },
      orderBy: { updated_at: "desc" },
      take: input?.limit ?? 30,
    });
    const requestCtx = await loadRequestContext(tx, rows);
    return rows.map((r) => mapRequest(r, requestCtx));
  },
  { schema: z.object({ limit: z.number().optional() }), useTransaction: false }
);

// ---------------------------------------------------------------------------
// Write — vendor follow-up
// ---------------------------------------------------------------------------

export const recordVendorFollowUpAction = createAction<
  VendorFollowUpInput,
  SampleRequestData
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.LIBRARY_PROCESS_REQUEST)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const existing = await tx.projectProductRequest.findUnique({ where: { id: input.requestId } });
    if (!existing) throw new ActionError("Request not found", "NOT_FOUND");
    if (existing.status === "RECEIVED") {
      throw new ActionError(
        "This request has been received. Reopen it first to change vendor details.",
        "CONFLICT"
      );
    }

    const staffName = ctx.user?.name ?? ctx.role;
    const price = input.vendorQuotedPrice != null ? Number(input.vendorQuotedPrice) : null;
    const unit = trimOrNull(input.vendorQuotedUnit);

    if (price != null && !unit) {
      throw new ActionError(
        "A unit is required when a price is entered — BQ cannot compute without one.",
        "VALIDATION_FAILED"
      );
    }

    const updated = await tx.projectProductRequest.update({
      where: { id: input.requestId },
      data: {
        vendor_contacted_by: staffName,
        vendor_contacted_at: input.vendorContactedAt
          ? new Date(input.vendorContactedAt)
          : new Date(),
        vendor_quoted_price: price,
        vendor_quoted_unit: unit,
        vendor_notes: trimOrNull(input.vendorNotes),
        status: existing.status === "REQUESTED" ? "IN_PROGRESS" : existing.status,
      },
    });

    let pricedSynced = false;
    if (input.syncToMaterialPrice && price != null) {
      if (!existing.sku_id) {
        throw new ActionError(
          "Master Data v2 requires every price to hang off a SKU. This request has none yet — receive the sample first, then sync the price.",
          "SKU_REQUIRED"
        );
      }
      await syncSkuPrice(tx, {
        skuId: existing.sku_id,
        price,
        unit,
        staffName,
        notes: trimOrNull(input.vendorNotes),
      }, { id: ctx.userId, name: ctx.user.name ?? "" });
      pricedSynced = true;
    }

    await insertAuditLog(
      tx,
      AUDIT_ACTIONS.MASTERDATA_REQUEST_VENDOR_FOLLOWUP,
      "ProjectProductRequest",
      input.requestId,
      ctx.userId,
      { quoted_price: price, unit, synced_to_material_price: pricedSynced }
    );

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    const requestCtx = await loadRequestContext(tx, [updated]);
    return mapRequest(updated, requestCtx);
  },
  { schema: VendorFollowUpSchema }
);

// ---------------------------------------------------------------------------
// Write — receive
// ---------------------------------------------------------------------------

export const receiveSampleAction = createAction<ReceiveSampleInput, SampleRequestData>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.LIBRARY_PROCESS_REQUEST)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const request = await tx.projectProductRequest.findUnique({
      where: { id: input.requestId },
      select: { id: true, brand_id: true, status: true, sku_id: true },
    });
    if (!request) throw new ActionError("Request not found", "NOT_FOUND");
    if (request.status === "RECEIVED") {
      throw new ActionError("This request has already been received.", "CONFLICT");
    }
    if (!request.brand_id) {
      throw new ActionError(
        "Request tidak punya Brand — sample tidak bisa diterima tanpa brand relasional.",
        "BRAND_REQUIRED"
      );
    }

    const brand = await tx.brand.findUnique({ where: { id: request.brand_id } });
    if (!brand || brand.deleted_at) {
      throw new ActionError("Brand tidak valid.", "VENDOR_REQUIRED");
    }

    const catalogSku = input.catalogSku.trim();
    const catalogProductName = input.catalogProductName.trim();

    let sku = await tx.sku.findFirst({
      where: {
        brand_id: brand.id,
        code: { equals: catalogSku, mode: "insensitive" },
        deleted_at: null,
      },
    });

    if (!sku) {
      const spec: Record<string, unknown> = {};
      const color = trimOrNull(input.catalogColor);
      const motif = trimOrNull(input.catalogMotif);
      const finishing = trimOrNull(input.catalogFinishing);
      if (color) spec.color = color;
      if (motif) spec.motif = motif;
      if (finishing) spec.finishing = finishing;

      // B5 (2026-08-18): create + slug + audit now go through `createSkuCore`
      // (see its doc comment). Before this, the SKU created here got a plain
      // `slugify()` with no uniqueness check, AND its creation event was
      // written TWICE — once to `studioflow.AuditLog` via `insertAuditLog`,
      // once to `master_data.MasterDataAudit` via a separately-added
      // `recordAudit` call — exactly the dual-write §6 rules out (the same
      // defect fixed at the other four SKU-creation sites). `createSkuCore`
      // now owns the one `recordAudit` call for the SKU itself; the
      // `insertAuditLog` below for `MASTERDATA_REQUEST_RECEIVE` is a
      // different entity (the request, a StudioFlow record) and stays.
      sku = await createSkuCore(
        tx,
        {
          data: {
            brand_id: brand.id,
            code: catalogSku,
            name: catalogProductName,
            base_unit: "pcs",
            spec: Object.keys(spec).length > 0 ? (spec as Prisma.InputJsonValue) : undefined,
            status: "DRAFT",
          },
          slugSeed: catalogProductName || catalogSku,
        },
        { id: ctx.userId, name: ctx.user.name ?? "" }
      );
    }

    const sample = await tx.sample.create({
      data: {
        sku_id: sku.id,
        rack_number: normaliseLocation(input.rackNumber),
        box_number: normaliseLocation(input.boxNumber),
        location_note: trimOrNull(input.locationNote),
        quantity: input.quantity,
        status: "AVAILABLE",
      },
    });

    const updated = await tx.projectProductRequest.update({
      where: { id: input.requestId },
      data: {
        status: "RECEIVED",
        sku_id: sku.id,
        sku_name_snapshot: sku.name,
        linked_sample_id: sample.id,
      },
    });

    await insertAuditLog(
      tx,
      AUDIT_ACTIONS.MASTERDATA_REQUEST_RECEIVE,
      "ProjectProductRequest",
      input.requestId,
      ctx.userId,
      { sku_id: sku.id, sample_id: sample.id, rack: input.rackNumber, box: input.boxNumber }
    );

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    const requestCtx = await loadRequestContext(tx, [updated]);
    return mapRequest(updated, requestCtx);
  },
  { schema: ReceiveSampleSchema }
);

// ---------------------------------------------------------------------------
// Write — unavailable / reopen
// ---------------------------------------------------------------------------

export const markRequestUnavailableAction = createAction<
  MarkUnavailableInput,
  SampleRequestData
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.LIBRARY_PROCESS_REQUEST)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const existing = await tx.projectProductRequest.findUnique({
      where: { id: input.requestId },
      select: { id: true, status: true, vendor_notes: true },
    });
    if (!existing) throw new ActionError("Request not found", "NOT_FOUND");
    if (existing.status === "RECEIVED") {
      throw new ActionError(
        "This request has been received — it cannot be marked unavailable.",
        "CONFLICT"
      );
    }

    const staffName = ctx.user?.name ?? ctx.role;
    const stamped = `[Unavailable — ${staffName}] ${input.reason.trim()}`;
    const merged = existing.vendor_notes
      ? `${existing.vendor_notes}\n${stamped}`
      : stamped;

    const updated = await tx.projectProductRequest.update({
      where: { id: input.requestId },
      data: {
        status: "UNAVAILABLE",
        vendor_notes: merged,
        vendor_contacted_by: staffName,
        vendor_contacted_at: new Date(),
      },
    });

    await insertAuditLog(
      tx,
      AUDIT_ACTIONS.MASTERDATA_REQUEST_UNAVAILABLE,
      "ProjectProductRequest",
      input.requestId,
      ctx.userId,
      { reason: input.reason }
    );

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    const requestCtx = await loadRequestContext(tx, [updated]);
    return mapRequest(updated, requestCtx);
  },
  { schema: MarkUnavailableSchema }
);

export const reopenSampleRequestAction = createAction<
  { requestId: string },
  SampleRequestData
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.LIBRARY_PROCESS_REQUEST)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const existing = await tx.projectProductRequest.findUnique({
      where: { id: input.requestId },
      select: { id: true, status: true, vendor_contacted_at: true },
    });
    if (!existing) throw new ActionError("Request not found", "NOT_FOUND");
    if (existing.status === "REQUESTED" || existing.status === "IN_PROGRESS") {
      throw new ActionError("This request is still open.", "CONFLICT");
    }

    const updated = await tx.projectProductRequest.update({
      where: { id: input.requestId },
      data: {
        status: existing.vendor_contacted_at ? "IN_PROGRESS" : "REQUESTED",
      },
    });

    await insertAuditLog(
      tx,
      AUDIT_ACTIONS.MASTERDATA_REQUEST_REOPEN,
      "ProjectProductRequest",
      input.requestId,
      ctx.userId,
      { from: existing.status, to: updated.status }
    );

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    const requestCtx = await loadRequestContext(tx, [updated]);
    return mapRequest(updated, requestCtx);
  },
  { schema: ReopenSchema }
);
