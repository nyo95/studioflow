-- AlterEnum
ALTER TYPE "master_data"."SampleStatus" ADD VALUE 'SENT_TO_CLIENT';

-- DropIndex
DROP INDEX "master_data"."Category_kind_slug_key";

-- CreateIndex
CREATE INDEX "Brand_slug_idx" ON "master_data"."Brand"("slug");

-- CreateIndex
CREATE INDEX "Category_kind_slug_idx" ON "master_data"."Category"("kind", "slug");

-- CreateIndex
CREATE INDEX "Party_slug_idx" ON "master_data"."Party"("slug");
