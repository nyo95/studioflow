import { ProjectScheduleEntry, ProjectScheduleOption, PrefixDictionary, ProductType, Sku } from "@/generated/prisma";
import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
export type { ScheduleSnapshot as ScheduleOptionSnapshot } from "@/lib/validations/schedule-snapshot";
// export removed to avoid duplicate export; ScheduleSnapshot is re‑exported as ScheduleOptionSnapshot above

export type GradualFormCustomData = {
  // Step 1: Primary
  catalog_sku: string;
  catalog_product_name: string;
  // Step 2: Physical Identity (Color mandatory per Point 11)
  catalog_color: string;
  catalog_motif: string;
  catalog_finishing: string;
  // Step 3: Metadata & Brand
  catalog_brand: string;
  catalog_sub_category: string;
  catalog_dimensions: string;
  catalog_reference_url: string;
  catalog_image_url?: string;
};

export type GradualFormData = {
  selectedId: string;
  customData: GradualFormCustomData;
};

// `catalog_brand` is no longer a Sku column — the brand lives on its own row —
// so the picker carries it as a resolved string alongside the Sku fields.
// MASTER DATA v2 (2026-08-10): Sku no longer has catalog_sku/catalog_product_name/
// catalog_image_url columns — those are legacy-named fields DERIVED by
// `attachDerivedCatalogFields` (src/extensions/library/types.ts) from the v2
// columns (code/name/media). Picked directly from Sku here since this type
// only needs the id plus display strings.
export type GradualFormProducts = (Pick<Sku, "id" | "code" | "name"> & {
  catalog_brand: string | null;
  catalog_image_url?: string | null;
})[];


export type ProjectScheduleOptionWithProduct = ProjectScheduleOption & {
  product_requests?: {
    status: string;
    project_id: string;
  }[];
  sku?: (Sku & {
    catalog_brand?: string | null;
    product_requests?: {
      status: string;
      project_id: string;
    }[];
  }) | null;
};


export type ProjectScheduleEntryWithRelations = ProjectScheduleEntry & {
  options: ProjectScheduleOptionWithProduct[];
  prefix_ref?: PrefixDictionary | null;
  schedule_code?: string;
};

export type ScheduleGroupedByCategory = {
  schedule_category: string;
  schedule_section: ProductType;
  entries: ProjectScheduleEntryWithRelations[];
};

export type ScheduleProjectMetadata = {
  projectName: string;
  clientName: string | null;
  clientContact: string | null;
  address: string | null;
};

export type ProjectScheduleSheetPayload = {
  section: ProductType;
  project: ScheduleProjectMetadata;
  availableCategories: string[];
  groups: ScheduleGroupedByCategory[];
};

export type ScheduleManualData = {
  catalog_sku: string;
  catalog_product_name: string;
  catalog_brand: string;
  catalog_sub_category?: string | null;
  catalog_motif?: string | null;
  catalog_color?: string | null;
  catalog_finishing?: string | null;
  catalog_dimension_p?: string | null;
  catalog_dimension_l?: string | null;
  catalog_dimension_t?: string | null;
  catalog_dimension_unit?: string | null;
  catalog_structured_tags?: string[];
  catalog_reference_url?: string | null;
  schedule_location?: string | null;
  catalog_image_url?: string | null;
  catalog_price?: number | null;
  catalog_has_sample?: boolean | null;
};
