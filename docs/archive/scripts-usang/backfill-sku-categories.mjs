/**
 * C12 Backfill — SkuCategory dari catalog_tags
 *
 * Jalankan SETELAH:
 *   1. prisma migrate deploy (atau migrate dev) untuk migrasi 20260806120000_add_sku_category
 *   2. npx prisma generate
 *
 * Perintah:
 *   node scripts/backfill-sku-categories.mjs
 *
 * Apa yang dilakukan:
 *   Untuk setiap SKU aktif, baca catalog_tags[] → upsert Category (by slug) →
 *   upsert SkuCategory (sku_id + category_id + sort_order).
 *   Idempotent: aman dijalankan ulang.
 */

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

function slugify(tag) {
  return tag.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

async function main() {
  const skus = await prisma.sku.findMany({
    where: { deleted_at: null, catalog_tags: { isEmpty: false } },
    select: { id: true, catalog_tags: true, brand_id: true },
  });

  console.log(`Backfilling SkuCategory for ${skus.length} SKUs…`);

  let created = 0;
  let skipped = 0;

  for (const sku of skus) {
    for (const [index, tag] of sku.catalog_tags.entries()) {
      const slug = slugify(tag);
      if (!slug) continue;

      const category = await prisma.category.upsert({
        where: { slug },
        create: { name: tag, slug, is_active: true },
        update: { is_active: true },
      });

      const existing = await prisma.skuCategory.findUnique({
        where: { sku_id_category_id: { sku_id: sku.id, category_id: category.id } },
      });

      if (existing) {
        if (existing.sort_order !== index) {
          await prisma.skuCategory.update({
            where: { id: existing.id },
            data: { sort_order: index },
          });
        }
        skipped++;
      } else {
        await prisma.skuCategory.create({
          data: { sku_id: sku.id, category_id: category.id, sort_order: index },
        });
        created++;
      }
    }
  }

  console.log(`Done. Created: ${created}, already existed: ${skipped}.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
