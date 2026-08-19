-- CreateEnum: PromotionStatus
CREATE TYPE "studioflow"."PromotionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: Tambah FK constraints + ubah status ke enum + tambah index
-- Catatan: Promotion Queue sudah disabled sejak 2026-08-10 (FEATURE_PROMOTION_QUEUE_ENABLED = false)
-- Tabel ini kemungkinan kosong atau hanya berisi data test.

-- 1. Tambah FK ke Project (required, onDelete: Cascade)
ALTER TABLE "studioflow"."PromotionRequest"
  ADD CONSTRAINT "PromotionRequest_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Tambah FK ke ProjectScheduleOption (required, onDelete: Restrict)
ALTER TABLE "studioflow"."PromotionRequest"
  ADD CONSTRAINT "PromotionRequest_schedule_option_id_fkey"
  FOREIGN KEY ("schedule_option_id") REFERENCES "studioflow"."ProjectScheduleOption"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 3. Tambah FK ke User (requested_by) (required, onDelete: Restrict)
ALTER TABLE "studioflow"."PromotionRequest"
  ADD CONSTRAINT "PromotionRequest_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "studioflow"."User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Tambah FK ke User (reviewed_by) (optional, onDelete: SetNull)
ALTER TABLE "studioflow"."PromotionRequest"
  ADD CONSTRAINT "PromotionRequest_reviewed_by_id_fkey"
  FOREIGN KEY ("reviewed_by_id") REFERENCES "studioflow"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Ubah status dari String ke enum PromotionStatus
-- Menggunakan USING untuk convert existing data (asumsi semua value = 'PENDING'/'APPROVED'/'REJECTED')
ALTER TABLE "studioflow"."PromotionRequest"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "studioflow"."PromotionStatus"
  USING ("status"::"studioflow"."PromotionStatus"),
  ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- 6. Tambah index untuk query performance
CREATE INDEX "PromotionRequest_status_idx" ON "studioflow"."PromotionRequest"("status");
CREATE INDEX "PromotionRequest_project_id_idx" ON "studioflow"."PromotionRequest"("project_id");
