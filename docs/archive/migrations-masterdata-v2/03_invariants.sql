-- =============================================================================
-- 03 — Invariant yang tidak bisa dinyatakan Prisma
-- =============================================================================
-- ⚠️ TANPA BERKAS INI, EMPAT ATURAN DI RANCANGAN TIDAK DITEGAKKAN APA PUN —
-- dan `prisma validate` tetap hijau. Itu yang membuatnya paling mudah terlewat.
--
-- Prisma tidak bisa mendeklarasikan partial index, expression index, generated
-- column, maupun GIN. Semuanya di sini.
--
-- Jalankan SESUDAH `02_create_master_data_v2.sql`.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Tepat satu harga berlaku per (SKU × supplier)
-- -----------------------------------------------------------------------------
-- `is_current` adalah denormalisasi yang disengaja: tanpanya "harga yang
-- berlaku sekarang" butuh window function di tiap pembacaan. Harganya adalah
-- invariant ini, yang harus dijaga di sini.
--
-- COALESCE wajib. `supplier_party_id` nullable, dan di Postgres NULL ≠ NULL,
-- jadi index polos akan meloloskan dua baris is_current yang sama-sama tanpa
-- supplier — persis kasus "harga list dari pabrikan" yang paling sering ada.

-- Tanda kurung GANDA di sekitar COALESCE bukan kelebihan ketik: Postgres
-- mensyaratkannya untuk expression index, dan hanya membolehkan penghilangannya
-- pada pemanggilan fungsi biasa. COALESCE bukan itu — ia konstruksi mirip CASE.

CREATE UNIQUE INDEX "SkuPrice_current_uniq"
  ON "master_data"."SkuPrice" (
    "sku_id",
    (COALESCE("supplier_party_id", '00000000-0000-0000-0000-000000000000'))
  )
  WHERE "is_current";

-- -----------------------------------------------------------------------------
-- 2. Keunikan Sku yang @@unique tidak bisa jaga
-- -----------------------------------------------------------------------------
-- `@@unique([brand_id, slug])` tidak menjaga baris ber-brand_id NULL — barang
-- generik seperti "plywood 9mm" yang memang sah tanpa merek (Excel Table 2
-- kolom D: "apabila tidak ada brand bisa dikosongkan").

CREATE UNIQUE INDEX "Sku_slug_nobrand_uniq"
  ON "master_data"."Sku" (lower("slug"))
  WHERE "brand_id" IS NULL AND "deleted_at" IS NULL;

-- `code` nullable sejak keputusan Q7 (kode artikel adalah fakta tentang barang,
-- bukan kunci basis data). Tapi DI MANA ia terisi, ia harus unik per merek —
-- dua barang dengan kode artikel sama adalah salah ketik, bukan dua barang.

CREATE UNIQUE INDEX "Sku_brand_code_uniq"
  ON "master_data"."Sku" ("brand_id", upper("code"))
  WHERE "code" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "Sku_code_nobrand_uniq"
  ON "master_data"."Sku" (upper("code"))
  WHERE "code" IS NOT NULL AND "brand_id" IS NULL AND "deleted_at" IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Tepat satu kategori utama per SKU
-- -----------------------------------------------------------------------------
-- Menggantikan konvensi v1 "tag pertama adalah yang utama" — konvensi urutan
-- yang rusak tanpa suara begitu ada yang menyortir ulang.

CREATE UNIQUE INDEX "SkuCategory_primary_uniq"
  ON "master_data"."SkuCategory" ("sku_id")
  WHERE "is_primary";

-- -----------------------------------------------------------------------------
-- 4. total_price tidak mungkin menyimpang dari komponennya
-- -----------------------------------------------------------------------------
-- v1 menyimpan `total_price` sebagai kolom biasa dengan komentar "derived" —
-- niat yang benar, jaminan yang tidak ada. Satu jalur tulis yang lupa
-- menghitung ulang cukup untuk membuatnya berbohong.
--
-- Kolom generated memindahkan jaminan itu ke database, tempat tidak ada jalur
-- tulis yang bisa melewatinya. Prisma memperlakukannya read-only.

