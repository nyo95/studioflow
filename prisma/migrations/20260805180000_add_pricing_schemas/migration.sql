-- Migration: 20260805180000_add_pricing_schemas
-- Adds:
--   1. updated_by_name column to MaterialPrice
--   2. MaterialLaborPrice table (supply+install combined pricing)
--   3. BackFill: service_vendor relation on MaterialLaborPrice

-- ---------------------------------------------------------------------------
-- 1. Add updated_by_name to master_data.MaterialPrice
-- ---------------------------------------------------------------------------
ALTER TABLE master_data."MaterialPrice"
  ADD COLUMN IF NOT EXISTS "updated_by_name" TEXT;

-- ---------------------------------------------------------------------------
-- 2. Create master_data.MaterialLaborPrice
--    "Paket pasang" — combined supply-and-install pricing for BQ.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS master_data."MaterialLaborPrice" (
  "id"                TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
  "code"              TEXT         NOT NULL,
  "name"              TEXT         NOT NULL,
  "category"          TEXT         NOT NULL,
  "unit"              TEXT         NOT NULL,
  "material_price"    DOUBLE PRECISION,
  "labor_price"       DOUBLE PRECISION,
  "total_price"       DOUBLE PRECISION,
  "scope_note"        TEXT,
  "notes"             TEXT,
  "service_vendor_id" TEXT,
  "is_active"         BOOLEAN      NOT NULL DEFAULT true,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3),
  "updated_by_name"   TEXT,

  CONSTRAINT "MaterialLaborPrice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MaterialLaborPrice_code_key" UNIQUE ("code"),
  CONSTRAINT "MaterialLaborPrice_service_vendor_id_fkey"
    FOREIGN KEY ("service_vendor_id")
    REFERENCES master_data."ServiceVendor"("id")
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "MaterialLaborPrice_category_idx"
  ON master_data."MaterialLaborPrice" ("category");

CREATE INDEX IF NOT EXISTS "MaterialLaborPrice_is_active_idx"
  ON master_data."MaterialLaborPrice" ("is_active");

CREATE INDEX IF NOT EXISTS "MaterialLaborPrice_service_vendor_id_idx"
  ON master_data."MaterialLaborPrice" ("service_vendor_id");
