import { Prisma, Vendor, VendorContact, LibraryItemStatus, ScheduleSection, PromotionRequest } from "@/generated/prisma";
import { z } from "zod";


export type LibraryVendor = Vendor & {
  contacts?: VendorContact[];
};

export type ProductCatalogWithRelations = Prisma.ProductCatalogGetPayload<{
  include: { 
    vendor: { include: { contacts: true } },
    physical_samples: true
  };
}>;

export type ProjectProductRequestWithDetails = Prisma.ProjectProductRequestGetPayload<{
  include: { 
    product_catalog: { 
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
  rack_number: string;
  box_number: string;
  notes?: string;
};

export type ProductCatalogInput = {
  vendor_id?: string;
  vendor_name?: string;
  catalog_category: string;
  section?: ScheduleSection; // Added to support MATERIAL vs FIXTURE sections
  catalog_sub_category?: string;
  catalog_sku: string;
  catalog_brand?: string;
  catalog_product_name?: string;
  catalog_motif?: string;
  tags?: string[];
  catalog_dimension_p?: string;
  catalog_dimension_l?: string;
  catalog_dimension_t?: string;
  catalog_dimension_unit?: string;
  catalog_color?: string;
  catalog_finishing?: string;
  catalog_image_url?: string;
  catalog_image_original_url?: string;
  catalog_reference_url?: string;
  catalog_folder_url?: string;
  metadata?: Record<string, unknown>;
  status?: LibraryItemStatus;
  catalog_price?: number | null;
  // We'll handle physical samples as an optional nested creation/update
  physical_samples?: PhysicalSampleInput[];
};

export type ProjectProductRequestInput = {
  project_id: string;
  product_catalog_id?: string;
  schedule_entry_id?: string;
  schedule_option_id?: string;
  custom_product_name?: string;
  reference_url?: string;
  cover_url?: string;
  original_url?: string;
  area_location?: string;
  is_scheduled?: boolean;
  notes?: string;
};

export const ProductMetadataSchema = z.record(z.string(), z.unknown());
export const LibraryItemStatusSchema = z.nativeEnum(LibraryItemStatus);

export type PromotionRequestWithDetails = PromotionRequest;
