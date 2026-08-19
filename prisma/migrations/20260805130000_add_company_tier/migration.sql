-- Company tier above Brand — R7, 2026-08-05
-- =============================================================================
-- Additive only. Introduces:
--   master_data.Company          — trading entity that owns ≥1 Brands
--   master_data.CompanyContact   — contacts at company level
--   master_data.CompanyLink      — links/drive/website at company level
--   master_data.Vendor.company_id — nullable FK; existing rows stay NULL
--
-- Rationale: "brand/company/PT sama aja" (§6.11) broke for multi-brand
-- suppliers (Aica → Aica HPL, Cerarl, Aibon) and for cases where company
-- name ≠ brand name (Carta → Vivere Group). See PLAN-AUDIT-ROADMAP §2.7.
--
-- No backfill required. Brand.company_id is nullable so every existing Brand
-- row keeps working. Staff assigns brands to companies via the Master Data UI.
-- =============================================================================

-- Company
CREATE TABLE "master_data"."Company" (
    "id"         TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
    "name"       TEXT         NOT NULL,
    "legal_name" TEXT,
    "address"    TEXT,
    "notes"      TEXT,
    "is_active"  BOOLEAN      NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_name_key"    ON "master_data"."Company"("name");
CREATE INDEX        "Company_deleted_at_idx" ON "master_data"."Company"("deleted_at");

-- CompanyContact
CREATE TABLE "master_data"."CompanyContact" (
    "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "company_id"     TEXT NOT NULL,
    "contact_person" TEXT NOT NULL,
    "contact_role"   TEXT,
    "phone_number"   TEXT,
    "email"          TEXT,
    CONSTRAINT "CompanyContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyContact_company_id_idx" ON "master_data"."CompanyContact"("company_id");

ALTER TABLE "master_data"."CompanyContact"
    ADD CONSTRAINT "CompanyContact_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "master_data"."Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- CompanyLink
CREATE TABLE "master_data"."CompanyLink" (
    "id"         TEXT    NOT NULL DEFAULT gen_random_uuid()::text,
    "company_id" TEXT    NOT NULL,
    "kind"       "master_data"."VendorLinkKind" NOT NULL,
    "url"        TEXT    NOT NULL,
    "label"      TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "CompanyLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyLink_company_id_url_key" ON "master_data"."CompanyLink"("company_id", "url");
CREATE INDEX        "CompanyLink_company_id_idx"     ON "master_data"."CompanyLink"("company_id");

ALTER TABLE "master_data"."CompanyLink"
    ADD CONSTRAINT "CompanyLink_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "master_data"."Company"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Brand.company_id (nullable FK)
ALTER TABLE "master_data"."Vendor" ADD COLUMN "company_id" TEXT;

CREATE INDEX "Vendor_company_id_idx" ON "master_data"."Vendor"("company_id");

ALTER TABLE "master_data"."Vendor"
    ADD CONSTRAINT "Vendor_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "master_data"."Company"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
