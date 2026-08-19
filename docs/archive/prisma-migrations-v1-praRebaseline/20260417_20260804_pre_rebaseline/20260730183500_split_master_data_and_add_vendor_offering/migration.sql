-- Physical schema split for the three application domains.
--
-- IMPORTANT:
-- Prisma's generated migration for a @@schema move drops and recreates the
-- table. This migration deliberately uses PostgreSQL SET SCHEMA instead, so
-- rows, indexes and foreign keys keep their identities and data.

CREATE SCHEMA IF NOT EXISTS "studioflow";
CREATE SCHEMA IF NOT EXISTS "master_data";
CREATE SCHEMA IF NOT EXISTS "bq";

-- Enum types used by StudioFlow models.
ALTER TYPE "public"."ActivityMode" SET SCHEMA "studioflow";
ALTER TYPE "public"."ActivityStatus" SET SCHEMA "studioflow";
ALTER TYPE "public"."CDItemStatus" SET SCHEMA "studioflow";
ALTER TYPE "public"."LibraryItemStatus" SET SCHEMA "studioflow";
ALTER TYPE "public"."MomListStyle" SET SCHEMA "studioflow";
ALTER TYPE "public"."MomPointStyle" SET SCHEMA "studioflow";
ALTER TYPE "public"."PhaseName" SET SCHEMA "studioflow";
ALTER TYPE "public"."PhaseStatus" SET SCHEMA "studioflow";
ALTER TYPE "public"."ProductRequestStatus" SET SCHEMA "studioflow";
ALTER TYPE "public"."ProductType" SET SCHEMA "studioflow";
ALTER TYPE "public"."ProjectPriority" SET SCHEMA "studioflow";
ALTER TYPE "public"."ProjectStatus" SET SCHEMA "studioflow";
ALTER TYPE "public"."RenderLabelSide" SET SCHEMA "studioflow";
ALTER TYPE "public"."RevisionStatus" SET SCHEMA "studioflow";
ALTER TYPE "public"."Role" SET SCHEMA "studioflow";
ALTER TYPE "public"."SampleAction" SET SCHEMA "studioflow";
ALTER TYPE "public"."SampleStatus" SET SCHEMA "studioflow";
ALTER TYPE "public"."ScheduleOptionStatus" SET SCHEMA "studioflow";
ALTER TYPE "public"."TimelineStatus" SET SCHEMA "studioflow";

