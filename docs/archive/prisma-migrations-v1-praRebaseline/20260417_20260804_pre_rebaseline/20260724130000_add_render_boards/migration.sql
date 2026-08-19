-- Non-destructive: additive tables + enum for render annotation boards.
CREATE TYPE "RenderLabelSide" AS ENUM ('auto', 'left', 'right');

CREATE TABLE "RenderBoard" (
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

CREATE TABLE "RenderAnnotation" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "schedule_entry_id" TEXT,
    "pin_x" DOUBLE PRECISION NOT NULL,
    "pin_y" DOUBLE PRECISION NOT NULL,
    "label_side" "RenderLabelSide" NOT NULL DEFAULT 'auto',
    "note" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RenderAnnotation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RenderBoard_project_id_sort_order_idx" ON "RenderBoard"("project_id", "sort_order");
CREATE INDEX "RenderAnnotation_board_id_sort_order_idx" ON "RenderAnnotation"("board_id", "sort_order");

ALTER TABLE "RenderBoard" ADD CONSTRAINT "RenderBoard_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RenderAnnotation" ADD CONSTRAINT "RenderAnnotation_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "RenderBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RenderAnnotation" ADD CONSTRAINT "RenderAnnotation_schedule_entry_id_fkey" FOREIGN KEY ("schedule_entry_id") REFERENCES "ProjectScheduleEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
