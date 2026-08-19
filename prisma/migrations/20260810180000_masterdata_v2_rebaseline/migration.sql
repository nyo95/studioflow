-- Master Data v2 rebaseline — dijalankan manual 2026-08-10 lewat
-- prisma/migrations-masterdata-v2/{01..04}*.sql terhadap DB, BUKAN lewat
-- 'prisma migrate deploy'. Berkas ini baseline riwayat migrasi Prisma;
-- ditandai applied lewat 'prisma migrate resolve --applied', tidak
-- dieksekusi ulang. Isinya gabungan verbatim keempat berkas sumber.
-- Lihat prisma/migrations-masterdata-v2/README.md untuk konteks penuh.

-- =============================================================================
-- SUMBER: prisma/migrations-masterdata-v2/01_drop_master_data_v1.sql
-- =============================================================================
-- =============================================================================
-- 01 — Buang master_data v1
-- =============================================================================
-- DESTRUKTIF. Menghapus seluruh isi schema `master_data`.
--
-- Keputusan owner 2026-08-10: *"DROP AJA - data kita mulai dari 0, gausa di
-- seeding."* Tidak ada ekspor, tidak ada rekonsiliasi, tidak ada seeding ulang.
--
-- Yang ikut hilang dan disadari: 392 Brand, 399 kontak, 1010 link, 756
-- MaterialCandidate, 287 SampleCandidate, seluruh Company hasil backfill, dan
-- semua harga yang diketik sejak 5 Agustus. Sumber pemulihannya tetap ada di
-- `docs/masterdata-seed/*.csv` dan `docs/RAD - Material + Supplier.xlsx` kalau
-- suatu saat keputusannya berubah — tapi jalur seeding-nya TIDAK dijalankan.
--
-- Jalankan sekali, di dalam satu transaksi.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- Langkah 1 — lepas lima FK dari `studioflow` secara EKSPLISIT
-- -----------------------------------------------------------------------------
-- `DROP SCHEMA ... CASCADE` di langkah 2 akan menghapus constraint ini sendiri.
-- Dilakukan manual lebih dulu karena tiga alasan:
--
--   1. CASCADE menghapus tanpa menyebut apa yang dihapusnya. Kalau ada FK lain
--      yang tidak kita ketahui, ia ikut hilang diam-diam.
--   2. Kelima constraint ini justru YANG DITUJU — §M5 memang melepasnya.
--      Menjadikannya langkah bernama membuat niatnya terbaca di log.
--   3. Kolomnya TIDAK ikut terhapus, hanya constraint-nya. Itu yang diinginkan:
--      `ProjectScheduleOption.sku_id` tetap ada sebagai kolom biasa.
--
-- IF EXISTS: aman dijalankan ulang, dan aman kalau DB-nya belum pernah
-- menerapkan migrasi yang membuat constraint ini.

ALTER TABLE "studioflow"."ProjectProductRequest"
  DROP CONSTRAINT IF EXISTS "ProjectProductRequest_brand_id_fkey",
  DROP CONSTRAINT IF EXISTS "ProjectProductRequest_sku_id_fkey",
  DROP CONSTRAINT IF EXISTS "ProjectProductRequest_linked_sample_id_fkey";

ALTER TABLE "studioflow"."ProjectScheduleOption"
  DROP CONSTRAINT IF EXISTS "ProjectScheduleOption_sku_id_fkey",
  DROP CONSTRAINT IF EXISTS "ProjectScheduleOption_spec_brand_id_fkey";

-- -----------------------------------------------------------------------------
-- Langkah 2 — buang schemanya
-- -----------------------------------------------------------------------------
-- Termasuk seluruh tabel, enum, index, dan view di dalamnya.

DROP SCHEMA IF EXISTS "master_data" CASCADE;

-- -----------------------------------------------------------------------------
-- Langkah 3 — bersihkan riwayat migrasi v1 yang menyentuh master_data
-- -----------------------------------------------------------------------------
-- TIDAK dilakukan di sini, dan itu disengaja.
--
-- `_prisma_migrations` adalah catatan APA YANG PERNAH DIJALANKAN, bukan
-- gambaran keadaan sekarang. Menghapus barisnya membuat `migrate status`
-- berbohong tentang masa lalu, dan tidak membuat apa pun jadi lebih benar.
--
-- Baseline v2 masuk sebagai migrasi BARU di atasnya (lihat README §Setelah).

COMMIT;

