-- C12: Add SkuCategory join table — replaces catalog_tags String[] as the
-- canonical SKU-level category store.
--
-- catalog_tags is intentionally NOT dropped here: library-service.ts and
-- schedule-snapshot code still read it. Switch those reads to SkuCategory,
-- verify, then drop the column in a follow-up migration.
--
-- Backfill: run scripts/backfill-sku-categories.mjs after applying.

CREATE TABLE IF NOT EXISTS master_data."SkuCategory" (
    "id"          TEXT        NOT NULL,
    "sku_id"      TEXT        NOT NULL,
    "category_id" TEXT        NOT NULL,
    "sort_order"  INTEGER     NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkuCategory_pkey" PRIMARY KEY ("id")
);

-- FK → master_data.Material (Sku)
ALTER TABLE master_data."SkuCategory"
    ADD CONSTRAINT "SkuCategory_sku_id_fkey"
    FOREIGN KEY ("sku_id")
    REFERENCES master_data."Material"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- FK → master_data.Category
ALTER TABLE master_data."SkuCategory"
    ADD CONSTRAINT "SkuCategory_category_id_fkey"
    FOREIGN KEY ("category_id")
    REFERENCES master_data."Category"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Unique constraint: one row per (sku, category) pair
CREATE UNIQUE INDEX IF NOT EXISTS "SkuCategory_sku_id_category_id_key"
    ON master_data."SkuCategory"("sku_id", "category_id");

-- Index for category → SKU lookups (Library search)
CREATE INDEX IF NOT EXISTS "SkuCategory_category_id_idx"
    ON master_data."SkuCategory"("category_id");

-- Index for ordered category fetch per SKU
CREATE INDEX IF NOT EXISTS "SkuCategory_sku_id_sort_order_idx"
    ON master_data."SkuCategory"("sku_id", "sort_order");
