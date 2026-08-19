import { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { AUDIT_ACTIONS } from "@/core/platform/audit";
import { insertAuditLog } from "@/actions/_shared";
import { MomListStyle, MomPointStyle } from "@/generated/prisma";

async function getMomDocumentOrThrow(tx: PrismaTransaction, momDocumentId: string) {
  return tx.projectMomDocument.findUniqueOrThrow({
    where: { id: momDocumentId },
  });
}

async function getMomItemOrThrow(tx: PrismaTransaction, momItemId: string) {
  return tx.projectMomItem.findUniqueOrThrow({
    where: { id: momItemId },
    include: {
      mom_document: true,
      mom_images: {
        orderBy: { sort_order: "asc" },
      },
    },
  });
}

async function getMomPointOrThrow(tx: PrismaTransaction, momPointId: string) {
  return tx.projectMomPoint.findUniqueOrThrow({
    where: { id: momPointId },
    include: {
      mom_item: {
        include: {
          mom_document: true,
        },
      },
    },
  });
}

async function getMomImageOrThrow(tx: PrismaTransaction, momImageId: string) {
  return tx.projectMomImage.findUniqueOrThrow({
    where: { id: momImageId },
    include: {
      mom_item: {
        include: {
          mom_document: true,
          mom_images: {
            orderBy: { sort_order: "asc" },
          },
        },
      },
    },
  });
}

function assertProjectScope(expectedProjectId: string, actualProjectId: string) {
  if (expectedProjectId !== actualProjectId) {
    throw new ActionError("MOM record does not belong to this project.", "MOM_SCOPE_MISMATCH");
  }
}

async function normalizeItemOrders(tx: PrismaTransaction, momDocumentId: string, itemIds?: string[]) {
  const items = itemIds
    ? await tx.projectMomItem.findMany({
        where: { id: { in: itemIds }, mom_document_id: momDocumentId },
        select: { id: true },
      })
    : await tx.projectMomItem.findMany({
        where: { mom_document_id: momDocumentId },
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
        select: { id: true },
      });

  if (itemIds && items.length !== itemIds.length) {
    throw new ActionError("Invalid MOM item reorder payload.", "MOM_REORDER_INVALID");
  }

  const normalizedIds = itemIds ?? items.map((item) => item.id);
  await Promise.all(
    normalizedIds.map((id, index) =>
      tx.projectMomItem.update({
        where: { id },
        data: { sort_order: index },
      })
    )
  );
}

async function normalizePointOrders(tx: PrismaTransaction, momItemId: string, pointIds?: string[]) {
  const points = pointIds
    ? await tx.projectMomPoint.findMany({
        where: { id: { in: pointIds }, mom_item_id: momItemId },
        select: { id: true },
      })
    : await tx.projectMomPoint.findMany({
        where: { mom_item_id: momItemId },
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
        select: { id: true },
      });

  if (pointIds && points.length !== pointIds.length) {
    throw new ActionError("Invalid MOM point reorder payload.", "MOM_POINT_REORDER_INVALID");
  }

  const normalizedIds = pointIds ?? points.map((point) => point.id);
  await Promise.all(
    normalizedIds.map((id, index) =>
      tx.projectMomPoint.update({
        where: { id },
        data: { sort_order: index },
      })
    )
  );
}

async function normalizeImageOrders(tx: PrismaTransaction, momItemId: string, imageIds?: string[]) {
  const images = imageIds
    ? await tx.projectMomImage.findMany({
        where: { id: { in: imageIds }, mom_item_id: momItemId },
        select: { id: true },
      })
    : await tx.projectMomImage.findMany({
        where: { mom_item_id: momItemId },
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
        select: { id: true },
      });

  if (imageIds && images.length !== imageIds.length) {
    throw new ActionError("Invalid MOM image reorder payload.", "MOM_IMAGE_REORDER_INVALID");
  }

  const normalizedIds = imageIds ?? images.map((image) => image.id);
  await Promise.all(
    normalizedIds.map((id, index) =>
      tx.projectMomImage.update({
        where: { id },
        data: { sort_order: index },
      })
    )
  );
}

export const momService = {
  async createDocument(
    tx: PrismaTransaction,
    params: {
      projectId: string;
      currentUserId: string;
      currentUserName: string;
    }
  ) {
    const document = await tx.projectMomDocument.create({
      data: {
        project_id: params.projectId,
        mom_topic: "SITE INSPECTION REPORT",
        mom_date: new Date(),
        mom_prepared_by_name: params.currentUserName,
        created_by: params.currentUserId,
      },
    });

    const item = await tx.projectMomItem.create({
      data: {
        mom_document_id: document.id,
        sort_order: 0,
        is_text_only: false,
        list_style: MomListStyle.decimal,
      },
    });

    await tx.projectMomPoint.create({
      data: {
        mom_item_id: item.id,
        sort_order: 0,
        text: "",
        style: MomPointStyle.default,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.MOM_CREATE_DOCUMENT, "ProjectMomDocument", document.id, params.currentUserId, {
      project_id: params.projectId,
      mom_topic: document.mom_topic,
    });

    return document;
  },

  async updateDocument(
    tx: PrismaTransaction,
    params: {
      projectId: string;
      mom_document_id: string;
      mom_topic: string;
      mom_date: Date;
      mom_venue: string | null;
      mom_attendees: string | null;
      mom_prepared_by_name: string;
      userId: string;
    }
  ) {
    const existing = await getMomDocumentOrThrow(tx, params.mom_document_id);
    assertProjectScope(params.projectId, existing.project_id);

    const updated = await tx.projectMomDocument.update({
      where: { id: params.mom_document_id },
      data: {
        mom_topic: params.mom_topic.trim(),
        mom_date: params.mom_date,
        mom_venue: params.mom_venue?.trim() || null,
        mom_attendees: params.mom_attendees?.trim() || null,
        mom_prepared_by_name: params.mom_prepared_by_name.trim(),
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.MOM_UPDATE_DOCUMENT, "ProjectMomDocument", updated.id, params.userId, {
      project_id: params.projectId,
      mom_topic: updated.mom_topic,
    });

    return updated;
  },

  async deleteDocument(tx: PrismaTransaction, params: { projectId: string; mom_document_id: string; userId: string }) {
    const existing = await getMomDocumentOrThrow(tx, params.mom_document_id);
    assertProjectScope(params.projectId, existing.project_id);

    await tx.projectMomDocument.delete({
      where: { id: params.mom_document_id },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.MOM_DELETE_DOCUMENT, "ProjectMomDocument", params.mom_document_id, params.userId, {
      project_id: params.projectId,
      mom_topic: existing.mom_topic,
    });
  },

  async createItem(tx: PrismaTransaction, params: { projectId: string; mom_document_id: string; userId: string }) {
    const existing = await getMomDocumentOrThrow(tx, params.mom_document_id);
    assertProjectScope(params.projectId, existing.project_id);

    const currentCount = await tx.projectMomItem.count({
      where: { mom_document_id: params.mom_document_id },
    });

    const item = await tx.projectMomItem.create({
      data: {
        mom_document_id: params.mom_document_id,
        sort_order: currentCount,
        is_text_only: false,
        list_style: MomListStyle.decimal,
      },
    });

    await tx.projectMomPoint.create({
      data: {
        mom_item_id: item.id,
        sort_order: 0,
        text: "",
        style: MomPointStyle.default,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.MOM_CREATE_ITEM, "ProjectMomItem", item.id, params.userId, {
      project_id: params.projectId,
      mom_document_id: params.mom_document_id,
    });

    return item;
  },

  async updateItem(
    tx: PrismaTransaction,
    params: {
      projectId: string;
      mom_item_id: string;
      is_text_only: boolean;
      list_style: MomListStyle;
      userId: string;
    }
  ) {
    const item = await getMomItemOrThrow(tx, params.mom_item_id);
    assertProjectScope(params.projectId, item.mom_document.project_id);

    const updated = await tx.projectMomItem.update({
      where: { id: params.mom_item_id },
      data: {
        is_text_only: params.is_text_only,
        list_style: params.list_style,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.MOM_UPDATE_ITEM, "ProjectMomItem", updated.id, params.userId, {
      project_id: params.projectId,
      mom_document_id: item.mom_document_id,
      is_text_only: updated.is_text_only,
      list_style: updated.list_style,
    });

    return updated;
  },

  async deleteItem(tx: PrismaTransaction, params: { projectId: string; mom_item_id: string; userId: string }) {
    const item = await getMomItemOrThrow(tx, params.mom_item_id);
    assertProjectScope(params.projectId, item.mom_document.project_id);

    await tx.projectMomItem.delete({
      where: { id: params.mom_item_id },
    });

    await normalizeItemOrders(tx, item.mom_document_id);

    await insertAuditLog(tx, AUDIT_ACTIONS.MOM_DELETE_ITEM, "ProjectMomItem", params.mom_item_id, params.userId, {
      project_id: params.projectId,
      mom_document_id: item.mom_document_id,
    });
  },

  async reorderItems(
    tx: PrismaTransaction,
    params: {
      projectId: string;
      mom_document_id: string;
      mom_item_ids: string[];
      userId: string;
    }
  ) {
    const document = await getMomDocumentOrThrow(tx, params.mom_document_id);
    assertProjectScope(params.projectId, document.project_id);
    await normalizeItemOrders(tx, params.mom_document_id, params.mom_item_ids);

    await insertAuditLog(tx, AUDIT_ACTIONS.MOM_REORDER_ITEM, "ProjectMomDocument", params.mom_document_id, params.userId, {
      project_id: params.projectId,
      mom_item_ids: params.mom_item_ids,
    });
  },

  async createPoint(tx: PrismaTransaction, params: { projectId: string; mom_item_id: string; text: string; userId: string }) {
    const item = await getMomItemOrThrow(tx, params.mom_item_id);
    assertProjectScope(params.projectId, item.mom_document.project_id);

    const currentCount = await tx.projectMomPoint.count({
      where: { mom_item_id: params.mom_item_id },
    });

    return tx.projectMomPoint.create({
      data: {
        mom_item_id: params.mom_item_id,
        sort_order: currentCount,
        text: params.text,
        style: MomPointStyle.default,
      },
    });
  },

  async updatePoint(
    tx: PrismaTransaction,
    params: {
      projectId: string;
      mom_point_id: string;
      text: string;
      style: MomPointStyle;
      userId: string;
    }
  ) {
    const point = await getMomPointOrThrow(tx, params.mom_point_id);
    assertProjectScope(params.projectId, point.mom_item.mom_document.project_id);

    return tx.projectMomPoint.update({
      where: { id: params.mom_point_id },
      data: {
        text: params.text,
        style: params.style,
      },
    });
  },

  async deletePoint(tx: PrismaTransaction, params: { projectId: string; mom_point_id: string; userId: string }) {
    const point = await getMomPointOrThrow(tx, params.mom_point_id);
    assertProjectScope(params.projectId, point.mom_item.mom_document.project_id);

    await tx.projectMomPoint.delete({
      where: { id: params.mom_point_id },
    });

    const remainingCount = await tx.projectMomPoint.count({
      where: { mom_item_id: point.mom_item_id },
    });

    if (remainingCount === 0) {
      await tx.projectMomPoint.create({
        data: {
          mom_item_id: point.mom_item_id,
          sort_order: 0,
          text: "",
          style: MomPointStyle.default,
        },
      });
    } else {
      await normalizePointOrders(tx, point.mom_item_id);
    }
  },

  async reorderPoints(tx: PrismaTransaction, params: { projectId: string; mom_item_id: string; mom_point_ids: string[]; userId: string }) {
    const item = await getMomItemOrThrow(tx, params.mom_item_id);
    assertProjectScope(params.projectId, item.mom_document.project_id);
    await normalizePointOrders(tx, params.mom_item_id, params.mom_point_ids);
  },

  async upsertImage(
    tx: PrismaTransaction,
    params: {
      projectId: string;
      mom_item_id: string;
      sort_order: number;
      file_url: string;
      userId: string;
    }
  ) {
    const item = await getMomItemOrThrow(tx, params.mom_item_id);
    assertProjectScope(params.projectId, item.mom_document.project_id);

    if (params.sort_order > 1) {
      throw new ActionError("Each MOM item supports at most 2 images.", "MOM_IMAGE_LIMIT");
    }

    const imageCount = item.mom_images.length;
    const existing = item.mom_images.find((image) => image.sort_order === params.sort_order);
    if (!existing && imageCount >= 2) {
      throw new ActionError("Each MOM item supports at most 2 images.", "MOM_IMAGE_LIMIT");
    }

    const image = existing
      ? await tx.projectMomImage.update({
          where: { id: existing.id },
          data: { file_url: params.file_url },
        })
      : await tx.projectMomImage.create({
          data: {
            mom_item_id: params.mom_item_id,
            sort_order: params.sort_order,
            file_url: params.file_url,
          },
        });

    await normalizeImageOrders(tx, params.mom_item_id);

    await insertAuditLog(tx, AUDIT_ACTIONS.MOM_UPLOAD_IMAGE, "ProjectMomImage", image.id, params.userId, {
      project_id: params.projectId,
      mom_item_id: params.mom_item_id,
      sort_order: params.sort_order,
    });

    return image;
  },

  async deleteImage(tx: PrismaTransaction, params: { projectId: string; mom_image_id: string; userId: string }) {
    const image = await getMomImageOrThrow(tx, params.mom_image_id);
    assertProjectScope(params.projectId, image.mom_item.mom_document.project_id);

    await tx.projectMomImage.delete({
      where: { id: params.mom_image_id },
    });

    await normalizeImageOrders(tx, image.mom_item_id);

    await insertAuditLog(tx, AUDIT_ACTIONS.MOM_DELETE_IMAGE, "ProjectMomImage", params.mom_image_id, params.userId, {
      project_id: params.projectId,
      mom_item_id: image.mom_item_id,
    });
  },

  async reorderImages(tx: PrismaTransaction, params: { projectId: string; mom_item_id: string; mom_image_ids: string[]; userId: string }) {
    const item = await getMomItemOrThrow(tx, params.mom_item_id);
    assertProjectScope(params.projectId, item.mom_document.project_id);
    if (params.mom_image_ids.length > 2) {
      throw new ActionError("Each MOM item supports at most 2 images.", "MOM_IMAGE_LIMIT");
    }
    await normalizeImageOrders(tx, params.mom_item_id, params.mom_image_ids);
  },
};
