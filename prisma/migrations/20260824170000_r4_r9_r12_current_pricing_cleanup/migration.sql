-- R4 / R9 / R12
-- - Flatten SkuPrice to current-state rows only
-- - Remove obsolete BQ snapshot/provenance fields tied to auto-pick/drift
-- - Drop write-only ProjectTimeline

-- ----------------------------------------------------------------------------
-- Archive non-current / duplicate SkuPrice rows before flattening the table.
-- History now belongs in generic AuditLog, not in the live pricing table.
-- ----------------------------------------------------------------------------

INSERT INTO "studioflow"."AuditLog" (
  "id",
  "domain",
  "action",
  "entity_type",
  "entity_id",
  "actor_name",
  "before_json",
  "metadata_json"
)
SELECT
  gen_random_uuid()::text,
  'MASTER_DATA',
  'R4_SKUPRICE_HISTORY_ARCHIVE',
  'SkuPrice',
  sp."id",
  'migration:20260824170000_r4_r9_r12_current_pricing_cleanup',
  to_jsonb(sp),
  jsonb_build_object(
    'migration', '20260824170000_r4_r9_r12_current_pricing_cleanup',
    'reason', 'SkuPrice flattened to current-state model'
  )
FROM "master_data"."SkuPrice" sp
WHERE sp."is_current" = false;

WITH duplicate_current AS (
  SELECT id
  FROM (
    SELECT
      sp."id",
      row_number() OVER (
        PARTITION BY
          sp."sku_id",
          COALESCE(sp."supplier_party_id", '00000000-0000-0000-0000-000000000000')
        ORDER BY
          COALESCE(sp."updated_at", sp."created_at") DESC,
          sp."created_at" DESC,
          sp."id" DESC
      ) AS rn
    FROM "master_data"."SkuPrice" sp
    WHERE sp."is_current" = true
  ) ranked
  WHERE ranked.rn > 1
)
INSERT INTO "studioflow"."AuditLog" (
  "id",
  "domain",
  "action",
  "entity_type",
  "entity_id",
  "actor_name",
  "before_json",
  "metadata_json"
)
SELECT
  gen_random_uuid()::text,
  'MASTER_DATA',
  'R4_SKUPRICE_HISTORY_ARCHIVE',
  'SkuPrice',
  sp."id",
  'migration:20260824170000_r4_r9_r12_current_pricing_cleanup',
  to_jsonb(sp),
  jsonb_build_object(
    'migration', '20260824170000_r4_r9_r12_current_pricing_cleanup',
    'reason', 'Duplicate current row removed during SkuPrice flattening'
  )
FROM "master_data"."SkuPrice" sp
JOIN duplicate_current d ON d.id = sp."id";

WITH duplicate_current AS (
  SELECT id
  FROM (
    SELECT
      sp."id",
      row_number() OVER (
        PARTITION BY
          sp."sku_id",
          COALESCE(sp."supplier_party_id", '00000000-0000-0000-0000-000000000000')
        ORDER BY
          COALESCE(sp."updated_at", sp."created_at") DESC,
          sp."created_at" DESC,
          sp."id" DESC
      ) AS rn
    FROM "master_data"."SkuPrice" sp
    WHERE sp."is_current" = true
  ) ranked
  WHERE ranked.rn > 1
)
DELETE FROM "master_data"."SkuPrice" sp
USING duplicate_current d
WHERE sp."id" = d."id";

DELETE FROM "master_data"."SkuPrice"
WHERE "is_current" = false;

DROP INDEX IF EXISTS "master_data"."SkuPrice_current_uniq";
DROP INDEX IF EXISTS "master_data"."SkuPrice_sku_id_is_current_idx";
DROP INDEX IF EXISTS "master_data"."SkuPrice_valid_from_idx";

CREATE UNIQUE INDEX "SkuPrice_pair_uniq"
  ON "master_data"."SkuPrice" (
    "sku_id",
    (COALESCE("supplier_party_id", '00000000-0000-0000-0000-000000000000'))
  );

ALTER TABLE "master_data"."SkuPrice"
  DROP COLUMN IF EXISTS "valid_from",
  DROP COLUMN IF EXISTS "valid_to",
  DROP COLUMN IF EXISTS "is_current";

ALTER TABLE "master_data"."Sku"
  DROP COLUMN IF EXISTS "preferred_supplier_party_id";

ALTER TABLE "bq"."BqMaterialLine"
  DROP COLUMN IF EXISTS "snapshot_price_valid_from",
  DROP COLUMN IF EXISTS "snapshot_price_verified_from";

ALTER TABLE "bq"."BqServiceLine"
  DROP COLUMN IF EXISTS "snapshot_price_valid_from";

ALTER TABLE "bq"."BqLibraryMaterialLine"
  ADD COLUMN IF NOT EXISTS "sku_price_id" TEXT,
  ADD COLUMN IF NOT EXISTS "supplier_party_id" TEXT;

DROP TABLE IF EXISTS "studioflow"."ProjectTimeline";
DROP TABLE IF EXISTS "studioflow"."TimelineTemplate";
DROP TYPE IF EXISTS "studioflow"."TimelineStatus";
