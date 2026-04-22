import { z } from "zod";

export const ScheduleSnapshotSchema = z.object({
  snapshot_source_kind: z.enum(["catalog", "manual"]),
  snapshot_source_origin: z.enum(["web_catalog", "web_manual", "gsheets_import", "sketchup_plugin"]),
  snapshot_source_external_id: z.string().nullable(),
  product_catalog_id: z.string().nullable(),
  catalog_type: z.enum(["material", "fixture"]),
  schedule_category: z.string(), 
  catalog_sub_category: z.string().nullable().optional(), 
  catalog_product_name: z.string(), 
  catalog_brand: z.string(), 
  catalog_initials_type: z.string().nullable().optional(),
  catalog_price: z.number().nullable(), 
  catalog_image_url: z.string().nullable(), 
  catalog_reference_url: z.string().nullable(), 
  catalog_contact_name: z.string().nullable().optional(), 
  catalog_contact_phone: z.string().nullable().optional(), 
  catalog_contact_email: z.string().nullable(), 
  catalog_has_sample: z.boolean().nullable(),
  specs: z.object({
    catalog_sku: z.string(), 
    catalog_motif: z.string().nullable().optional(), 
    catalog_structured_tags: z.array(z.string()), 
    catalog_dimensions: z.string(), 
    catalog_color: z.string().nullable().optional(),
    catalog_finishing: z.string().nullable().optional(),
    catalog_reference_url: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  snapshot_source_payload: z.record(z.string(), z.unknown()).optional(),
  snapshot_captured_at: z.string().datetime().or(z.string()), 
});

export type ScheduleSnapshot = z.infer<typeof ScheduleSnapshotSchema>;
