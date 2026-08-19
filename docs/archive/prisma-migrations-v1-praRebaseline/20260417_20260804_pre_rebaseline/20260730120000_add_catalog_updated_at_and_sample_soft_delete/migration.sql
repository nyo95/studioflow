-- Additive only. No DROP, no ALTER of existing columns, no backfill.

-- 1. "Update" column of the office material/supplier list.
--    Nullable on purpose: existing rows stay NULL rather than being stamped with
--    the migration date, which would be false "last updated" data.
ALTER TABLE "ProductCatalog" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3);

-- 2. Soft delete for physical samples (SSOT 7.1).
--    SampleMovementLog cascade-deletes with its sample, so a hard delete would
--    destroy borrow/return history. Removal is now a soft delete instead.
ALTER TABLE "PhysicalSample" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "PhysicalSample_deleted_at_idx" ON "PhysicalSample"("deleted_at");
