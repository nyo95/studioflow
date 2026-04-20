import { z } from "zod";

export const GSheetsMaterialRowSchema = z.object({
  code: z.string().min(1),
  material_type: z.string().optional().nullable(),
  ex: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  initials_type: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  schedule_qty: z.number().optional().nullable(),
  schedule_unit: z.string().optional().nullable(),
});

export const GSheetsFixtureRowSchema = z.object({
  code: z.string().min(1),
  ex: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  initials_type: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  contact: z.string().optional().nullable(),
  schedule_qty: z.number().optional().nullable(),
  schedule_unit: z.string().optional().nullable(),
});

export type GSheetsMaterialRow = z.infer<typeof GSheetsMaterialRowSchema>;
export type GSheetsFixtureRow = z.infer<typeof GSheetsFixtureRowSchema>;

export interface ScheduleCsvExportRow {
  code: string;
  material_type?: string | null;
  ex?: string | null;
  type?: string | null;
  initials_type?: string | null;
  image?: string | null;
  location?: string | null;
  contact?: string | null;
  schedule_qty?: number | null;
  schedule_unit?: string | null;
}

export interface ScheduleCsvImportRow {
  code: string;
  category?: string;
  materialType?: string;
  ex?: string;
  type?: string;
  initialsType?: string;
  imageUrl?: string;
  location?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  price?: number;
  schedule_qty?: number;
  schedule_unit?: string;
  referenceUrl?: string;
  sourceExternalId?: string;
  sourcePayload?: unknown;
}

export const SketchUpImportRowSchema = z.object({
  code: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  type: z.string().optional().nullable(),
  kind_label: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  subtype: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  thumb: z.string().optional().nullable(),
  number: z.string().optional().nullable(),
  id: z.string().optional().nullable(),
  reference_url: z.string().optional().nullable(),
});

export type SketchUpImportRow = z.infer<typeof SketchUpImportRowSchema>;
