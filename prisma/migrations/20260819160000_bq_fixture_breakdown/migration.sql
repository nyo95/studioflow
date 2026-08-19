-- =============================================================================
-- BQ Fixture Breakdown — schema `bq`
-- =============================================================================
-- Sumber: PRD_Fixture_Breakdown.md (repo D:\Misc\ProjectsHUB\BQ).
-- Keputusan owner 2026-08-19: BQ dibangun DI DALAM StudioFlow di `/bq`, bukan
-- repo terpisah. `UPSTREAM-BQ-MATERIAL-SOURCE.md` §0 (yang mengasumsikan repo
-- terpisah + bloker "di mana database material bertempat") gugur karenanya:
-- material tinggal di `master_data`, BQ membacanya lintas-schema di database
-- yang sama, dan FK antar-schema memang sah di Postgres.
--
-- ADITIF SEPENUHNYA. Tidak ada `DROP`, tidak ada `ALTER` pada tabel yang sudah
-- ada, tidak ada baris yang disentuh di `studioflow` maupun `master_data`.
-- Satu-satunya sentuhan ke luar schema `bq` adalah dua FOREIGN KEY yang
-- MENUNJUK ke `master_data` — arah yang sah (yang dilarang AGENTS.md §8 adalah
-- master_data bergantung ke studioflow).
--
-- Catatan presisi: qty `numeric(18,6)`, uang `numeric(18,4)`, persentase
-- disimpan sebagai FRAKSI ber-`numeric(9,6)` (0.100000 = 10%).
-- =============================================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS "bq";

-- -----------------------------------------------------------------------------
-- Enum
-- -----------------------------------------------------------------------------

CREATE TYPE "bq"."BqDetailMode" AS ENUM ('DETAIL', 'RINGKAS');
CREATE TYPE "bq"."BqProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

COMMENT ON TYPE "bq"."BqDetailMode" IS
  'DETAIL = waste aktif + object ikut Purchase Summary. RINGKAS = waste dianggap 0 + object dilewati Purchase Summary. Konversi purchase unit TETAP aktif di kedua mode (PRD Bab 4, AT-05b) - mematikannya membuat harga per lembar terbaca per sqm.';

-- -----------------------------------------------------------------------------
-- Setelan kantor
-- -----------------------------------------------------------------------------

CREATE TABLE "bq"."BqSettings" (
  "id"                  TEXT PRIMARY KEY,
  "default_detail_mode" "bq"."BqDetailMode" NOT NULL DEFAULT 'DETAIL',
  "default_markup_pct"  DECIMAL(9,6)  NOT NULL DEFAULT 0.2,
  "currency"            TEXT          NOT NULL DEFAULT 'IDR',
  "updated_at"          TIMESTAMP(3),
  "updated_by_name"     TEXT
);

COMMENT ON TABLE "bq"."BqSettings" IS
  'Satu baris, id dikunci ke konstanta aplikasi (pola SystemConfig). default_markup_pct DISALIN ke BqObject saat object dibuat - mengubahnya di sini tidak pernah mengubah object yang sudah ada, alasan yang sama dengan snapshot harga.';

-- -----------------------------------------------------------------------------
-- Pelengkap master data untuk BQ
-- -----------------------------------------------------------------------------
-- Keputusan owner 2026-08-19: keempat angka ini (konversi, default waste,
-- minimum order, rounding increment) "hanya perlu untuk keperluan BQ, maka ada
-- di settingan BQ saja". Master data TIDAK diubah - ia tetap SSOT untuk
-- identitas dan harga.
-- -----------------------------------------------------------------------------

CREATE TABLE "bq"."BqMaterialProfile" (
  "id"                          TEXT PRIMARY KEY,
  "sku_id"                      TEXT NOT NULL,
  "usage_unit"                  TEXT NOT NULL,
  "purchase_unit"               TEXT NOT NULL,
  "conversion"                  DECIMAL(18,6) NOT NULL,
  "default_waste_pct"           DECIMAL(9,6),
  "minimum_order"               DECIMAL(18,6),
  "rounding_increment"          DECIMAL(18,6) NOT NULL DEFAULT 1,
  "preferred_supplier_party_id" TEXT,
  "is_active"                   BOOLEAN NOT NULL DEFAULT true,
  "notes"                       TEXT,
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3),
  "updated_by_name"             TEXT
);

