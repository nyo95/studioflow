-- DropForeignKey
ALTER TABLE "bq"."BqSubObject" DROP CONSTRAINT "BqSubObject_library_sub_object_id_fkey";

-- AlterTable
ALTER TABLE "bq"."BqLibraryObject" ALTER COLUMN "unit" DROP DEFAULT,
ALTER COLUMN "markup_pct" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bq"."BqLibrarySubObject" ALTER COLUMN "qty" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bq"."BqLibrarySubObjectOfObject" ALTER COLUMN "qty" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "bq"."BqSubObject" ADD CONSTRAINT "BqSubObject_library_sub_object_id_fkey" FOREIGN KEY ("library_sub_object_id") REFERENCES "bq"."BqLibrarySubObject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
