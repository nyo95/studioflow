-- MASTER DATA ENTITY REWORK
--
-- Owner direction, 31 July 2026: master data should be six things — brand,
-- category, product (sub-category), SKU, links, sample — and the imported rows
-- may be discarded ("benerin skema, hapus aja datanya gpp").
--
-- WHAT THIS DESTROYS, EXPLICITLY
-- ------------------------------
-- Deleted on purpose, with the owner's agreement:
--   * every master_data."Vendor" row            (397 brands)
--   * every master_data."VendorOffering" row    (483 capability rows)
--   * every master_data."ProductCatalog" row    (3 SKUs)
--   * every master_data."VendorContact" row
--
-- PRESERVED, and the reason the samples are moved rather than recreated:
--   * all 287 studioflow."PhysicalSample" rows and their SampleMovementLog
--     history. The table is renamed and moved with ALTER TABLE, not dropped,
--     because SampleMovementLog cascade-deletes with its sample: a DROP would
--     silently take the borrow/return trail with it. Their product_id was
--     already NULL for every row ("Terhubung ke SKU: 0"), so nothing is lost
--     by the catalog wipe.
--   * every studioflow project table. ProjectScheduleOption.data_snapshot is
--     frozen JSON and is not touched, so existing schedules keep rendering
--     brand, SKU, colour and price exactly as they do today. What they LOSE is
--     the live link back to the library: product_catalog_id becomes sku_id and
--     is set NULL, because the row it pointed at no longer exists. Re-linking
--     is a curation task, not something this migration can guess.
--   * every AuditLog row. entity_type still reads 'ProductCatalog' /
--     'PhysicalSample' / 'VENDOR' for historical entries; new writes use 'Sku'
--     and 'Sample'. The old strings are deliberately NOT rewritten — an audit
--     log that edits itself is not an audit log.
--
-- RUN ORDER MATTERS: drop the FKs that point into master_data before dropping
-- the tables they reference, or Postgres refuses.

-- ---------------------------------------------------------------------------
-- 1. Release studioflow's references into the catalog.
-- ---------------------------------------------------------------------------

ALTER TABLE "studioflow"."ProjectScheduleOption"
  DROP CONSTRAINT IF EXISTS "ProjectScheduleOption_product_catalog_id_fkey";
ALTER TABLE "studioflow"."ProjectProductRequest"
  DROP CONSTRAINT IF EXISTS "ProjectProductRequest_product_catalog_id_fkey";
ALTER TABLE "studioflow"."ProjectProductRequest"
  DROP CONSTRAINT IF EXISTS "ProjectProductRequest_linked_sample_id_fkey";
ALTER TABLE "studioflow"."PhysicalSample"
  DROP CONSTRAINT IF EXISTS "PhysicalSample_product_id_fkey";
-- SET SCHEMA moves this FK with SampleMovementLog. Drop it first because step
-- 5 recreates it against the renamed master_data.Sample table; otherwise the
-- existing constraint name collides and PostgreSQL aborts the migration.
ALTER TABLE "studioflow"."SampleMovementLog"
  DROP CONSTRAINT IF EXISTS "SampleMovementLog_sample_id_fkey";

-- Rename in place so the column keeps its data type and its index; the values
-- are cleared below, once nothing can still be read through them.
ALTER TABLE "studioflow"."ProjectScheduleOption"
  RENAME COLUMN "product_catalog_id" TO "sku_id";
ALTER TABLE "studioflow"."ProjectProductRequest"
  RENAME COLUMN "product_catalog_id" TO "sku_id";

UPDATE "studioflow"."ProjectScheduleOption" SET "sku_id" = NULL;
UPDATE "studioflow"."ProjectProductRequest"  SET "sku_id" = NULL;

-- ---------------------------------------------------------------------------
-- 2. Move the sample register into master_data, keeping every row.
-- ---------------------------------------------------------------------------

