-- =============================================================================
-- Pindahkan field costing dari BqMaterialProfile ke master_data.Sku
-- =============================================================================
-- Keputusan owner 2026-08-19: field costing (konversi, waste, minimum order,
-- rounding) dipindahkan ke Sku agar SKU baru langsung siap pakai BQ.
-- BqMaterialProfile dan relasinya akan dihapus di migrasi terpisah SETELAH
-- backfill terverifikasi.
--
-- ADITIF SEPENUHNYA. Tidak ada DROP atau ALTER pada tabel yang sudah ada.
-- =============================================================================

BEGIN;

-- 1. Tambah kolom costing ke Sku (semua nullable, aditif) -------------------

ALTER TABLE "master_data"."Sku"
  ADD COLUMN "usage_unit"         TEXT,
  ADD COLUMN "purchase_unit"      TEXT,
  ADD COLUMN "conversion"         DECIMAL(18,6),
  ADD COLUMN "default_waste_pct"  DECIMAL(9,6),
  ADD COLUMN "minimum_order"      DECIMAL(18,6),
  ADD COLUMN "rounding_increment" DECIMAL(18,6),
  ADD COLUMN "preferred_supplier_party_id" TEXT;

COMMENT ON COLUMN "master_data"."Sku"."usage_unit" IS
  'Satuan saat dipakai di breakdown (sqm, m'', pcs). Dipindahkan dari BqMaterialProfile 2026-08-19.';
COMMENT ON COLUMN "master_data"."Sku"."purchase_unit" IS
  'Satuan saat dibeli (lembar, roll, kg). WAJIB cocok dengan SkuPrice.unit. Dipindahkan dari BqMaterialProfile 2026-08-19.';
COMMENT ON COLUMN "master_data"."Sku"."conversion" IS
  'Berapa usage unit dalam 1 purchase unit. WAJIB > 0. Dipindahkan dari BqMaterialProfile 2026-08-19.';
COMMENT ON COLUMN "master_data"."Sku"."default_waste_pct" IS
  'Presedensi waste level 3. Fraksi. NULL = tidak diset. Dipindahkan dari BqMaterialProfile 2026-08-19.';
COMMENT ON COLUMN "master_data"."Sku"."minimum_order" IS
  'Minimum order untuk Purchase Summary. NULL = tidak ada minimum. Dipindahkan dari BqMaterialProfile 2026-08-19.';
COMMENT ON COLUMN "master_data"."Sku"."rounding_increment" IS
  'Pembulatan purchase summary. NULL = belum diset (default app = 1). Dipindahkan dari BqMaterialProfile 2026-08-19.';

-- 2. Backfill dari BqMaterialProfile (aditif — tidak menimpa) ----------------

UPDATE "master_data"."Sku" s
SET
  usage_unit         = p.usage_unit,
  purchase_unit      = p.purchase_unit,
  conversion         = p.conversion,
  default_waste_pct  = p.default_waste_pct,
  minimum_order      = p.minimum_order,
  rounding_increment = p.rounding_increment,
  preferred_supplier_party_id = p.preferred_supplier_party_id
FROM "bq"."BqMaterialProfile" p
WHERE p.sku_id = s.id
  AND s.usage_unit IS NULL;

-- 3. Index untuk kolom costing (membantu query BQ picker) -------------------

CREATE INDEX "Sku_bq_costing_idx" ON "master_data"."Sku"("usage_unit", "purchase_unit")
  WHERE "usage_unit" IS NOT NULL;

COMMIT;

-- =============================================================================
-- Verifikasi
-- =============================================================================
--   SELECT COUNT(*) FROM "master_data"."Sku"
--   WHERE "usage_unit" IS NOT NULL;
--   -- Harus sama dengan jumlah baris BqMaterialProfile yang is_active = true
--
--   SELECT s.id, s.name, s.usage_unit, s.purchase_unit, s.conversion
--   FROM "master_data"."Sku" s
--   JOIN "bq"."BqMaterialProfile" p ON p.sku_id = s.id
--   WHERE s.usage_unit IS DISTINCT FROM p.usage_unit
--      OR s.purchase_unit IS DISTINCT FROM p.purchase_unit
--      OR s.conversion IS DISTINCT FROM p.conversion;
--   -- HARUS kosong (tidak ada selisih setelah backfill)
-- =============================================================================
