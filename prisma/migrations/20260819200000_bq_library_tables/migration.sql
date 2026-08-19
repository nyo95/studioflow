-- =============================================================================
-- BQ Library tables — resep yang bisa dipanggil ulang
-- =============================================================================
-- ADITIF SEPENUHNYA. Tabel baru, tidak menyentuh yang sudah ada.
-- =============================================================================

BEGIN;

-- L1 Library -------------------------------------------------------------

CREATE TABLE "bq"."BqLibraryObject" (
  "id"               TEXT PRIMARY KEY,
  "code"             TEXT,
  "name"             TEXT NOT NULL,
  "unit"             TEXT NOT NULL DEFAULT 'unit',
  "markup_pct"       DECIMAL(9,6) NOT NULL DEFAULT 0.2,
  "detail_mode"      "bq"."BqDetailMode" NOT NULL DEFAULT 'DETAIL',
  "notes"            TEXT,
  "created_by_name"  TEXT NOT NULL,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3),
  "deleted_at"       TIMESTAMP(3)
);

-- L2 in Library (nested in L1) ------------------------------------------

CREATE TABLE "bq"."BqLibrarySubObjectOfObject" (
  "id"                  TEXT PRIMARY KEY,
  "library_object_id"   TEXT NOT NULL,
  "name"                TEXT NOT NULL,
  "qty"                 DECIMAL(18,6) NOT NULL DEFAULT 1,
  "notes"               TEXT,
  "sort_order"          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX "BqLibrarySubObjectOfObject_library_object_id_sort_order_idx"
  ON "bq"."BqLibrarySubObjectOfObject"("library_object_id", "sort_order");

ALTER TABLE "bq"."BqLibrarySubObjectOfObject"
  ADD CONSTRAINT "BqLibrarySubObjectOfObject_library_object_id_fkey"
  FOREIGN KEY ("library_object_id") REFERENCES "bq"."BqLibraryObject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- L2 Library (standalone) ------------------------------------------------

CREATE TABLE "bq"."BqLibrarySubObject" (
  "id"               TEXT PRIMARY KEY,
  "name"             TEXT NOT NULL,
  "qty"              DECIMAL(18,6) NOT NULL DEFAULT 1,
  "notes"            TEXT,
  "created_by_name"  TEXT NOT NULL,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3),
  "deleted_at"       TIMESTAMP(3)
);

-- Library material lines -------------------------------------------------

CREATE TABLE "bq"."BqLibraryMaterialLine" (
  "id"                         TEXT PRIMARY KEY,
  "sub_object_of_object_id"    TEXT,
  "sub_object_id"              TEXT,
  "sku_id"                     TEXT NOT NULL,
  "qty_per_sub"                DECIMAL(18,6) NOT NULL,
  "waste_override_pct"         DECIMAL(9,6),
  "sort_order"                 INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX "BqLibraryMaterialLine_sub_object_of_object_id_idx"
  ON "bq"."BqLibraryMaterialLine"("sub_object_of_object_id");
CREATE INDEX "BqLibraryMaterialLine_sub_object_id_idx"
  ON "bq"."BqLibraryMaterialLine"("sub_object_id");

ALTER TABLE "bq"."BqLibraryMaterialLine"
  ADD CONSTRAINT "BqLibraryMaterialLine_sub_object_of_object_id_fkey"
  FOREIGN KEY ("sub_object_of_object_id") REFERENCES "bq"."BqLibrarySubObjectOfObject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bq"."BqLibraryMaterialLine"
  ADD CONSTRAINT "BqLibraryMaterialLine_sub_object_id_fkey"
  FOREIGN KEY ("sub_object_id") REFERENCES "bq"."BqLibrarySubObject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Library service lines --------------------------------------------------

CREATE TABLE "bq"."BqLibraryServiceLine" (
  "id"                         TEXT PRIMARY KEY,
  "sub_object_of_object_id"    TEXT,
  "sub_object_id"              TEXT,
  "work_price_id"              TEXT NOT NULL,
  "qty_per_sub"                DECIMAL(18,6) NOT NULL,
  "sort_order"                 INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX "BqLibraryServiceLine_sub_object_of_object_id_idx"
  ON "bq"."BqLibraryServiceLine"("sub_object_of_object_id");
CREATE INDEX "BqLibraryServiceLine_sub_object_id_idx"
  ON "bq"."BqLibraryServiceLine"("sub_object_id");

ALTER TABLE "bq"."BqLibraryServiceLine"
  ADD CONSTRAINT "BqLibraryServiceLine_sub_object_of_object_id_fkey"
  FOREIGN KEY ("sub_object_of_object_id") REFERENCES "bq"."BqLibrarySubObjectOfObject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bq"."BqLibraryServiceLine"
  ADD CONSTRAINT "BqLibraryServiceLine_sub_object_id_fkey"
  FOREIGN KEY ("sub_object_id") REFERENCES "bq"."BqLibrarySubObject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