-- Verifikasi sesudah COMMIT — keduanya harus mengembalikan nol baris:
--
--   SELECT schema_name FROM information_schema.schemata
--    WHERE schema_name = 'master_data';
--
--   SELECT conname FROM pg_constraint
--    WHERE conname LIKE 'ProjectScheduleOption_sku_id_fkey'
--       OR conname LIKE 'ProjectProductRequest_%_fkey' AND conname LIKE '%sku%';
--
-- Dan yang ini HARUS masih ada (kolomnya bertahan, hanya FK-nya yang lepas):
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'studioflow'
--      AND table_name = 'ProjectScheduleOption'
--      AND column_name IN ('sku_id', 'spec_brand_id');

-- =============================================================================
-- SUMBER: prisma/migrations-masterdata-v2/02_create_master_data_v2.sql
-- =============================================================================
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


-- =============================================================================
-- SUMBER: prisma/migrations-masterdata-v2/03_invariants.sql
-- =============================================================================
-- =============================================================================
-- 03 — Invariant yang tidak bisa dinyatakan Prisma
-- =============================================================================
-- ⚠️ TANPA BERKAS INI, EMPAT ATURAN DI RANCANGAN TIDAK DITEGAKKAN APA PUN —
-- dan `prisma validate` tetap hijau. Itu yang membuatnya paling mudah terlewat.
--
-- Prisma tidak bisa mendeklarasikan partial index, expression index, generated
-- column, maupun GIN. Semuanya di sini.
--
-- Jalankan SESUDAH `02_create_master_data_v2.sql`.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Tepat satu harga berlaku per (SKU × supplier)
-- -----------------------------------------------------------------------------
-- `is_current` adalah denormalisasi yang disengaja: tanpanya "harga yang
-- berlaku sekarang" butuh window function di tiap pembacaan. Harganya adalah
-- invariant ini, yang harus dijaga di sini.
--
-- COALESCE wajib. `supplier_party_id` nullable, dan di Postgres NULL ≠ NULL,
-- jadi index polos akan meloloskan dua baris is_current yang sama-sama tanpa
-- supplier — persis kasus "harga list dari pabrikan" yang paling sering ada.

-- Tanda kurung GANDA di sekitar COALESCE bukan kelebihan ketik: Postgres
-- mensyaratkannya untuk expression index, dan hanya membolehkan penghilangannya
-- pada pemanggilan fungsi biasa. COALESCE bukan itu — ia konstruksi mirip CASE.

CREATE UNIQUE INDEX "SkuPrice_current_uniq"
  ON "master_data"."SkuPrice" (
    "sku_id",
    (COALESCE("supplier_party_id", '00000000-0000-0000-0000-000000000000'))
  )
  WHERE "is_current";

-- -----------------------------------------------------------------------------
-- 2. Keunikan Sku yang @@unique tidak bisa jaga
-- -----------------------------------------------------------------------------
-- `@@unique([brand_id, slug])` tidak menjaga baris ber-brand_id NULL — barang
-- generik seperti "plywood 9mm" yang memang sah tanpa merek (Excel Table 2
-- kolom D: "apabila tidak ada brand bisa dikosongkan").

CREATE UNIQUE INDEX "Sku_slug_nobrand_uniq"
  ON "master_data"."Sku" (lower("slug"))
  WHERE "brand_id" IS NULL AND "deleted_at" IS NULL;

-- `code` nullable sejak keputusan Q7 (kode artikel adalah fakta tentang barang,
-- bukan kunci basis data). Tapi DI MANA ia terisi, ia harus unik per merek —
-- dua barang dengan kode artikel sama adalah salah ketik, bukan dua barang.

CREATE UNIQUE INDEX "Sku_brand_code_uniq"
  ON "master_data"."Sku" ("brand_id", upper("code"))
  WHERE "code" IS NOT NULL AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "Sku_code_nobrand_uniq"
  ON "master_data"."Sku" (upper("code"))
  WHERE "code" IS NOT NULL AND "brand_id" IS NULL AND "deleted_at" IS NULL;

-- -----------------------------------------------------------------------------
-- 3. Tepat satu kategori utama per SKU
-- -----------------------------------------------------------------------------
-- Menggantikan konvensi v1 "tag pertama adalah yang utama" — konvensi urutan
-- yang rusak tanpa suara begitu ada yang menyortir ulang.

CREATE UNIQUE INDEX "SkuCategory_primary_uniq"
  ON "master_data"."SkuCategory" ("sku_id")
  WHERE "is_primary";

