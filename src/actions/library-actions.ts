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
      data: params,
    });
  }
);

export const addToProjectSchedule = createAction(
  async ({ input, ctx, tx }) => {
    const params = input as { projectId: string; libraryItemId: string };

    await getProjectMembershipOrThrow(tx, params.projectId, ctx.userId, ctx.role);

    const item = await tx.globalLibrary.findUniqueOrThrow({
      where: { id: params.libraryItemId },
      include: { vendor: true },
    });

    if (item.status !== "APPROVED") throw new Error(ERR.ITEM_NOT_APPROVED);

    const snapshot = {
      internal_code: item.internal_code,
      item_name: item.item_name,
      vendor_name: item.vendor?.name ?? null,
      price_at_snapshot: item.price,
      specs: item.specs as Record<string, string>,
      image_url: item.image_url ?? null,
      snapshot_timestamp: new Date().toISOString(),
    } as const;

    const schedule = await tx.projectSchedule.create({
      data: {
        project_id: params.projectId,
        category_enum: item.category_enum,
        data_snapshot: snapshot,
        original_library_id: item.id,
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

    return tx.globalLibrary.update({
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

    return tx.globalLibrary.create({
      data: {
        category_enum: params.category_enum,
        internal_code: params.internal_code,
        item_name: params.item_name,
        vendor_id: params.vendor_id,
        price: params.price,
        specs: params.specs,
        image_url: params.image_url,
        status,
      },
    });
  }
);
