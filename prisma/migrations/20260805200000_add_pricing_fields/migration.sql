-- Migration: 20260805200000_add_pricing_fields
-- R8: Adds fields derived from the actual Excel data model (Aplikasi AI.xlsx).
--
-- Changes per table:
--   MaterialPrice        → category TEXT, specifications JSONB
--   ServicePrice         → vendor_category TEXT, specifications JSONB
--   MaterialLaborPrice   → vendor_category TEXT, specifications JSONB

-- ---------------------------------------------------------------------------
-- 1. MaterialPrice
-- ---------------------------------------------------------------------------
ALTER TABLE master_data."MaterialPrice"
  ADD COLUMN IF NOT EXISTS "category"       TEXT,
  ADD COLUMN IF NOT EXISTS "specifications" JSONB;

CREATE INDEX IF NOT EXISTS "MaterialPrice_category_idx"
  ON master_data."MaterialPrice" ("category");

-- ---------------------------------------------------------------------------
-- 2. ServicePrice
-- ---------------------------------------------------------------------------
ALTER TABLE master_data."ServicePrice"
  ADD COLUMN IF NOT EXISTS "vendor_category" TEXT,
  ADD COLUMN IF NOT EXISTS "specifications"  JSONB;

CREATE INDEX IF NOT EXISTS "ServicePrice_vendor_category_idx"
  ON master_data."ServicePrice" ("vendor_category");

-- ---------------------------------------------------------------------------
-- 3. MaterialLaborPrice
-- ---------------------------------------------------------------------------
ALTER TABLE master_data."MaterialLaborPrice"
  ADD COLUMN IF NOT EXISTS "vendor_category" TEXT,
  ADD COLUMN IF NOT EXISTS "specifications"  JSONB;

CREATE INDEX IF NOT EXISTS "MaterialLaborPrice_vendor_category_idx"
  ON master_data."MaterialLaborPrice" ("vendor_category");
