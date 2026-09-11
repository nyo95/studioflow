-- BQ Library: baris resep menempel LANGSUNG ke Works.
--
-- Sebelum ini `BqLibraryMaterialLine` / `BqLibraryServiceLine` hanya bisa
-- menunjuk `sub_object_of_object_id` atau `sub_object_id` — dua-duanya lewat
-- lapis `BqSubObject` yang sudah dipensiunkan (PRD-BQ §2.2).
--
-- Akibatnya `saveObjectToLibraryAction` hanya menyalin baris yang ada DI DALAM
-- sub-object; baris yang menempel langsung di Works diabaikan diam-diam, dan
-- resep tersimpan sebagai cangkang kosong.
--
-- Kolom lama sengaja DIPERTAHANKAN supaya resep yang terlanjur tersimpan lewat
-- jalur sub-object tetap terbaca. Validasi "tepat satu parent terisi" ada di
-- lapisan aplikasi, sama seperti sebelumnya.

ALTER TABLE "bq"."BqLibraryMaterialLine"
  ADD COLUMN "library_object_id" TEXT;

ALTER TABLE "bq"."BqLibraryServiceLine"
  ADD COLUMN "library_object_id" TEXT;

CREATE INDEX "BqLibraryMaterialLine_library_object_id_idx"
  ON "bq"."BqLibraryMaterialLine"("library_object_id");

CREATE INDEX "BqLibraryServiceLine_library_object_id_idx"
  ON "bq"."BqLibraryServiceLine"("library_object_id");

ALTER TABLE "bq"."BqLibraryMaterialLine"
  ADD CONSTRAINT "BqLibraryMaterialLine_library_object_id_fkey"
  FOREIGN KEY ("library_object_id") REFERENCES "bq"."BqLibraryObject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "bq"."BqLibraryServiceLine"
  ADD CONSTRAINT "BqLibraryServiceLine_library_object_id_fkey"
  FOREIGN KEY ("library_object_id") REFERENCES "bq"."BqLibraryObject"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
