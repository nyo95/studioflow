-- Migration: add library_sub_object_id FK to BqSubObject (R2, 2026-08-19)
-- Sub-object bisa jadi "instance" (⧉) dari BqLibrarySubObject.
-- OnDelete SetNull: kalau template dihapus, sub-object tetap hidup sebagai ◇.

ALTER TABLE bq."BqSubObject"
  ADD COLUMN "library_sub_object_id" TEXT;

ALTER TABLE bq."BqSubObject"
  ADD CONSTRAINT "BqSubObject_library_sub_object_id_fkey"
    FOREIGN KEY ("library_sub_object_id")
    REFERENCES bq."BqLibrarySubObject"("id")
    ON DELETE SET NULL;

CREATE INDEX "BqSubObject_library_sub_object_id_idx"
  ON bq."BqSubObject"("library_sub_object_id");
