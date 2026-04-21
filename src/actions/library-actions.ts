"use server";

import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { LibraryService } from "@/extensions/library/services/library-service";
import { ActionError } from "@/lib/error-types";
import { insertAuditLog } from "./_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit/types";
import { PromotionRequest, ProductCatalog } from "@/generated/prisma";

const CreatePromotionRequestInputSchema = z.object({
  schedule_option_id: z.string().uuid(),
  project_id: z.string().uuid(),
  notes: z.string().optional()
});

const IdSchema = z.object({ id: z.string().uuid() });

type CreatePromotionRequestInput = z.infer<typeof CreatePromotionRequestInputSchema>;
type IdInput = z.infer<typeof IdSchema>;

interface ScheduleSnapshotSpecs {
  catalog_sku?: string;
  catalog_dimension?: {
    p?: string;
    l?: string;
    t?: string;
    unit?: string;
  };
}

interface ScheduleSnapshot {
  catalog_brand?: string;
  schedule_category?: string;
  catalog_sub_category?: string;
  catalog_product_name?: string;
  catalog_motif?: string;
  catalog_color?: string;
  catalog_finishing?: string;
  catalog_image_url?: string;
  catalog_image_original_url?: string;
  catalog_reference_url?: string;
  catalog_price?: number;
  catalog_sku?: string;
  specs?: ScheduleSnapshotSpecs;
}

export const createPromotionRequestAction = createAction<
  CreatePromotionRequestInput,
  PromotionRequest
>(
  async ({ input, ctx, tx }) => {
    const option = await tx.projectScheduleOption.findUnique({
      where: { id: input.schedule_option_id },
      include: { entry: true }
    });

    if (!option) {
      throw new ActionError("Schedule option not found", "NOT_FOUND");
    }

    const snapshot = option.data_snapshot;
    if (!snapshot) {
      throw new ActionError("Cannot promote option without snapshot data", "SNAPSHOT_MISSING");
    }

    const existingRequest = await tx.promotionRequest.findFirst({
      where: {
        schedule_option_id: input.schedule_option_id,
        status: "PENDING"
      }
    });

    if (existingRequest) {
      throw new ActionError("There's already a pending request for this option", "DUPLICATE_REQUEST");
    }

    const request = await LibraryService.createPromotionRequest(tx, {
      project_id: input.project_id,
      schedule_option_id: input.schedule_option_id,
      requested_by_id: ctx.userId,
      snapshot_data: snapshot,
      notes: input.notes
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_CREATE_PROMOTION_REQUEST, "PromotionRequest", request.id, ctx.userId, {
      schedule_option_id: input.schedule_option_id,
      project_id: input.project_id
    });

    return request;
  },
  {
    schema: CreatePromotionRequestInputSchema,
  }
);

export const approvePromotionRequestAction = createAction<IdInput, { success: boolean; product: ProductCatalog }>(
  async ({ input, ctx, tx }) => {
    const request = await tx.promotionRequest.findUnique({
      where: { id: input.id }
    });

    if (!request) {
      throw new ActionError("Promotion request not found", "NOT_FOUND");
    }

    if (request.status !== "PENDING") {
      throw new ActionError("Request already processed", "INVALID_STATE");
    }

    const snapshot = request.snapshot_data as ScheduleSnapshot | null;
    if (!snapshot) {
      throw new ActionError("Missing snapshot data", "SNAPSHOT_MISSING");
    }

    let vendorId: string;
    const existingVendor = await tx.vendor.findFirst({
      where: { brand_name: { equals: snapshot.catalog_brand || "", mode: "insensitive" } }
    });

    if (existingVendor) {
      vendorId = existingVendor.id;
    } else {
      const newVendor = await tx.vendor.create({
        data: { brand_name: snapshot.catalog_brand || "Unknown Brand" }
      });
      vendorId = newVendor.id;
    }

    const product = await tx.productCatalog.create({
      data: {
        vendor_id: vendorId,
        catalog_category: snapshot.schedule_category || "UNCATEGORIZED",
        catalog_sub_category: snapshot.catalog_sub_category || null,
        catalog_sku: snapshot.specs?.catalog_sku || snapshot.catalog_sku || snapshot.catalog_product_name || "N/A",
        catalog_product_name: snapshot.catalog_product_name || null,
        catalog_brand: snapshot.catalog_brand || null,
        catalog_motif: snapshot.catalog_motif || null,
        catalog_color: snapshot.catalog_color || null,
        catalog_finishing: snapshot.catalog_finishing || null,
        catalog_dimension_p: snapshot.specs?.catalog_dimension?.p || null,
        catalog_dimension_l: snapshot.specs?.catalog_dimension?.l || null,
        catalog_dimension_t: snapshot.specs?.catalog_dimension?.t || null,
        catalog_dimension_unit: snapshot.specs?.catalog_dimension?.unit || "cm",
        catalog_image_url: snapshot.catalog_image_url || null,
        catalog_image_original_url: snapshot.catalog_image_original_url || null,
        catalog_reference_url: snapshot.catalog_reference_url || null,
        catalog_price: snapshot.catalog_price || null,
        status: "PENDING",
      }
    });

    await tx.projectScheduleOption.update({
      where: { id: request.schedule_option_id },
      data: {
        product_catalog_id: product.id,
        status: "APPROVED"
      }
    });

    await LibraryService.reviewPromotionRequest(tx, input.id, "APPROVED", ctx.userId);

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_APPROVE_PROMOTION, "PromotionRequest", input.id, ctx.userId, {
      product_id: product.id,
      schedule_option_id: request.schedule_option_id
    });

    return { success: true, product };
  },
  {
    schema: IdSchema,
  }
);

export const rejectPromotionRequestAction = createAction<IdInput, { success: boolean }>(
  async ({ input, ctx, tx }) => {
    const request = await tx.promotionRequest.findUnique({
      where: { id: input.id }
    });

    if (!request) {
      throw new ActionError("Promotion request not found", "NOT_FOUND");
    }

    if (request.status !== "PENDING") {
      throw new ActionError("Request already processed", "INVALID_STATE");
    }

    await LibraryService.reviewPromotionRequest(tx, input.id, "REJECTED", ctx.userId);

    await insertAuditLog(tx, AUDIT_ACTIONS.LIBRARY_REJECT_PROMOTION, "PromotionRequest", input.id, ctx.userId, {
      schedule_option_id: request.schedule_option_id
    });

    return { success: true };
  },
  {
    schema: IdSchema,
  }
);