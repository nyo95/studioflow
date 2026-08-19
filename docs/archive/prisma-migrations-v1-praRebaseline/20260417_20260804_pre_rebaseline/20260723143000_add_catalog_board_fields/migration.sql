-- Catalog Board StudioFlow-side editable fields.
-- IF NOT EXISTS keeps this migration safe for development databases that were
-- previously aligned with prisma db push rather than the migration baseline.
ALTER TABLE "SketchupMaterial"
  ADD COLUMN IF NOT EXISTS "item_no" TEXT,
  ADD COLUMN IF NOT EXISTS "qty" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "unit" TEXT,
  ADD COLUMN IF NOT EXISTS "color_size" TEXT,
  ADD COLUMN IF NOT EXISTS "unit_cost" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "catalog_fields" JSONB;