CREATE UNIQUE INDEX "BqMaterialProfile_sku_id_key" ON "bq"."BqMaterialProfile"("sku_id");
CREATE INDEX "BqMaterialProfile_is_active_idx" ON "bq"."BqMaterialProfile"("is_active");

ALTER TABLE "bq"."BqMaterialProfile"
  ADD CONSTRAINT "BqMaterialProfile_sku_id_fkey"
  FOREIGN KEY ("sku_id") REFERENCES "master_data"."Sku"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Konversi nol atau negatif bukan "data yang belum diisi", ia data yang rusak:
-- ia membuat harga per usage unit jadi tak hingga atau negatif. Ditolak
-- database, bukan cuma Zod - PRD Bab 5.2 menuliskannya sebagai syarat, dan
-- syarat yang hanya ditegakkan aplikasi akan bocor lewat impor massal.
ALTER TABLE "bq"."BqMaterialProfile"
  ADD CONSTRAINT "BqMaterialProfile_conversion_positive" CHECK ("conversion" > 0);

ALTER TABLE "bq"."BqMaterialProfile"
  ADD CONSTRAINT "BqMaterialProfile_rounding_positive" CHECK ("rounding_increment" > 0);

ALTER TABLE "bq"."BqMaterialProfile"
  ADD CONSTRAINT "BqMaterialProfile_minimum_order_nonneg"
  CHECK ("minimum_order" IS NULL OR "minimum_order" >= 0);

-- Waste negatif berarti bahan bertambah saat dipotong. Nol tetap sah dan
-- bermakna (PRD Bab 4.1: nol eksplisit menang atas default di bawahnya).
ALTER TABLE "bq"."BqMaterialProfile"
  ADD CONSTRAINT "BqMaterialProfile_waste_nonneg"
  CHECK ("default_waste_pct" IS NULL OR "default_waste_pct" >= 0);

COMMENT ON COLUMN "bq"."BqMaterialProfile"."conversion" IS
  'Berapa usage unit dalam 1 purchase unit. Plywood 1220x2440 = 2.9768 sqm per lembar. WAJIB > 0.';
COMMENT ON COLUMN "bq"."BqMaterialProfile"."purchase_unit" IS
  'WAJIB cocok dengan SkuPrice.unit penawaran yang dipakai. Kalau tidak cocok, resolveMaterialSnapshot() menolak dan melaporkan SKU ini belum siap dipakai BQ - bukan menebak konversinya.';

CREATE TABLE "bq"."BqCategoryWaste" (
  "id"              TEXT PRIMARY KEY,
  "category_id"     TEXT NOT NULL,
  "waste_pct"       DECIMAL(9,6) NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3),
  "updated_by_name" TEXT
);

CREATE UNIQUE INDEX "BqCategoryWaste_category_id_key" ON "bq"."BqCategoryWaste"("category_id");

ALTER TABLE "bq"."BqCategoryWaste"
  ADD CONSTRAINT "BqCategoryWaste_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "master_data"."Category"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bq"."BqCategoryWaste"
  ADD CONSTRAINT "BqCategoryWaste_waste_nonneg" CHECK ("waste_pct" >= 0);

COMMENT ON TABLE "bq"."BqCategoryWaste" IS
  'Presedensi waste level 4 (PRD Bab 4.1). Hanya bermakna untuk Category ber-kind = PRODUCT; itu dijaga aplikasi karena Postgres tidak bisa menyatakannya lewat FK. Tidak ada baris yang di-seed - kantor mengisinya sendiri di /bq/settings.';

-- -----------------------------------------------------------------------------
-- L1 / L2 / L3
-- -----------------------------------------------------------------------------

CREATE TABLE "bq"."BqProject" (
  "id"                      TEXT PRIMARY KEY,
  "code"                    TEXT,
  "name"                    TEXT NOT NULL,
  "studioflow_project_id"   TEXT,
  "studioflow_project_name" TEXT,
  "status"                  "bq"."BqProjectStatus" NOT NULL DEFAULT 'DRAFT',
  "notes"                   TEXT,
  "created_by_id"           TEXT,
  "created_by_name"         TEXT,
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3),
  "deleted_at"              TIMESTAMP(3),
  "updated_by_name"         TEXT
);

CREATE INDEX "BqProject_status_deleted_at_idx" ON "bq"."BqProject"("status", "deleted_at");
CREATE INDEX "BqProject_studioflow_project_id_idx" ON "bq"."BqProject"("studioflow_project_id");
CREATE INDEX "BqProject_deleted_at_idx" ON "bq"."BqProject"("deleted_at");

