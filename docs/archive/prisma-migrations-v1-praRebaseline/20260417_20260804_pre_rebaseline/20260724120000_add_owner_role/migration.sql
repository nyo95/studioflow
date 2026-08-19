-- Add the OWNER role: admin-level access across the web app, but every
-- SketchUp-plugin gate stays hard-checked to ADMIN so the plugin/API remains
-- exclusive to the plugin admin. Additive enum change — no data touched.
ALTER TYPE "Role" ADD VALUE 'OWNER';
