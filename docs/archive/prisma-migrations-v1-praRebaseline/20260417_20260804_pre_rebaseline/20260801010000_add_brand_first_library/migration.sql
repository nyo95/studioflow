-- §6.14 Brand-First Library (PLAN-LIBRARY-BRAND-FIRST.md).
-- Purely additive: no column dropped, no table dropped, no existing row
-- touched. Sku/Sample/MaterialCandidate/SampleCandidate keep their current
-- shape and data. This migration only adds the new Brand+Category surface,
-- price detached from Sku, and the reuse-search columns on
-- ProjectScheduleOption. The teardown of Sku's price columns and the
-- per-SKU catalog surface is a SEPARATE, later migration (PLAN §9 step 7)
-- run only after the new surface has been evaluated on screen (PLAN §9
-- step 4, R7).
--
-- Hand-written per this codebase's established convention (see e.g.
-- 20260731234000_add_masterdata_curation_queue/migration.sql) rather than
-- `prisma migrate dev`, because this schema change was authored without a
-- live database connection to diff against. Before applying: run
-- `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma`
-- (or the equivalent shadow-DB diff) and confirm it matches this file with
-- zero drift, per the same discipline §6.11 used to catch two migration
-- defects that would not have failed at compile time.

-- ---------------------------------------------------------------------------
-- 1. BrandLinkKind: two new values. Postgres requires ADD VALUE to run
--    outside the transaction that first uses the new value; this statement
--    only adds it, nothing in this file reads it back.
-- ---------------------------------------------------------------------------
ALTER TYPE "master_data"."VendorLinkKind" ADD VALUE IF NOT EXISTS 'DRIVE';
ALTER TYPE "master_data"."VendorLinkKind" ADD VALUE IF NOT EXISTS 'PRICE_LIST';

-- ---------------------------------------------------------------------------
-- 2. BrandLink (VendorLink table): archive_url for "URL asal + salinan
--    arsip" (owner decision, §6.14 / PLAN §10 R1).
-- ---------------------------------------------------------------------------
ALTER TABLE "master_data"."VendorLink" ADD COLUMN "archive_url" TEXT;

