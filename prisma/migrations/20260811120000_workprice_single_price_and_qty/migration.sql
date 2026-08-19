-- =============================================================================
-- WorkPrice: satu kolom harga + penanda jenis, plus kolom qty
-- =============================================================================
-- Menutup E8 dan E6 di docs/PENYIMPANGAN-DARI-EXCEL.md.
-- Keputusan owner 2026-08-11.
--
-- ALASANNYA, ringkas:
--   Excel Table 3 ("Harga Material + Upah") dan Table 4 ("Harga Upah") punya
--   kolom yang identik dan SATU kolom `Price`. v2 memberi keduanya dua kolom
--   (`material_price` + `labor_price`) dan menyimpulkan tabel mana yang
--   dimaksud dari `material_price != null`.
--
--   Dua akibatnya:
--   1. Paket supply-and-install dikutip satu angka. Dua kotak kosong memaksa
--      orang mengarang pembagiannya — persis kesalahan yang X12 hindari dengan
--      TIDAK menebak arti kolom `Qty`.
--   2. Tarif upah-murni yang kebetulan diketik lengkap dengan biaya materialnya
--      tidak bisa dibedakan dari paket supply+install. Pembedanya disimpulkan,
--      bukan dinyatakan.
--
-- ⚠️ DESTRUKTIF SEBAGIAN. `material_price` dan `labor_price` dibuang setelah
--    isinya dijumlahkan ke `price`. Jalankan backup dulu kalau tabelnya sudah
--    berisi:
--      pg_dump -n master_data -t '"master_data"."WorkPrice"' -Fc studioflow \
--        > backup-workprice-pre-e8.dump
--
-- Verifikasi sesudahnya ada di bagian bawah berkas ini.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Lepas view yang bergantung pada kolom yang akan dibuang
-- -----------------------------------------------------------------------------
-- `v_bq_work_rate` menyebut material_price / labor_price / total_price.
-- Postgres MENOLAK `DROP COLUMN` selama sebuah view merujuknya — bukan
-- membiarkan view-nya rusak. Jadi urutannya harus: lepas view, ubah tabel,
-- pasang view baru.
--
-- Dilepas di sini alih-alih di berkas berikutnya supaya seluruh langkah
-- destruktif ada dalam SATU transaksi. Kalau langkah mana pun gagal, view lama
-- ikut kembali bersama kolom lamanya, dan database tidak tertinggal di keadaan
-- setengah jalan yang tidak dijelaskan berkas mana pun.
DROP VIEW IF EXISTS "master_data"."v_bq_work_rate";

-- -----------------------------------------------------------------------------
-- 1. Enum pembeda Table 3 / Table 4
-- -----------------------------------------------------------------------------
CREATE TYPE "master_data"."WorkPriceKind" AS ENUM ('MATERIAL_LABOR', 'LABOR_ONLY');

-- -----------------------------------------------------------------------------
-- 2. Kolom baru
-- -----------------------------------------------------------------------------
-- `price` dibuat nullable dulu supaya baris yang sudah ada bisa diisi, baru
-- di-SET NOT NULL di langkah 4. Menambah kolom NOT NULL tanpa default pada
-- tabel berisi akan gagal seketika.
ALTER TABLE "master_data"."WorkPrice"
  ADD COLUMN "price" DECIMAL(16,2),
  ADD COLUMN "kind"  "master_data"."WorkPriceKind" NOT NULL DEFAULT 'LABOR_ONLY',
  ADD COLUMN "qty"   DECIMAL(12,3);

-- -----------------------------------------------------------------------------
-- 3. Pindahkan isinya
-- -----------------------------------------------------------------------------
-- Aturan pemindahan, dan alasan tiap barisnya:
--
--   price = material_price + labor_price
--     Itu memang arti `total_price` yang generated selama ini, jadi tidak ada
--     angka yang berubah nilainya. COALESCE dipakai karena salah satunya boleh
--     NULL dan `NULL + 5` di SQL adalah NULL, bukan 5.
--
--   kind = MATERIAL_LABOR kalau material_price terisi
--     Persis aturan yang selama ini disimpulkan. Memindahkannya ke kolom
--     membekukan tafsir yang berlaku saat migrasi, alih-alih membiarkannya
--     dihitung ulang berbeda oleh pembaca berikutnya.
UPDATE "master_data"."WorkPrice"
SET
  "price" = COALESCE("material_price", 0) + COALESCE("labor_price", 0),
  "kind"  = CASE
              WHEN "material_price" IS NOT NULL THEN 'MATERIAL_LABOR'::"master_data"."WorkPriceKind"
              ELSE 'LABOR_ONLY'::"master_data"."WorkPriceKind"
            END;

