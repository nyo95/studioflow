-- AddColumn
-- checked_at: timestamp of when a task was last marked done.
-- Set by executeToggleChecklist; used to expire stale done-items from the Today
-- feed after CHECKLIST_DONE_RETENTION_DAYS (currently 7 days).
-- Nullable so pre-migration rows (is_checked=true, checked_at=null) are treated
-- as recent and kept in the feed rather than silently disappearing on upgrade.
ALTER TABLE "studioflow"."ProjectChecklist" ADD COLUMN "checked_at" TIMESTAMP(3);
