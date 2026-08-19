-- REBASELINE, 5 Aug 2026.
--
-- The migration history through 20260804140000 could not be replayed from an
-- empty database: several tables (the Sketchup* tables, and MaterialCatalog's
-- predecessor of ProductCatalog, plus a handful of PhysicalSample columns)
-- were originally provisioned via `prisma db push` rather than tracked
-- migrations, so later ALTER TABLE statements assumed structure that no
-- earlier migration ever created. This is the second time this project has
-- hit that problem — see prisma/migrations_archive/20260101_initial_state for
-- the first rebaseline.
--
-- This single migration was generated with
-- `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`
-- against a live database independently confirmed to have zero drift from
-- schema.prisma (`prisma migrate diff --from-config-datasource --to-schema
-- prisma/schema.prisma` reported "No difference detected"), so it reproduces
-- the actual current schema exactly rather than a guess. All 21 prior
-- migrations (20260417032114 through 20260804140000) are preserved for
-- historical record in prisma/migrations_archive/20260417_20260804_pre_rebaseline/.
--
-- Any other environment (staging/production) already on schema
-- 20260804140000 must run `prisma migrate resolve --applied
-- 20260805100000_rebaseline_current_schema` BEFORE the next `prisma migrate
-- deploy` — otherwise deploy will try to execute this CREATE-everything
-- script against a database that already has every table.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "master_data";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "studioflow";

-- CreateEnum
CREATE TYPE "master_data"."VendorLinkKind" AS ENUM ('WEBSITE', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'WHATSAPP', 'MARKETPLACE', 'CATALOG', 'DRIVE', 'PRICE_LIST', 'OTHER');

-- CreateEnum
CREATE TYPE "master_data"."CurationCandidateStatus" AS ENUM ('PENDING', 'DISMISSED', 'PROMOTED');

-- CreateEnum
CREATE TYPE "studioflow"."TimelineStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "studioflow"."MomListStyle" AS ENUM ('decimal', 'disc', 'dash', 'none');

-- CreateEnum
CREATE TYPE "studioflow"."MomPointStyle" AS ENUM ('default', 'none');

-- CreateEnum
CREATE TYPE "studioflow"."Role" AS ENUM ('ADMIN', 'OWNER', 'DIC', 'DRIC', 'STAFF', 'CURATOR', 'ESTIMATOR');