-- -----------------------------------------------------------------------------
-- 4. total_price tidak mungkin menyimpang dari komponennya
-- -----------------------------------------------------------------------------
-- v1 menyimpan `total_price` sebagai kolom biasa dengan komentar "derived" —
-- niat yang benar, jaminan yang tidak ada. Satu jalur tulis yang lupa
-- menghitung ulang cukup untuk membuatnya berbohong.
--
-- Kolom generated memindahkan jaminan itu ke database, tempat tidak ada jalur
-- tulis yang bisa melewatinya. Prisma memperlakukannya read-only.

ALTER TABLE "master_data"."WorkPrice" DROP COLUMN "total_price";
ALTER TABLE "master_data"."WorkPrice"
  ADD COLUMN "total_price" DECIMAL(16,2)
  GENERATED ALWAYS AS (
    COALESCE("material_price", 0) + COALESCE("labor_price", 0)
  ) STORED;

-- -----------------------------------------------------------------------------
-- 5. Kolom `qty` tidak boleh dipakai
-- -----------------------------------------------------------------------------
-- Keputusan owner Q12: kolom "Qty" di Excel disimpan apa adanya, tapi tidak
-- dipakai — artinya memang belum jelas ("need curations" ditulis penulisnya
-- sendiri). COMMENT ini yang mencegahnya diam-diam masuk perhitungan nanti,
-- karena ia terbaca di `\d+` dan di tiap tool introspeksi.

COMMENT ON COLUMN "master_data"."SkuPrice"."qty" IS 'TIDAK DIPAKAI. Kolom Qty dari design database masterdata.xlsx Table 2, ditandai sumbernya sendiri "(need curations)". Disimpan atas keputusan owner 2026-08-10 tanpa arti yang ditetapkan. JANGAN masukkan ke perhitungan apa pun dan jangan ekspos ke view BQ/Library: price selalu berarti harga per satu unit.';

-- -----------------------------------------------------------------------------
-- 6. Index parsial untuk baris hidup
-- -----------------------------------------------------------------------------
-- Tabel yang sebagian isinya soft-deleted membuat index penuh membaca baris
-- yang tidak akan pernah ditampilkan.

CREATE INDEX "Sku_active_idx"
  ON "master_data"."Sku" ("kind", "status") WHERE "deleted_at" IS NULL;

CREATE INDEX "Party_active_idx"
  ON "master_data"."Party" ("type") WHERE "deleted_at" IS NULL;

CREATE INDEX "Brand_active_idx"
  ON "master_data"."Brand" ("owner_party_id") WHERE "deleted_at" IS NULL;

-- -----------------------------------------------------------------------------
-- 7. spec JSON tetap bisa dicari
-- -----------------------------------------------------------------------------
-- Excel meminta Specification 1/2 disimpan sebagai JSON, dan itu benar —
-- atribut opsional berjumlah tidak tetap. GIN yang membuatnya tidak jadi
-- lubang hitam: tanpa index, tiap pencarian spec adalah sequential scan.

CREATE INDEX "Sku_spec_gin"
  ON "master_data"."Sku" USING GIN ("spec" jsonb_path_ops);

CREATE INDEX "WorkPrice_spec_gin"
  ON "master_data"."WorkPrice" USING GIN ("spec" jsonb_path_ops);

-- -----------------------------------------------------------------------------
-- 8. Pencarian nama — substring, bukan prefix
-- -----------------------------------------------------------------------------
-- Ini yang membuat Library bisa menjawab "gw mau cari terazzo, merek apa aja
-- ya?". Tanpa pg_trgm, `name ILIKE '%terazzo%'` selalu sequential scan.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Brand_name_trgm"
  ON "master_data"."Brand" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Party_name_trgm"
  ON "master_data"."Party" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Category_name_trgm"
  ON "master_data"."Category" USING GIN ("name" gin_trgm_ops);

CREATE INDEX "Sku_name_trgm"
  ON "master_data"."Sku" USING GIN ("name" gin_trgm_ops);

COMMIT;

-- =============================================================================
-- Yang sengaja TIDAK dilakukan
-- =============================================================================
-- - Tanpa `citext`. Dedup case-insensitive ditangani kolom `slug` yang sudah
--   ternormalisasi. citext menular ke setiap perbandingan dan memecahkan
--   kesetaraan dengan cara yang mengejutkan orang enam bulan kemudian.
--
-- - Tanpa partisi tabel. Volumenya ribuan baris, bukan puluhan juta.
--
-- - Tanpa materialized view "harga termurah". `is_current` + index sudah
--   membuatnya satu index scan. MV butuh strategi refresh, dan strategi refresh
--   butuh orang yang mengingatnya.
--
-- - Tanpa trigger validasi PartyRole. Penjaganya service layer dulu; trigger
--   baru kalau terbukti ada yang lolos. Kompleksitas tanpa bukti masalah tetap
--   harus dirawat.