-- Baris yang kedua harganya NULL menghasilkan price = 0. Itu bukan harga, itu
-- data yang tidak lengkap — dan membiarkannya lolos sebagai 0 adalah persis
-- cacat `price_net ?? 0` yang baru saja dibuang dari SkuPrice. Migrasinya
-- BERHENTI berisik supaya barisnya diperiksa manusia, bukan diperbaiki diam.
DO $$
DECLARE
  bad_rows integer;
BEGIN
  SELECT count(*) INTO bad_rows
  FROM "master_data"."WorkPrice"
  WHERE "material_price" IS NULL AND "labor_price" IS NULL AND "deleted_at" IS NULL;

  IF bad_rows > 0 THEN
    RAISE EXCEPTION
      'Ada % baris WorkPrice tanpa harga sama sekali. Migrasi dibatalkan. Periksa dulu: SELECT id, code, name FROM master_data."WorkPrice" WHERE material_price IS NULL AND labor_price IS NULL AND deleted_at IS NULL;',
      bad_rows;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Kunci kolom baru, buang yang lama
-- -----------------------------------------------------------------------------
ALTER TABLE "master_data"."WorkPrice" ALTER COLUMN "price" SET NOT NULL;

-- `total_price` adalah generated column (03_invariants.sql §4) — ia harus
-- dibuang lebih dulu, karena ia bergantung pada dua kolom di bawahnya.
ALTER TABLE "master_data"."WorkPrice" DROP COLUMN "total_price";
ALTER TABLE "master_data"."WorkPrice" DROP COLUMN "material_price";
ALTER TABLE "master_data"."WorkPrice" DROP COLUMN "labor_price";

-- -----------------------------------------------------------------------------
-- 5. Index dan COMMENT
-- -----------------------------------------------------------------------------
CREATE INDEX "WorkPrice_kind_idx" ON "master_data"."WorkPrice" ("kind");

-- Larangan yang sama persis dengan SkuPrice.qty, ditulis di tempat yang terbaca
-- `\d+` dan tiap tool introspeksi — bukan hanya di dokumen.
COMMENT ON COLUMN "master_data"."WorkPrice"."qty" IS 'TIDAK DIPAKAI. Kolom Qty dari design database masterdata.xlsx Table 3/4, ditandai sumbernya sendiri "(need curations)". Disimpan atas keputusan owner tanpa arti yang ditetapkan. JANGAN masukkan ke perhitungan apa pun dan jangan ekspos ke view BQ: price selalu berarti harga per satu unit.';

COMMENT ON COLUMN "master_data"."WorkPrice"."price" IS 'Satu harga, sesuai Excel Table 3 dan 4 yang keduanya hanya punya kolom Price. Apa yang dicakupnya dinyatakan kolom "kind", bukan disimpulkan dari kolom mana yang terisi.';

COMMIT;

-- =============================================================================
-- Verifikasi — jalankan sesudahnya, jangan dilewati
-- =============================================================================
-- 1. Tidak ada harga yang hilang atau berubah nilainya:
--      SELECT count(*) FROM master_data."WorkPrice" WHERE price IS NULL;
--      -- harus 0
--
-- 2. Pembagian jenisnya masuk akal terhadap yang Anda ingat:
--      SELECT kind, count(*) FROM master_data."WorkPrice" GROUP BY kind;
--
-- 3. Kolom lama benar-benar hilang:
--      \d+ master_data."WorkPrice"
--      -- tidak boleh ada material_price, labor_price, total_price
--
-- =============================================================================
-- WAJIB dijalankan setelah ini
-- =============================================================================
-- `v_bq_work_rate` sudah DI-DROP di langkah 0 dan BELUM dipasang kembali.
-- Sampai berkas berikutnya jalan, BQ tidak punya view tarif kerja sama sekali:
--
--   prisma/migrations/20260811120100_redefine_v_bq_work_rate/migration.sql
--
-- `prisma migrate deploy` menjalankan keduanya berurutan. Kalau menjalankan
-- manual lewat psql, jangan berhenti di berkas ini.
