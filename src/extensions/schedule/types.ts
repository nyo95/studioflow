import { ProjectScheduleEntry, ProjectScheduleOption, PrefixDictionary, ProductType, ProductCatalog } from "@/generated/prisma";
import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
export type { ScheduleSnapshot as ScheduleOptionSnapshot } from "@/lib/validations/schedule-snapshot";
export type { ScheduleSnapshot };

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

export type GradualFormProducts = Pick<ProductCatalog, "id" | "catalog_sku" | "catalog_product_name" | "catalog_brand" | "catalog_image_url">[];


export type ProjectScheduleOptionWithProduct = ProjectScheduleOption & {
  product_catalog?: (ProductCatalog & {
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
