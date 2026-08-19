/*
  Warnings:

  - You are about to drop the column `box_number` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `cover_url` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `digital_catalog_url` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `digital_folder_url` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `dimension_l` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `dimension_p` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `dimension_t` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `dimension_unit` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `finishing` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `motif_or_color` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `original_url` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `product_type` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `rak_location` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `sub_category` on the `MaterialCatalog` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `ProjectScheduleEntry` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `ProjectScheduleEntry` table. All the data in the column will be lost.
  - Added the required column `catalog_category` to the `MaterialCatalog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `catalog_sku` to the `MaterialCatalog` table without a default value. This is not possible if the table is not empty.
  - Added the required column `schedule_category` to the `ProjectScheduleEntry` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "MaterialCatalog_category_idx";

-- AlterTable
ALTER TABLE "MaterialCatalog" DROP COLUMN "box_number",
DROP COLUMN "category",
DROP COLUMN "color",
DROP COLUMN "cover_url",
DROP COLUMN "digital_catalog_url",
DROP COLUMN "digital_folder_url",
DROP COLUMN "dimension_l",
DROP COLUMN "dimension_p",
DROP COLUMN "dimension_t",
DROP COLUMN "dimension_unit",
DROP COLUMN "finishing",
DROP COLUMN "motif_or_color",
DROP COLUMN "original_url",
DROP COLUMN "price",
DROP COLUMN "product_type",
DROP COLUMN "rak_location",
DROP COLUMN "sub_category",
ADD COLUMN     "catalog_box_number" TEXT,
ADD COLUMN     "catalog_brand" TEXT,
ADD COLUMN     "catalog_category" TEXT NOT NULL,
ADD COLUMN     "catalog_color" TEXT,
ADD COLUMN     "catalog_dimension_l" TEXT,
ADD COLUMN     "catalog_dimension_p" TEXT,
ADD COLUMN     "catalog_dimension_t" TEXT,
ADD COLUMN     "catalog_dimension_unit" TEXT DEFAULT 'cm',
ADD COLUMN     "catalog_finishing" TEXT,
ADD COLUMN     "catalog_folder_url" TEXT,
ADD COLUMN     "catalog_image_original_url" TEXT,
ADD COLUMN     "catalog_image_url" TEXT,
ADD COLUMN     "catalog_motif" TEXT,
ADD COLUMN     "catalog_price" DOUBLE PRECISION,
ADD COLUMN     "catalog_product_name" TEXT,
ADD COLUMN     "catalog_rak_location" TEXT,
ADD COLUMN     "catalog_reference_url" TEXT,
ADD COLUMN     "catalog_sku" TEXT NOT NULL,
ADD COLUMN     "catalog_sub_category" TEXT;

-- AlterTable
ALTER TABLE "ProjectScheduleEntry" DROP COLUMN "category",
DROP COLUMN "location",
ADD COLUMN     "schedule_category" TEXT NOT NULL,
ADD COLUMN     "schedule_location" TEXT;

-- CreateIndex
CREATE INDEX "MaterialCatalog_catalog_category_idx" ON "MaterialCatalog"("catalog_category");

-- CreateIndex
CREATE INDEX "MaterialCatalog_catalog_brand_idx" ON "MaterialCatalog"("catalog_brand");
