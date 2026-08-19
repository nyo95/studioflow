-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "master_data";

-- CreateEnum
CREATE TYPE "master_data"."PartyType" AS ENUM ('COMPANY', 'INDIVIDUAL');

-- CreateEnum
CREATE TYPE "master_data"."PartyRoleKind" AS ENUM ('MANUFACTURER', 'DISTRIBUTOR', 'SUPPLIER', 'RETAIL', 'SUBCON', 'SERVICE_VENDOR');

-- CreateEnum
CREATE TYPE "master_data"."LinkKind" AS ENUM ('WEBSITE', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'YOUTUBE', 'LINKEDIN', 'WHATSAPP', 'MARKETPLACE', 'DRIVE', 'CATALOG', 'PRICE_LIST', 'OTHER');

-- CreateEnum
CREATE TYPE "master_data"."CategoryKind" AS ENUM ('PRODUCT', 'WORK');

-- CreateEnum
CREATE TYPE "master_data"."CategorySource" AS ENUM ('SEED', 'DERIVED_FROM_SKU');

-- CreateEnum
CREATE TYPE "master_data"."SkuKind" AS ENUM ('MATERIAL', 'FURNITURE', 'FIXTURE', 'SERVICE');

-- CreateEnum
CREATE TYPE "master_data"."SkuStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "master_data"."MediaKind" AS ENUM ('IMAGE', 'THUMBNAIL', 'ORIGINAL', 'REFERENCE', 'FOLDER');

-- CreateEnum
CREATE TYPE "master_data"."SampleStatus" AS ENUM ('AVAILABLE', 'BORROWED', 'LOST', 'DISCARDED');

-- CreateEnum
CREATE TYPE "master_data"."SampleAction" AS ENUM ('IN', 'OUT', 'RETURN', 'ADJUST');

-- CreateEnum
CREATE TYPE "master_data"."AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'RESTORE');

