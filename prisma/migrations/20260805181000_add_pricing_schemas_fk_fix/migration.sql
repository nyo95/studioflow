-- DropForeignKey
ALTER TABLE "master_data"."MaterialLaborPrice" DROP CONSTRAINT "MaterialLaborPrice_service_vendor_id_fkey";

-- AlterTable
ALTER TABLE "master_data"."MaterialLaborPrice" ALTER COLUMN "id" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "master_data"."MaterialLaborPrice" ADD CONSTRAINT "MaterialLaborPrice_service_vendor_id_fkey" FOREIGN KEY ("service_vendor_id") REFERENCES "master_data"."ServiceVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
