-- DESTRUCTIVE SCOPE GUARD
--
-- The owner explicitly authorized rebuilding master_data only. The guard makes
-- that authorization executable: if any master-data rows appear after the
-- verified cleanup and before deploy, the migration aborts instead of deleting
-- unexpected data. No studioflow table or row is dropped/truncated below.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "master_data"."Brand" LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM "master_data"."BrandContact" LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM "master_data"."BrandLink" LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM "master_data"."Category" LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM "master_data"."Product" LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM "master_data"."Sku" LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM "master_data"."Sample" LIMIT 1
  ) OR EXISTS (
    SELECT 1 FROM "master_data"."SampleMovementLog" LIMIT 1
  ) THEN
    RAISE EXCEPTION
      'master_data is no longer empty; aborting destructive Material/Vendor rebuild';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "master_data"."VendorLinkKind" AS ENUM ('WEBSITE', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'WHATSAPP', 'MARKETPLACE', 'CATALOG', 'OTHER');

-- DropForeignKey (constraints only; studioflow rows and columns are preserved)
ALTER TABLE "master_data"."BrandContact" DROP CONSTRAINT "BrandContact_brand_id_fkey";
ALTER TABLE "master_data"."BrandLink" DROP CONSTRAINT "BrandLink_brand_id_fkey";
ALTER TABLE "master_data"."Product" DROP CONSTRAINT "Product_category_id_fkey";
ALTER TABLE "master_data"."Sample" DROP CONSTRAINT "Sample_sku_id_fkey";
ALTER TABLE "master_data"."Sku" DROP CONSTRAINT "Sku_brand_id_fkey";
ALTER TABLE "master_data"."Sku" DROP CONSTRAINT "Sku_category_id_fkey";
ALTER TABLE "master_data"."Sku" DROP CONSTRAINT "Sku_product_id_fkey";
ALTER TABLE "studioflow"."ProjectProductRequest" DROP CONSTRAINT "ProjectProductRequest_sku_id_fkey";
ALTER TABLE "studioflow"."ProjectScheduleOption" DROP CONSTRAINT "ProjectScheduleOption_sku_id_fkey";

-- Rebuild the empty physical-sample intake shape.
DROP INDEX "master_data"."Sample_catalog_source_brand_idx";
DROP INDEX "master_data"."Sample_sku_id_idx";
DROP INDEX "master_data"."Sample_source_checksum_source_sheet_source_row_key";

ALTER TABLE "master_data"."Sample"
  DROP COLUMN "catalog_source_brand",
  DROP COLUMN "catalog_source_category",
  DROP COLUMN "catalog_source_motif",
  DROP COLUMN "catalog_source_number",
  DROP COLUMN "catalog_source_type",
  DROP COLUMN "sku_id",
  DROP COLUMN "source_checksum",
  DROP COLUMN "source_row",
  DROP COLUMN "source_sheet",
  ADD COLUMN "material_id" TEXT NOT NULL;

-- Drop only superseded master_data entities.
DROP TABLE "master_data"."Brand";
DROP TABLE "master_data"."BrandContact";
DROP TABLE "master_data"."BrandLink";
DROP TABLE "master_data"."Category";
DROP TABLE "master_data"."Product";
DROP TABLE "master_data"."Sku";
DROP TYPE "master_data"."BrandLinkKind";

-- Canonical relational Vendor.
CREATE TABLE "master_data"."Vendor" (
  "id" TEXT NOT NULL,
  "vendor_name" TEXT NOT NULL,
  "legal_name" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "master_data"."VendorLink" (
  "id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "kind" "master_data"."VendorLinkKind" NOT NULL,
  "url" TEXT NOT NULL,
  "label" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "VendorLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "master_data"."VendorContact" (
  "id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "contact_person" TEXT NOT NULL,
  "contact_role" TEXT,
  "phone_number" TEXT,
  "email" TEXT,
  CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

-- Canonical Material. Category/sub-category are ordered tags; SKU is required.
CREATE TABLE "master_data"."Material" (
  "id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "catalog_brand" TEXT NOT NULL,
  "catalog_sku" TEXT NOT NULL,
  "catalog_product_name" TEXT NOT NULL,
  "catalog_pattern" TEXT,
  "catalog_motif" TEXT,
  "catalog_color" TEXT,
  "catalog_finishing" TEXT,
  "catalog_dimension_p" TEXT,
  "catalog_dimension_l" TEXT,
  "catalog_dimension_t" TEXT,
  "catalog_dimension_unit" TEXT DEFAULT 'cm',
  "catalog_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "catalog_metadata" JSONB,
  "catalog_type" "studioflow"."ProductType" NOT NULL DEFAULT 'material',
  "catalog_status" "studioflow"."LibraryItemStatus" NOT NULL DEFAULT 'PENDING',
  "catalog_image_url" TEXT,
  "catalog_image_thumbnail_url" TEXT,
  "catalog_image_original_url" TEXT,
  "catalog_reference_url" TEXT,
  "catalog_folder_url" TEXT,
  "price_after_discount" DOUBLE PRECISION,
  "price_before_discount" DOUBLE PRECISION,
  "price_unit" TEXT,
  "price_updated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vendor_vendor_name_key"
  ON "master_data"."Vendor"("vendor_name");
CREATE INDEX "Vendor_deleted_at_idx"
  ON "master_data"."Vendor"("deleted_at");
CREATE INDEX "VendorLink_vendor_id_idx"
  ON "master_data"."VendorLink"("vendor_id");
CREATE UNIQUE INDEX "VendorLink_vendor_id_url_key"
  ON "master_data"."VendorLink"("vendor_id", "url");
CREATE INDEX "VendorContact_vendor_id_idx"
  ON "master_data"."VendorContact"("vendor_id");
CREATE INDEX "Material_vendor_id_idx"
  ON "master_data"."Material"("vendor_id");
CREATE INDEX "Material_brand_idx"
  ON "master_data"."Material"("catalog_brand");
CREATE INDEX "Material_status_idx"
  ON "master_data"."Material"("catalog_status");
CREATE INDEX "Material_deleted_at_idx"
  ON "master_data"."Material"("deleted_at");
CREATE UNIQUE INDEX "Material_vendor_brand_sku_key"
  ON "master_data"."Material"("vendor_id", "catalog_brand", "catalog_sku");
CREATE INDEX "Sample_material_id_idx"
  ON "master_data"."Sample"("material_id");

ALTER TABLE "master_data"."VendorLink"
  ADD CONSTRAINT "VendorLink_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "master_data"."Vendor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "master_data"."VendorContact"
  ADD CONSTRAINT "VendorContact_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "master_data"."Vendor"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "master_data"."Material"
  ADD CONSTRAINT "Material_vendor_id_fkey"
  FOREIGN KEY ("vendor_id") REFERENCES "master_data"."Vendor"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_data"."Sample"
  ADD CONSTRAINT "Sample_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "master_data"."Material"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reconnect existing nullable studioflow references to the new Material table.
ALTER TABLE "studioflow"."ProjectProductRequest"
  ADD CONSTRAINT "ProjectProductRequest_sku_id_fkey"
  FOREIGN KEY ("sku_id") REFERENCES "master_data"."Material"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "studioflow"."ProjectScheduleOption"
  ADD CONSTRAINT "ProjectScheduleOption_sku_id_fkey"
  FOREIGN KEY ("sku_id") REFERENCES "master_data"."Material"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
