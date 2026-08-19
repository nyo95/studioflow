-- PHASE STATUS TIMESTAMP — "how long has this been sitting here?"
--
-- WHY
-- ---
-- studioflow."Phase" records WHAT state a phase is in (status_enum) but never
-- WHEN it entered that state. The office question is almost never "what is the
-- status" — everybody knows Design 3D is with the client. The question is "how
-- long has it been with the client?", because that is what surfaces a stalled
-- project before the deadline does.
--
-- Until now the only way to answer that was to scan studioflow."AuditLog" for
-- the newest phase-transition row. That is fine for one phase detail page and
-- unusable for a project list rendering 6 phases x N projects.
--
-- STRICTLY ADDITIVE. This migration:
--   * adds ONE nullable column, studioflow."Phase"."status_changed_at";
--   * backfills it, where possible, from existing AuditLog history.
--
-- It does NOT touch status_enum, is_locked, allow_parallel, any enum, any
-- foreign key, or a single row outside the new column.
--
-- NO INDEX. An earlier draft added a partial index on the new column. It was
-- removed for two reasons: nothing queries on it yet (every consumer reads the
-- value off a row already being fetched, never as a predicate), and a partial
-- index has no expression in schema.prisma, so `prisma migrate dev` would
-- report permanent drift and try to drop it. Add one alongside the first query
-- that actually filters on this column, and declare it in the schema.
--
-- NULLABLE, DELIBERATELY
-- ----------------------
-- A NOT NULL DEFAULT now() would have been one line shorter and would have
-- lied: every pre-existing phase would claim it changed state at migration
-- time, so a phase that has genuinely been stuck with the client for three
-- weeks would render "waiting 0 days" — the exact opposite of the signal this
-- column exists to provide. NULL means "we do not know", and the presenter
-- (src/lib/domain/phase-presenter.ts) renders no duration for NULL.

ALTER TABLE studioflow."Phase"
  ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMP(3);

-- BACKFILL
-- --------
-- For each phase, take the newest non-reverted audit row whose action is a
-- phase status transition. Reverted rows are excluded: an undone transition
-- did not leave the phase in that state, so its timestamp is not when the
-- current status began.
--
-- Phases with no surviving audit history (older projects, pruned logs, phases
-- never activated) stay NULL. That is the intended outcome, not a gap to fill.

UPDATE studioflow."Phase" AS p
SET "status_changed_at" = latest.created_at
FROM (
  SELECT DISTINCT ON (l."phase_id")
         l."phase_id",
         l."created_at"
  FROM studioflow."AuditLog" AS l
  WHERE l."phase_id" IS NOT NULL
    AND l."reverted_at" IS NULL
    AND l."action" IN (
      'ACTIVATE_PHASE',
      'SUBMIT_FOR_INTERNAL_REVIEW',
      'APPROVE_INTERNAL',
      'SUBMIT_FOR_CLIENT_REVIEW',
      'APPROVE_CLIENT_PHASE',
      'REJECT_PHASE_INTERNAL',
      'REJECT_PHASE_CLIENT',
      'REOPEN_PHASE',
      'COMPLETE_SUPERVISION_PHASE',
      'REVISION_OVERRIDE_ADMIN',
      'BYPASS_PHASE_TO_COMPLETED'
    )
  ORDER BY l."phase_id", l."created_at" DESC
) AS latest
WHERE p."id" = latest."phase_id"
  AND p."status_changed_at" IS NULL;
