CREATE TYPE "bq"."BqLineSource" AS ENUM ('MASTER_DATA', 'PROJECT_LOCAL');

ALTER TABLE "bq"."BqMaterialLine"
  ADD COLUMN "source" "bq"."BqLineSource" NOT NULL DEFAULT 'MASTER_DATA';
ALTER TABLE "bq"."BqServiceLine"
  ADD COLUMN "source" "bq"."BqLineSource" NOT NULL DEFAULT 'MASTER_DATA';

ALTER TABLE "bq"."BqLibraryMaterialLine"
  ADD COLUMN "source" "bq"."BqLineSource" NOT NULL DEFAULT 'MASTER_DATA',
  ALTER COLUMN "sku_id" DROP NOT NULL,
  ADD COLUMN "recipe_name" TEXT,
  ADD COLUMN "recipe_code" TEXT,
  ADD COLUMN "recipe_brand_name" TEXT,
  ADD COLUMN "recipe_supplier_name" TEXT,
  ADD COLUMN "recipe_usage_unit" TEXT,
  ADD COLUMN "recipe_purchase_unit" TEXT,
  ADD COLUMN "recipe_conversion" DECIMAL(18,6),
  ADD COLUMN "recipe_price" DECIMAL(18,4),
  ADD COLUMN "recipe_currency" TEXT,
  ADD COLUMN "recipe_default_waste_pct" DECIMAL(9,6),
  ADD COLUMN "recipe_minimum_order" DECIMAL(18,6),
  ADD COLUMN "recipe_rounding_increment" DECIMAL(18,6),
  ADD COLUMN "notes" TEXT;

ALTER TABLE "bq"."BqLibraryServiceLine"
  ADD COLUMN "source" "bq"."BqLineSource" NOT NULL DEFAULT 'MASTER_DATA',
  ALTER COLUMN "work_price_id" DROP NOT NULL,
  ADD COLUMN "recipe_name" TEXT,
  ADD COLUMN "recipe_code" TEXT,
  ADD COLUMN "recipe_vendor_name" TEXT,
  ADD COLUMN "recipe_rate_unit" TEXT,
  ADD COLUMN "recipe_price" DECIMAL(18,4),
  ADD COLUMN "recipe_currency" TEXT,
  ADD COLUMN "recipe_scope_note" TEXT,
  ADD COLUMN "recipe_has_material" BOOLEAN,
  ADD COLUMN "notes" TEXT;
