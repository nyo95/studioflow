-- CreateEnum
CREATE TYPE "TimelineStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DIC', 'DRIC', 'STAFF');

-- CreateEnum
CREATE TYPE "PhaseName" AS ENUM ('MOODBOARD', 'LAYOUT', 'DESIGN_3D', 'CD', 'SUPERVISION');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "ProjectPriority" AS ENUM ('URGENT', 'NORMAL', 'LOW');

-- CreateEnum
CREATE TYPE "PhaseStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'ON_REVIEW_INTERNAL', 'APPROVED_INTERNAL', 'ON_REVIEW_CLIENT', 'READY_FOR_NEXT', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RevisionStatus" AS ENUM ('ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ActivityMode" AS ENUM ('TODO', 'FEEDBACK');

-- CreateEnum
CREATE TYPE "CDItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'FINISHED');

-- CreateEnum
CREATE TYPE "LibraryItemStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MaterialRequestStatus" AS ENUM ('REQUESTED', 'ORDERED', 'SHIPPED', 'RECEIVED', 'UNAVAILABLE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleOptionStatus" AS ENUM ('DRAFT', 'APPROVED', 'NOT_USED');

-- CreateEnum
CREATE TYPE "ScheduleSection" AS ENUM ('MATERIAL', 'FIXTURE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "logo_url" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pic_designer_id" TEXT NOT NULL,
    "pic_drafter_id" TEXT NOT NULL,
    "clientId" TEXT,
    "opening_date" TIMESTAMP(3),
    "project_type" TEXT NOT NULL DEFAULT 'RETAIL',
    "status_progress" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "priority" "ProjectPriority" NOT NULL DEFAULT 'NORMAL',
    "client_contact" TEXT,
    "address" TEXT,
    "area" DOUBLE PRECISION,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name_enum" "PhaseName" NOT NULL,
    "status_enum" "PhaseStatus" NOT NULL DEFAULT 'PENDING',
    "order_index" INTEGER NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Revision" (
    "id" TEXT NOT NULL,
    "phase_id" TEXT NOT NULL,
    "major" INTEGER NOT NULL DEFAULT 1,
    "minor" INTEGER NOT NULL DEFAULT 0,
    "status_enum" "RevisionStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Revision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "project_id" TEXT,
    "revision_id" TEXT,
    "content" TEXT NOT NULL,
    "mode" "ActivityMode" NOT NULL DEFAULT 'TODO',
    "status" "ActivityStatus" NOT NULL DEFAULT 'OPEN',
    "assigned_to_id" TEXT,
    "origin_phase_id" TEXT,
    "deferred_from_version" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "File" (
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
CREATE TABLE "AuditLog" (
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
CREATE TABLE "ProjectTimeline" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "TimelineStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "phase_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineTemplate" (
    "id" TEXT NOT NULL,
    "phase_enum" TEXT NOT NULL,
    "duration_days" INTEGER NOT NULL DEFAULT 7,

    CONSTRAINT "TimelineTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" TEXT NOT NULL,
    "phase_enum" TEXT,
    "label" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "app_title" TEXT NOT NULL DEFAULT 'StudioFlow',
    "is_auto_naming_enabled" BOOLEAN NOT NULL DEFAULT true,
    "ui_settings" JSONB,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vendor" (
    "id" TEXT NOT NULL,
    "brand_name" TEXT NOT NULL,
    "company_name" TEXT,
    "company_pt" TEXT,
    "address" TEXT,
    "website_url" TEXT,
    "instagram_url" TEXT,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorContact" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "contact_person" TEXT NOT NULL,
    "contact_role" TEXT NOT NULL,
    "phone_number" TEXT,
    "email" TEXT,

    CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialCatalog" (
    "id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sub_category" TEXT,
    "product_type" TEXT NOT NULL,
    "motif_or_color" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dimension_p" TEXT,
    "dimension_l" TEXT,
    "dimension_t" TEXT,
    "dimension_unit" TEXT DEFAULT 'cm',
    "color" TEXT,
    "finishing" TEXT,
    "rak_location" TEXT,
    "box_number" TEXT,
    "cover_url" TEXT,
    "original_url" TEXT,
    "digital_catalog_url" TEXT,
    "digital_folder_url" TEXT,
    "metadata" JSONB,
    "price" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "LibraryItemStatus" NOT NULL DEFAULT 'PENDING',
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "MaterialCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalSample" (
    "id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "location_rak" TEXT NOT NULL,
    "container_box" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhysicalSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMaterialRequest" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "material_id" TEXT,
    "schedule_entry_id" TEXT,
    "custom_material_name" TEXT,
    "reference_url" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "status" "MaterialRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "area_location" TEXT,
    "is_scheduled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "staff_name_override" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMaterialRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectChecklist" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "phase_id" TEXT,
    "label" TEXT NOT NULL,
    "is_checked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProjectChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CDList" (
    "id" TEXT NOT NULL,
    "phase_id" TEXT NOT NULL,
    "group_code" TEXT NOT NULL,
    "drawing_name" TEXT NOT NULL,
    "status_enum" "CDItemStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_to_id" TEXT,

    CONSTRAINT "CDList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
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
CREATE TABLE "PrefixDictionary" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "section" "ScheduleSection" NOT NULL DEFAULT 'MATERIAL',

    CONSTRAINT "PrefixDictionary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectScheduleEntry" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "index_number" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "qty" DOUBLE PRECISION,
    "unit" TEXT,
    "location" TEXT,
    "section" "ScheduleSection" NOT NULL DEFAULT 'MATERIAL',
    "prefix_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectScheduleOption" (
    "id" TEXT NOT NULL,
    "entry_id" TEXT NOT NULL,
    "material_catalog_id" TEXT,
    "manual_data" JSONB,
    "data_snapshot" JSONB,
    "option_label" TEXT NOT NULL,
    "is_final" BOOLEAN NOT NULL DEFAULT false,
    "status" "ScheduleOptionStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectScheduleOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleTemplate" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "section" "ScheduleSection" NOT NULL DEFAULT 'MATERIAL',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ScheduleTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Client_name_key" ON "Client"("name");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineTemplate_phase_enum_key" ON "TimelineTemplate"("phase_enum");

-- CreateIndex
CREATE UNIQUE INDEX "Vendor_brand_name_key" ON "Vendor"("brand_name");

-- CreateIndex
CREATE INDEX "MaterialCatalog_vendor_id_idx" ON "MaterialCatalog"("vendor_id");

-- CreateIndex
CREATE INDEX "MaterialCatalog_category_idx" ON "MaterialCatalog"("category");

-- CreateIndex
CREATE INDEX "PhysicalSample_material_id_idx" ON "PhysicalSample"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "PrefixDictionary_section_category_key" ON "PrefixDictionary"("section", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectScheduleEntry_project_id_section_code_key" ON "ProjectScheduleEntry"("project_id", "section", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleTemplate_section_category_key" ON "ScheduleTemplate"("section", "category");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_pic_designer_id_fkey" FOREIGN KEY ("pic_designer_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_pic_drafter_id_fkey" FOREIGN KEY ("pic_drafter_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Revision" ADD CONSTRAINT "Revision_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "Revision"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTimeline" ADD CONSTRAINT "ProjectTimeline_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTimeline" ADD CONSTRAINT "ProjectTimeline_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorContact" ADD CONSTRAINT "VendorContact_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialCatalog" ADD CONSTRAINT "MaterialCatalog_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "Vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhysicalSample" ADD CONSTRAINT "PhysicalSample_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "MaterialCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterialRequest" ADD CONSTRAINT "ProjectMaterialRequest_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "MaterialCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterialRequest" ADD CONSTRAINT "ProjectMaterialRequest_schedule_entry_id_fkey" FOREIGN KEY ("schedule_entry_id") REFERENCES "ProjectScheduleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterialRequest" ADD CONSTRAINT "ProjectMaterialRequest_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMaterialRequest" ADD CONSTRAINT "ProjectMaterialRequest_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChecklist" ADD CONSTRAINT "ProjectChecklist_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChecklist" ADD CONSTRAINT "ProjectChecklist_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CDList" ADD CONSTRAINT "CDList_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CDList" ADD CONSTRAINT "CDList_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_phase_id_fkey" FOREIGN KEY ("phase_id") REFERENCES "Phase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheduleEntry" ADD CONSTRAINT "ProjectScheduleEntry_prefix_id_fkey" FOREIGN KEY ("prefix_id") REFERENCES "PrefixDictionary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheduleEntry" ADD CONSTRAINT "ProjectScheduleEntry_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheduleOption" ADD CONSTRAINT "ProjectScheduleOption_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "ProjectScheduleEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectScheduleOption" ADD CONSTRAINT "ProjectScheduleOption_material_catalog_id_fkey" FOREIGN KEY ("material_catalog_id") REFERENCES "MaterialCatalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