ALTER TABLE "studioflow"."PhysicalSample" SET SCHEMA "master_data";
ALTER TABLE "master_data"."PhysicalSample" RENAME TO "Sample";
ALTER TABLE "studioflow"."SampleMovementLog" SET SCHEMA "master_data";

ALTER TABLE "master_data"."Sample" RENAME COLUMN "product_id" TO "sku_id";

-- Every sample was already unlinked; this makes that explicit before the FK is
-- re-pointed at the new Sku table.
UPDATE "master_data"."Sample" SET "sku_id" = NULL;

-- New columns the rework adds. All nullable or defaulted, so existing rows stay
-- valid without inventing values for them.
ALTER TABLE "master_data"."Sample"
  ADD COLUMN IF NOT EXISTS "catalog_location_note" TEXT,
  ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "borrowed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP(3);

-- Rename the indexes and constraints too.
--
-- This block is easy to skip and costly to skip. PostgreSQL moves indexes and
-- constraints with the table on SET SCHEMA and RENAME, but it does NOT rename
-- them: without this, the database would keep `PhysicalSample_pkey` and
-- `PhysicalSample_product_id_idx` on a table Prisma now calls `Sample` with a
-- column called `sku_id`. Everything would still work, and then the next
-- `prisma migrate dev` would report drift and try to "fix" it. Verified by
-- diffing this file against `prisma migrate diff --from-empty`.
ALTER INDEX "master_data"."PhysicalSample_pkey"
  RENAME TO "Sample_pkey";
ALTER INDEX "master_data"."PhysicalSample_source_checksum_source_sheet_source_row_key"
  RENAME TO "Sample_source_checksum_source_sheet_source_row_key";
ALTER INDEX "master_data"."PhysicalSample_product_id_idx"
  RENAME TO "Sample_sku_id_idx";
ALTER INDEX "master_data"."PhysicalSample_catalog_status_idx"
  RENAME TO "Sample_catalog_status_idx";
ALTER INDEX "master_data"."PhysicalSample_catalog_source_brand_idx"
  RENAME TO "Sample_catalog_source_brand_idx";
ALTER INDEX "master_data"."PhysicalSample_catalog_rack_number_catalog_box_number_idx"
  RENAME TO "Sample_catalog_rack_number_catalog_box_number_idx";
ALTER INDEX "master_data"."PhysicalSample_deleted_at_idx"
  RENAME TO "Sample_deleted_at_idx";

-- Dropped rather than renamed: the new schema does not index
-- catalog_source_category. It was only ever used to group the office register
-- by its raw category text, and category is a real table now.
DROP INDEX IF EXISTS "master_data"."PhysicalSample_catalog_source_category_idx";

-- ---------------------------------------------------------------------------
-- 3. Drop the old master_data tables. Offering goes entirely (MASTER_SSOT
--    §6.7 already ruled it is not its own domain; §6.10 made a null SKU legal,
--    which is all an "offering" ever was).
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS "master_data"."VendorOffering";
DROP TABLE IF EXISTS "master_data"."ProductCatalog";
DROP TABLE IF EXISTS "master_data"."VendorContact";
DROP TABLE IF EXISTS "master_data"."Vendor";

DROP TYPE IF EXISTS "master_data"."VendorOfferingJessStatus";
DROP TYPE IF EXISTS "master_data"."VendorOfferingStatus";

-- ---------------------------------------------------------------------------
-- 4. The new shape.
-- ---------------------------------------------------------------------------

CREATE TYPE "master_data"."BrandLinkKind" AS ENUM (
  'WEBSITE', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE',
  'LINKEDIN', 'WHATSAPP', 'MARKETPLACE', 'CATALOG', 'OTHER'
);

