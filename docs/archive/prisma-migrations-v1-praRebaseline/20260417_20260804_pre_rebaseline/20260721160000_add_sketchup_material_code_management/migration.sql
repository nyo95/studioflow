-- Keep code reservations and the exact order of queued SketchUp material actions.
ALTER TABLE "SketchupMaterial"
ADD COLUMN "is_reserved" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "SketchupMergeAction"
ADD COLUMN "queue_order" INTEGER NOT NULL DEFAULT 0;
