-- Master Data v2 follow-up: drop the two studioflow-schema enums left orphaned
-- by the rework.
--
-- `SampleAction` and `SampleStatus` used to be @@schema("studioflow") because
-- master_data.Sample / SampleMovementLog referenced them from there. v2 moved
-- both enums into master_data (with different values — SampleAction lost
-- TRANSFER/REJECT/CHECK_IN/CHECK_OUT/AUDITED/BORROW, SampleStatus swapped
-- SENT_TO_CLIENT for LOST/DISCARDED), so the studioflow copies now have zero
-- referencing columns. Verified before writing this: master_data.SampleAction
-- backs 1 column and master_data.SampleStatus backs 2; the studioflow pair
-- backs none.
--
-- RESTRICT, not CASCADE: if anything does still reference these, this migration
-- must fail loudly rather than quietly delete that column.

DROP TYPE IF EXISTS "studioflow"."SampleAction" RESTRICT;
DROP TYPE IF EXISTS "studioflow"."SampleStatus" RESTRICT;