CREATE TABLE "master_data"."Brand" (
  "id"         TEXT NOT NULL,
  "brand_name" TEXT NOT NULL,
  -- One column for the legal entity, replacing company_name + company_pt. Two
  -- columns for one fact is how a brand ended up with a company name in one and
  -- a PT name in the other, with nothing reconciling them.
  "legal_name" TEXT,
  "address"    TEXT,
  "notes"      TEXT,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Brand_brand_name_key" ON "master_data"."Brand"("brand_name");
CREATE INDEX "Brand_deleted_at_idx" ON "master_data"."Brand"("deleted_at");

CREATE TABLE "master_data"."BrandLink" (
  "id"         TEXT NOT NULL,
  "brand_id"   TEXT NOT NULL,
  "kind"       "master_data"."BrandLinkKind" NOT NULL,
  "url"        TEXT NOT NULL,
  "label"      TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BrandLink_pkey" PRIMARY KEY ("id")
);
-- Keyed on (brand, url) and NOT on kind: the same URL twice under one brand is
-- a data-entry slip, and a URL should be classified exactly once.
CREATE UNIQUE INDEX "BrandLink_brand_id_url_key" ON "master_data"."BrandLink"("brand_id", "url");
CREATE INDEX "BrandLink_brand_id_idx" ON "master_data"."BrandLink"("brand_id");

CREATE TABLE "master_data"."BrandContact" (
  "id"             TEXT NOT NULL,
  "brand_id"       TEXT NOT NULL,
  "contact_person" TEXT NOT NULL,
  "contact_role"   TEXT,
  -- TEXT, always. Leading zeros are significant and one field legitimately
  -- holds several numbers at once.
  "phone_number"   TEXT,
  "email"          TEXT,
  CONSTRAINT "BrandContact_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BrandContact_brand_id_idx" ON "master_data"."BrandContact"("brand_id");

CREATE TABLE "master_data"."Category" (
  "id"         TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "slug"       TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3),
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Category_name_key" ON "master_data"."Category"("name");
-- The slug is what makes "Sanitary", "sanitary" and " Sanitary " one category
-- instead of three. That was impossible while this was a free-text column.
CREATE UNIQUE INDEX "Category_slug_key" ON "master_data"."Category"("slug");

CREATE TABLE "master_data"."Product" (
  "id"          TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "sort_order"  INTEGER NOT NULL DEFAULT 0,
  "is_active"   BOOLEAN NOT NULL DEFAULT true,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3),
  CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Product_category_id_name_key" ON "master_data"."Product"("category_id", "name");
CREATE UNIQUE INDEX "Product_category_id_slug_key" ON "master_data"."Product"("category_id", "slug");
CREATE INDEX "Product_category_id_idx" ON "master_data"."Product"("category_id");

CREATE TABLE "master_data"."Sku" (
  "id"          TEXT NOT NULL,
  "brand_id"    TEXT NOT NULL,
  "category_id" TEXT NOT NULL,
  -- Nullable: a capability-level row often knows its category but not its
  -- sub-category, and guessing one invents taxonomy nobody verified.
  "product_id"  TEXT,
  -- Nullable, which is what absorbs the old VendorOffering: a supplier
  -- capability row is a Sku with no article code and status PENDING.
  "catalog_sku" TEXT,
  "catalog_product_name"        TEXT,
  "catalog_pattern"             TEXT,
  "catalog_motif"               TEXT,
  "catalog_color"               TEXT,
  "catalog_finishing"           TEXT,
  "catalog_dimension_p"         TEXT,
  "catalog_dimension_l"         TEXT,
  "catalog_dimension_t"         TEXT,
  "catalog_dimension_unit"      TEXT DEFAULT 'cm',
  "catalog_tags"                TEXT[] DEFAULT ARRAY[]::TEXT[],
  "catalog_metadata"            JSONB,
  "catalog_type"                "studioflow"."ProductType" NOT NULL DEFAULT 'material',
  "catalog_status"              "studioflow"."LibraryItemStatus" NOT NULL DEFAULT 'PENDING',
  "catalog_image_url"           TEXT,
  "catalog_image_thumbnail_url" TEXT,
  "catalog_image_original_url"  TEXT,
  "catalog_reference_url"       TEXT,
  "catalog_folder_url"          TEXT,
  "catalog_price"               DOUBLE PRECISION,
  "catalog_vendor_price"        DOUBLE PRECISION,
  -- No default on purpose: a price without a unit cannot be estimated against,
  -- and defaulting it would silently corrupt BQ quantities.
  "catalog_price_unit"          TEXT,
  "catalog_price_updated_at"    TIMESTAMP(3),
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"  TIMESTAMP(3),
  "deleted_at"  TIMESTAMP(3),
  CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);
-- Postgres treats NULLs as distinct, so every unidentified row coexists freely
-- while two real article codes cannot collide inside one brand.
CREATE UNIQUE INDEX "Sku_brand_id_catalog_sku_key" ON "master_data"."Sku"("brand_id", "catalog_sku");
CREATE INDEX "Sku_brand_id_idx"       ON "master_data"."Sku"("brand_id");
CREATE INDEX "Sku_category_id_idx"    ON "master_data"."Sku"("category_id");
CREATE INDEX "Sku_product_id_idx"     ON "master_data"."Sku"("product_id");
CREATE INDEX "Sku_catalog_status_idx" ON "master_data"."Sku"("catalog_status");
CREATE INDEX "Sku_deleted_at_idx"     ON "master_data"."Sku"("deleted_at");

-- ---------------------------------------------------------------------------
-- 5. Wire it together.
-- ---------------------------------------------------------------------------

ALTER TABLE "master_data"."BrandLink"
  ADD CONSTRAINT "BrandLink_brand_id_fkey" FOREIGN KEY ("brand_id")
  REFERENCES "master_data"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "master_data"."BrandContact"
  ADD CONSTRAINT "BrandContact_brand_id_fkey" FOREIGN KEY ("brand_id")
  REFERENCES "master_data"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "master_data"."Product"
  ADD CONSTRAINT "Product_category_id_fkey" FOREIGN KEY ("category_id")
  REFERENCES "master_data"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RESTRICT, not CASCADE: deleting a brand or a category should fail loudly
-- while SKUs still hang off it, rather than quietly taking the catalog with it.
ALTER TABLE "master_data"."Sku"
  ADD CONSTRAINT "Sku_brand_id_fkey" FOREIGN KEY ("brand_id")
  REFERENCES "master_data"."Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_data"."Sku"
  ADD CONSTRAINT "Sku_category_id_fkey" FOREIGN KEY ("category_id")
  REFERENCES "master_data"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_data"."Sku"
  ADD CONSTRAINT "Sku_product_id_fkey" FOREIGN KEY ("product_id")
  REFERENCES "master_data"."Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SET NULL, so removing a SKU orphans its samples rather than destroying the
-- physical inventory record and its movement history.
ALTER TABLE "master_data"."Sample"
  ADD CONSTRAINT "Sample_sku_id_fkey" FOREIGN KEY ("sku_id")
  REFERENCES "master_data"."Sku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "master_data"."SampleMovementLog"
  ADD CONSTRAINT "SampleMovementLog_sample_id_fkey" FOREIGN KEY ("sample_id")
  REFERENCES "master_data"."Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cross-schema foreign keys, valid PostgreSQL and the reason for the
-- single-instance / three-schema topology (MASTER_SSOT §6.3).
ALTER TABLE "studioflow"."ProjectScheduleOption"
  ADD CONSTRAINT "ProjectScheduleOption_sku_id_fkey" FOREIGN KEY ("sku_id")
  REFERENCES "master_data"."Sku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "studioflow"."ProjectProductRequest"
  ADD CONSTRAINT "ProjectProductRequest_sku_id_fkey" FOREIGN KEY ("sku_id")
  REFERENCES "master_data"."Sku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "studioflow"."ProjectProductRequest"
  ADD CONSTRAINT "ProjectProductRequest_linked_sample_id_fkey" FOREIGN KEY ("linked_sample_id")
  REFERENCES "master_data"."Sample"("id") ON DELETE SET NULL ON UPDATE CASCADE;
