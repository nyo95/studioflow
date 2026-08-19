-- Physical-sample intake from the office register.
--
-- `Sheet1` describes real objects and their rack/box locations, but it does
-- not consistently contain the SKU, colour or image required by
-- ProductCatalog. Making the existing relation nullable keeps one inventory
-- table and avoids inventing catalog rows.

ALTER TABLE "studioflow"."PhysicalSample"
  DROP CONSTRAINT IF EXISTS "PhysicalSample_product_id_fkey";

ALTER TABLE "studioflow"."PhysicalSample"
  ALTER COLUMN "product_id" DROP NOT NULL,
  ADD COLUMN "catalog_source_number" TEXT,
  ADD COLUMN "catalog_source_category" TEXT,
  ADD COLUMN "catalog_source_brand" TEXT,
  ADD COLUMN "catalog_source_type" TEXT,
  ADD COLUMN "catalog_source_motif" TEXT,
  ADD COLUMN "source_sheet" TEXT,
  ADD COLUMN "source_row" INTEGER,
  ADD COLUMN "source_checksum" TEXT;

ALTER TABLE "studioflow"."PhysicalSample"
  ADD CONSTRAINT "PhysicalSample_product_id_fkey"
  FOREIGN KEY ("product_id")
  REFERENCES "studioflow"."ProductCatalog"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "studioflow"."PhysicalSample"
  ADD CONSTRAINT "PhysicalSample_identity_check"
  CHECK (
    "product_id" IS NOT NULL
    OR NULLIF(BTRIM("catalog_source_category"), '') IS NOT NULL
  );

CREATE UNIQUE INDEX "PhysicalSample_source_checksum_source_sheet_source_row_key"
ON "studioflow"."PhysicalSample"("source_checksum", "source_sheet", "source_row");

CREATE INDEX "PhysicalSample_catalog_source_category_idx"
ON "studioflow"."PhysicalSample"("catalog_source_category");

CREATE INDEX "PhysicalSample_catalog_source_brand_idx"
ON "studioflow"."PhysicalSample"("catalog_source_brand");

CREATE INDEX "PhysicalSample_catalog_status_idx"
ON "studioflow"."PhysicalSample"("catalog_status");

CREATE INDEX "PhysicalSample_catalog_rack_number_catalog_box_number_idx"
ON "studioflow"."PhysicalSample"("catalog_rack_number", "catalog_box_number");
