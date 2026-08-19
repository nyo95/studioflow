-- Additive review-only staging for incomplete workbook evidence.
-- Canonical Material and Sample constraints remain unchanged: promotion is
-- explicit and only succeeds after required identity/linkage is complete.

CREATE TYPE "master_data"."CurationCandidateStatus"
AS ENUM ('PENDING', 'DISMISSED', 'PROMOTED');

CREATE TABLE "master_data"."MaterialCandidate" (
    "id" TEXT NOT NULL,
    "candidate_key" TEXT NOT NULL,
    "source_context" TEXT NOT NULL,
    "source_sheet" TEXT NOT NULL,
    "source_rows" TEXT NOT NULL,
    "source_checksum" TEXT NOT NULL,
    "vendor_key_candidate" TEXT,
    "candidate_vendor_id" TEXT,
    "confirmed_vendor_id" TEXT,
    "brand_candidate" TEXT,
    "brand_confirmed" TEXT,
    "category_tags_candidate" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "category_tags_confirmed" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "source_product_or_type" TEXT,
    "product_name_confirmed" TEXT,
    "sku_confirmed" TEXT,
    "motif_candidate" TEXT,
    "reference_url_candidate" TEXT,
    "folder_url_candidate" TEXT,
    "price_before_discount" DOUBLE PRECISION,
    "price_after_discount" DOUBLE PRECISION,
    "price_unit" TEXT,
    "review_status" "master_data"."CurationCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "blocker_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decision_notes" TEXT,
    "promoted_material_id" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialCandidate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "master_data"."SampleCandidate" (
    "id" TEXT NOT NULL,
    "sample_candidate_key" TEXT NOT NULL,
    "source_sheet" TEXT NOT NULL,
    "source_row" INTEGER NOT NULL,
    "source_no" TEXT,
    "source_category" TEXT,
    "source_brand" TEXT,
    "source_type" TEXT,
    "source_motif" TEXT,
    "vendor_key_candidate" TEXT,
    "material_candidate_id" TEXT,
    "confirmed_material_id" TEXT,
    "rack_number" TEXT NOT NULL,
    "box_number" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status_candidate" TEXT,
    "confirmed_status" "studioflow"."SampleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "current_borrower_name" TEXT,
    "notes" TEXT,
    "review_status" "master_data"."CurationCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "blocker_reasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "decision_notes" TEXT,
    "source_checksum" TEXT NOT NULL,
    "promoted_sample_id" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SampleCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MaterialCandidate_candidate_key_key"
ON "master_data"."MaterialCandidate"("candidate_key");

CREATE UNIQUE INDEX "MaterialCandidate_promoted_material_id_key"
ON "master_data"."MaterialCandidate"("promoted_material_id");

CREATE INDEX "MaterialCandidate_review_status_idx"
ON "master_data"."MaterialCandidate"("review_status");

CREATE INDEX "MaterialCandidate_candidate_vendor_id_idx"
ON "master_data"."MaterialCandidate"("candidate_vendor_id");

CREATE INDEX "MaterialCandidate_confirmed_vendor_id_idx"
ON "master_data"."MaterialCandidate"("confirmed_vendor_id");

CREATE INDEX "MaterialCandidate_source_sheet_idx"
ON "master_data"."MaterialCandidate"("source_sheet");

CREATE UNIQUE INDEX "SampleCandidate_sample_candidate_key_key"
ON "master_data"."SampleCandidate"("sample_candidate_key");

CREATE UNIQUE INDEX "SampleCandidate_promoted_sample_id_key"
ON "master_data"."SampleCandidate"("promoted_sample_id");

CREATE INDEX "SampleCandidate_review_status_idx"
ON "master_data"."SampleCandidate"("review_status");

CREATE INDEX "SampleCandidate_material_candidate_id_idx"
ON "master_data"."SampleCandidate"("material_candidate_id");

CREATE INDEX "SampleCandidate_confirmed_material_id_idx"
ON "master_data"."SampleCandidate"("confirmed_material_id");

CREATE INDEX "SampleCandidate_source_sheet_source_row_idx"
ON "master_data"."SampleCandidate"("source_sheet", "source_row");

ALTER TABLE "master_data"."MaterialCandidate"
ADD CONSTRAINT "MaterialCandidate_candidate_vendor_id_fkey"
FOREIGN KEY ("candidate_vendor_id") REFERENCES "master_data"."Vendor"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "master_data"."MaterialCandidate"
ADD CONSTRAINT "MaterialCandidate_confirmed_vendor_id_fkey"
FOREIGN KEY ("confirmed_vendor_id") REFERENCES "master_data"."Vendor"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "master_data"."MaterialCandidate"
ADD CONSTRAINT "MaterialCandidate_promoted_material_id_fkey"
FOREIGN KEY ("promoted_material_id") REFERENCES "master_data"."Material"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "master_data"."SampleCandidate"
ADD CONSTRAINT "SampleCandidate_material_candidate_id_fkey"
FOREIGN KEY ("material_candidate_id") REFERENCES "master_data"."MaterialCandidate"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "master_data"."SampleCandidate"
ADD CONSTRAINT "SampleCandidate_confirmed_material_id_fkey"
FOREIGN KEY ("confirmed_material_id") REFERENCES "master_data"."Material"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "master_data"."SampleCandidate"
ADD CONSTRAINT "SampleCandidate_promoted_sample_id_fkey"
FOREIGN KEY ("promoted_sample_id") REFERENCES "master_data"."Sample"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
