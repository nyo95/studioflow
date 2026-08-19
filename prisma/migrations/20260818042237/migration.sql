/*
  Warnings:

  - The values [SENT_TO_CLIENT] on the enum `SampleStatus` will be removed. If these variants are still used in the database, this will fail.
  - The `status` column on the `PromotionRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "master_data"."SampleStatus_new" AS ENUM ('AVAILABLE', 'BORROWED', 'LOST', 'DISCARDED');
ALTER TABLE "master_data"."Sample" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "master_data"."Sample" ALTER COLUMN "status" TYPE "master_data"."SampleStatus_new" USING ("status"::text::"master_data"."SampleStatus_new");
ALTER TYPE "master_data"."SampleStatus" RENAME TO "SampleStatus_old";
ALTER TYPE "master_data"."SampleStatus_new" RENAME TO "SampleStatus";
DROP TYPE "master_data"."SampleStatus_old";
ALTER TABLE "master_data"."Sample" ALTER COLUMN "status" SET DEFAULT 'AVAILABLE';
COMMIT;

-- DropForeignKey
ALTER TABLE "studioflow"."PromotionRequest" DROP CONSTRAINT "PromotionRequest_project_id_fkey";

-- DropForeignKey
ALTER TABLE "studioflow"."PromotionRequest" DROP CONSTRAINT "PromotionRequest_requested_by_id_fkey";

-- DropForeignKey
ALTER TABLE "studioflow"."PromotionRequest" DROP CONSTRAINT "PromotionRequest_reviewed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "studioflow"."PromotionRequest" DROP CONSTRAINT "PromotionRequest_schedule_option_id_fkey";

-- DropIndex
DROP INDEX "master_data"."Brand_name_trgm";

-- DropIndex
DROP INDEX "master_data"."Category_name_trgm";

-- DropIndex
DROP INDEX "master_data"."Party_name_trgm";

-- DropIndex
DROP INDEX "master_data"."Sku_name_trgm";

-- DropIndex
DROP INDEX "master_data"."Sku_spec_gin";

-- DropIndex
DROP INDEX "master_data"."WorkPrice_spec_gin";

-- DropIndex
DROP INDEX "studioflow"."PromotionRequest_project_id_idx";

-- DropIndex
DROP INDEX "studioflow"."PromotionRequest_status_idx";

-- AlterTable
ALTER TABLE "studioflow"."PromotionRequest" DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'PENDING';

-- DropEnum
DROP TYPE "studioflow"."PromotionStatus";
