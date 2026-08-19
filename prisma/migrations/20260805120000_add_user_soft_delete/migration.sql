-- User soft-delete — 05 Aug 2026
-- =============================================================================
-- Additive only. Adds a nullable soft-delete marker to User. A removed user is
-- stamped with deleted_at instead of being DELETEd, so every required FK to
-- User (Project.pic_designer_id / pic_drafter_id, Comment.author_id,
-- AuditLog.user_id, ProjectProductRequest.requested_by_id,
-- ProjectMomDocument.created_by) stays valid and its name keeps resolving.
--
-- No backfill: existing rows are active (deleted_at = NULL).
-- =============================================================================

ALTER TABLE "studioflow"."User" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- Partial index: nearly every read filters to active users (deleted_at IS NULL).
CREATE INDEX "User_deleted_at_idx" ON "studioflow"."User"("deleted_at");
