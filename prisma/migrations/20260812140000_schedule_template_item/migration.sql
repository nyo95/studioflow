-- Tambah tabel ScheduleTemplateItem: item default yang dipasang ke proyek baru.
-- Format data_snapshot identik dengan ProjectScheduleOption.data_snapshot.
-- Snapshot beku, disalin saat apply, tidak ada propagasi (keputusan owner 2026-08-12).
CREATE TABLE "studioflow"."ScheduleTemplateItem" (
  -- id: TEXT (bukan UUID) supaya konsisten dengan seluruh tabel lain dan
  -- schema.prisma (`String @id @default(uuid())` — UUID di-generate klien).
  -- Kolom ini direferensikan dari ProjectScheduleEntry.template_item_id (TEXT);
  -- FK text->uuid tidak bisa dibuat di PostgreSQL ("cannot be implemented").
  "id"                TEXT NOT NULL,
  "section"           "studioflow"."ProductType" NOT NULL DEFAULT 'material',
  "schedule_category" TEXT NOT NULL,
  "sort_order"        INTEGER NOT NULL,
  "data_snapshot"     JSONB NOT NULL,
  "sku_id"            TEXT,
  "is_active"         BOOLEAN NOT NULL DEFAULT true,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ScheduleTemplateItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduleTemplateItem_section_schedule_category_sort_order_idx"
  ON "studioflow"."ScheduleTemplateItem"("section", "schedule_category", "sort_order");

-- Tambah kolom template_item_id ke ProjectScheduleEntry.
-- onDelete: SetNull — menghapus template item TIDAK menghapus kartu proyek.
ALTER TABLE "studioflow"."ProjectScheduleEntry"
  ADD COLUMN "template_item_id" TEXT;

ALTER TABLE "studioflow"."ProjectScheduleEntry"
  ADD CONSTRAINT "ProjectScheduleEntry_template_item_id_fkey"
  FOREIGN KEY ("template_item_id")
  REFERENCES "studioflow"."ScheduleTemplateItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ProjectScheduleEntry_project_id_template_item_id_idx"
  ON "studioflow"."ProjectScheduleEntry"("project_id", "template_item_id");
