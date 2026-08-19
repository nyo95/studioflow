-- =============================================================================
-- 01 — Buang master_data v1
-- =============================================================================
-- DESTRUKTIF. Menghapus seluruh isi schema `master_data`.
--
-- Keputusan owner 2026-08-10: *"DROP AJA - data kita mulai dari 0, gausa di
-- seeding."* Tidak ada ekspor, tidak ada rekonsiliasi, tidak ada seeding ulang.
--
-- Yang ikut hilang dan disadari: 392 Brand, 399 kontak, 1010 link, 756
-- MaterialCandidate, 287 SampleCandidate, seluruh Company hasil backfill, dan
-- semua harga yang diketik sejak 5 Agustus. Sumber pemulihannya tetap ada di
-- `docs/masterdata-seed/*.csv` dan `docs/RAD - Material + Supplier.xlsx` kalau
-- suatu saat keputusannya berubah — tapi jalur seeding-nya TIDAK dijalankan.
--
-- Jalankan sekali, di dalam satu transaksi.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Langkah 1 — lepas lima FK dari `studioflow` secara EKSPLISIT
-- -----------------------------------------------------------------------------
-- `DROP SCHEMA ... CASCADE` di langkah 2 akan menghapus constraint ini sendiri.
-- Dilakukan manual lebih dulu karena tiga alasan:
--
--   1. CASCADE menghapus tanpa menyebut apa yang dihapusnya. Kalau ada FK lain
--      yang tidak kita ketahui, ia ikut hilang diam-diam.
--   2. Kelima constraint ini justru YANG DITUJU — §M5 memang melepasnya.
--      Menjadikannya langkah bernama membuat niatnya terbaca di log.
--   3. Kolomnya TIDAK ikut terhapus, hanya constraint-nya. Itu yang diinginkan:
--      `ProjectScheduleOption.sku_id` tetap ada sebagai kolom biasa.
--
-- IF EXISTS: aman dijalankan ulang, dan aman kalau DB-nya belum pernah
-- menerapkan migrasi yang membuat constraint ini.

ALTER TABLE "studioflow"."ProjectProductRequest"
  DROP CONSTRAINT IF EXISTS "ProjectProductRequest_brand_id_fkey",
  DROP CONSTRAINT IF EXISTS "ProjectProductRequest_sku_id_fkey",
  DROP CONSTRAINT IF EXISTS "ProjectProductRequest_linked_sample_id_fkey";

ALTER TABLE "studioflow"."ProjectScheduleOption"
  DROP CONSTRAINT IF EXISTS "ProjectScheduleOption_sku_id_fkey",
  DROP CONSTRAINT IF EXISTS "ProjectScheduleOption_spec_brand_id_fkey";

-- -----------------------------------------------------------------------------
-- Langkah 2 — buang schemanya
-- -----------------------------------------------------------------------------
-- Termasuk seluruh tabel, enum, index, dan view di dalamnya.

DROP SCHEMA IF EXISTS "master_data" CASCADE;

-- -----------------------------------------------------------------------------
-- Langkah 3 — bersihkan riwayat migrasi v1 yang menyentuh master_data
-- -----------------------------------------------------------------------------
-- TIDAK dilakukan di sini, dan itu disengaja.
--
-- `_prisma_migrations` adalah catatan APA YANG PERNAH DIJALANKAN, bukan
-- gambaran keadaan sekarang. Menghapus barisnya membuat `migrate status`
-- berbohong tentang masa lalu, dan tidak membuat apa pun jadi lebih benar.
--
-- Baseline v2 masuk sebagai migrasi BARU di atasnya (lihat README §Setelah).

COMMIT;

-- Verifikasi sesudah COMMIT — keduanya harus mengembalikan nol baris:
--
--   SELECT schema_name FROM information_schema.schemata
--    WHERE schema_name = 'master_data';
--
--   SELECT conname FROM pg_constraint
--    WHERE conname LIKE 'ProjectScheduleOption_sku_id_fkey'
--       OR conname LIKE 'ProjectProductRequest_%_fkey' AND conname LIKE '%sku%';
--
-- Dan yang ini HARUS masih ada (kolomnya bertahan, hanya FK-nya yang lepas):
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'studioflow'
--      AND table_name = 'ProjectScheduleOption'
--      AND column_name IN ('sku_id', 'spec_brand_id');
