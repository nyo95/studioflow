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
  /** Relational supplier identity for explicit promotion back to Master Data. */
  catalog_vendor_id: z.string().nullable().optional(),
  catalog_vendor_name: z.string().nullable().optional(),
  catalog_initials_type: z.string().nullable().optional(),
  catalog_price: z.number().nullable(), 
  catalog_notes: z.string().nullable().optional(),
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
  const sku = data.specs.catalog_sku?.trim();
  const name = data.catalog_product_name?.trim();
  const brand = data.catalog_brand?.trim();

  // A reserved slot is an intentional, system-allocated placeholder (created by
  // the "reserve" schedule mode and by "Add item" before it writes the real
  // draft snapshot). Its whole purpose is to hold a code before any content is
  // filled in, so it is exempt from the "must have a data point" rule below.
  const isReservedPlaceholder = name === "[RESERVED]";

  // Items synced from the SketchUp plugin are real materials/fixtures in the
  // model, identified by their code (schedule_code) — they are legitimately
  // sparse until a designer fills in brand/color/etc. They must NOT be forced
  // to carry echoed placeholder data just to pass this rule (that echo was the
  // source of "COLOR: CT-3" / SKU "PL-1" / duplicated titles), so they are
  // exempt: the code is their identity.
  const isSyncedDraft = data.snapshot_source_origin === "sketchup_plugin";

  const hasPrimary = (sku && !["Generic", "DRAFT", "N/A"].includes(sku)) ||
                     (name && !["Manual Item", "New Item", "[RESERVED]"].includes(name)) ||
                     (brand && !["Custom", "Generic", "PENDING"].includes(brand));

  const hasSecondary = !!data.specs.catalog_color?.trim() ||
                       !!data.specs.catalog_motif?.trim() ||
                       !!data.specs.catalog_finishing?.trim();

  if (!isReservedPlaceholder && !isSyncedDraft && !hasPrimary && !hasSecondary) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one Primary (Name/SKU/Brand) or Secondary (Color/Motif/Finishing) data point must be provided for draft entries.",
      path: ["catalog_product_name"],
    });
  }
});

export type ScheduleSnapshot = z.infer<typeof ScheduleSnapshotSchema>;