ALTER TABLE "master_data"."WorkPrice" DROP COLUMN "total_price";
ALTER TABLE "master_data"."WorkPrice"
  ADD COLUMN "total_price" DECIMAL(16,2)
  GENERATED ALWAYS AS (
    COALESCE("material_price", 0) + COALESCE("labor_price", 0)
  ) STORED;

-- -----------------------------------------------------------------------------
-- 5. Kolom `qty` tidak boleh dipakai
-- -----------------------------------------------------------------------------
-- Keputusan owner Q12: kolom "Qty" di Excel disimpan apa adanya, tapi tidak
-- dipakai — artinya memang belum jelas ("need curations" ditulis penulisnya
-- sendiri). COMMENT ini yang mencegahnya diam-diam masuk perhitungan nanti,
-- karena ia terbaca di `\d+` dan di tiap tool introspeksi.

COMMENT ON COLUMN "master_data"."SkuPrice"."qty" IS 'TIDAK DIPAKAI. Kolom Qty dari design database masterdata.xlsx Table 2, ditandai sumbernya sendiri "(need curations)". Disimpan atas keputusan owner 2026-08-10 tanpa arti yang ditetapkan. JANGAN masukkan ke perhitungan apa pun dan jangan ekspos ke view BQ/Library: price selalu berarti harga per satu unit.';

-- -----------------------------------------------------------------------------
-- 6. Index parsial untuk baris hidup
-- -----------------------------------------------------------------------------
-- Tabel yang sebagian isinya soft-deleted membuat index penuh membaca baris
-- yang tidak akan pernah ditampilkan.

CREATE INDEX "Sku_active_idx"
  ON "master_data"."Sku" ("kind", "status") WHERE "deleted_at" IS NULL;

CREATE INDEX "Party_active_idx"
  ON "master_data"."Party" ("type") WHERE "deleted_at" IS NULL;

CREATE INDEX "Brand_active_idx"
  ON "master_data"."Brand" ("owner_party_id") WHERE "deleted_at" IS NULL;

-- -----------------------------------------------------------------------------
-- 7. spec JSON tetap bisa dicari
-- -----------------------------------------------------------------------------
-- Excel meminta Specification 1/2 disimpan sebagai JSON, dan itu benar —
-- atribut opsional berjumlah tidak tetap. GIN yang membuatnya tidak jadi
-- lubang hitam: tanpa index, tiap pencarian spec adalah sequential scan.

CREATE INDEX "Sku_spec_gin"
  ON "master_data"."Sku" USING GIN ("spec" jsonb_path_ops);

CREATE INDEX "WorkPrice_spec_gin"
  ON "master_data"."WorkPrice" USING GIN ("spec" jsonb_path_ops);

-- -----------------------------------------------------------------------------
-- 8. Pencarian nama — substring, bukan prefix
-- -----------------------------------------------------------------------------
-- Ini yang membuat Library bisa menjawab "gw mau cari terazzo, merek apa aja
-- ya?". Tanpa pg_trgm, `name ILIKE '%terazzo%'` selalu sequential scan.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Brand_name_trgm"
  ON "master_data"."Brand" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Party_name_trgm"
  ON "master_data"."Party" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Category_name_trgm"
  ON "master_data"."Category" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Sku_name_trgm"
  ON "master_data"."Sku" USING GIN ("name" gin_trgm_ops);

COMMIT;

-- =============================================================================
-- Yang sengaja TIDAK dilakukan
-- =============================================================================
-- - Tanpa `citext`. Dedup case-insensitive ditangani kolom `slug` yang sudah
--   ternormalisasi. citext menular ke setiap perbandingan dan memecahkan
--   kesetaraan dengan cara yang mengejutkan orang enam bulan kemudian.
--
-- - Tanpa partisi tabel. Volumenya ribuan baris, bukan puluhan juta.
--
-- - Tanpa materialized view "harga termurah". `is_current` + index sudah
--   membuatnya satu index scan. MV butuh strategi refresh, dan strategi refresh
--   butuh orang yang mengingatnya.
--
-- - Tanpa trigger validasi PartyRole. Penjaganya service layer dulu; trigger
--   baru kalau terbukti ada yang lolos. Kompleksitas tanpa bukti masalah tetap
--   harus dirawat.
