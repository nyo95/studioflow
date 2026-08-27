-- BQ — seksi cetak (L0) + kategori biaya baris L3.
--
-- Dua penambahan yang datang dari template BQ kantor:
--   1. "A / B / C" pada sheet BQ  -> tabel bq.BqSection, dan BqObject.section_id
--   2. kolom KATEGORI sheet Tes   -> enum bq.BqCostCategory pada baris L3
--
-- Keduanya ADITIF. section_id nullable dan cost_category punya default, jadi
-- seluruh BQ yang sudah ada tetap sah tanpa backfill.

-- ---------------------------------------------------------------------------
-- 1. Enum kategori biaya
-- ---------------------------------------------------------------------------
CREATE TYPE "bq"."BqCostCategory" AS ENUM (
  'MATERIAL',
  'UPAH',
  'ALAT',
  'BIAYA_UMUM',
  'TRANSPORT_AKOMODASI'
);

-- ---------------------------------------------------------------------------
-- 2. Seksi cetak (L0)
-- ---------------------------------------------------------------------------
CREATE TABLE "bq"."BqSection" (
  "id"              TEXT NOT NULL,
  "project_id"      TEXT NOT NULL,
  "code"            TEXT,
  "name"            TEXT NOT NULL,
  "sort_order"      INTEGER NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3),
  "deleted_at"      TIMESTAMP(3),
  "updated_by_name" TEXT,

  CONSTRAINT "BqSection_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BqSection_project_id_sort_order_idx"
  ON "bq"."BqSection" ("project_id", "sort_order");
CREATE INDEX "BqSection_deleted_at_idx"
  ON "bq"."BqSection" ("deleted_at");

ALTER TABLE "bq"."BqSection"
  ADD CONSTRAINT "BqSection_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "bq"."BqProject" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 3. BqObject.section_id
-- ---------------------------------------------------------------------------
ALTER TABLE "bq"."BqObject" ADD COLUMN "section_id" TEXT;

CREATE INDEX "BqObject_section_id_sort_order_idx"
  ON "bq"."BqObject" ("section_id", "sort_order");

-- SetNull: menghapus seksi tidak boleh ikut menghapus pekerjaan di dalamnya.
ALTER TABLE "bq"."BqObject"
  ADD CONSTRAINT "BqObject_section_id_fkey"
  FOREIGN KEY ("section_id") REFERENCES "bq"."BqSection" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 4. cost_category pada baris L3 (project + library)
-- ---------------------------------------------------------------------------
ALTER TABLE "bq"."BqMaterialLine"
  ADD COLUMN "cost_category" "bq"."BqCostCategory" NOT NULL DEFAULT 'MATERIAL';

ALTER TABLE "bq"."BqServiceLine"
  ADD COLUMN "cost_category" "bq"."BqCostCategory" NOT NULL DEFAULT 'UPAH';

ALTER TABLE "bq"."BqLibraryMaterialLine"
  ADD COLUMN "cost_category" "bq"."BqCostCategory" NOT NULL DEFAULT 'MATERIAL';

ALTER TABLE "bq"."BqLibraryServiceLine"
  ADD COLUMN "cost_category" "bq"."BqCostCategory" NOT NULL DEFAULT 'UPAH';
