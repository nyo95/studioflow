-- Additive only: preserves every existing SketchUp material and catalog snapshot.
ALTER TABLE "SketchupMaterial"
ADD COLUMN "reference_url" TEXT;
