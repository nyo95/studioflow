import { z } from "zod";
import { MomListStyle, MomPointStyle } from "@/generated/prisma";
import { IdSchema } from "@/lib/validations";

const MomDocumentIdSchema = z.object({
  mom_document_id: IdSchema,
});

const MomItemIdSchema = z.object({
  mom_item_id: IdSchema,
});

const MomPointIdSchema = z.object({
  mom_point_id: IdSchema,
});

const MomImageIdSchema = z.object({
  mom_image_id: IdSchema,
});

export const CreateMomDocumentSchema = z.object({
  projectId: IdSchema,
});

export const DeleteMomDocumentSchema = z.object({
  projectId: IdSchema,
  mom_document_id: IdSchema,
});

export const UpdateMomDocumentSchema = z.object({
  projectId: IdSchema,
  mom_document_id: IdSchema,
  mom_topic: z.string().min(1).max(200),
  mom_date: z.coerce.date(),
  mom_venue: z.string().max(500).nullable(),
  mom_attendees: z.string().max(5000).nullable(),
  mom_prepared_by_name: z.string().min(1).max(200),
});

export const CreateMomItemSchema = z.object({
  projectId: IdSchema,
  mom_document_id: IdSchema,
});

export const UpdateMomItemSchema = z.object({
  projectId: IdSchema,
  mom_item_id: IdSchema,
  is_text_only: z.boolean(),
  list_style: z.nativeEnum(MomListStyle),
});

export const DeleteMomItemSchema = z.object({
  projectId: IdSchema,
  mom_item_id: IdSchema,
});

export const ReorderMomItemsSchema = z.object({
  projectId: IdSchema,
  mom_document_id: IdSchema,
  mom_item_ids: z.array(IdSchema).min(1),
});

export const CreateMomPointSchema = z.object({
  projectId: IdSchema,
  mom_item_id: IdSchema,
  text: z.string(),
});

export const UpdateMomPointSchema = z.object({
  projectId: IdSchema,
  mom_point_id: IdSchema,
  text: z.string(),
  style: z.nativeEnum(MomPointStyle),
});

export const DeleteMomPointSchema = z.object({
  projectId: IdSchema,
  mom_point_id: IdSchema,
});

export const ReorderMomPointsSchema = z.object({
  projectId: IdSchema,
  mom_item_id: IdSchema,
  mom_point_ids: z.array(IdSchema).min(1),
});

export const UpsertMomImageSchema = z.object({
  projectId: IdSchema,
  mom_item_id: IdSchema,
  sort_order: z.number().int().min(0).max(1),
  file_url: z.string().min(1),
});

export const DeleteMomImageSchema = z.object({
  projectId: IdSchema,
  mom_image_id: IdSchema,
});

export const ReorderMomImagesSchema = z.object({
  projectId: IdSchema,
  mom_item_id: IdSchema,
  mom_image_ids: z.array(IdSchema).min(1).max(2),
});

export {
  MomDocumentIdSchema,
  MomItemIdSchema,
  MomPointIdSchema,
  MomImageIdSchema,
};
