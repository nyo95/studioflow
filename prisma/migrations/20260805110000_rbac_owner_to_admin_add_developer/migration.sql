-- RBAC restructure — 05 Aug 2026
-- =============================================================================
-- 1. OWNER role is removed; existing OWNER users become ADMIN (the studio-boss
--    role now carries full web-app admin, minus the SketchUp plugin surface).
-- 2. New DEVELOPER role (technical superuser: everything ADMIN has PLUS the
--    SketchUp plugin surface). berkah.rad@gmail.com is promoted to DEVELOPER.
-- 3. CURATOR role is removed; existing CURATOR users become STAFF. Material and
--    promotion curation is no longer a distinct role — it is an admin-level
--    (ADMIN / DEVELOPER) capability, granted via ROLE_PERMISSIONS.
--
-- The only column using "studioflow"."Role" is "studioflow"."User"."role"
-- (verified against the rebaseline migration). We recreate the enum rather than
-- ALTER TYPE ... ADD VALUE, because we must also DROP values (OWNER, CURATOR)
-- and remap rows in the same transaction — ADD VALUE cannot be used that way.
-- =============================================================================

-- Target enum (final shape).
CREATE TYPE "studioflow"."Role_new" AS ENUM ('ADMIN', 'DEVELOPER', 'DIC', 'DRIC', 'STAFF', 'ESTIMATOR');

-- Default references the old type; drop it so the column can be re-typed.
ALTER TABLE "studioflow"."User" ALTER COLUMN "role" DROP DEFAULT;

-- Re-type the column, remapping legacy values in flight.
--   OWNER   -> ADMIN
--   CURATOR -> STAFF
--   (all others map to themselves)
ALTER TABLE "studioflow"."User"
  ALTER COLUMN "role" TYPE "studioflow"."Role_new"
  USING (
    CASE "role"::text
      WHEN 'OWNER'   THEN 'ADMIN'
      WHEN 'CURATOR' THEN 'STAFF'
      ELSE "role"::text
    END::"studioflow"."Role_new"
  );

-- Swap the types over.
ALTER TYPE "studioflow"."Role" RENAME TO "Role_old";
ALTER TYPE "studioflow"."Role_new" RENAME TO "Role";
DROP TYPE "studioflow"."Role_old";

-- Restore the column default (unchanged: STAFF).
ALTER TABLE "studioflow"."User" ALTER COLUMN "role" SET DEFAULT 'STAFF';

-- Promote the developer account. Idempotent: no-op if the row is absent.
UPDATE "studioflow"."User" SET "role" = 'DEVELOPER' WHERE "email" = 'berkah.rad@gmail.com';
