-- =============================================================================
-- Drop BqCategoryWaste — tabel kosong, presedensi level 4 ditangguhkan
-- =============================================================================
-- Tabel ini tidak punya baris (kantor belum mengisinya). Presedensi waste
-- level 4 di calc.ts tetap dengan `categoryDefaultWastePct: null`.
-- Kolom `snapshot_category_default_waste_pct` di BqMaterialLine TIDAK di-DROP.
-- =============================================================================

BEGIN;

DROP TABLE "bq"."BqCategoryWaste";

COMMIT;
