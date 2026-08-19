-- Roadmap §C — turn ProjectChecklist from a generated checklist into a task
-- list, without splitting it into a second system.
--
-- Every column here is nullable or defaulted, so existing rows stay valid and
-- no backfill is required. One exception is handled below: template_id is
-- backfilled by label match so that rows generated before this migration are
-- still recognised as template rows by the sync dedup.
--
-- Deliberately NOT in this migration, and why:
--   due_has_time   — no UI offers a time picker, so every due_at lands at
--                    midnight. Adding the flag later leaves all existing rows
--                    already correct.
--   completed_at   — AuditLog already records TOGGLE_CHECKLIST with user_id
--   completed_by   and created_at. Backfillable from there if ever needed.
--   notes          — Comment.task_id covers it, and brings author + attachments.

-- ---------------------------------------------------------------------------
-- 1. ProjectChecklist — task columns
-- ---------------------------------------------------------------------------

ALTER TABLE studioflow."ProjectChecklist"
    ADD COLUMN IF NOT EXISTS "parent_id"      TEXT,
    ADD COLUMN IF NOT EXISTS "sort_order"     INTEGER      NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "priority"       INTEGER      NOT NULL DEFAULT 4,
    ADD COLUMN IF NOT EXISTS "due_at"         TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "assigned_to_id" TEXT,
    ADD COLUMN IF NOT EXISTS "template_id"    TEXT,
    ADD COLUMN IF NOT EXISTS "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Subtask parent. Cascade, not SetNull: an orphaned subtask is worse than a
-- deleted one, because it silently rejoins the root list and starts holding up
-- phase approval on its own.
ALTER TABLE studioflow."ProjectChecklist"
    DROP CONSTRAINT IF EXISTS "ProjectChecklist_parent_id_fkey";
ALTER TABLE studioflow."ProjectChecklist"
    ADD CONSTRAINT "ProjectChecklist_parent_id_fkey"
    FOREIGN KEY ("parent_id")
    REFERENCES studioflow."ProjectChecklist"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE studioflow."ProjectChecklist"
    DROP CONSTRAINT IF EXISTS "ProjectChecklist_assigned_to_id_fkey";
ALTER TABLE studioflow."ProjectChecklist"
    ADD CONSTRAINT "ProjectChecklist_assigned_to_id_fkey"
    FOREIGN KEY ("assigned_to_id")
    REFERENCES studioflow."User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- SetNull on template delete: the row may already be ticked, and deleting it
-- would throw away completed work. It becomes a plain user task instead.
ALTER TABLE studioflow."ProjectChecklist"
    DROP CONSTRAINT IF EXISTS "ProjectChecklist_template_id_fkey";
ALTER TABLE studioflow."ProjectChecklist"
    ADD CONSTRAINT "ProjectChecklist_template_id_fkey"
    FOREIGN KEY ("template_id")
    REFERENCES studioflow."ChecklistTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ProjectChecklist_project_id_parent_id_idx"
    ON studioflow."ProjectChecklist"("project_id", "parent_id");
CREATE INDEX IF NOT EXISTS "ProjectChecklist_phase_id_is_checked_idx"
    ON studioflow."ProjectChecklist"("phase_id", "is_checked");
CREATE INDEX IF NOT EXISTS "ProjectChecklist_assigned_to_id_idx"
    ON studioflow."ProjectChecklist"("assigned_to_id");

-- ---------------------------------------------------------------------------
-- 2. Backfill template_id for rows generated before this migration
-- ---------------------------------------------------------------------------
--
-- Until now the only way a row could exist was template generation or the
-- addChecklistItem action — and that action has no caller in the UI, so in
-- practice every existing row came from a template. Matching on label is the
-- only signal available retroactively; it is exactly the identity the old dedup
-- used, so this reproduces the status quo rather than guessing.
--
-- Ambiguous labels (two active templates sharing a label for the same phase)
-- are left NULL on purpose. A NULL there means "treated as a user task": sync
-- may re-create the template row alongside it, which is visible and fixable.
-- Picking one template arbitrarily would be invisible and wrong.

