-- WorkPriceProjectRef was legacy project metadata. The live database
-- inspection on 2026-08-20 found zero rows, so no operational data is lost.
-- The views were legacy BQ read contracts and had no active runtime consumer.
DROP VIEW IF EXISTS "master_data"."v_bq_material_rate";
DROP VIEW IF EXISTS "master_data"."v_bq_work_rate";
DROP TABLE IF EXISTS "master_data"."WorkPriceProjectRef";