-- CreateTable
CREATE TABLE "master_data"."Party" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "legal_name" TEXT,
    "type" "master_data"."PartyType" NOT NULL DEFAULT 'COMPANY',
    "address" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "updated_by_name" TEXT,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."PartyRole" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "role" "master_data"."PartyRoleKind" NOT NULL,
    "notes" TEXT,

    CONSTRAINT "PartyRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."PartyContact" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "person_name" TEXT NOT NULL,
    "job_title" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "brand_id" TEXT,

    CONSTRAINT "PartyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."PartyLink" (
    "id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "kind" "master_data"."LinkKind" NOT NULL,
    "url" TEXT NOT NULL,
    "archive_url" TEXT,
    "label" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PartyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."Brand" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_party_id" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "updated_by_name" TEXT,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."BrandLink" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "kind" "master_data"."LinkKind" NOT NULL,
    "url" TEXT NOT NULL,
    "archive_url" TEXT,
    "label" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "BrandLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."BrandSupplier" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "party_id" TEXT NOT NULL,
    "is_authorized" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "BrandSupplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "master_data"."CategoryKind" NOT NULL,
    "parent_id" TEXT,
    "path" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
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
    "source" "master_data"."CategorySource" NOT NULL DEFAULT 'DERIVED_FROM_SKU',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrandCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."SkuCategory" (
    "id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."Sku" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brand_id" TEXT,
    "kind" "master_data"."SkuKind" NOT NULL DEFAULT 'MATERIAL',
    "status" "master_data"."SkuStatus" NOT NULL DEFAULT 'DRAFT',
    "spec" JSONB,
    "dim_length" DECIMAL(12,3),
    "dim_width" DECIMAL(12,3),
    "dim_height" DECIMAL(12,3),
    "dim_unit" TEXT DEFAULT 'mm',
    "dim_display" TEXT,
    "base_unit" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "updated_by_name" TEXT,

    CONSTRAINT "Sku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."SkuMedia" (
    "id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "kind" "master_data"."MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkuMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."SkuPrice" (
    "id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "supplier_party_id" TEXT,
    "price_list" DECIMAL(16,2),
    "price_net" DECIMAL(16,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "unit" TEXT NOT NULL,
    "qty" DECIMAL(12,3),
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "source_link_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "updated_by_name" TEXT,

    CONSTRAINT "SkuPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."WorkPrice" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "vendor_party_id" TEXT,
    "spec" JSONB,
    "dim_display" TEXT,
    "unit" TEXT NOT NULL,
    "material_price" DECIMAL(16,2),
    "labor_price" DECIMAL(16,2),
    "total_price" DECIMAL(16,2),
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "scope_note" TEXT,
    "notes" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_to" TIMESTAMP(3),
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "updated_by_name" TEXT,

    CONSTRAINT "WorkPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."WorkPriceProjectRef" (
    "id" TEXT NOT NULL,
    "work_price_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "used_at" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "WorkPriceProjectRef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."Sample" (
    "id" TEXT NOT NULL,
    "sku_id" TEXT NOT NULL,
    "rack_number" TEXT NOT NULL,
    "box_number" TEXT NOT NULL,
    "location_note" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "master_data"."SampleStatus" NOT NULL DEFAULT 'AVAILABLE',
    "borrower_name" TEXT,
    "borrowed_at" TIMESTAMP(3),
    "due_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."SampleMovement" (
    "id" TEXT NOT NULL,
    "sample_id" TEXT NOT NULL,
    "action" "master_data"."SampleAction" NOT NULL,
    "notes" TEXT,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "taken_by" TEXT,
    "date_out" TIMESTAMP(3),
    "date_return" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SampleMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_data"."MasterDataAudit" (
    "id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" "master_data"."AuditAction" NOT NULL,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "changes" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterDataAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Party_name_key" ON "master_data"."Party"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Party_slug_key" ON "master_data"."Party"("slug");

-- CreateIndex
CREATE INDEX "Party_type_idx" ON "master_data"."Party"("type");

-- CreateIndex
CREATE INDEX "Party_is_active_idx" ON "master_data"."Party"("is_active");

-- CreateIndex
CREATE INDEX "Party_deleted_at_idx" ON "master_data"."Party"("deleted_at");

-- CreateIndex
CREATE INDEX "PartyRole_role_idx" ON "master_data"."PartyRole"("role");

-- CreateIndex
CREATE UNIQUE INDEX "PartyRole_party_id_role_key" ON "master_data"."PartyRole"("party_id", "role");

-- CreateIndex
CREATE INDEX "PartyContact_party_id_idx" ON "master_data"."PartyContact"("party_id");

-- CreateIndex
CREATE INDEX "PartyContact_brand_id_idx" ON "master_data"."PartyContact"("brand_id");

-- CreateIndex
CREATE INDEX "PartyLink_party_id_kind_idx" ON "master_data"."PartyLink"("party_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "PartyLink_party_id_url_key" ON "master_data"."PartyLink"("party_id", "url");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "master_data"."Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_slug_key" ON "master_data"."Brand"("slug");

-- CreateIndex
CREATE INDEX "Brand_owner_party_id_idx" ON "master_data"."Brand"("owner_party_id");

-- CreateIndex
CREATE INDEX "Brand_deleted_at_idx" ON "master_data"."Brand"("deleted_at");

-- CreateIndex
CREATE INDEX "BrandLink_brand_id_kind_idx" ON "master_data"."BrandLink"("brand_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "BrandLink_brand_id_url_key" ON "master_data"."BrandLink"("brand_id", "url");

-- CreateIndex
CREATE INDEX "BrandSupplier_party_id_idx" ON "master_data"."BrandSupplier"("party_id");

-- CreateIndex
CREATE UNIQUE INDEX "BrandSupplier_brand_id_party_id_key" ON "master_data"."BrandSupplier"("brand_id", "party_id");

-- CreateIndex
CREATE INDEX "Category_kind_parent_id_sort_order_idx" ON "master_data"."Category"("kind", "parent_id", "sort_order");

-- CreateIndex
CREATE INDEX "Category_path_idx" ON "master_data"."Category"("path");

-- CreateIndex
CREATE UNIQUE INDEX "Category_kind_slug_key" ON "master_data"."Category"("kind", "slug");

-- CreateIndex
CREATE INDEX "BrandCategory_category_id_idx" ON "master_data"."BrandCategory"("category_id");

-- CreateIndex
CREATE INDEX "BrandCategory_brand_id_sort_order_idx" ON "master_data"."BrandCategory"("brand_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "BrandCategory_brand_id_category_id_key" ON "master_data"."BrandCategory"("brand_id", "category_id");

-- CreateIndex
CREATE INDEX "SkuCategory_category_id_idx" ON "master_data"."SkuCategory"("category_id");

-- CreateIndex
CREATE INDEX "SkuCategory_sku_id_sort_order_idx" ON "master_data"."SkuCategory"("sku_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "SkuCategory_sku_id_category_id_key" ON "master_data"."SkuCategory"("sku_id", "category_id");

-- CreateIndex
CREATE INDEX "Sku_brand_id_idx" ON "master_data"."Sku"("brand_id");

-- CreateIndex
CREATE INDEX "Sku_kind_status_idx" ON "master_data"."Sku"("kind", "status");

-- CreateIndex
CREATE INDEX "Sku_deleted_at_idx" ON "master_data"."Sku"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "Sku_brand_id_slug_key" ON "master_data"."Sku"("brand_id", "slug");

-- CreateIndex
CREATE INDEX "SkuMedia_sku_id_kind_sort_order_idx" ON "master_data"."SkuMedia"("sku_id", "kind", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "SkuMedia_sku_id_url_key" ON "master_data"."SkuMedia"("sku_id", "url");

-- CreateIndex
CREATE INDEX "SkuPrice_sku_id_is_current_idx" ON "master_data"."SkuPrice"("sku_id", "is_current");

-- CreateIndex
CREATE INDEX "SkuPrice_supplier_party_id_idx" ON "master_data"."SkuPrice"("supplier_party_id");

-- CreateIndex
CREATE INDEX "SkuPrice_valid_from_idx" ON "master_data"."SkuPrice"("valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPrice_code_key" ON "master_data"."WorkPrice"("code");

-- CreateIndex
CREATE INDEX "WorkPrice_category_id_idx" ON "master_data"."WorkPrice"("category_id");

-- CreateIndex
CREATE INDEX "WorkPrice_vendor_party_id_idx" ON "master_data"."WorkPrice"("vendor_party_id");

-- CreateIndex
CREATE INDEX "WorkPrice_is_current_is_active_idx" ON "master_data"."WorkPrice"("is_current", "is_active");

-- CreateIndex
CREATE INDEX "WorkPrice_deleted_at_idx" ON "master_data"."WorkPrice"("deleted_at");

-- CreateIndex
CREATE INDEX "WorkPriceProjectRef_project_id_idx" ON "master_data"."WorkPriceProjectRef"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPriceProjectRef_work_price_id_project_id_key" ON "master_data"."WorkPriceProjectRef"("work_price_id", "project_id");

-- CreateIndex
CREATE INDEX "Sample_sku_id_idx" ON "master_data"."Sample"("sku_id");

-- CreateIndex
CREATE INDEX "Sample_status_idx" ON "master_data"."Sample"("status");

-- CreateIndex
CREATE INDEX "Sample_rack_number_box_number_idx" ON "master_data"."Sample"("rack_number", "box_number");

-- CreateIndex
CREATE INDEX "Sample_deleted_at_idx" ON "master_data"."Sample"("deleted_at");

-- CreateIndex
CREATE INDEX "SampleMovement_sample_id_created_at_idx" ON "master_data"."SampleMovement"("sample_id", "created_at");

-- CreateIndex
CREATE INDEX "MasterDataAudit_entity_entity_id_created_at_idx" ON "master_data"."MasterDataAudit"("entity", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "MasterDataAudit_created_at_idx" ON "master_data"."MasterDataAudit"("created_at");

-- AddForeignKey
ALTER TABLE "master_data"."PartyRole" ADD CONSTRAINT "PartyRole_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "master_data"."Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."PartyContact" ADD CONSTRAINT "PartyContact_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "master_data"."Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."PartyContact" ADD CONSTRAINT "PartyContact_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "master_data"."Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."PartyLink" ADD CONSTRAINT "PartyLink_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "master_data"."Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."Brand" ADD CONSTRAINT "Brand_owner_party_id_fkey" FOREIGN KEY ("owner_party_id") REFERENCES "master_data"."Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."BrandLink" ADD CONSTRAINT "BrandLink_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "master_data"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."BrandSupplier" ADD CONSTRAINT "BrandSupplier_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "master_data"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."BrandSupplier" ADD CONSTRAINT "BrandSupplier_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "master_data"."Party"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."Category" ADD CONSTRAINT "Category_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "master_data"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."BrandCategory" ADD CONSTRAINT "BrandCategory_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "master_data"."Brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."BrandCategory" ADD CONSTRAINT "BrandCategory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "master_data"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."SkuCategory" ADD CONSTRAINT "SkuCategory_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "master_data"."Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."SkuCategory" ADD CONSTRAINT "SkuCategory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "master_data"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."Sku" ADD CONSTRAINT "Sku_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "master_data"."Brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."SkuMedia" ADD CONSTRAINT "SkuMedia_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "master_data"."Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."SkuPrice" ADD CONSTRAINT "SkuPrice_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "master_data"."Sku"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."SkuPrice" ADD CONSTRAINT "SkuPrice_supplier_party_id_fkey" FOREIGN KEY ("supplier_party_id") REFERENCES "master_data"."Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."SkuPrice" ADD CONSTRAINT "SkuPrice_source_link_id_fkey" FOREIGN KEY ("source_link_id") REFERENCES "master_data"."BrandLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."WorkPrice" ADD CONSTRAINT "WorkPrice_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "master_data"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."WorkPrice" ADD CONSTRAINT "WorkPrice_vendor_party_id_fkey" FOREIGN KEY ("vendor_party_id") REFERENCES "master_data"."Party"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."WorkPriceProjectRef" ADD CONSTRAINT "WorkPriceProjectRef_work_price_id_fkey" FOREIGN KEY ("work_price_id") REFERENCES "master_data"."WorkPrice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."Sample" ADD CONSTRAINT "Sample_sku_id_fkey" FOREIGN KEY ("sku_id") REFERENCES "master_data"."Sku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_data"."SampleMovement" ADD CONSTRAINT "SampleMovement_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "master_data"."Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

