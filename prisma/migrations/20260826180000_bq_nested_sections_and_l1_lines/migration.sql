-- BQ — hirarki diluruskan agar cocok dengan dokumen BQ kantor.
--
-- ============================================================================
-- KENAPA
-- ============================================================================
-- Pemetaan sebelumnya meleset satu lapis. Di dokumen sumber, yang punya SATUAN
-- dan HARGA SATUAN adalah ITEM ("Screeding Base H+100mm | sqm"), sedangkan
-- seksi ("B INTERIOR WORKS") dan divisi ("I Floor Works") tidak punya keduanya.
-- Sementara di aplikasi, yang punya qty/unit/markup/rate adalah L1.
--
-- Yang terjadi: divisi ditaruh di L1 (dan diberi satuan "ls" yang tak bermakna)
-- sedangkan item ditaruh di L2 (yang tidak punya kolom harga satuan sama
-- sekali) — sehingga baris BQ yang sesungguhnya tidak bisa dicetak.
--
-- Sesudah migrasi ini:
--   BqSection (parent NULL) = seksi   A / B / C        pengelompok
--   BqSection (parent ada)  = divisi  I / II / III     pengelompok
--   BqObject   L1           = ITEM    baris BQ berharga
--   BqSubObject L2          = sub-rakitan, OPSIONAL
--   Baris L3                = menempel ke L1 atau L2
--
-- Aditif dan tanpa kehilangan data: kolom baru nullable, dan baris lama
-- di-backfill supaya tetap menunjuk induk yang sama.

-- ---------------------------------------------------------------------------
-- 1. Seksi bersarang
-- ---------------------------------------------------------------------------
ALTER TABLE "bq"."BqSection" ADD COLUMN "parent_id" TEXT;

CREATE INDEX "BqSection_parent_id_sort_order_idx"
  ON "bq"."BqSection" ("parent_id", "sort_order");

-- Cascade: menghapus seksi ikut menghapus divisinya. Pekerjaan di dalam divisi
-- dilepas jadi tanpa-seksi oleh aksi hapus di app layer, bukan ikut terhapus.
ALTER TABLE "bq"."BqSection"
  ADD CONSTRAINT "BqSection_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "bq"."BqSection" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 2. Baris L3 boleh menempel langsung ke L1
-- ---------------------------------------------------------------------------
ALTER TABLE "bq"."BqMaterialLine" ADD COLUMN "object_id" TEXT;
ALTER TABLE "bq"."BqServiceLine"  ADD COLUMN "object_id" TEXT;

-- sub_object_id kini boleh kosong (barisnya menempel di L1).
ALTER TABLE "bq"."BqMaterialLine" ALTER COLUMN "sub_object_id" DROP NOT NULL;
ALTER TABLE "bq"."BqServiceLine"  ALTER COLUMN "sub_object_id" DROP NOT NULL;

CREATE INDEX "BqMaterialLine_object_id_sort_order_idx"
  ON "bq"."BqMaterialLine" ("object_id", "sort_order");
CREATE INDEX "BqServiceLine_object_id_sort_order_idx"
  ON "bq"."BqServiceLine" ("object_id", "sort_order");

ALTER TABLE "bq"."BqMaterialLine"
  ADD CONSTRAINT "BqMaterialLine_object_id_fkey"
  FOREIGN KEY ("object_id") REFERENCES "bq"."BqObject" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bq"."BqServiceLine"
  ADD CONSTRAINT "BqServiceLine_object_id_fkey"
  FOREIGN KEY ("object_id") REFERENCES "bq"."BqObject" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. TEPAT SATU induk
-- ---------------------------------------------------------------------------
-- Ditegakkan di database, bukan cuma di aplikasi: baris tanpa induk atau
-- berinduk dua adalah data yang tidak bisa dihitung, dan bug semacam itu masuk
-- lewat jalur tulis mana pun yang lupa memeriksanya.
ALTER TABLE "bq"."BqMaterialLine"
  ADD CONSTRAINT "BqMaterialLine_exactly_one_parent"
  CHECK (("object_id" IS NULL) <> ("sub_object_id" IS NULL));

ALTER TABLE "bq"."BqServiceLine"
  ADD CONSTRAINT "BqServiceLine_exactly_one_parent"
  CHECK (("object_id" IS NULL) <> ("sub_object_id" IS NULL));