-- CreateEnum
CREATE TYPE "studioflow"."PhaseName" AS ENUM ('MOODBOARD', 'LAYOUT', 'DESIGN_3D', 'CD', 'SUPERVISION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "studioflow"."ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "studioflow"."ProjectPriority" AS ENUM ('URGENT', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "studioflow"."PhaseStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'ON_REVIEW_INTERNAL', 'APPROVED_INTERNAL', 'ON_REVIEW_CLIENT', 'READY_FOR_NEXT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "studioflow"."RevisionStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "studioflow"."ActivityStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "studioflow"."ActivityMode" AS ENUM ('TODO', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "studioflow"."CDItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "studioflow"."LibraryItemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "studioflow"."ProductRequestStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'RECEIVED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "studioflow"."ScheduleOptionStatus" AS ENUM ('DRAFT', 'APPROVED', 'NOT_USED');

-- CreateEnum
CREATE TYPE "studioflow"."ProductType" AS ENUM ('material', 'fixture');

-- CreateEnum
CREATE TYPE "studioflow"."SampleAction" AS ENUM ('IN', 'OUT', 'TRANSFER', 'REJECT', 'CHECK_IN', 'CHECK_OUT', 'AUDITED', 'BORROW', 'RETURN');

-- CreateEnum
CREATE TYPE "studioflow"."SampleStatus" AS ENUM ('AVAILABLE', 'BORROWED', 'SENT_TO_CLIENT');

-- CreateEnum
CREATE TYPE "studioflow"."RenderLabelSide" AS ENUM ('auto', 'left', 'right');

-- CreateTable
CREATE TABLE "studioflow"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "studioflow"."Role" NOT NULL DEFAULT 'STAFF',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "logo_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."Project" (
    "id" TEXT NOT NULL,
    "project_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pic_designer_id" TEXT NOT NULL,
    "pic_drafter_id" TEXT NOT NULL,
    "clientId" TEXT,
    "opening_date" TIMESTAMP(3),
    "core_project_type" TEXT NOT NULL DEFAULT 'RETAIL',
    "status_progress" "studioflow"."ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" "studioflow"."ProjectPriority" NOT NULL DEFAULT 'NORMAL',
    "client_contact" TEXT,
    "address" TEXT,
    "area" DOUBLE PRECISION,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."Phase" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name_enum" "studioflow"."PhaseName" NOT NULL,
    "status_enum" "studioflow"."PhaseStatus" NOT NULL DEFAULT 'PENDING',
    "order_index" INTEGER NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "allow_parallel" BOOLEAN NOT NULL DEFAULT false,
    "status_changed_at" TIMESTAMP(3),

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."Revision" (
    "id" TEXT NOT NULL,
    "phase_id" TEXT NOT NULL,
    "major" INTEGER NOT NULL DEFAULT 1,
    "minor" INTEGER NOT NULL DEFAULT 0,
    "status_enum" "studioflow"."RevisionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."Activity" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "revision_id" TEXT,
    "content" TEXT NOT NULL,
    "mode" "studioflow"."ActivityMode" NOT NULL DEFAULT 'TODO',
    "status" "studioflow"."ActivityStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_id" TEXT,
    "phase_id" TEXT,
    "deferred_from_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."File" (
    "id" TEXT NOT NULL,
    "revision_id" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "link_url" TEXT,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "phase_id" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reverted_at" TIMESTAMP(3),

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."ProjectTimeline" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "studioflow"."TimelineStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "phase_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."TimelineTemplate" (
    "id" TEXT NOT NULL,
    "phase_enum" TEXT NOT NULL,
    "duration_days" INTEGER NOT NULL DEFAULT 7,

    CONSTRAINT "TimelineTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "phase_enum" TEXT,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."SystemConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "app_title" TEXT NOT NULL DEFAULT 'StudioFlow',
    "is_auto_naming_enabled" BOOLEAN NOT NULL DEFAULT true,
    "ui_settings" JSONB,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "master_data"."ServicePrice" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "scope_note" TEXT,
    "service_vendor_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "ServicePrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."Vendor" (
    "id" TEXT NOT NULL,
    "vendor_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."BrandCategory" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."MaterialPrice" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "sku_id" TEXT,
    "item_description" TEXT NOT NULL,
    "unit" TEXT,
    "price_before_discount" DOUBLE PRECISION,
    "price_after_discount" DOUBLE PRECISION,
    "source_link_id" TEXT,
    "valid_from" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "MaterialPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."VendorLink" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "kind" "master_data"."VendorLinkKind" NOT NULL,
    "url" TEXT NOT NULL,
    "archive_url" TEXT,
    "label" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VendorLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."VendorContact" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "contact_person" TEXT NOT NULL,
    "contact_role" TEXT,
    "phone_number" TEXT,
    "email" TEXT,

    CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."Material" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "catalog_brand" TEXT NOT NULL,
    "catalog_sku" TEXT NOT NULL,
    "catalog_product_name" TEXT NOT NULL,
    "catalog_pattern" TEXT,
    "catalog_motif" TEXT,
    "catalog_color" TEXT,
    "catalog_finishing" TEXT,
    "catalog_dimension_p" TEXT,
    "catalog_dimension_l" TEXT,
    "catalog_dimension_t" TEXT,
    "catalog_dimension_unit" TEXT DEFAULT 'cm',
    "catalog_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "catalog_metadata" JSONB,
    "catalog_type" "studioflow"."ProductType" NOT NULL DEFAULT 'material',
    "catalog_status" "studioflow"."LibraryItemStatus" NOT NULL DEFAULT 'PENDING',
    "catalog_image_url" TEXT,
    "catalog_image_thumbnail_url" TEXT,
    "catalog_image_original_url" TEXT,
    "catalog_reference_url" TEXT,
    "catalog_folder_url" TEXT,
    "price_after_discount" DOUBLE PRECISION,
    "price_before_discount" DOUBLE PRECISION,
    "price_unit" TEXT,
    "price_updated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."Sample" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "catalog_rack_number" TEXT NOT NULL,
    "catalog_box_number" TEXT NOT NULL,
    "catalog_location_note" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "catalog_status" "studioflow"."SampleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "current_borrower_name" TEXT,
    "borrowed_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "catalog_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."SampleMovementLog" (
    "id" TEXT NOT NULL,
    "sample_id" TEXT NOT NULL,
    "action" "studioflow"."SampleAction" NOT NULL,
    "notes" TEXT,
    "user_id" TEXT NOT NULL,
    "taken_by" TEXT,
    "date_out" TIMESTAMP(3),
    "date_return" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleMovementLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
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

-- CreateTable
CREATE TABLE "studioflow"."ProjectProductRequest" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "brand_id" TEXT,
    "sku_id" TEXT,
    "schedule_entry_id" TEXT,
    "schedule_option_id" TEXT,
    "custom_product_name" TEXT,
    "reference_url" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "status" "studioflow"."ProductRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "area_location" TEXT,
    "is_scheduled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "staff_name_override" TEXT,
    "linked_sample_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectProductRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."ProjectChecklist" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "phase_id" TEXT,
    "label" TEXT NOT NULL,
    "is_checked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."CDList" (
    "id" TEXT NOT NULL,
    "phase_id" TEXT NOT NULL,
    "group_code" TEXT NOT NULL,
    "drawing_name" TEXT NOT NULL,
    "status_enum" "studioflow"."CDItemStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CDList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "phase_id" TEXT,
    "task_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."TemporaryAttachment" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "comment_id" TEXT,

    CONSTRAINT "TemporaryAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."ProjectMomDocument" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "mom_topic" TEXT NOT NULL DEFAULT 'SITE INSPECTION REPORT',
    "mom_date" TIMESTAMP(3) NOT NULL,
    "mom_venue" TEXT,
    "mom_attendees" TEXT,
    "mom_prepared_by_name" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMomDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."ProjectMomItem" (
    "id" TEXT NOT NULL,
    "mom_document_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_text_only" BOOLEAN NOT NULL DEFAULT false,
    "list_style" "studioflow"."MomListStyle" NOT NULL DEFAULT 'decimal',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMomItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."ProjectMomPoint" (
    "id" TEXT NOT NULL,
    "mom_item_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "style" "studioflow"."MomPointStyle" NOT NULL DEFAULT 'default',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMomPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."ProjectMomImage" (
    "id" TEXT NOT NULL,
    "mom_item_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "file_url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMomImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."PrefixDictionary" (
    "id" TEXT NOT NULL,
    "schedule_category" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "section" "studioflow"."ProductType" NOT NULL DEFAULT 'material',

    CONSTRAINT "PrefixDictionary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."ProjectScheduleEntry" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "schedule_category" TEXT NOT NULL,
    "schedule_prefix" TEXT NOT NULL,
    "schedule_increment" INTEGER NOT NULL,
    "index_number" INTEGER NOT NULL,
    "schedule_sort_order" INTEGER NOT NULL,
    "schedule_qty" DOUBLE PRECISION,
    "schedule_unit" TEXT,
    "schedule_location" TEXT,
    "section" "studioflow"."ProductType" NOT NULL DEFAULT 'material',
    "active_index" INTEGER NOT NULL DEFAULT 0,
    "version_locked" BOOLEAN NOT NULL DEFAULT false,
    "prefix_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."ProjectScheduleOption" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "sku_id" TEXT,
    "manual_data" JSONB,
    "data_snapshot" JSONB,
    "option_label" TEXT NOT NULL,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "status" "studioflow"."ScheduleOptionStatus" NOT NULL DEFAULT 'DRAFT',
    "spec_brand_id" TEXT,
    "spec_product_name" TEXT,
    "spec_color" TEXT,
    "spec_finishing" TEXT,
    "spec_search_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectScheduleOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."ScheduleTemplate" (
    "id" TEXT NOT NULL,
    "schedule_category" TEXT NOT NULL,
    "section" "studioflow"."ProductType" NOT NULL DEFAULT 'material',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default_entry" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ScheduleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."PromotionRequest" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "schedule_option_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "snapshot_data" JSONB,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."SketchupProject" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "sketchup_model_name" TEXT NOT NULL,
    "api_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SketchupProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."SketchupMaterial" (
    "id" TEXT NOT NULL,
    "sketchup_project_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "uuid" TEXT NOT NULL,
    "brand" TEXT,
    "type" TEXT,
    "finish" TEXT,
    "image_url" TEXT,
    "reference_url" TEXT,
    "location_notes" TEXT,
    "item_no" TEXT,
    "qty" DOUBLE PRECISION,
    "unit" TEXT,
    "color_size" TEXT,
    "unit_cost" DOUBLE PRECISION,
    "notes" TEXT,
    "catalog_fields" JSONB,
    "area" DOUBLE PRECISION,
    "face_count" INTEGER,
    "backface_count" INTEGER,
    "layers" JSONB,
    "parents" JSONB,
    "is_reserved" BOOLEAN NOT NULL DEFAULT false,
    "linked_entry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SketchupMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."SketchupFFE" (
    "id" TEXT NOT NULL,
    "sketchup_project_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "instance_count" INTEGER NOT NULL DEFAULT 1,
    "area" DOUBLE PRECISION,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SketchupFFE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."SketchupMergeAction" (
    "id" TEXT NOT NULL,
    "sketchup_project_id" TEXT NOT NULL,
    "source_code" TEXT NOT NULL,
    "target_code" TEXT NOT NULL,
    "queue_order" INTEGER NOT NULL DEFAULT 0,
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SketchupMergeAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."RenderBoard" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Render Board',
    "image_url" TEXT NOT NULL,
    "image_ratio" DOUBLE PRECISION,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "studioflow"."RenderAnnotation" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "schedule_entry_id" TEXT,
    "pin_x" DOUBLE PRECISION NOT NULL,
    "pin_y" DOUBLE PRECISION NOT NULL,
    "label_side" "studioflow"."RenderLabelSide" NOT NULL DEFAULT 'auto',
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "studioflow"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_key" ON "studioflow"."Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_project_code_key" ON "studioflow"."Project"("project_code");

-- CreateIndex
CREATE UNIQUE INDEX "Project_name_key" ON "studioflow"."Project"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineTemplate_phase_enum_key" ON "studioflow"."TimelineTemplate"("phase_enum");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceVendor_name_key" ON "master_data"."ServiceVendor"("name");

-- CreateIndex
CREATE INDEX "ServiceVendor_is_active_idx" ON "master_data"."ServiceVendor"("is_active");

-- CreateIndex
CREATE INDEX "ServiceVendor_deleted_at_idx" ON "master_data"."ServiceVendor"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePrice_code_key" ON "master_data"."ServicePrice"("code");

-- CreateIndex
CREATE INDEX "ServicePrice_category_idx" ON "master_data"."ServicePrice"("category");

-- CreateIndex
CREATE INDEX "ServicePrice_is_active_idx" ON "master_data"."ServicePrice"("is_active");

-- CreateIndex
CREATE INDEX "ServicePrice_service_vendor_id_idx" ON "master_data"."ServicePrice"("service_vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_vendor_name_key" ON "master_data"."Vendor"("vendor_name");

-- CreateIndex
CREATE INDEX "Vendor_deleted_at_idx" ON "master_data"."Vendor"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "master_data"."Category"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "master_data"."Category"("slug");

-- CreateIndex
CREATE INDEX "BrandCategory_category_id_idx" ON "master_data"."BrandCategory"("category_id");

-- CreateIndex
CREATE INDEX "BrandCategory_brand_id_sort_order_idx" ON "master_data"."BrandCategory"("brand_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "BrandCategory_brand_id_category_id_key" ON "master_data"."BrandCategory"("brand_id", "category_id");

-- CreateIndex
CREATE INDEX "MaterialPrice_brand_id_idx" ON "master_data"."MaterialPrice"("brand_id");

-- CreateIndex
CREATE INDEX "MaterialPrice_sku_id_idx" ON "master_data"."MaterialPrice"("sku_id");

-- CreateIndex
CREATE INDEX "MaterialPrice_deleted_at_idx" ON "master_data"."MaterialPrice"("deleted_at");

-- CreateIndex
CREATE INDEX "VendorLink_vendor_id_idx" ON "master_data"."VendorLink"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "VendorLink_vendor_id_url_key" ON "master_data"."VendorLink"("vendor_id", "url");

-- CreateIndex
CREATE INDEX "VendorContact_vendor_id_idx" ON "master_data"."VendorContact"("vendor_id");

-- CreateIndex
CREATE INDEX "Material_vendor_id_idx" ON "master_data"."Material"("vendor_id");

-- CreateIndex
CREATE INDEX "Material_brand_idx" ON "master_data"."Material"("catalog_brand");

-- CreateIndex
CREATE INDEX "Material_status_idx" ON "master_data"."Material"("catalog_status");

-- CreateIndex
CREATE INDEX "Material_deleted_at_idx" ON "master_data"."Material"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "Material_vendor_brand_sku_key" ON "master_data"."Material"("vendor_id", "catalog_brand", "catalog_sku");

-- CreateIndex
CREATE INDEX "Sample_material_id_idx" ON "master_data"."Sample"("material_id");

-- CreateIndex
CREATE INDEX "Sample_catalog_status_idx" ON "master_data"."Sample"("catalog_status");

-- CreateIndex
CREATE INDEX "Sample_catalog_rack_number_catalog_box_number_idx" ON "master_data"."Sample"("catalog_rack_number", "catalog_box_number");

-- CreateIndex
CREATE INDEX "Sample_deleted_at_idx" ON "master_data"."Sample"("deleted_at");

-- CreateIndex
CREATE INDEX "SampleMovementLog_sample_id_idx" ON "master_data"."SampleMovementLog"("sample_id");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCandidate_candidate_key_key" ON "master_data"."MaterialCandidate"("candidate_key");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialCandidate_promoted_material_id_key" ON "master_data"."MaterialCandidate"("promoted_material_id");

-- CreateIndex
CREATE INDEX "MaterialCandidate_review_status_idx" ON "master_data"."MaterialCandidate"("review_status");

-- CreateIndex
CREATE INDEX "MaterialCandidate_candidate_vendor_id_idx" ON "master_data"."MaterialCandidate"("candidate_vendor_id");

-- CreateIndex
CREATE INDEX "MaterialCandidate_confirmed_vendor_id_idx" ON "master_data"."MaterialCandidate"("confirmed_vendor_id");

-- CreateIndex
CREATE INDEX "MaterialCandidate_source_sheet_idx" ON "master_data"."MaterialCandidate"("source_sheet");

-- CreateIndex
CREATE UNIQUE INDEX "SampleCandidate_sample_candidate_key_key" ON "master_data"."SampleCandidate"("sample_candidate_key");

-- CreateIndex
CREATE UNIQUE INDEX "SampleCandidate_promoted_sample_id_key" ON "master_data"."SampleCandidate"("promoted_sample_id");

-- CreateIndex
CREATE INDEX "SampleCandidate_review_status_idx" ON "master_data"."SampleCandidate"("review_status");

-- CreateIndex
CREATE INDEX "SampleCandidate_material_candidate_id_idx" ON "master_data"."SampleCandidate"("material_candidate_id");

-- CreateIndex
CREATE INDEX "SampleCandidate_confirmed_material_id_idx" ON "master_data"."SampleCandidate"("confirmed_material_id");

-- CreateIndex
CREATE INDEX "SampleCandidate_source_sheet_source_row_idx" ON "master_data"."SampleCandidate"("source_sheet", "source_row");

-- CreateIndex
CREATE INDEX "ProjectProductRequest_brand_id_idx" ON "studioflow"."ProjectProductRequest"("brand_id");

-- CreateIndex
CREATE INDEX "TemporaryAttachment_expires_at_idx" ON "studioflow"."TemporaryAttachment"("expires_at");

-- CreateIndex
CREATE INDEX "ProjectMomDocument_project_id_mom_date_idx" ON "studioflow"."ProjectMomDocument"("project_id", "mom_date");

-- CreateIndex
CREATE INDEX "ProjectMomItem_mom_document_id_sort_order_idx" ON "studioflow"."ProjectMomItem"("mom_document_id", "sort_order");

-- CreateIndex
CREATE INDEX "ProjectMomPoint_mom_item_id_sort_order_idx" ON "studioflow"."ProjectMomPoint"("mom_item_id", "sort_order");

-- CreateIndex
CREATE INDEX "ProjectMomImage_mom_item_id_sort_order_idx" ON "studioflow"."ProjectMomImage"("mom_item_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "PrefixDictionary_section_schedule_category_key" ON "studioflow"."PrefixDictionary"("section", "schedule_category");

-- CreateIndex
CREATE INDEX "ProjectScheduleEntry_project_id_idx" ON "studioflow"."ProjectScheduleEntry"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectScheduleEntry_project_id_section_schedule_prefix_sch_key" ON "studioflow"."ProjectScheduleEntry"("project_id", "section", "schedule_prefix", "schedule_increment");

-- CreateIndex
CREATE INDEX "ProjectScheduleOption_spec_search_key_idx" ON "studioflow"."ProjectScheduleOption"("spec_search_key");

-- CreateIndex
CREATE INDEX "ProjectScheduleOption_spec_brand_id_idx" ON "studioflow"."ProjectScheduleOption"("spec_brand_id");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleTemplate_section_schedule_category_key" ON "studioflow"."ScheduleTemplate"("section", "schedule_category");

-- CreateIndex
CREATE UNIQUE INDEX "SketchupProject_api_key_key" ON "studioflow"."SketchupProject"("api_key");

-- CreateIndex
CREATE INDEX "SketchupProject_project_id_idx" ON "studioflow"."SketchupProject"("project_id");

-- CreateIndex
CREATE INDEX "SketchupMaterial_sketchup_project_id_idx" ON "studioflow"."SketchupMaterial"("sketchup_project_id");

-- CreateIndex
CREATE UNIQUE INDEX "SketchupMaterial_sketchup_project_id_uuid_key" ON "studioflow"."SketchupMaterial"("sketchup_project_id", "uuid");

-- CreateIndex
CREATE INDEX "SketchupFFE_sketchup_project_id_idx" ON "studioflow"."SketchupFFE"("sketchup_project_id");

-- CreateIndex
CREATE UNIQUE INDEX "SketchupFFE_sketchup_project_id_code_key" ON "studioflow"."SketchupFFE"("sketchup_project_id", "code");

-- CreateIndex
CREATE INDEX "SketchupMergeAction_sketchup_project_id_idx" ON "studioflow"."SketchupMergeAction"("sketchup_project_id");

-- CreateIndex
CREATE INDEX "RenderBoard_project_id_sort_order_idx" ON "studioflow"."RenderBoard"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "RenderAnnotation_board_id_sort_order_idx" ON "studioflow"."RenderAnnotation"("board_id", "sort_order");

-- AddForeignKey
ALTER TABLE "studioflow"."Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "studioflow"."Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."Project" ADD CONSTRAINT "Project_pic_designer_id_fkey" FOREIGN KEY ("pic_designer_id") REFERENCES "studioflow"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."Project" ADD CONSTRAINT "Project_pic_drafter_id_fkey" FOREIGN KEY ("pic_drafter_id") REFERENCES "studioflow"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."Phase" ADD CONSTRAINT "Phase_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."Revision" ADD CONSTRAINT "Revision_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "studioflow"."Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."Activity" ADD CONSTRAINT "Activity_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."Activity" ADD CONSTRAINT "Activity_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "studioflow"."Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."Activity" ADD CONSTRAINT "Activity_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "studioflow"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."File" ADD CONSTRAINT "File_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "studioflow"."Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."AuditLog" ADD CONSTRAINT "AuditLog_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "studioflow"."Phase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."AuditLog" ADD CONSTRAINT "AuditLog_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "studioflow"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectTimeline" ADD CONSTRAINT "ProjectTimeline_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "studioflow"."Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectTimeline" ADD CONSTRAINT "ProjectTimeline_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."ServicePrice" ADD CONSTRAINT "ServicePrice_service_vendor_id_fkey" FOREIGN KEY ("service_vendor_id") REFERENCES "master_data"."ServiceVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."BrandCategory" ADD CONSTRAINT "BrandCategory_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "master_data"."Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."BrandCategory" ADD CONSTRAINT "BrandCategory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "master_data"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."MaterialPrice" ADD CONSTRAINT "MaterialPrice_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "master_data"."Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."MaterialPrice" ADD CONSTRAINT "MaterialPrice_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "master_data"."Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."MaterialPrice" ADD CONSTRAINT "MaterialPrice_source_link_id_fkey" FOREIGN KEY ("source_link_id") REFERENCES "master_data"."VendorLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."VendorLink" ADD CONSTRAINT "VendorLink_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "master_data"."Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."VendorContact" ADD CONSTRAINT "VendorContact_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "master_data"."Vendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."Material" ADD CONSTRAINT "Material_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "master_data"."Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."Sample" ADD CONSTRAINT "Sample_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "master_data"."Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."SampleMovementLog" ADD CONSTRAINT "SampleMovementLog_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "master_data"."Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."MaterialCandidate" ADD CONSTRAINT "MaterialCandidate_candidate_vendor_id_fkey" FOREIGN KEY ("candidate_vendor_id") REFERENCES "master_data"."Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."MaterialCandidate" ADD CONSTRAINT "MaterialCandidate_confirmed_vendor_id_fkey" FOREIGN KEY ("confirmed_vendor_id") REFERENCES "master_data"."Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."MaterialCandidate" ADD CONSTRAINT "MaterialCandidate_promoted_material_id_fkey" FOREIGN KEY ("promoted_material_id") REFERENCES "master_data"."Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."SampleCandidate" ADD CONSTRAINT "SampleCandidate_material_candidate_id_fkey" FOREIGN KEY ("material_candidate_id") REFERENCES "master_data"."MaterialCandidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."SampleCandidate" ADD CONSTRAINT "SampleCandidate_confirmed_material_id_fkey" FOREIGN KEY ("confirmed_material_id") REFERENCES "master_data"."Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."SampleCandidate" ADD CONSTRAINT "SampleCandidate_promoted_sample_id_fkey" FOREIGN KEY ("promoted_sample_id") REFERENCES "master_data"."Sample"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectProductRequest" ADD CONSTRAINT "ProjectProductRequest_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "master_data"."Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectProductRequest" ADD CONSTRAINT "ProjectProductRequest_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "master_data"."Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectProductRequest" ADD CONSTRAINT "ProjectProductRequest_schedule_entry_id_fkey" FOREIGN KEY ("schedule_entry_id") REFERENCES "studioflow"."ProjectScheduleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectProductRequest" ADD CONSTRAINT "ProjectProductRequest_schedule_option_id_fkey" FOREIGN KEY ("schedule_option_id") REFERENCES "studioflow"."ProjectScheduleOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectProductRequest" ADD CONSTRAINT "ProjectProductRequest_linked_sample_id_fkey" FOREIGN KEY ("linked_sample_id") REFERENCES "master_data"."Sample"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectProductRequest" ADD CONSTRAINT "ProjectProductRequest_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectProductRequest" ADD CONSTRAINT "ProjectProductRequest_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "studioflow"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectChecklist" ADD CONSTRAINT "ProjectChecklist_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "studioflow"."Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectChecklist" ADD CONSTRAINT "ProjectChecklist_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."CDList" ADD CONSTRAINT "CDList_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "studioflow"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."CDList" ADD CONSTRAINT "CDList_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "studioflow"."Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."Comment" ADD CONSTRAINT "Comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "studioflow"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."Comment" ADD CONSTRAINT "Comment_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "studioflow"."Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."Comment" ADD CONSTRAINT "Comment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."TemporaryAttachment" ADD CONSTRAINT "TemporaryAttachment_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "studioflow"."Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectMomDocument" ADD CONSTRAINT "ProjectMomDocument_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "studioflow"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectMomDocument" ADD CONSTRAINT "ProjectMomDocument_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectMomItem" ADD CONSTRAINT "ProjectMomItem_mom_document_id_fkey" FOREIGN KEY ("mom_document_id") REFERENCES "studioflow"."ProjectMomDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectMomPoint" ADD CONSTRAINT "ProjectMomPoint_mom_item_id_fkey" FOREIGN KEY ("mom_item_id") REFERENCES "studioflow"."ProjectMomItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectMomImage" ADD CONSTRAINT "ProjectMomImage_mom_item_id_fkey" FOREIGN KEY ("mom_item_id") REFERENCES "studioflow"."ProjectMomItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectScheduleEntry" ADD CONSTRAINT "ProjectScheduleEntry_prefix_id_fkey" FOREIGN KEY ("prefix_id") REFERENCES "studioflow"."PrefixDictionary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectScheduleEntry" ADD CONSTRAINT "ProjectScheduleEntry_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectScheduleOption" ADD CONSTRAINT "ProjectScheduleOption_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "studioflow"."ProjectScheduleEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectScheduleOption" ADD CONSTRAINT "ProjectScheduleOption_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "master_data"."Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."ProjectScheduleOption" ADD CONSTRAINT "ProjectScheduleOption_spec_brand_id_fkey" FOREIGN KEY ("spec_brand_id") REFERENCES "master_data"."Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."SketchupProject" ADD CONSTRAINT "SketchupProject_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."SketchupMaterial" ADD CONSTRAINT "SketchupMaterial_linked_entry_id_fkey" FOREIGN KEY ("linked_entry_id") REFERENCES "studioflow"."ProjectScheduleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."SketchupMaterial" ADD CONSTRAINT "SketchupMaterial_sketchup_project_id_fkey" FOREIGN KEY ("sketchup_project_id") REFERENCES "studioflow"."SketchupProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."SketchupFFE" ADD CONSTRAINT "SketchupFFE_sketchup_project_id_fkey" FOREIGN KEY ("sketchup_project_id") REFERENCES "studioflow"."SketchupProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."SketchupMergeAction" ADD CONSTRAINT "SketchupMergeAction_sketchup_project_id_fkey" FOREIGN KEY ("sketchup_project_id") REFERENCES "studioflow"."SketchupProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."RenderBoard" ADD CONSTRAINT "RenderBoard_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "studioflow"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."RenderAnnotation" ADD CONSTRAINT "RenderAnnotation_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "studioflow"."RenderBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "studioflow"."RenderAnnotation" ADD CONSTRAINT "RenderAnnotation_schedule_entry_id_fkey" FOREIGN KEY ("schedule_entry_id") REFERENCES "studioflow"."ProjectScheduleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