-- =============================================================================
-- SUMBER: prisma/migrations-masterdata-v2/04_views_and_grants.sql
-- =============================================================================
-- =============================================================================
-- 04 — Kontrak SSOT: view + hak akses
-- =============================================================================
-- Master Data adalah SSOT untuk StudioFlow (sekarang) dan BQ (nanti).
-- SSOT berarti SATU PENULIS, BANYAK PEMBACA — dan pembacanya membaca lewat
-- permukaan yang bisa distabilkan, bukan langsung ke tabel.
--
-- Keputusan owner 2026-08-10:
--   - StudioFlow membaca TEPAT SATU view: v_library_brand.
--     Card brand + link, untuk menjawab "gw mau cari terazzo, merek apa aja ya?"
--   - Schedule dan SketchUp TIDAK BOLEH memilih SKU dari Master Data.
--   - Hanya app Master Data yang menulis.
--
-- Jalankan SESUDAH `03_invariants.sql`.
-- =============================================================================

BEGIN;

-- =============================================================================
-- v_library_brand — Table 1 kolom A–G, tidak lebih
-- =============================================================================
-- Lingkupnya PERSIS bagian Excel yang di-screenshot owner:
--   A Company · B Brand · C Product Brand · D Category · E–G Link
--
-- Yang TIDAK ada di sini, dan itu inti keputusannya:
--   Sku, SkuPrice, WorkPrice, PartyContact, Sample — satu pun tidak.
--
-- Card hanya memunculkan link; katalog produknya dibuka di Drive atau website
-- milik brand itu sendiri.

CREATE VIEW "master_data"."v_library_brand" AS
SELECT
  b."id"          AS brand_id,
  b."name"        AS brand_name,          -- Table 1 kolom C "Product Brand"
  b."slug"        AS brand_slug,

  p."id"          AS company_id,
  p."name"        AS company_name,        -- Table 1 kolom B "Brand"
  p."legal_name"  AS company_legal_name,  -- Table 1 kolom A "Company"

  -- Table 1 kolom D. Array supaya filter kategori jadi satu query, bukan join
  -- yang menggandakan baris brand.
  COALESCE((
    SELECT array_agg(c."name" ORDER BY bc."sort_order", c."name")
    FROM "master_data"."BrandCategory" bc
    JOIN "master_data"."Category" c ON c."id" = bc."category_id"
    WHERE bc."brand_id" = b."id" AND c."is_active"
  ), ARRAY[]::text[]) AS categories,

  COALESCE((
    SELECT array_agg(c."slug" ORDER BY bc."sort_order", c."slug")
    FROM "master_data"."BrandCategory" bc
    JOIN "master_data"."Category" c ON c."id" = bc."category_id"
    WHERE bc."brand_id" = b."id" AND c."is_active"
  ), ARRAY[]::text[]) AS category_slugs,

  -- Table 1 kolom E–G. HANYA kind yang ada di Excel: Google Drive, Website,
  -- Socmed.
  --
  -- PRICE_LIST dan MARKETPLACE sengaja TIDAK di sini, meski keduanya ada di
  -- `ALLOWED_LINK_KINDS` hari ini. Keduanya masuk allowlist justru sebagai
  -- akibat keputusan 1 Agu "ada harga ga masalah" — dan lingkup Library yang
  -- baru tidak menampilkan produk sama sekali, jadi tidak ada harga untuk
  -- diizinkan. WHATSAPP juga tidak: kanal kontak, bukan katalog.
  --
  -- `archive_url` didahulukan supaya link brand yang mati tidak mematikan card.
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'kind',  l."kind",
        'url',   COALESCE(l."archive_url", l."url"),
        'label', l."label"
      ) ORDER BY l."sort_order", l."kind"
    )
    FROM "master_data"."BrandLink" l
    WHERE l."brand_id" = b."id"
      AND l."kind" IN ('DRIVE', 'WEBSITE', 'INSTAGRAM', 'FACEBOOK',
                       'TIKTOK', 'YOUTUBE', 'LINKEDIN')
  ), '[]'::jsonb) AS links

