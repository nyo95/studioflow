-- =============================================================================
-- Drop BqMaterialProfile — data sudah dipindahkan ke master_data.Sku
-- =============================================================================
-- Hanya dieksekusi SETELAH backfill di migrasi sebelumnya terverifikasi.
-- Tidak ada dependensi lain ke tabel ini (tidak ada FK dari tabel lain ke
-- BqMaterialProfile).
-- =============================================================================

BEGIN;

-- Drop index terlebih dahulu (referensi dari tabel)
DROP INDEX IF EXISTS "bq"."BqMaterialProfile_is_active_idx";

-- Drop tabel (akan menghapus unique index "BqMaterialProfile_sku_id_key" otomatis)
DROP TABLE "bq"."BqMaterialProfile";

COMMIT;

-- =============================================================================
-- Verifikasi
-- =============================================================================
--   \dt bq.*
--   -- BqMaterialProfile tidak boleh muncul
--
--   SELECT COUNT(*) FROM "bq"."BqMaterialProfile";
--   -- HARUS error (relation does not exist)
-- =============================================================================