COMMENT ON COLUMN "bq"."BqProject"."studioflow_project_id" IS
  'Kolom biasa, BUKAN FK - pola yang sama dengan WorkPriceProjectRef.project_id (AGENTS.md Master Data Contract 8). Yang disimpan snapshot id + nama, supaya BQ bisa disusun untuk tender yang belum jadi project StudioFlow dan tidak ikut hilang kalau project-nya batal.';

CREATE TABLE "bq"."BqObject" (
  "id"                      TEXT PRIMARY KEY,
  "project_id"              TEXT NOT NULL,
  "code"                    TEXT,
  "name"                    TEXT NOT NULL,
  "qty"                     DECIMAL(18,6) NOT NULL DEFAULT 1,
  "unit"                    TEXT NOT NULL DEFAULT 'unit',
  "markup_pct"              DECIMAL(9,6) NOT NULL DEFAULT 0.2,
  "detail_mode"             "bq"."BqDetailMode" NOT NULL DEFAULT 'DETAIL',
  "detail_mode_set_by_name" TEXT,
  "detail_mode_set_at"      TIMESTAMP(3),
  "waste_override_pct"      DECIMAL(9,6),
  "sort_order"              INTEGER NOT NULL DEFAULT 0,
  "notes"                   TEXT,
  "locked_at"               TIMESTAMP(3),
  "locked_by_name"          TEXT,
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3),
  "deleted_at"              TIMESTAMP(3),
  "updated_by_name"         TEXT
);

CREATE INDEX "BqObject_project_id_sort_order_idx" ON "bq"."BqObject"("project_id", "sort_order");
CREATE INDEX "BqObject_deleted_at_idx" ON "bq"."BqObject"("deleted_at");

ALTER TABLE "bq"."BqObject"
  ADD CONSTRAINT "BqObject_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "bq"."BqProject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bq"."BqObject" ADD CONSTRAINT "BqObject_qty_positive" CHECK ("qty" > 0);
ALTER TABLE "bq"."BqObject"
  ADD CONSTRAINT "BqObject_waste_nonneg"
  CHECK ("waste_override_pct" IS NULL OR "waste_override_pct" >= 0);

COMMENT ON COLUMN "bq"."BqObject"."markup_pct" IS
  'Fraksi (0.2 = 20%). Markup di L1, bukan per baris L3 (PRD Bab 3.4) - ia keputusan komersial atas satu fixture utuh, bukan atas sebatang edging. TIDAK PERNAH tercetak ke klien; klien lihat rate saja.';
COMMENT ON COLUMN "bq"."BqObject"."waste_override_pct" IS
  'Presedensi waste level 2. NULL = tidak di-override. 0 adalah nilai SAH yang menang atas default bahan dan kategori (PRD Bab 4.1, AT-04) - jangan pernah menulisnya sebagai COALESCE(x, 0).';

COMMENT ON TABLE "bq"."BqObject" IS
  'L1. Rate TIDAK disimpan di sini - ia dihitung ulang dari baris L3 setiap kali dibaca. Menyimpannya berarti dua sumber kebenaran yang bisa selisih, dan yang tersimpan selalu yang dipercaya orang. Yang membekukan angka di BQ adalah snapshot di baris L3.';

CREATE TABLE "bq"."BqSubObject" (
  "id"              TEXT PRIMARY KEY,
  "object_id"       TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "qty"             DECIMAL(18,6) NOT NULL DEFAULT 1,
  "sort_order"      INTEGER NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3),
  "updated_by_name" TEXT
);

CREATE INDEX "BqSubObject_object_id_sort_order_idx" ON "bq"."BqSubObject"("object_id", "sort_order");

ALTER TABLE "bq"."BqSubObject"
  ADD CONSTRAINT "BqSubObject_object_id_fkey"
  FOREIGN KEY ("object_id") REFERENCES "bq"."BqObject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bq"."BqSubObject" ADD CONSTRAINT "BqSubObject_qty_positive" CHECK ("qty" > 0);

COMMENT ON COLUMN "bq"."BqSubObject"."qty" IS
  'Pengali L2 - berapa banyak sub-object ini di dalam 1 object. INI KUNCI DESAIN SELURUH ALAT (PRD Bab 2.1): estimator menulis kebutuhan untuk SATU ambalan lalu set jumlahnya 3; ubah jadi 5, seluruh bahan di bawahnya ikut. Tanpa kolom ini BQ cuma Excel yang lebih rapi.';

