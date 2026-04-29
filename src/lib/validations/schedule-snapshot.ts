import { z } from "zod";

export const ScheduleSnapshotSchema = z.object({
  snapshot_source_kind: z.enum(["catalog", "manual"]),
  snapshot_source_origin: z.enum(["library", "manual", "gsheets_import", "sketchup_plugin"]).nullable().optional(),
  snapshot_source_external_id: z.string().nullable(),
  product_catalog_id: z.string().nullable(),
  catalog_type: z.enum(["material", "fixture"]),
  schedule_category: z.string(), 
  catalog_sub_category: z.string().nullable().optional(), 
  catalog_product_name: z.string().nullable().optional(), 
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
    catalog_sku: z.string().nullable().optional(), 
    catalog_motif: z.string().nullable().optional(), 
    catalog_structured_tags: z.array(z.string()), 
    catalog_dimensions: z.string(), 
    catalog_dimension_p: z.string().nullable().optional(),
    catalog_dimension_l: z.string().nullable().optional(),
    catalog_dimension_t: z.string().nullable().optional(),
    catalog_dimension_unit: z.string().nullable().optional(),
    catalog_color: z.string().nullable().optional(),
    catalog_finishing: z.string().nullable().optional(),
    catalog_reference_url: z.string().nullable().optional(),
    catalog_metadata: z.record(z.string(), z.unknown()).optional(),
  }),
  snapshot_source_payload: z.record(z.string(), z.unknown()).optional(),
  schedule_code: z.string().nullable().optional(),
  snapshot_captured_at: z.string().datetime().or(z.string()), 
}).superRefine((data, ctx) => {
  const hasSku = !!data.specs.catalog_sku?.trim() && 
                 data.specs.catalog_sku !== "Generic" && 
                 data.specs.catalog_sku !== "DRAFT" && 
                 data.specs.catalog_sku !== "N/A";
  
  const hasName = !!data.catalog_product_name?.trim() && 
                  data.catalog_product_name !== "Manual Item" && 
                  data.catalog_product_name !== "New Item" && 
                  data.catalog_product_name !== "[RESERVED]";
  
  const hasIdentity = hasSku || hasName;
  const hasSecondary = !!data.specs.catalog_color?.trim() || 
                       !!data.specs.catalog_motif?.trim() || 
                       !!data.specs.catalog_finishing?.trim();

  if (!hasIdentity && !hasSecondary) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least (SKU or Name) or (Color/Motif/Finishing) must be provided.",
      path: ["catalog_product_name"],
    });
  }
});

export type ScheduleSnapshot = z.infer<typeof ScheduleSnapshotSchema>;
