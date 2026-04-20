import { ProjectScheduleEntry, ProjectScheduleOption, PrefixDictionary, ScheduleSection, MaterialCatalog } from "@/generated/prisma";


export type ScheduleOptionSnapshot = {
  snapshot_source_kind: "catalog" | "manual";
  snapshot_source_origin?: "web_catalog" | "web_manual" | "gsheets_import" | "sketchup_plugin";
  snapshot_source_external_id?: string | null;
  material_catalog_id: string | null;
  schedule_category: string;
  catalog_sub_category?: string | null;
  catalog_product_name: string;
  catalog_brand: string;
  catalog_initials_type?: string | null;
  catalog_price: number | null;
  catalog_image_url: string | null;
  catalog_reference_url: string | null;
  catalog_contact_name?: string | null;
  catalog_contact_phone?: string | null;
  catalog_contact_email?: string | null;
  catalog_has_sample?: boolean | null;
  specs: {
    catalog_sku: string;
    catalog_motif?: string | null;
    catalog_structured_tags: string[];
    catalog_dimensions: string;
    catalog_color?: string | null;
    catalog_finishing?: string | null;
    catalog_reference_url?: string | null;
    metadata: unknown;
  };
  snapshot_source_payload?: unknown;
  snapshot_captured_at: string;
};

export type ProjectScheduleOptionWithMaterial = ProjectScheduleOption & {
  material_catalog?: (MaterialCatalog & {
    material_requests?: {
      status: string;
      project_id: string;
    }[];
  }) | null;
};


export type ProjectScheduleEntryWithRelations = ProjectScheduleEntry & {
  options: ProjectScheduleOptionWithMaterial[];
  prefix_ref?: PrefixDictionary | null;
};

export type ScheduleGroupedByCategory = {
  schedule_category: string;
  schedule_section: ScheduleSection;
  entries: ProjectScheduleEntryWithRelations[];
};

export type ScheduleProjectMetadata = {
  projectName: string;
  clientName: string | null;
  clientContact: string | null;
  address: string | null;
};

export type ProjectScheduleSheetPayload = {
  section: ScheduleSection;
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