-- L3 bahan -------------------------------------------------------------------

CREATE TABLE "bq"."BqMaterialLine" (
  "id"                                  TEXT PRIMARY KEY,
  "sub_object_id"                       TEXT NOT NULL,
  "sku_id"                              TEXT,
  "sku_price_id"                        TEXT,
  "supplier_party_id"                   TEXT,
  "qty_per_sub"                         DECIMAL(18,6) NOT NULL,
  "waste_override_pct"                  DECIMAL(9,6),
  "snapshot_name"                       TEXT NOT NULL,
  "snapshot_code"                       TEXT,
  "snapshot_brand_name"                 TEXT,
  "snapshot_category_path"              TEXT,
  "snapshot_supplier_name"              TEXT,
  "snapshot_usage_unit"                 TEXT NOT NULL,
  "snapshot_purchase_unit"              TEXT NOT NULL,
  "snapshot_conversion"                 DECIMAL(18,6) NOT NULL,
  "snapshot_price"                      DECIMAL(18,4) NOT NULL,
  "snapshot_currency"                   TEXT NOT NULL DEFAULT 'IDR',
  "snapshot_material_default_waste_pct" DECIMAL(9,6),
  "snapshot_category_default_waste_pct" DECIMAL(9,6),
  "snapshot_minimum_order"              DECIMAL(18,6),
  "snapshot_rounding_increment"         DECIMAL(18,6) NOT NULL DEFAULT 1,
  "snapshot_price_valid_from"           TIMESTAMP(3),
  "snapshot_price_verified_from"        TIMESTAMP(3),
  "snapshot_taken_at"                   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_manual_override"                  BOOLEAN NOT NULL DEFAULT false,
  "override_note"                       TEXT,
  "sort_order"                          INTEGER NOT NULL DEFAULT 0,
  "notes"                               TEXT,
  "created_at"                          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                          TIMESTAMP(3),
  "updated_by_name"                     TEXT
);

CREATE INDEX "BqMaterialLine_sub_object_id_sort_order_idx" ON "bq"."BqMaterialLine"("sub_object_id", "sort_order");
CREATE INDEX "BqMaterialLine_sku_id_idx" ON "bq"."BqMaterialLine"("sku_id");

ALTER TABLE "bq"."BqMaterialLine"
  ADD CONSTRAINT "BqMaterialLine_sub_object_id_fkey"
  FOREIGN KEY ("sub_object_id") REFERENCES "bq"."BqSubObject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bq"."BqMaterialLine"
  ADD CONSTRAINT "BqMaterialLine_conversion_positive" CHECK ("snapshot_conversion" > 0);
ALTER TABLE "bq"."BqMaterialLine"
  ADD CONSTRAINT "BqMaterialLine_qty_nonneg" CHECK ("qty_per_sub" >= 0);
ALTER TABLE "bq"."BqMaterialLine"
  ADD CONSTRAINT "BqMaterialLine_waste_nonneg"
  CHECK ("waste_override_pct" IS NULL OR "waste_override_pct" >= 0);

COMMENT ON TABLE "bq"."BqMaterialLine" IS
  'L3 bahan. Seluruh kolom snapshot_* dibekukan saat baris dibuat dan TIDAK PERNAH dibaca ulang dari master data (PRD Bab 5.4 - larangan silent update, aturan yang paling tidak boleh dilanggar). Harga master berubah menghasilkan banner, bukan angka yang berubah sendiri.';

COMMENT ON COLUMN "bq"."BqMaterialLine"."sku_id" IS
  'Kolom biasa, BUKAN FK. Snapshot harus selamat dari apa pun yang terjadi pada master data sesudahnya; FK ber-SetNull pun tidak cukup karena ia benar hari ini dan diam-diam salah kalau suatu saat ditulis Cascade. NULL hanya untuk baris yang SKU-nya benar-benar lenyap - BUKAN pintu masuk baris karangan. Master data adalah SSOT: bahan yang belum ada di sana diminta ke staff lewat Master Data lebih dulu.';