FROM "master_data"."Brand" b
LEFT JOIN "master_data"."Party" p ON p."id" = b."owner_party_id"
WHERE b."deleted_at" IS NULL
  AND b."is_active";

COMMENT ON VIEW "master_data"."v_library_brand" IS 'Kontrak baca StudioFlow Library. Lingkup: design database masterdata.xlsx Table 1 kolom A-G. JANGAN tambahkan kolom produk, harga, kontak, atau sampel ke sini - itu penyimpangan dari Table 1 dan harus diputuskan owner dulu.';

-- =============================================================================
-- v_bq_material_rate — harga material untuk BQ
-- =============================================================================
-- BQ belum dibangun. View ini ada SEKARANG justru supaya bentuk akhirnya bisa
-- diubah nanti dengan menulis ulang view — tanpa migrasi tabel dan tanpa
-- menyentuh Library. Membangun BQ langsung di atas tabel akan membekukan bentuk
-- SkuPrice pada tebakan pertama.
--
-- Satu baris per PENAWARAN yang berlaku (SKU × supplier), bukan per SKU: BQ
-- memang perlu membandingkan.

CREATE VIEW "master_data"."v_bq_material_rate" AS
SELECT
  sp."id"          AS price_id,
  s."id"           AS sku_id,
  s."code"         AS sku_code,
  s."name"         AS sku_name,
  b."name"         AS brand_name,

  -- Kategori utama + jalurnya, untuk sectioning dokumen BQ.
  pc."name"        AS category_name,
  pc."path"        AS category_path,

  s."spec",
  s."dim_display",
  s."dim_length", s."dim_width", s."dim_height", s."dim_unit",

  sp."unit",
  sp."price_list",
  sp."price_net",
  sp."currency",

  sup."id"         AS supplier_id,
  sup."name"       AS supplier_name,

  sp."valid_from",
  sp."notes",

  -- "Siap BQ" (roadmap §Peta schema): harga sebelum diskon + setelah diskon +
  -- satuan terisi. Dihitung di view, BUKAN kolom — keadaan turunan tidak
  -- pernah butuh tempat penyimpanan sendiri.
  (sp."price_list" IS NOT NULL
   AND sp."price_net" IS NOT NULL
   AND sp."unit" IS NOT NULL)          AS bq_ready

FROM "master_data"."SkuPrice" sp
JOIN "master_data"."Sku" s        ON s."id" = sp."sku_id"
LEFT JOIN "master_data"."Brand" b ON b."id" = s."brand_id"
LEFT JOIN "master_data"."SkuCategory" sc
       ON sc."sku_id" = s."id" AND sc."is_primary"
LEFT JOIN "master_data"."Category" pc ON pc."id" = sc."category_id"
LEFT JOIN "master_data"."Party" sup   ON sup."id" = sp."supplier_party_id"
WHERE sp."is_current"
  AND s."deleted_at" IS NULL
  AND s."status" <> 'DISCONTINUED';

-- Catatan sengaja: kolom `qty` di SkuPrice TIDAK diekspos. Artinya belum
-- ditetapkan (Q12), dan angka tanpa arti yang masuk BQ adalah cara paling
-- senyap merusak dokumen komersial.

COMMENT ON VIEW "master_data"."v_bq_material_rate" IS 'Kontrak baca BQ untuk harga material. Satu baris per penawaran yang berlaku (SKU x supplier). Kolom qty sengaja tidak diekspos - artinya belum ditetapkan.';

-- =============================================================================
-- v_bq_work_rate — Table 3 + Table 4, satu view
-- =============================================================================
-- Table 3 (material + upah) dan Table 4 (upah murni) dibedakan DATA, bukan
-- struktur: `material_price` NULL berarti upah murni. `has_material` membuat
-- pembedaan itu terbaca tanpa BQ perlu tahu aturannya.

