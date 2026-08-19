"use server";

import { createAction } from "@/lib/action-wrapper";
import { getProjectMembershipOrThrow } from "@/core/rbac/permissions";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_CUSTOM, REVALIDATE_PROJECT } from "@/lib/revalidation-tags";
import { unwrapActionResult } from "@/lib/result";
import { momService } from "../services/mom-service";
import {
  CreateMomDocumentSchema,
  DeleteMomDocumentSchema,
  UpdateMomDocumentSchema,
  CreateMomItemSchema,
  UpdateMomItemSchema,
  DeleteMomItemSchema,
  ReorderMomItemsSchema,
  CreateMomPointSchema,
  UpdateMomPointSchema,
  DeleteMomPointSchema,
  ReorderMomPointsSchema,
  UpsertMomImageSchema,
  DeleteMomImageSchema,
  ReorderMomImagesSchema,
} from "../validations";

function revalidateMom(projectId: string, momDocumentId?: string) {
  invalidateCache({ scope: REVALIDATE_PROJECT, id: projectId });
  invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${projectId}/mom` });
  if (momDocumentId) {
    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${projectId}/mom/${momDocumentId}` });
    invalidateCache({ scope: REVALIDATE_CUSTOM, path: `/projects/${projectId}/mom/${momDocumentId}/print` });
  }
}

export const createMomDocument = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const document = await momService.createDocument(tx, {
    projectId: input.projectId,
    currentUserId: ctx.userId,
    currentUserName: ctx.user?.name || "User",
  });
  revalidateMom(input.projectId, document.id);
  return document;
}, { schema: CreateMomDocumentSchema });

export const updateMomDocument = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const document = await momService.updateDocument(tx, {
    ...input,
    userId: ctx.userId,
  });
  revalidateMom(input.projectId, document.id);
  return document;
}, { schema: UpdateMomDocumentSchema });

export const deleteMomDocument = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  await momService.deleteDocument(tx, {
    ...input,
    userId: ctx.userId,
  });
  revalidateMom(input.projectId);
}, { schema: DeleteMomDocumentSchema });

export const createMomItem = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const item = await momService.createItem(tx, {
    ...input,
    userId: ctx.userId,
  });
  revalidateMom(input.projectId, input.mom_document_id);
  return item;
}, { schema: CreateMomItemSchema });

export const updateMomItem = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const item = await momService.updateItem(tx, {
    ...input,
    userId: ctx.userId,
  });
  const fullItem = await tx.projectMomItem.findUniqueOrThrow({
    where: { id: item.id },
    select: { mom_document: { select: { id: true } } },
  });
  revalidateMom(input.projectId, fullItem.mom_document.id);
  return item;
}, { schema: UpdateMomItemSchema });

export const deleteMomItem = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const item = await tx.projectMomItem.findUniqueOrThrow({
    where: { id: input.mom_item_id },
    select: { mom_document: { select: { id: true } } },
  });
  await momService.deleteItem(tx, {
    ...input,
    userId: ctx.userId,
  });
  revalidateMom(input.projectId, item.mom_document.id);
}, { schema: DeleteMomItemSchema });

export const reorderMomItems = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  await momService.reorderItems(tx, {
    ...input,
    userId: ctx.userId,
  });
  revalidateMom(input.projectId, input.mom_document_id);
}, { schema: ReorderMomItemsSchema });

export const createMomPoint = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const point = await momService.createPoint(tx, {
    ...input,
    userId: ctx.userId,
  });
  return point;
}, { schema: CreateMomPointSchema });

export const updateMomPoint = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const point = await momService.updatePoint(tx, {
    ...input,
    userId: ctx.userId,
  });
  const fullPoint = await tx.projectMomPoint.findUniqueOrThrow({
    where: { id: point.id },
    select: {
      mom_item: {
        select: {
          mom_document: {
            select: { id: true },
          },
        },
      },
    },
  });
  revalidateMom(input.projectId, fullPoint.mom_item.mom_document.id);
  return point;
}, { schema: UpdateMomPointSchema });

export const deleteMomPoint = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const point = await tx.projectMomPoint.findUniqueOrThrow({
    where: { id: input.mom_point_id },
    select: {
      mom_item: {
        select: {
          mom_document: {
            select: { id: true },
          },
        },
      },
    },
  });
  await momService.deletePoint(tx, {
    ...input,
    userId: ctx.userId,
  });
  revalidateMom(input.projectId, point.mom_item.mom_document.id);
}, { schema: DeleteMomPointSchema });

export const reorderMomPoints = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const item = await tx.projectMomItem.findUniqueOrThrow({
    where: { id: input.mom_item_id },
    select: { mom_document: { select: { id: true } } },
  });
  await momService.reorderPoints(tx, {
    ...input,
    userId: ctx.userId,
  });
  revalidateMom(input.projectId, item.mom_document.id);
}, { schema: ReorderMomPointsSchema });

export const upsertMomImage = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const image = await momService.upsertImage(tx, {
    ...input,
    userId: ctx.userId,
  });
  const item = await tx.projectMomItem.findUniqueOrThrow({
    where: { id: input.mom_item_id },
    select: { mom_document: { select: { id: true } } },
  });
  revalidateMom(input.projectId, item.mom_document.id);
  return image;
}, { schema: UpsertMomImageSchema });

export const deleteMomImage = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const image = await tx.projectMomImage.findUniqueOrThrow({
    where: { id: input.mom_image_id },
    select: {
      mom_item: {
        select: {
          mom_document: {
            select: { id: true },
          },
        },
      },
    },
  });
  await momService.deleteImage(tx, {
    ...input,
    userId: ctx.userId,
  });
  revalidateMom(input.projectId, image.mom_item.mom_document.id);
}, { schema: DeleteMomImageSchema });

export const reorderMomImages = createAction(async ({ input, ctx, tx }) => {
  await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);
  const item = await tx.projectMomItem.findUniqueOrThrow({
    where: { id: input.mom_item_id },
    select: { mom_document: { select: { id: true } } },
  });
  await momService.reorderImages(tx, {
    ...input,
    userId: ctx.userId,
  });
  revalidateMom(input.projectId, item.mom_document.id);
}, { schema: ReorderMomImagesSchema });

export async function createMomDocumentOrThrow(projectId: string) {
  const result = await createMomDocument({ projectId });
  return unwrapActionResult(result);
}
