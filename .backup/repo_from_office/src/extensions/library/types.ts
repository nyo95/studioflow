import { Prisma, Vendor, VendorContact, LibraryItemStatus, ScheduleSection } from "@/generated/prisma";
import { z } from "zod";


export type LibraryVendor = Vendor & {
  contacts?: VendorContact[];
};

export type MaterialCatalogWithRelations = Prisma.MaterialCatalogGetPayload<{
  include: { 
    vendor: { include: { contacts: true } },
    physical_samples: true
  };
}>;

export type ProjectMaterialRequestWithDetails = Prisma.ProjectMaterialRequestGetPayload<{
  include: { 
    material: { 
      include: { 
        vendor: { include: { contacts: true } },
        physical_samples: true
      } 
    },
    requested_by: true,
    project: true
  };
}>;

export type VendorContactInput = {
  id?: string;
  contact_person: string;
  contact_role: string;
  phone_number?: string;
  email?: string;
};

export type LibraryVendorInput = {
  brand_name: string;
  company_name?: string;
  company_pt?: string;
  address?: string;
  website_url?: string;
  instagram_url?: string;
  contacts: VendorContactInput[];
};

export type PhysicalSampleInput = {
  id?: string;
  location_rak: string;
  container_box: string;
  notes?: string;
};

export type MaterialCatalogInput = {
  vendor_id?: string;
  vendor_name?: string;
  category: string;
  section?: ScheduleSection; // Added to support MATERIAL vs FIXTURE sections
  sub_category?: string;
  product_type: string;
  motif_or_color?: string;
  tags?: string[];
  dimension_p?: string;
  dimension_l?: string;
  dimension_t?: string;
  dimension_unit?: string;
  color?: string;
  finishing?: string;
  cover_url?: string;
  original_url?: string;
  digital_catalog_url?: string;
  digital_folder_url?: string;
  rak_location?: string;
  box_number?: string;
  metadata?: Record<string, unknown>;
  status?: LibraryItemStatus;
  price?: number | null;
  // We'll handle physical samples as an optional nested creation/update
  physical_samples?: PhysicalSampleInput[];
};

export type ProjectMaterialRequestInput = {
  project_id: string;
  material_id?: string;
  custom_material_name?: string;
  reference_url?: string;
  cover_url?: string;
  original_url?: string;
  area_location?: string;
  is_scheduled?: boolean;
  notes?: string;
};

export const MaterialMetadataSchema = z.record(z.string(), z.unknown());
export const LibraryItemStatusSchema = z.nativeEnum(LibraryItemStatus);
