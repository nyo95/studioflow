-- MATERIAL SSOT CONSOLIDATION
--
-- Goal: make Master Data the single source of truth for material identity and
-- pricing, so BQ can read one place. Three moves, in dependency order.
--
-- SAFETY POSTURE
-- --------------
-- Every statement here is either relaxing (DROP NOT NULL), additive (ADD
-- COLUMN / CREATE TABLE), or a namespace move (SET SCHEMA). There is no DROP
-- TABLE, no DROP COLUMN, no DELETE and no UPDATE of existing values. Row counts
-- are identical before and after.
--
-- SET SCHEMA is used rather than letting Prisma generate a @@schema change,
-- because Prisma's generated migration for that drops and recreates the table,
-- which would destroy the 5 ProductCatalog rows, their foreign keys and their
-- audit history. PostgreSQL moves the table in place and carries every
-- constraint, index and FK with it.
--
-- WHAT DOES NOT BREAK
-- -------------------
-- ProjectScheduleOption, ProjectProductRequest and PhysicalSample keep their
-- foreign keys into ProductCatalog; they simply become cross-schema. That is
-- valid PostgreSQL and is the reason the single-instance/three-schema topology
-- was chosen over three databases (MASTER_SSOT §6.3). Project schedules are
-- additionally protected by their frozen `data_snapshot`.
--
-- RUN ORDER: this migration only prepares structure. The 483 VendorOffering
-- rows are moved by `scripts/migrate-offerings-to-materials.mjs` afterwards,
-- as a reviewed, audited, idempotent transaction — not by this SQL, because
-- each inserted row needs an AuditLog entry with a real actor.

-- ---------------------------------------------------------------------------
-- 1. Relax the two columns that blocked offering-level rows.
-- ---------------------------------------------------------------------------
-- These were the schema conflict raised at the very start of the material work
-- and deferred three times. 483 supplier-capability rows have neither a SKU nor
-- a colour, and fabricating them (`LEGACY-*`, `N/A`) is forbidden.
--
-- The APPROVED gate is NOT weakened: it is enforced by
-- CatalogApprovalValidationSchema (src/extensions/library/types.ts), which
-- requires catalog_color, catalog_image_url, vendor_id and at least one of
-- SKU/name before a row may become APPROVED.

ALTER TABLE "studioflow"."ProductCatalog"
  ALTER COLUMN "catalog_sku" DROP NOT NULL,
  ALTER COLUMN "catalog_color" DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Pricing + offering provenance columns.
-- ---------------------------------------------------------------------------
-- Pricing is held inline on the material row because the owner asked for it to
-- be editable directly there, and because schedule-service.ts already reads
-- catalog_price in six places.
--
-- catalog_price_unit has no default on purpose. A rate without a unit cannot be
-- estimated against, and defaulting it to 'pcs' would silently corrupt BQ
-- quantities for tiles sold per m2.

ALTER TABLE "studioflow"."ProductCatalog"
  ADD COLUMN IF NOT EXISTS "catalog_vendor_price" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "catalog_price_unit" TEXT,
  ADD COLUMN IF NOT EXISTS "catalog_price_updated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "source_offering_id" TEXT;

-- Traces a migrated row back to its VendorOffering source. UNIQUE makes the
-- data migration idempotent: a second run cannot create a duplicate material
-- for an offering that already has one.
CREATE UNIQUE INDEX IF NOT EXISTS "ProductCatalog_source_offering_id_key"
  ON "studioflow"."ProductCatalog"("source_offering_id");

CREATE INDEX IF NOT EXISTS "ProductCatalog_catalog_status_idx"
  ON "studioflow"."ProductCatalog"("catalog_status");

-- ---------------------------------------------------------------------------
-- 3. Move material identity into master_data.
-- ---------------------------------------------------------------------------
-- Done last so the column changes above apply to the table at its old address
-- and cannot half-apply across the move.

ALTER TABLE "studioflow"."ProductCatalog" SET SCHEMA "master_data";

-- ---------------------------------------------------------------------------
-- 4. Service rates (harga jasa) — new, empty.
-- ---------------------------------------------------------------------------
-- Not linked to Vendor: a service rate is the studio's own labour cost, not a
-- supplier quote.

CREATE TABLE IF NOT EXISTS "master_data"."ServicePrice" (
  "id"         TEXT NOT NULL,
  "code"       TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "category"   TEXT NOT NULL,
  "unit"       TEXT NOT NULL,
  "price"      DOUBLE PRECISION NOT NULL,
  "scope_note" TEXT,
  "is_active"  BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3),

  CONSTRAINT "ServicePrice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ServicePrice_code_key"
  ON "master_data"."ServicePrice"("code");

CREATE INDEX IF NOT EXISTS "ServicePrice_category_idx"
  ON "master_data"."ServicePrice"("category");

CREATE INDEX IF NOT EXISTS "ServicePrice_is_active_idx"
  ON "master_data"."ServicePrice"("is_active");
