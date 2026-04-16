"use server";

import { createAction } from "@/lib/action-wrapper";
import { getProjectMembershipOrThrow, assertAdmin, ERR } from "@/lib/permissions";
import { insertAuditLog } from "./_shared";
import { revalidatePath } from "next/cache";

interface LibrarySnapshot {
  internal_code: string;
  item_name: string;
  vendor_name: string | null;
  price_at_snapshot: number;
  specs: Record<string, string>;
  image_url: string | null;
  snapshot_timestamp: string;
}

export const createVendor = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as {
      name: string;
      contact_person?: string;
      phone?: string;
      address?: string;
    };

    return tx.vendor.create({
      data: {
        brand_name: params.name,
        address: params.address,
      },
    });
  }
);

export const addToProjectSchedule = createAction(
  async ({ input, ctx, tx }) => {
    const params = input as { projectId: string; libraryItemId: string };

    await getProjectMembershipOrThrow(tx, params.projectId, ctx.userId, ctx.role);

    const item = await tx.materialCatalog.findUniqueOrThrow({
      where: { id: params.libraryItemId },
      include: { vendor: true },
    });

    if (item.status !== "APPROVED") throw new Error(ERR.ITEM_NOT_APPROVED);

    const snapshot = {
      source_kind: "catalog",
      source_origin: "web_catalog",
      material_catalog_id: item.id,
      category: item.category,
      sub_category: item.sub_category,
      name: item.product_type,
      brand: item.vendor?.brand_name ?? "Unknown",
      price: item.price,
      image_url: item.cover_url,
      reference_url: item.original_url,
      specs: {
        product_type: item.product_type,
        motif_or_color: item.motif_or_color,
        tags: item.tags,
        dimensions: `${item.dimension_p ?? ""} x ${item.dimension_l ?? ""} x ${item.dimension_t ?? ""}`,
        color: item.color,
        finishing: item.finishing,
        digital_catalog_url: item.digital_catalog_url,
        metadata: item.metadata,
      },
      captured_at: new Date().toISOString(),
    } as const;

    const schedule = await tx.projectScheduleEntry.create({
      data: {
        project_id: params.projectId,
        category: item.category,
        code: "TEMP",
        index_number: 1,
        sort_order: 1,
        section: item.category === "FIXTURE" ? "FIXTURE" : "MATERIAL",
        options: {
          create: {
            option_label: "Standard",
            is_final: true,
            status: "APPROVED",
            data_snapshot: snapshot as any,
          }
        }
      },
    });

    await insertAuditLog(
      tx,
      "addToProjectSchedule",
      "ProjectSchedule",
      schedule.id,
      ctx.userId,
      { libraryItemId: params.libraryItemId, projectId: params.projectId }
    );

    return schedule;
  }
);

export const updateGlobalItemStatus = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { libraryItemId: string; newStatus: "PENDING" | "APPROVED" };

    return tx.materialCatalog.update({
      where: { id: params.libraryItemId },
      data: { status: params.newStatus },
    });
  }
);

export const createLibraryItem = createAction(
  async ({ input, ctx, tx }) => {
    const params = input as {
      category_enum: string;
      internal_code: string;
      item_name: string;
      vendor_id?: string;
      price: number;
      specs: Record<string, string>;
      image_url?: string;
    };

    const allowedRoles = ["ADMIN", "DIC", "DRIC", "STAFF"];
    if (!allowedRoles.includes(ctx.role)) throw new Error(ERR.UNAUTHORIZED_ACTION);

    const status = ctx.role === "ADMIN" ? "APPROVED" : "PENDING";

    return tx.materialCatalog.create({
      data: {
        category: params.category_enum,
        product_type: params.item_name,
        vendor_id: params.vendor_id!,
        price: params.price,
        metadata: params.specs,
        cover_url: params.image_url,
        status,
      },
    });
  }
);
