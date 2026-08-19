-- SERVICE VENDOR — "Vendor" reclaimed for the services side.
--
-- Terminology fixed 31 Jul 2026 by the owner: for a Material the relational
-- party is a BRAND; "Vendor" means a service provider (tukang, applicator,
-- contractor, workshop) who performs work and quotes a rate.
--
-- STRICTLY ADDITIVE. This migration:
--   * creates one new table, master_data."ServiceVendor";
--   * adds one NULLABLE column, master_data."ServicePrice"."service_vendor_id";
--   * adds one ON DELETE SET NULL foreign key and two indexes.
--
-- It does NOT rename master_data."Vendor" (which is `model Brand`), does NOT
-- touch Material, Sample, MaterialCandidate, SampleCandidate, or anything in
-- the studioflow schema, and does NOT delete or rewrite a single existing row.
-- The Vendor->Brand change made alongside it is a UI/terminology change only.
--
-- Renaming the physical "Vendor" table was considered and rejected: every
-- Material, MaterialCandidate, VendorContact and VendorLink foreign key points
-- at it, and `ProjectScheduleOption.data_snapshot` freezes `catalog_*` keys for
-- existing projects. A rename buys nothing the Prisma-level name (`model
-- Brand`) does not already give.

CREATE TABLE "master_data"."ServiceVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "trade" TEXT,
    "phone_number" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "ServiceVendor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceVendor_name_key"
ON "master_data"."ServiceVendor"("name");

CREATE INDEX "ServiceVendor_is_active_idx"
ON "master_data"."ServiceVendor"("is_active");

CREATE INDEX "ServiceVendor_deleted_at_idx"
ON "master_data"."ServiceVendor"("deleted_at");

-- NULLABLE on purpose. The studio carries its own internal labour rates that
-- belong to no external provider, and every ServicePrice row predating this
-- column has no provider recorded. NULL means "internal studio rate", which is
-- exactly what the ServicePrice docblock used to assert for every row.
ALTER TABLE "master_data"."ServicePrice"
ADD COLUMN "service_vendor_id" TEXT;

CREATE INDEX "ServicePrice_service_vendor_id_idx"
ON "master_data"."ServicePrice"("service_vendor_id");

-- SET NULL, not CASCADE: removing a provider must not silently delete the rate
-- history that BQ line items may already reference by `code`.
ALTER TABLE "master_data"."ServicePrice"
ADD CONSTRAINT "ServicePrice_service_vendor_id_fkey"
FOREIGN KEY ("service_vendor_id") REFERENCES "master_data"."ServiceVendor"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
