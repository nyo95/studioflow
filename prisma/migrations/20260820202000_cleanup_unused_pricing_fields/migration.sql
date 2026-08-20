-- Qty was historical Excel metadata and was not used by Master Data or BQ.
-- WorkPrice valid_to/is_current were misleading history-shaped fields; WorkPrice
-- is edited in place and audit history lives in MasterDataAudit.
ALTER TABLE "master_data"."SkuPrice" DROP COLUMN IF EXISTS "qty";
ALTER TABLE "master_data"."WorkPrice"
  DROP COLUMN IF EXISTS "qty",
  DROP COLUMN IF EXISTS "valid_to",
  DROP COLUMN IF EXISTS "is_current";
DROP INDEX IF EXISTS "master_data"."WorkPrice_is_current_is_active_idx";