-- StudioFlow-owned tables. _prisma_migrations intentionally stays in public.
ALTER TABLE "public"."Activity" SET SCHEMA "studioflow";
ALTER TABLE "public"."AuditLog" SET SCHEMA "studioflow";
ALTER TABLE "public"."CDList" SET SCHEMA "studioflow";
ALTER TABLE "public"."ChecklistTemplate" SET SCHEMA "studioflow";
ALTER TABLE "public"."Client" SET SCHEMA "studioflow";
ALTER TABLE "public"."Comment" SET SCHEMA "studioflow";
ALTER TABLE "public"."File" SET SCHEMA "studioflow";
ALTER TABLE "public"."Phase" SET SCHEMA "studioflow";
ALTER TABLE "public"."PhysicalSample" SET SCHEMA "studioflow";
ALTER TABLE "public"."PrefixDictionary" SET SCHEMA "studioflow";
ALTER TABLE "public"."ProductCatalog" SET SCHEMA "studioflow";
ALTER TABLE "public"."Project" SET SCHEMA "studioflow";
ALTER TABLE "public"."ProjectChecklist" SET SCHEMA "studioflow";
ALTER TABLE "public"."ProjectMomDocument" SET SCHEMA "studioflow";
ALTER TABLE "public"."ProjectMomImage" SET SCHEMA "studioflow";
ALTER TABLE "public"."ProjectMomItem" SET SCHEMA "studioflow";
ALTER TABLE "public"."ProjectMomPoint" SET SCHEMA "studioflow";
ALTER TABLE "public"."ProjectProductRequest" SET SCHEMA "studioflow";
ALTER TABLE "public"."ProjectScheduleEntry" SET SCHEMA "studioflow";
ALTER TABLE "public"."ProjectScheduleOption" SET SCHEMA "studioflow";
ALTER TABLE "public"."ProjectTimeline" SET SCHEMA "studioflow";
ALTER TABLE "public"."PromotionRequest" SET SCHEMA "studioflow";
ALTER TABLE "public"."RenderAnnotation" SET SCHEMA "studioflow";
ALTER TABLE "public"."RenderBoard" SET SCHEMA "studioflow";
ALTER TABLE "public"."Revision" SET SCHEMA "studioflow";
ALTER TABLE "public"."SampleMovementLog" SET SCHEMA "studioflow";
ALTER TABLE "public"."ScheduleTemplate" SET SCHEMA "studioflow";
ALTER TABLE "public"."SketchupFFE" SET SCHEMA "studioflow";
ALTER TABLE "public"."SketchupMaterial" SET SCHEMA "studioflow";
ALTER TABLE "public"."SketchupMergeAction" SET SCHEMA "studioflow";
ALTER TABLE "public"."SketchupProject" SET SCHEMA "studioflow";
ALTER TABLE "public"."SystemConfig" SET SCHEMA "studioflow";
ALTER TABLE "public"."TemporaryAttachment" SET SCHEMA "studioflow";
ALTER TABLE "public"."TimelineTemplate" SET SCHEMA "studioflow";
ALTER TABLE "public"."User" SET SCHEMA "studioflow";

-- Supplier identity belongs to Master Data.
ALTER TABLE "public"."Vendor" SET SCHEMA "master_data";
ALTER TABLE "public"."VendorContact" SET SCHEMA "master_data";

CREATE INDEX "VendorContact_vendor_id_idx"
ON "master_data"."VendorContact"("vendor_id");

-- Supplier offerings are intentionally broader than approved catalog SKUs.
CREATE TYPE "master_data"."VendorOfferingJessStatus" AS ENUM (
  'VERIFIED_GREEN',
  'INACTIVE_RED',
  'UNREACHABLE_DARKRED',
  'UNCERTAIN_PEACH',
  'UNVERIFIED_WHITE',
  'UNVERIFIED_NONE'
);

CREATE TYPE "master_data"."VendorOfferingStatus" AS ENUM (
  'ACTIVE',
  'ARCHIVED'
);

CREATE TABLE "master_data"."VendorOffering" (
  "id" TEXT NOT NULL,
  "vendor_id" TEXT NOT NULL,
  "category_raw" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "product_family_name" TEXT,
  "reference_url" TEXT,
  "folder_url" TEXT,
  "source_notes" TEXT,
  "jess_status" "master_data"."VendorOfferingJessStatus" NOT NULL DEFAULT 'UNVERIFIED_NONE',
  "curated_by" TEXT,
  "active_status" "master_data"."VendorOfferingStatus" NOT NULL DEFAULT 'ACTIVE',
  "verified_at" TIMESTAMP(3),
  "source_sheet" TEXT NOT NULL,
  "source_row" INTEGER NOT NULL,
  "source_checksum" TEXT NOT NULL,
  "needs_review_multiline" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VendorOffering_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VendorOffering_vendor_id_fkey"
    FOREIGN KEY ("vendor_id")
    REFERENCES "master_data"."Vendor"("id")
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "VendorOffering_source_checksum_source_sheet_source_row_key"
ON "master_data"."VendorOffering"("source_checksum", "source_sheet", "source_row");

CREATE INDEX "VendorOffering_vendor_id_idx"
ON "master_data"."VendorOffering"("vendor_id");

CREATE INDEX "VendorOffering_active_status_idx"
ON "master_data"."VendorOffering"("active_status");

CREATE INDEX "VendorOffering_jess_status_idx"
ON "master_data"."VendorOffering"("jess_status");
