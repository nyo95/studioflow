-- =============================================================================
-- Party & Brand: keunikan hanya berlaku untuk baris yang MASIH HIDUP
-- =============================================================================
-- Menutup temuan B2 audit 2026-08-18.
--
-- ALASANNYA, ringkas:
--   `Party.name`, `Party.slug`, `Brand.name`, `Brand.slug` unik TANPA syarat,
--   sementara keempat tabelnya memakai soft-delete (`deleted_at`). Dua aturan
--   itu bertengkar, dan yang kalah adalah pengguna:
--
--   1. Nama supplier yang pernah dihapus TIDAK BISA dipakai lagi, selamanya.
--      Baris hantu itu tetap memegang namanya.
--   2. Ketiga aksi quick-create memeriksa `existing && !existing.deleted_at`
--      lalu jatuh ke `create` — yang langsung menabrak index. Yang dilihat
--      pengguna adalah pesan Prisma mentah di tengah mengetik harga.
--   3. Cek konflik di aplikasi tidak sepakat arahnya: `create` menghitung baris
--      terhapus (menolak nama yang sebenarnya bebas), `update` mengabaikannya
--      (melewatkan bentrokan, lalu crash di database). Dua bug berlawanan pada
--      tabel yang sama.
--
-- Polanya sudah ada di repo ini sejak `03_invariants.sql` §2:
--   `Sku_slug_nobrand_uniq` dan `Sku_brand_code_uniq` keduanya sudah memakai
--   `WHERE ... deleted_at IS NULL`. Migrasi ini hanya memperluas keputusan yang
--   sama ke Party dan Brand.
--
-- AMAN DIJALANKAN PADA TABEL BERISI. Arah perubahannya dari KETAT ke LONGGAR —
-- setiap baris yang lolos index lama pasti lolos index baru. Tidak ada
-- kemungkinan gagal karena data yang sudah ada, jadi tidak ada pemeriksaan
-- pra-migrasi seperti di 20260811120000 (yang memang berubah ke arah
-- sebaliknya).
--
-- TIDAK DESTRUKTIF. Tidak ada kolom atau baris yang dibuang.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Lepas index tanpa syarat
-- -----------------------------------------------------------------------------
-- Dibuat oleh 20260810180000_masterdata_v2_rebaseline sebagai INDEX biasa
-- (bukan CONSTRAINT), jadi DROP INDEX — bukan ALTER TABLE ... DROP CONSTRAINT.
DROP INDEX IF EXISTS "master_data"."Party_name_key";
DROP INDEX IF EXISTS "master_data"."Party_slug_key";
DROP INDEX IF EXISTS "master_data"."Brand_name_key";
DROP INDEX IF EXISTS "master_data"."Brand_slug_key";

-- -----------------------------------------------------------------------------
-- 1b. Berhenti berisik kalau data yang ada sudah punya duplikat huruf besar-kecil
-- -----------------------------------------------------------------------------
-- Langkah 2 menambahkan `lower(...)`, yang lebih ketat dari index lama pada
-- SATU sumbu: "Ace Hardware" dan "ACE HARDWARE" sampai sekarang adalah dua
-- baris yang sah. Kalau keduanya benar-benar ada, `CREATE UNIQUE INDEX` akan
-- gagal dengan 23505 — sebuah nomor error yang tidak memberi tahu siapa pun
-- baris mana yang bermasalah.
--
-- Jadi diperiksa lebih dulu, dan pesannya menyebutkan query untuk menemukannya.
-- Sama seperti 20260811120000: migrasi yang berhenti berisik lebih baik daripada
-- migrasi yang menggabungkan dua party diam-diam.
DO $$
DECLARE
  dup_party integer;
  dup_brand integer;
BEGIN
  SELECT count(*) INTO dup_party FROM (
    SELECT lower("name") FROM "master_data"."Party"
    WHERE "deleted_at" IS NULL GROUP BY 1 HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO dup_brand FROM (
    SELECT lower("name") FROM "master_data"."Brand"
    WHERE "deleted_at" IS NULL GROUP BY 1 HAVING count(*) > 1
  ) d;

  IF dup_party > 0 OR dup_brand > 0 THEN
    RAISE EXCEPTION
      'Ada % nama Party dan % nama Brand yang sama kalau huruf besar-kecil diabaikan. Migrasi dibatalkan — gabungkan dulu secara manual, jangan biarkan index yang memilih pemenangnya. Periksa: SELECT lower(name), count(*), array_agg(id) FROM master_data."Party" WHERE deleted_at IS NULL GROUP BY 1 HAVING count(*) > 1; lalu ulangi untuk "Brand".',
      dup_party, dup_brand;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Pasang index parsial
-- -----------------------------------------------------------------------------
-- Nama sengaja diberi akhiran `_live_uniq`, bukan `_key`. Akhiran `_key` adalah
-- konvensi yang DIHASILKAN Prisma dari `@unique`; memakainya untuk index yang
-- ditulis tangan dan tidak bisa dinyatakan `@unique` membuat pembaca berikutnya
-- mengira ia akan muncul kembali sendiri kalau dihapus. Ia tidak akan.
--
-- `lower(...)` sekalian: sampai sekarang "Ace Hardware" dan "ACE HARDWARE" adalah
-- dua party yang sah dan berbeda, yang bukan keputusan siapa pun — hanya akibat
-- membandingkan string apa adanya. Nama dagang tidak peka huruf besar-kecil.
CREATE UNIQUE INDEX "Party_name_live_uniq"
  ON "master_data"."Party" (lower("name"))
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "Party_slug_live_uniq"
  ON "master_data"."Party" ("slug")
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "Brand_name_live_uniq"
  ON "master_data"."Brand" (lower("name"))
  WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "Brand_slug_live_uniq"
  ON "master_data"."Brand" ("slug")
  WHERE "deleted_at" IS NULL;

COMMIT;

-- =============================================================================
-- Verifikasi — jalankan sesudahnya, jangan dilewati
-- =============================================================================
-- 1. Keempat index baru ada, keempat yang lama hilang:
--      SELECT indexname FROM pg_indexes
--      WHERE schemaname = 'master_data'
--        AND (indexname LIKE 'Party_%' OR indexname LIKE 'Brand_%')
--      ORDER BY indexname;
--      -- harus memuat *_live_uniq, tidak boleh memuat Party_name_key dkk.
--
-- 2. Nama yang pernah dihapus sekarang bisa dipakai lagi (di database staging):
--      INSERT INTO master_data."Party" (id, name, slug)
--      SELECT gen_random_uuid(), name, slug || '-baru'
--      FROM master_data."Party" WHERE deleted_at IS NOT NULL LIMIT 1;
--      -- harus berhasil; sebelum migrasi ini gagal dengan 23505
--      ROLLBACK; -- jangan tinggalkan baris uji
--
-- 3. Duplikat huruf besar-kecil yang mungkin sudah terlanjur ada:
--      SELECT lower(name), count(*) FROM master_data."Party"
--      WHERE deleted_at IS NULL GROUP BY 1 HAVING count(*) > 1;
--      -- kalau ini mengembalikan baris, langkah 2 di atas GAGAL dan migrasi
--      -- batal. Gabungkan dulu partynya secara manual, lalu ulangi.
-- =============================================================================
