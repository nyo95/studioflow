-- R3 Platform Consolidation — final audit SSOT.
-- Keputusan owner 2026-08-24 (PRD Architecture Cleanup v2 §20).
-- Backfill payload columns, migrate legacy MasterDataAudit rows into
-- studioflow.AuditLog, then drop the transitional table/column.

ALTER TABLE "studioflow"."AuditLog"
  ADD COLUMN IF NOT EXISTS "before_json" JSONB,
  ADD COLUMN IF NOT EXISTS "after_json" JSONB,
  ADD COLUMN IF NOT EXISTS "metadata_json" JSONB;

-- Existing StudioFlow/BQ rows stored their payload in `details`.
UPDATE "studioflow"."AuditLog"
SET "metadata_json" = "details"
WHERE "domain" <> 'MASTER_DATA'
  AND "details" IS NOT NULL
  AND "metadata_json" IS NULL;

WITH legacy_base AS (
  SELECT
    "id",
    "entity",
    "entity_id",
    "action"::TEXT AS "action",
    "actor_id",
    "actor_name",
    "changes"::JSONB AS "changes_json",
    "created_at",
    (
      SELECT jsonb_object_agg(entry.key, entry.value->'from')
      FROM jsonb_each(COALESCE("changes"::JSONB, '{}'::JSONB)) AS entry
      WHERE jsonb_typeof(entry.value) = 'object'
        AND entry.value ? 'from'
        AND entry.value ? 'to'
    ) AS "before_json",
    (
      SELECT jsonb_object_agg(entry.key, entry.value->'to')
      FROM jsonb_each(COALESCE("changes"::JSONB, '{}'::JSONB)) AS entry
      WHERE jsonb_typeof(entry.value) = 'object'
        AND entry.value ? 'from'
        AND entry.value ? 'to'
    ) AS "after_json",
    CASE
      WHEN "changes" IS NULL THEN NULL
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_each(COALESCE("changes"::JSONB, '{}'::JSONB)) AS entry
        WHERE NOT (
          jsonb_typeof(entry.value) = 'object'
          AND entry.value ? 'from'
          AND entry.value ? 'to'
        )
      )
      THEN jsonb_build_object('changes', "changes"::JSONB)
      ELSE NULL
    END AS "metadata_json",
    md5(
      concat_ws(
        '|',
        "entity",
        "entity_id",
        "action"::TEXT,
        COALESCE("actor_id", ''),
        COALESCE("actor_name", ''),
        to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        COALESCE("changes"::JSONB::TEXT, 'null')
      )
    ) AS "match_key"
  FROM "master_data"."MasterDataAudit"
),
legacy_ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY "match_key" ORDER BY "id") AS "match_rn"
  FROM legacy_base
),
core_ranked AS (
  SELECT
    "id" AS "audit_log_id",
    md5(
      concat_ws(
        '|',
        "entity_type",
        "entity_id",
        "action",
        COALESCE("actor_id", ''),
        COALESCE("actor_name", ''),
        to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        COALESCE(("details"->'changes')::JSONB::TEXT, 'null')
      )
    ) AS "match_key",
    ROW_NUMBER() OVER (
      PARTITION BY md5(
        concat_ws(
          '|',
          "entity_type",
          "entity_id",
          "action",
          COALESCE("actor_id", ''),
          COALESCE("actor_name", ''),
          to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
          COALESCE(("details"->'changes')::JSONB::TEXT, 'null')
        )
      )
      ORDER BY "id"
    ) AS "match_rn"
  FROM "studioflow"."AuditLog"
  WHERE "domain" = 'MASTER_DATA'
),
matched AS (
  SELECT
    core_ranked."audit_log_id",
    legacy_ranked."before_json",
    legacy_ranked."after_json",
    legacy_ranked."metadata_json"
  FROM legacy_ranked
  INNER JOIN core_ranked
    ON core_ranked."match_key" = legacy_ranked."match_key"
   AND core_ranked."match_rn" = legacy_ranked."match_rn"
),
unmatched AS (
  SELECT legacy_ranked.*
  FROM legacy_ranked
  LEFT JOIN core_ranked
    ON core_ranked."match_key" = legacy_ranked."match_key"
   AND core_ranked."match_rn" = legacy_ranked."match_rn"
  WHERE core_ranked."audit_log_id" IS NULL
)
UPDATE "studioflow"."AuditLog" AS audit
SET
  "before_json" = matched."before_json",
  "after_json" = matched."after_json",
  "metadata_json" = COALESCE(audit."metadata_json", matched."metadata_json")
FROM matched
WHERE audit."id" = matched."audit_log_id";

