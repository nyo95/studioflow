-- Owner feedback 2026-08-18, item 5: Brand gets a free-form "hashtag" field,
-- separate from Category. Category stays the curated ~40-option checklist
-- (brand-catalog-categories.json); tags is the general, organically-grown
-- pool (e.g. "batu", "batu buatan", "tegel murah", "finishing lantai") edited
-- via the same CreatableTagInput control already used for SKU-level tags.
--
-- No join table: unlike Category, a brand tag is not shared/normalised across
-- entities and doesn't need slugs or FK integrity — it is scoped to the one
-- Brand row, same shape as Sku.spec free text.

ALTER TABLE master_data."Brand"
    ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT '{}';
