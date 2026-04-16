import { z } from "zod";

export const ScheduleSnapshotSchema = z.object({
  source_kind: z.enum(["catalog", "manual"]),
  source_origin: z.enum(["web_catalog", "web_manual", "gsheets_import", "sketchup_plugin"]),
  source_external_id: z.string().nullable(),
  material_catalog_id: z.string().nullable(),
  category: z.string(),
  sub_category: z.string().nullable().optional(),
  name: z.string(),
  brand: z.string(),
  initials_type: z.string().nullable().optional(),
  price: z.number().nullable(),
  image_url: z.string().nullable(),
  reference_url: z.string().nullable(),
  contact_name: z.string().nullable().optional(),
  contact_phone: z.string().nullable().optional(),
  contact_email: z.string().nullable(),
  has_sample: z.boolean().nullable(),
  specs: z.object({
    product_type: z.string(),
    motif_or_color: z.string().nullable().optional(),
    tags: z.array(z.string()),
    dimensions: z.string(),
    color: z.string().nullable().optional(),
    finishing: z.string().nullable().optional(),
    digital_catalog_url: z.string().nullable().optional(),
    metadata: z.any().optional(),
  }),
  source_payload: z.any().optional(),
  captured_at: z.string().datetime().or(z.string()), // Accept ISO string
});

export type ScheduleSnapshot = z.infer<typeof ScheduleSnapshotSchema>;