COMMENT ON COLUMN "bq"."BqMaterialLine"."snapshot_material_default_waste_pct" IS
  'Presedensi level 3. Disimpan TERPISAH dari level 4 (kategori), tidak dikerucutkan jadi satu angka - kalau digabung, mesin hitung tidak bisa lagi menjawab kenapa waste-nya 10%, dan AT-03 tidak bisa diuji.';

COMMENT ON COLUMN "bq"."BqMaterialLine"."is_manual_override" IS
  'Estimator menyunting nilai snapshot langsung di BQ (keputusan owner 2026-08-19). Suntingan hidup di baris ini saja - tidak pernah merambat balik ke Master Data. Tiap project BQ punya snapshot sendiri.';

-- L3 jasa ---------------------------------------------------------------------
-- TIDAK punya waste_override_pct, TIDAK punya snapshot_conversion, TIDAK punya
-- minimum_order / rounding_increment. Itu bukan kelalaian - PRD Bab 3.2:
-- "Tanpa waste. Tanpa konversi. Ditegakkan lewat skema - tabel baris jasa
-- memang tidak punya kolomnya." AT-07 menguji tepat itu. Kalau suatu saat
-- kolom-kolom itu muncul di sini, yang salah adalah migrasinya.
-- -----------------------------------------------------------------------------

CREATE TABLE "bq"."BqServiceLine" (
  "id"                        TEXT PRIMARY KEY,
  "sub_object_id"             TEXT NOT NULL,
  "work_price_id"             TEXT,
  "vendor_party_id"           TEXT,
  "qty_per_sub"               DECIMAL(18,6) NOT NULL,
  "snapshot_name"             TEXT NOT NULL,
  "snapshot_code"             TEXT,
  "snapshot_category_path"    TEXT,
  "snapshot_vendor_name"      TEXT,
  "snapshot_rate_unit"        TEXT NOT NULL,
  "snapshot_price"            DECIMAL(18,4) NOT NULL,
  "snapshot_currency"         TEXT NOT NULL DEFAULT 'IDR',
  "snapshot_scope_note"       TEXT,
  "snapshot_has_material"     BOOLEAN NOT NULL DEFAULT false,
  "snapshot_price_valid_from" TIMESTAMP(3),
  "snapshot_taken_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "is_manual_override"        BOOLEAN NOT NULL DEFAULT false,
  "override_note"             TEXT,
  "sort_order"                INTEGER NOT NULL DEFAULT 0,
  "notes"                     TEXT,
  "created_at"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                TIMESTAMP(3),
  "updated_by_name"           TEXT
);

CREATE INDEX "BqServiceLine_sub_object_id_sort_order_idx" ON "bq"."BqServiceLine"("sub_object_id", "sort_order");
CREATE INDEX "BqServiceLine_work_price_id_idx" ON "bq"."BqServiceLine"("work_price_id");

ALTER TABLE "bq"."BqServiceLine"
  ADD CONSTRAINT "BqServiceLine_sub_object_id_fkey"
  FOREIGN KEY ("sub_object_id") REFERENCES "bq"."BqSubObject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bq"."BqServiceLine"
  ADD CONSTRAINT "BqServiceLine_qty_nonneg" CHECK ("qty_per_sub" >= 0);

COMMENT ON TABLE "bq"."BqServiceLine" IS
  'L3 jasa. Ketiadaan kolom waste dan konversi di sini ADALAH penegakan PRD Bab 3.2 / AT-07. Jangan menambahkannya supaya seragam dengan tabel bahan.';

COMMIT;

-- =============================================================================
-- Verifikasi
-- =============================================================================
--   \dt bq.*
--   -- 7 tabel: BqSettings, BqMaterialProfile, BqCategoryWaste, BqProject,
--   --          BqObject, BqSubObject, BqMaterialLine, BqServiceLine
--
--   SELECT conname FROM pg_constraint
--   WHERE connamespace = 'bq'::regnamespace AND contype = 'c'
--   ORDER BY conname;
--   -- CHECK harus mencakup conversion > 0 di BqMaterialProfile DAN di
--   -- BqMaterialLine. Yang kedua yang paling penting: ia menjaga snapshot
--   -- yang sudah terlanjur tersimpan, bukan cuma input baru.
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'bq' AND table_name = 'BqServiceLine'
--     AND column_name IN ('waste_override_pct', 'snapshot_conversion');
--   -- HARUS kosong (AT-07). Kalau ada isinya, migrasi sesudah ini melanggar
--   -- PRD Bab 3.2.
-- =============================================================================