UPDATE studioflow."ProjectChecklist" pc
SET "template_id" = t."id"
FROM studioflow."ChecklistTemplate" t
WHERE pc."template_id" IS NULL
  AND pc."label" = t."label"
  AND (
        SELECT COUNT(*)
        FROM studioflow."ChecklistTemplate" t2
        WHERE t2."label" = pc."label"
      ) = 1;

-- ---------------------------------------------------------------------------
-- 3. Seed sort_order from insertion order
-- ---------------------------------------------------------------------------
--
-- created_at was just added, so every existing row shares the same default
-- timestamp and cannot break the tie. Ordering by label reproduces what the
-- overview component was already showing on screen; the phase view was ordering
-- by UUID and therefore showing no meaningful order at all.

WITH ordered AS (
    SELECT "id",
           ROW_NUMBER() OVER (
               PARTITION BY "project_id", COALESCE("phase_id", '')
               ORDER BY "label" ASC
           ) AS rn
    FROM studioflow."ProjectChecklist"
)
UPDATE studioflow."ProjectChecklist" pc
SET "sort_order" = ordered.rn * 10
FROM ordered
WHERE pc."id" = ordered."id";

-- ---------------------------------------------------------------------------
-- 4. Labels
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS studioflow."ChecklistLabel" (
    "id"    TEXT NOT NULL,
    "name"  TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'slate',

    CONSTRAINT "ChecklistLabel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ChecklistLabel_name_key"
    ON studioflow."ChecklistLabel"("name");

CREATE TABLE IF NOT EXISTS studioflow."ChecklistLabelOnItem" (
    "checklist_id" TEXT NOT NULL,
    "label_id"     TEXT NOT NULL,

    CONSTRAINT "ChecklistLabelOnItem_pkey" PRIMARY KEY ("checklist_id", "label_id")
);

CREATE INDEX IF NOT EXISTS "ChecklistLabelOnItem_label_id_idx"
    ON studioflow."ChecklistLabelOnItem"("label_id");

ALTER TABLE studioflow."ChecklistLabelOnItem"
    DROP CONSTRAINT IF EXISTS "ChecklistLabelOnItem_checklist_id_fkey";
ALTER TABLE studioflow."ChecklistLabelOnItem"
    ADD CONSTRAINT "ChecklistLabelOnItem_checklist_id_fkey"
    FOREIGN KEY ("checklist_id")
    REFERENCES studioflow."ProjectChecklist"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE studioflow."ChecklistLabelOnItem"
    DROP CONSTRAINT IF EXISTS "ChecklistLabelOnItem_label_id_fkey";
ALTER TABLE studioflow."ChecklistLabelOnItem"
    ADD CONSTRAINT "ChecklistLabelOnItem_label_id_fkey"
    FOREIGN KEY ("label_id")
    REFERENCES studioflow."ChecklistLabel"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- 5. Comment.task_id — wire the dangling column
-- ---------------------------------------------------------------------------
--
-- The column has existed without a relation since it was first added. Any row
-- holding a task_id that points at nothing would now violate the FK, so those
-- are cleared first. In practice there are none: nothing ever wrote to it.

UPDATE studioflow."Comment" c
SET "task_id" = NULL
WHERE c."task_id" IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM studioflow."ProjectChecklist" pc WHERE pc."id" = c."task_id"
  );

ALTER TABLE studioflow."Comment"
    DROP CONSTRAINT IF EXISTS "Comment_task_id_fkey";
ALTER TABLE studioflow."Comment"
    ADD CONSTRAINT "Comment_task_id_fkey"
    FOREIGN KEY ("task_id")
    REFERENCES studioflow."ProjectChecklist"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "Comment_task_id_idx"
    ON studioflow."Comment"("task_id");