CREATE VIEW "master_data"."v_bq_work_rate" AS
SELECT
  w."id"           AS work_price_id,
  w."code",
  w."name",                              -- jawaban kolom "Items" di Excel

  -- Dua tingkat kategori Excel ("Vendor Category" + "Category") diambil dari
  -- pohon yang sama: daun dan induknya.
  c."name"         AS category_name,     -- "Lighting", "Floor Works"
  parent."name"    AS vendor_category,   -- "MEP", "Sipil", "Furniture"
  c."path"         AS category_path,

  v."id"           AS vendor_id,
  v."name"         AS vendor_name,

  w."spec",
  w."dim_display",
  w."unit",
  w."material_price",
  w."labor_price",
  w."total_price",
  w."currency",
  w."scope_note",
  w."notes",
  w."valid_from",

  (w."material_price" IS NOT NULL AND w."material_price" > 0) AS has_material,

  -- Excel kolom "Project Reference" — dinormalisasi jadi baris di
  -- WorkPriceProjectRef, dirakit kembali di sini untuk ditampilkan.
  COALESCE((
    SELECT array_agg(r."project_name" ORDER BY r."used_at" DESC NULLS LAST)
    FROM "master_data"."WorkPriceProjectRef" r
    WHERE r."work_price_id" = w."id"
  ), ARRAY[]::text[]) AS project_refs

FROM "master_data"."WorkPrice" w
JOIN "master_data"."Category" c            ON c."id" = w."category_id"
LEFT JOIN "master_data"."Category" parent  ON parent."id" = c."parent_id"
LEFT JOIN "master_data"."Party" v          ON v."id" = w."vendor_party_id"
WHERE w."is_current"
  AND w."is_active"
  AND w."deleted_at" IS NULL;

COMMENT ON VIEW "master_data"."v_bq_work_rate" IS 'Kontrak baca BQ untuk tarif pekerjaan. Table 3 + Table 4 xlsx digabung; has_material membedakan keduanya. TIDAK boleh diekspos ke StudioFlow.';

COMMIT;

-- =============================================================================
-- HAK AKSES — jalankan setelah role aplikasinya ada
-- =============================================================================
-- Bagian ini yang mengubah kontrak dari KESEPAKATAN jadi ATURAN. Tanpanya,
-- ketiga view di atas hanya saran yang bisa dilewati query berikutnya.
--
-- Butuh role terpisah per app. Kalau sekarang semua app memakai satu user
-- Postgres yang sama, langkah ini TIDAK BISA dijalankan apa adanya — dan itu
-- temuan tersendiri, bukan alasan melewatinya. Lihat README §Prasyarat.
--
-- Diberi komentar supaya tidak ikut jalan sebelum rolenya disiapkan.

-- CREATE ROLE studioflow_app LOGIN PASSWORD '...';
-- CREATE ROLE bq_app         LOGIN PASSWORD '...';
-- CREATE ROLE masterdata_app LOGIN PASSWORD '...';

-- -- Master Data: satu-satunya penulis.
-- GRANT USAGE ON SCHEMA "master_data" TO masterdata_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE
--   ON ALL TABLES IN SCHEMA "master_data" TO masterdata_app;
-- ALTER DEFAULT PRIVILEGES IN SCHEMA "master_data"
--   GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO masterdata_app;

-- -- StudioFlow: satu view, baca saja.
-- REVOKE ALL ON ALL TABLES IN SCHEMA "master_data" FROM studioflow_app;
-- GRANT USAGE  ON SCHEMA "master_data"                     TO studioflow_app;
-- GRANT SELECT ON "master_data"."v_library_brand"          TO studioflow_app;

-- -- BQ: dua view, baca saja.
-- REVOKE ALL ON ALL TABLES IN SCHEMA "master_data" FROM bq_app;
-- GRANT USAGE  ON SCHEMA "master_data"                     TO bq_app;
-- GRANT SELECT ON "master_data"."v_bq_material_rate"       TO bq_app;
-- GRANT SELECT ON "master_data"."v_bq_work_rate"           TO bq_app;

-- =============================================================================
-- Uji yang membuktikan batasnya benar-benar ada
-- =============================================================================
-- Dijalankan SEBAGAI studioflow_app. Nomor 1 yang paling penting: kalau ia
-- LOLOS, seluruh berkas ini hanya dokumentasi.
--
--   1. SELECT * FROM master_data."Sku" LIMIT 1;        -- harus DITOLAK
--   2. SELECT * FROM master_data."SkuPrice" LIMIT 1;   -- harus DITOLAK
--   3. SELECT * FROM master_data.v_library_brand LIMIT 1;  -- harus BOLEH
--   4. Kolom hasil (3) harus TEPAT SEMBILAN: brand_id, brand_name, brand_slug,
--      company_id, company_name, company_legal_name, categories,
--      category_slugs, links — tanpa satu pun kolom produk/harga/kontak/sampel
--   5. SELECT jsonb_array_elements(links)->>'kind' FROM master_data.v_library_brand
--      → tidak boleh memuat PRICE_LIST, MARKETPLACE, WHATSAPP, CATALOG, OTHER