WITH legacy_base AS (
  SELECT
    "id",
    "entity",
    "entity_id",
    "action"::TEXT AS "action",
    "actor_id",
    "actor_name",
    "changes"::JSONB AS "changes_json",
    "created_at",
    (
      SELECT jsonb_object_agg(entry.key, entry.value->'from')
      FROM jsonb_each(COALESCE("changes"::JSONB, '{}'::JSONB)) AS entry
      WHERE jsonb_typeof(entry.value) = 'object'
        AND entry.value ? 'from'
        AND entry.value ? 'to'
    ) AS "before_json",
    (
      SELECT jsonb_object_agg(entry.key, entry.value->'to')
      FROM jsonb_each(COALESCE("changes"::JSONB, '{}'::JSONB)) AS entry
      WHERE jsonb_typeof(entry.value) = 'object'
        AND entry.value ? 'from'
        AND entry.value ? 'to'
    ) AS "after_json",
    CASE
      WHEN "changes" IS NULL THEN NULL
      WHEN EXISTS (
        SELECT 1
        FROM jsonb_each(COALESCE("changes"::JSONB, '{}'::JSONB)) AS entry
        WHERE NOT (
          jsonb_typeof(entry.value) = 'object'
          AND entry.value ? 'from'
          AND entry.value ? 'to'
        )
      )
      THEN jsonb_build_object('changes', "changes"::JSONB)
      ELSE NULL
    END AS "metadata_json",
    md5(
      concat_ws(
        '|',
        "entity",
        "entity_id",
        "action"::TEXT,
        COALESCE("actor_id", ''),
        COALESCE("actor_name", ''),
        to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        COALESCE("changes"::JSONB::TEXT, 'null')
      )
    ) AS "match_key"
  FROM "master_data"."MasterDataAudit"
),
legacy_ranked AS (
  SELECT
    *,
    ROW_NUMBER() OVER (PARTITION BY "match_key" ORDER BY "id") AS "match_rn"
  FROM legacy_base
),
core_ranked AS (
  SELECT
    "id" AS "audit_log_id",
    md5(
      concat_ws(
        '|',
        "entity_type",
        "entity_id",
        "action",
        COALESCE("actor_id", ''),
        COALESCE("actor_name", ''),
        to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
        COALESCE(("details"->'changes')::JSONB::TEXT, 'null')
      )
    ) AS "match_key",
    ROW_NUMBER() OVER (
      PARTITION BY md5(
        concat_ws(
          '|',
          "entity_type",
          "entity_id",
          "action",
          COALESCE("actor_id", ''),
          COALESCE("actor_name", ''),
          to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US'),
          COALESCE(("details"->'changes')::JSONB::TEXT, 'null')
        )
      )
      ORDER BY "id"
    ) AS "match_rn"
  FROM "studioflow"."AuditLog"
  WHERE "domain" = 'MASTER_DATA'
)
-- `id` HARUS disebut eksplisit. `@default(uuid())` di schema.prisma dihasilkan
-- Prisma Client di sisi aplikasi, ia TIDAK pernah jadi DEFAULT di Postgres —
-- kolomnya cuma `"id" TEXT NOT NULL`. INSERT mentah yang menghilangkan `id`
-- karena itu mengirim NULL dan kena not-null constraint. Bukan data lama yang
-- rusak: `id` adalah primary key, ia tidak mungkin NULL di baris yang sudah ada.
INSERT INTO "studioflow"."AuditLog" (
  "id",
  "domain",
  "action",
  "entity_type",
  "entity_id",
  "actor_id",
  "actor_name",
  "before_json",
  "after_json",
  "metadata_json",
  "created_at"
)
SELECT
  gen_random_uuid()::TEXT,
  'MASTER_DATA',
  legacy_ranked."action",
  legacy_ranked."entity",
  legacy_ranked."entity_id",
  legacy_ranked."actor_id",
  legacy_ranked."actor_name",
  legacy_ranked."before_json",
  legacy_ranked."after_json",
  legacy_ranked."metadata_json",
  legacy_ranked."created_at"
FROM legacy_ranked
LEFT JOIN core_ranked
  ON core_ranked."match_key" = legacy_ranked."match_key"
 AND core_ranked."match_rn" = legacy_ranked."match_rn"
WHERE core_ranked."audit_log_id" IS NULL;

-- Any MASTER_DATA rows written only to the transitional generic table keep
-- their legacy payload in metadata when no legacy pair exists.
UPDATE "studioflow"."AuditLog"
SET "metadata_json" = "details"
WHERE "domain" = 'MASTER_DATA'
  AND "metadata_json" IS NULL
  AND "before_json" IS NULL
  AND "after_json" IS NULL
  AND "details" IS NOT NULL;

ALTER TABLE "studioflow"."AuditLog"
  DROP COLUMN "details";

DROP TABLE "master_data"."MasterDataAudit";
