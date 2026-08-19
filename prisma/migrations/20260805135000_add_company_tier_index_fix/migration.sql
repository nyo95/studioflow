-- DropIndex
DROP INDEX "studioflow"."User_deleted_at_idx";

-- AlterTable
ALTER TABLE "master_data"."Company" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "master_data"."CompanyContact" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "master_data"."CompanyLink" ALTER COLUMN "id" DROP DEFAULT;
