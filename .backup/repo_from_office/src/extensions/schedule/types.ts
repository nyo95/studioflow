import { ProjectScheduleEntry, ProjectScheduleOption, PrefixDictionary, ScheduleSection, MaterialCatalog } from "@/generated/prisma";


export type ScheduleOptionSnapshot = {
  source_kind: "catalog" | "manual";
  source_origin?: "web_catalog" | "web_manual" | "gsheets_import" | "sketchup_plugin";
  source_external_id?: string | null;
  material_catalog_id: string | null;
  category: string;
  sub_category?: string | null;
  name: string;
  brand: string;
  initials_type?: string | null;
  price: number | null;
  image_url: string | null;
  reference_url: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  has_sample?: boolean;
  specs: {
    product_type: string;
    motif_or_color?: string | null;
    tags: string[];
    dimensions: string;
    color?: string | null;
    finishing?: string | null;
    digital_catalog_url?: string | null;
    metadata: unknown;
  };
  source_payload?: unknown;
  captured_at: string;
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
  category: string;
  section: ScheduleSection;
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
  name: string;
  brand: string;
  sub_category?: string | null;
  motif_or_color?: string | null;
  color?: string | null;
  finishing?: string | null;
  dimension_p?: string | null;
  dimension_l?: string | null;
  dimension_t?: string | null;
  dimension_unit?: string | null;
  tags?: string[];
  digital_catalog_url?: string | null;
  reference_url?: string | null;
  location?: string | null;
  image_url?: string | null;
  price?: number | null;
  has_sample?: boolean;
};
