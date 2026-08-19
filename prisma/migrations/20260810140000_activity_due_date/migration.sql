-- Gives `Activity` a due date so the Upcoming view can show all of the work,
-- not just the half that lives in ProjectChecklist.
--
-- Purely additive: one nullable column and one index. Nothing is backfilled —
-- a task nobody dated has no date, and inventing one (from the phase timeline,
-- say) would put every task in a phase on the same day and make the busiest
-- bucket a lie.

ALTER TABLE studioflow."Activity"
    ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP(3);

-- The Upcoming view's whole query is "what is dated, ordered by date". Most
-- rows will have NULL here for a long while, so the index stays small and is
-- exactly the one that query wants.
CREATE INDEX IF NOT EXISTS "Activity_due_at_idx"
    ON studioflow."Activity"("due_at");
