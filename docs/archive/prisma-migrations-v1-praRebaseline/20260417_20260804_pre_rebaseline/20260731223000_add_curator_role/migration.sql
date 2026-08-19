-- CURATOR is an additive StudioFlow identity role. It does not alter, rewrite,
-- or delete any existing user, project, schedule, snapshot, or master-data row.
ALTER TYPE "studioflow"."Role" ADD VALUE IF NOT EXISTS 'CURATOR';
