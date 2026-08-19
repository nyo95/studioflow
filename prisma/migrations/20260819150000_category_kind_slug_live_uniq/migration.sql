-- =============================================================================
-- Category: keunikan (kind, slug) hanya berlaku untuk baris AKTIF
-- =============================================================================
-- Menutup temuan #3 audit skema 2026-08-19 (`AUDIT-SKEMA-MASTERDATA-2026-08-19.md`).
--
-- ALASANNYA, ringkas: `Category` unik pada `(kind, slug)` TANPA syarat, sama
-- seperti `Party.name`/`Brand.name` sebelum ditambal migrasi `20260818120000`
-- (B2) — bedanya, `Category` tidak punya `deleted_at` sama sekali, jadi
-- padanan "baris hidup" di sini adalah `is_active`, bukan `deleted_at IS
-- NULL`. Category belum punya action delete/nonaktifkan apa pun hari ini
-- (diverifikasi lewat grep `src/subapps/master-data` — nol hasil), jadi ini
-- migrasi PENCEGAHAN: begitu fitur "nonaktifkan kategori" dibangun, kategori
-- yang dinonaktifkan tidak akan mengunci slug-nya selamanya seperti yang
-- dulu terjadi pada Party/Brand.
--
-- AMAN DIJALANKAN PADA TABEL BERISI. Arah perubahannya dari KETAT ke
-- LONGGAR — index lama `(kind, slug)` unik TANPA syarat sudah menjamin nol
-- duplikat di SELURUH baris (aktif maupun tidak), jadi index parsial yang
-- hanya menegakkan baris `is_active` pasti berhasil dibuat tanpa perlu
-- pemeriksaan pra-migrasi seperti `20260818120000` (yang harus mengecek
-- duplikat huruf besar-kecil karena longgarnya dua sumbu sekaligus).
--
-- TIDAK DESTRUKTIF. Tidak ada kolom atau baris yang dibuang.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Lepas index tanpa syarat
-- -----------------------------------------------------------------------------
-- Dibuat oleh 20260810180000_masterdata_v2_rebaseline sebagai CONSTRAINT unik
-- (dari `@@unique` Prisma), jadi ALTER TABLE ... DROP CONSTRAINT — bukan DROP
-- INDEX seperti pada Party_name_key/dst yang dibuat sebagai index biasa.
ALTER TABLE "master_data"."Category" DROP CONSTRAINT IF EXISTS "Category_kind_slug_key";

-- -----------------------------------------------------------------------------
-- 2. Pasang index parsial
-- -----------------------------------------------------------------------------
-- Nama sengaja diberi akhiran `_live_uniq`, bukan `_key` — pola sama dengan
-- `Party_name_live_uniq`/dst di 20260818120000. `_key` adalah konvensi yang
-- DIHASILKAN Prisma dari `@unique`; memakainya untuk index yang ditulis
-- tangan membuat pembaca berikutnya mengira ia muncul kembali sendiri kalau
-- dihapus. Ia tidak akan.
CREATE UNIQUE INDEX "Category_kind_slug_live_uniq"
  ON "master_data"."Category" ("kind", "slug")
  WHERE "is_active";

COMMIT;

-- =============================================================================
-- Verifikasi — jalankan sesudahnya, jangan dilewati
-- =============================================================================
-- 1. Index baru ada, constraint lama hilang:
--      SELECT indexname FROM pg_indexes
--      WHERE schemaname = 'master_data' AND tablename = 'Category'
--      ORDER BY indexname;
--      -- harus memuat Category_kind_slug_live_uniq, tidak boleh memuat
--      -- Category_kind_slug_key.
--
-- 2. Kategori yang dinonaktifkan (kalau fitur itu sudah ada) bisa dipakai
--    ulang slug-nya oleh kategori baru yang aktif — belum bisa diuji hari
--    ini karena belum ada action nonaktifkan Category di aplikasi.
-- =============================================================================
