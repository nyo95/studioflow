-- R4 (PRD Architecture Cleanup v2, keputusan owner U4 2026-08-24):
-- `SkuPrice.updated_by_id` sebagai plain column (tanpa FK lintas schema),
-- pola yang sama dengan `SampleMovement.actor_id`.
ALTER TABLE "master_data"."SkuPrice" ADD COLUMN "updated_by_id" TEXT;
