-- Master Data v2 follow-up (M5): ProjectProductRequest keeps a frozen copy of
-- the brand / SKU name it was raised against.
--
-- The FKs to master_data.Brand and master_data.Sku were dropped by
-- 20260810180000_masterdata_v2_rebaseline, so `brand_id` / `sku_id` are now
-- plain columns that may point at rows which no longer exist. Without a
-- snapshot there is nothing left to render for such a request.
--
-- These two columns were added to schema.prisma during the v2 rework but the
-- matching migration was missed — the baseline was registered with
-- `migrate resolve --applied`, which records a migration as run WITHOUT
-- diffing schema against database, so `migrate status` reported clean while
-- the columns did not exist. Caught by ensureDbSchemaPreflight on 2026-08-10.

ALTER TABLE "studioflow"."ProjectProductRequest"
  ADD COLUMN IF NOT EXISTS "brand_name_snapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "sku_name_snapshot" TEXT;
