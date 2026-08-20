-- BQ projects are standalone. The live database inspection on 2026-08-20
-- found zero rows with either reference populated.
DROP INDEX IF EXISTS "bq"."BqProject_studioflow_project_id_idx";
ALTER TABLE "bq"."BqProject"
  DROP COLUMN IF EXISTS "studioflow_project_id",
  DROP COLUMN IF EXISTS "studioflow_project_name";
