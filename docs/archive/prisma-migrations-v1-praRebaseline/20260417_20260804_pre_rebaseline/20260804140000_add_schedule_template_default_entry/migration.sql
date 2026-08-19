-- RECURRING SCHEDULE TEMPLATE — "template berulang tiap proyek"
--
-- WHY
-- ---
-- Every new project's Product Schedule starts empty. studioflow."ScheduleTemplate"
-- already exists as a category dictionary (which categories/sections are
-- known), but nothing marks which of those categories should be pre-populated
-- into a new project automatically — so the team re-creates the same PT-/FL-/
-- WD-/etc. rows by hand on every project. See PLAN-AUDIT-ROADMAP-2026Q3.md §2.1 R1.
--
-- This migration:
--   * adds ONE column, studioflow."ScheduleTemplate"."is_default_entry",
--     defaulting to false so no existing category silently starts
--     auto-populating projects the moment this ships.
--
-- STRICTLY ADDITIVE. Does not touch schedule_category, section, is_active, or
-- any other table. Application code (ScheduleService.applyDefaultTemplateEntries)
-- reads rows where is_default_entry = true and materializes each as an empty
-- "reserve" ProjectScheduleEntry — reusing the existing entry-creation path,
-- not a new one — on project creation, and via an explicit "Apply template"
-- action for projects that already exist.
--
-- Admins opt categories in via Settings > Studio > Project Engine Templates
-- (one global default set per section — see §2.1's decision note, no
-- per-client variants).

ALTER TABLE studioflow."ScheduleTemplate"
  ADD COLUMN IF NOT EXISTS "is_default_entry" BOOLEAN NOT NULL DEFAULT false;