-- ---------------------------------------------------------------------------
-- 3. Category — canonical, slug-unique. Reverses §6.12's free-tag choice for
--    Brand-level category, because category search now *is* the Library.
-- ---------------------------------------------------------------------------
CREATE TABLE "master_data"."Category" (
    "id"         TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "slug"       TEXT NOT NULL,
    "is_active"  BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Category_name_key" ON "master_data"."Category"("name");
CREATE UNIQUE INDEX "Category_slug_key" ON "master_data"."Category"("slug");

-- ---------------------------------------------------------------------------
-- 4. BrandCategory — join, ordered. sort_order preserves §6.12's "first tag
--    is the primary Schedule category" semantic.
-- ---------------------------------------------------------------------------
CREATE TABLE "master_data"."BrandCategory" (
    "id"          TEXT NOT NULL,
    "brand_id"    TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "sort_order"  INTEGER NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BrandCategory_brand_id_category_id_key" ON "master_data"."BrandCategory"("brand_id", "category_id");
CREATE INDEX "BrandCategory_category_id_idx" ON "master_data"."BrandCategory"("category_id");
CREATE INDEX "BrandCategory_brand_id_sort_order_idx" ON "master_data"."BrandCategory"("brand_id", "sort_order");

ALTER TABLE "master_data"."BrandCategory"
    ADD CONSTRAINT "BrandCategory_brand_id_fkey"
    FOREIGN KEY ("brand_id") REFERENCES "master_data"."Vendor"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "master_data"."BrandCategory"
    ADD CONSTRAINT "BrandCategory_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "master_data"."Category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. MaterialPrice — pricing detached from Sku (§6.14). sku_id optional on
--    purpose: most price-list rows describe an item never physically
--    received. Master Data-owned; StudioFlow's service layer must never
--    query this table on a StudioFlow-facing read path.
-- ---------------------------------------------------------------------------
CREATE TABLE "master_data"."MaterialPrice" (
    "id"                    TEXT NOT NULL,
    "brand_id"              TEXT NOT NULL,
    "sku_id"                TEXT,
    "item_description"      TEXT NOT NULL,
    "unit"                  TEXT,
    "price_before_discount" DOUBLE PRECISION,
    "price_after_discount"  DOUBLE PRECISION,
    "source_link_id"        TEXT,
    "valid_from"            TIMESTAMP(3),
    "notes"                 TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3),
    "deleted_at"            TIMESTAMP(3),

    CONSTRAINT "MaterialPrice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaterialPrice_brand_id_idx" ON "master_data"."MaterialPrice"("brand_id");
CREATE INDEX "MaterialPrice_sku_id_idx" ON "master_data"."MaterialPrice"("sku_id");
CREATE INDEX "MaterialPrice_deleted_at_idx" ON "master_data"."MaterialPrice"("deleted_at");

ALTER TABLE "master_data"."MaterialPrice"
    ADD CONSTRAINT "MaterialPrice_brand_id_fkey"
    FOREIGN KEY ("brand_id") REFERENCES "master_data"."Vendor"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "master_data"."MaterialPrice"
    ADD CONSTRAINT "MaterialPrice_sku_id_fkey"
    FOREIGN KEY ("sku_id") REFERENCES "master_data"."Material"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "master_data"."MaterialPrice"
    ADD CONSTRAINT "MaterialPrice_source_link_id_fkey"
    FOREIGN KEY ("source_link_id") REFERENCES "master_data"."VendorLink"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 6. ProjectScheduleOption — reuse-search columns. Plain columns, written by
--    the service layer in the same transaction as data_snapshot, NOT
--    Postgres GENERATED — this migration was authored without a live DB to
--    verify STORED-generated-column behavior against Prisma 7.5. If DB
--    access later confirms it works cleanly, a follow-up migration may
--    convert these to `GENERATED ALWAYS AS (data_snapshot->>'catalog_brand'
--    …) STORED` for a stronger no-drift guarantee. Until then, correctness
--    depends on the write path — flagged as a step-8 regression check in
--    PLAN-LIBRARY-BRAND-FIRST.md §9, not assumed.
-- ---------------------------------------------------------------------------
ALTER TABLE "studioflow"."ProjectScheduleOption" ADD COLUMN "spec_brand_id" TEXT;
ALTER TABLE "studioflow"."ProjectScheduleOption" ADD COLUMN "spec_product_name" TEXT;
ALTER TABLE "studioflow"."ProjectScheduleOption" ADD COLUMN "spec_color" TEXT;
ALTER TABLE "studioflow"."ProjectScheduleOption" ADD COLUMN "spec_finishing" TEXT;
ALTER TABLE "studioflow"."ProjectScheduleOption" ADD COLUMN "spec_search_key" TEXT;

CREATE INDEX "ProjectScheduleOption_spec_search_key_idx" ON "studioflow"."ProjectScheduleOption"("spec_search_key");
CREATE INDEX "ProjectScheduleOption_spec_brand_id_idx" ON "studioflow"."ProjectScheduleOption"("spec_brand_id");

ALTER TABLE "studioflow"."ProjectScheduleOption"
    ADD CONSTRAINT "ProjectScheduleOption_spec_brand_id_fkey"
    FOREIGN KEY ("spec_brand_id") REFERENCES "master_data"."Vendor"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 7. ProjectProductRequest — brand_id. The request now starts against a
--    Brand; sku_id becomes something the request PRODUCES on RECEIVED, not
--    something it requires up front (§6.14).
-- ---------------------------------------------------------------------------
ALTER TABLE "studioflow"."ProjectProductRequest" ADD COLUMN "brand_id" TEXT;

CREATE INDEX "ProjectProductRequest_brand_id_idx" ON "studioflow"."ProjectProductRequest"("brand_id");

ALTER TABLE "studioflow"."ProjectProductRequest"
    ADD CONSTRAINT "ProjectProductRequest_brand_id_fkey"
    FOREIGN KEY ("brand_id") REFERENCES "master_data"."Vendor"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
