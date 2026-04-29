import { Prisma, Vendor, VendorContact, LibraryItemStatus, ProductType, PromotionRequest } from "@/generated/prisma";
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
    project: true,
    schedule_entry: true,
    schedule_option: true
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
  catalog_rack_number: string;
  catalog_box_number: string;
  catalog_notes?: string;
  catalog_status?: "AVAILABLE" | "BORROWED" | "SENT_TO_CLIENT";
  current_borrower_name?: string;
};

export type ProductCatalogInput = {
  vendor_id?: string;
  vendor_name?: string;
  catalog_category: string;
  catalog_type?: ProductType; // material or fixture
  catalog_sub_category?: string;
  catalog_sku: string;
  catalog_brand?: string;
  catalog_product_name?: string;
  catalog_motif?: string;
  catalog_tags?: string[];
  catalog_dimension_p?: string;
  catalog_dimension_l?: string;
  catalog_dimension_t?: string;
  catalog_dimension_unit?: string;
  catalog_color: string; // REQUIRED as per Extension_rule.md
  catalog_finishing?: string;
  catalog_image_url?: string;
  catalog_image_thumbnail_url?: string;
  catalog_image_original_url?: string;
  catalog_reference_url?: string;
  catalog_folder_url?: string;
  catalog_metadata?: Record<string, unknown>;
  catalog_status?: LibraryItemStatus;
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
  linked_sample_id?: string;
};

export const ProductMetadataSchema = z.record(z.string(), z.unknown());
export const LibraryItemStatusSchema = z.nativeEnum(LibraryItemStatus);

/**
 * Strict validation for Product Catalog according to Extension_rule.md
 */
const ProductCatalogBaseSchema = z.object({
  catalog_category: z.string().min(1, "Category is required"),
  catalog_color: z.string().optional(),
  catalog_finishing: z.string().optional(),
  catalog_motif: z.string().optional(),
  catalog_sku: z.string().optional(),
  catalog_product_name: z.string().optional(),
  catalog_image_url: z.string().optional(), // Snapshot level optional
  catalog_type: z.nativeEnum(ProductType),
  vendor_id: z.string().optional(),
  vendor_name: z.string().optional(),
});

export const ProductCatalogValidationSchema = ProductCatalogBaseSchema.refine(
  data => {
    const hasSku = !!data.catalog_sku?.trim() && data.catalog_sku !== "N/A" && data.catalog_sku !== "DRAFT";
    const hasName = !!data.catalog_product_name?.trim() && data.catalog_product_name !== "New Item";
    const hasIdentity = hasSku || hasName;
    const hasSecondary = !!data.catalog_color?.trim() || !!data.catalog_motif?.trim() || !!data.catalog_finishing?.trim();
    return hasIdentity || hasSecondary;
  },
  {
    message: "At least (SKU or Name) or (Color/Motif/Finishing) must be provided.",
    path: ["catalog_sku"]
  }
);

/**
 * Hyper-Strict validation for Catalog Approval (Source of Truth)
 */
export const CatalogApprovalValidationSchema = ProductCatalogBaseSchema.extend({
  catalog_image_url: z.string().min(1, "Original Image is REQUIRED for catalog"),
  vendor_id: z.string().min(1, "Brand is REQUIRED for catalog"),
  catalog_color: z.string().min(1, "Color is REQUIRED for catalog"),
}).refine(
  data => data.catalog_sku?.trim() || data.catalog_product_name?.trim(),
  {
    message: "At least SKU or Product Name must exist for formal catalog entry",
    path: ["catalog_sku"]
  }
);

/**
 * Type-specific assertions for material vs fixture
 */
export const ProductTypeAssertionSchema = z.object({
  catalog_type: z.nativeEnum(ProductType),
  schedule_qty: z.number().optional(),
  schedule_location: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.catalog_type === "material") {
    if (data.schedule_qty !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Materials FORBID qty",
        path: ["schedule_qty"]
      });
    }
  } else if (data.catalog_type === "fixture") {
    // Note: These are required only in SNAPSHOT context
    // This schema will be used contextually by the service layer
  }
});

export type PromotionRequestWithDetails = PromotionRequest;
