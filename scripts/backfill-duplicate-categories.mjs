#!/usr/bin/env node
/**
 * BACKFILL — merge duplicate categories created by the B7 bug
 *
 *   node scripts/backfill-duplicate-categories.mjs            # dry-run (default)
 *   node scripts/backfill-duplicate-categories.mjs --apply    # write
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * Before the 2026-08-18 fix to `category-tree-service.ts` (`upsertCategory`'s
 * `needsParent` branch), typing a plain category ("Plywood") and later typing
 * it again under a parent ("Bahan Baku > Plywood") did not re-parent the
 * first row — it silently created a SECOND row with the same `(kind, name)`,
 * one at the root and one nested. SKUs, brands, and work-price rows filed
 * before the parent existed are still pointed at the orphaned root row; the
 * dropdown shows "Plywood" twice, and only the nested one is reachable from
 * `LIKE 'bahan-baku/%'` reads.
 *
 * ============================================================================
 * WHAT COUNTS AS A SAFE MERGE, AND WHAT DOES NOT
 * ============================================================================
 * This script only touches a group that is EXACTLY one root row + one nested
 * row sharing `(kind, name)`, where the root row has no children of its own.
 * That is the exact shape the B7 bug produces. Anything else — two roots,
 * two nested rows under different parents, a root that has its own
 * sub-tree — is a coincidence of naming, not a proven duplicate, and is
 * reported under "NEEDS MANUAL REVIEW" instead of guessed at. Same rule as
 * `backfill-party-roles.mjs`: assign only what the data already proves.
 *
 * For each safe pair, the OLDER row (the root — it can only have been
 * created first, since re-parenting never worked) is merged INTO the nested
 * one: every `SkuCategory`, `BrandCategory`, and `WorkPrice` reference is
 * repointed, then the root row is deactivated (`is_active: false` — the
 * same soft-delete `Category` already uses everywhere else). Nothing is
 * hard-deleted; `onDelete: Restrict` on all three references would refuse it
 * anyway, and a wrong merge is far easier to undo than a wrong delete.
 */

import { PrismaClient } from "../src/generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const APPLY = process.argv.includes("--apply");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function recordAudit(tx, { entity, entity_id, action, actor, changes }) {
  await tx.masterDataAudit.create({
    data: {
      entity,
      entity_id,
      action,
      actor_id: actor.id ?? null,
      actor_name: actor.name,
      changes: changes ?? undefined,
    },
  });
}

async function main() {
  const categories = await prisma.category.findMany({
    where: { is_active: true },
    select: { id: true, kind: true, name: true, parent_id: true, path: true, created_at: true },
    orderBy: { created_at: "asc" },
  });

  const groups = new Map();
  for (const c of categories) {
    const key = `${c.kind}::${c.name.trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  const planned = [];
  const ambiguous = [];

  for (const [key, rows] of groups) {
    if (rows.length < 2) continue;

    const roots = rows.filter((r) => r.parent_id === null);
    const nested = rows.filter((r) => r.parent_id !== null);

    if (rows.length !== 2 || roots.length !== 1 || nested.length !== 1) {
      ambiguous.push({ key, rows });
      continue;
    }

    const [root] = roots;
    const [canonical] = nested;

    const rootChildren = await prisma.category.count({
      where: { parent_id: root.id, is_active: true },
    });
    if (rootChildren > 0) {
      ambiguous.push({ key, rows, reason: `root has ${rootChildren} sub-categor${rootChildren === 1 ? "y" : "ies"} of its own` });
      continue;
    }

    const [skuRefs, brandRefs, workPriceRefs] = await Promise.all([
      prisma.skuCategory.count({ where: { category_id: root.id } }),
      prisma.brandCategory.count({ where: { category_id: root.id } }),
      prisma.workPrice.count({ where: { category_id: root.id } }),
    ]);

    planned.push({ root, canonical, skuRefs, brandRefs, workPriceRefs });
  }

  console.log("");
  console.log("DUPLICATE CATEGORY BACKFILL");
  console.log("=".repeat(72));
  console.log(`Active categories           : ${categories.length}`);
  console.log(`(kind, name) groups checked : ${groups.size}`);
  console.log(`Safe merges found           : ${planned.length}`);
  console.log(`Needs manual review         : ${ambiguous.length}`);
  console.log("");

  if (planned.length > 0) {
    console.log("WILL MERGE (root -> nested, root deactivated)");
    console.log("-".repeat(72));
    for (const p of planned) {
      const refs = [
        p.skuRefs > 0 && `${p.skuRefs} sku`,
        p.brandRefs > 0 && `${p.brandRefs} brand`,
        p.workPriceRefs > 0 && `${p.workPriceRefs} work price`,
      ].filter(Boolean).join(", ") || "no references";
      console.log(`  [${p.root.kind}] "${p.root.name}"`);
      console.log(`    root    : ${p.root.id}  (path: ${p.root.path ?? "-"})`);
      console.log(`    keep    : ${p.canonical.id}  (path: ${p.canonical.path ?? "-"})`);
      console.log(`    moves   : ${refs}`);
    }
    console.log("");
  }

  if (ambiguous.length > 0) {
    console.log("NEEDS MANUAL REVIEW — not touched");
    console.log("-".repeat(72));
    for (const a of ambiguous) {
      const [kind, name] = a.key.split("::");
      console.log(`  [${kind}] "${name}" — ${a.rows.length} rows${a.reason ? ` (${a.reason})` : ""}`);
      for (const r of a.rows) {
        console.log(`      ${r.id}  parent=${r.parent_id ?? "-"}  path=${r.path ?? "-"}`);
      }
    }
    console.log("");
  }

  if (!APPLY) {
    console.log("DRY RUN — nothing written. Re-run with --apply to commit.");
    return;
  }

  if (planned.length === 0) {
    console.log("Nothing to merge.");
    return;
  }

  const actor = { id: null, name: "backfill-duplicate-categories" };
  let merged = 0;

  for (const p of planned) {
    await prisma.$transaction(async (tx) => {
      // SkuCategory unique on [sku_id, category_id] — if the same SKU is
      // already tagged with BOTH rows, keep the canonical tag and drop the
      // orphaned one instead of colliding.
      const skuRows = await tx.skuCategory.findMany({ where: { category_id: p.root.id } });
      for (const row of skuRows) {
        const clash = await tx.skuCategory.findUnique({
          where: { sku_id_category_id: { sku_id: row.sku_id, category_id: p.canonical.id } },
        });
        if (clash) {
          await tx.skuCategory.delete({ where: { id: row.id } });
        } else {
          await tx.skuCategory.update({ where: { id: row.id }, data: { category_id: p.canonical.id } });
        }
      }

      // Same idea for BrandCategory, unique on [brand_id, category_id].
      const brandRows = await tx.brandCategory.findMany({ where: { category_id: p.root.id } });
      for (const row of brandRows) {
        const clash = await tx.brandCategory.findUnique({
          where: { brand_id_category_id: { brand_id: row.brand_id, category_id: p.canonical.id } },
        });
        if (clash) {
          await tx.brandCategory.delete({ where: { id: row.id } });
        } else {
          await tx.brandCategory.update({ where: { id: row.id }, data: { category_id: p.canonical.id } });
        }
      }

      // WorkPrice.category_id has no such uniqueness — a plain repoint.
      await tx.workPrice.updateMany({
        where: { category_id: p.root.id },
        data: { category_id: p.canonical.id },
      });

      await tx.category.update({
        where: { id: p.root.id },
        data: { is_active: false },
      });

      await recordAudit(tx, {
        entity: "Category",
        entity_id: p.root.id,
        action: "DELETE",
        actor,
        changes: { merged_into: p.canonical.id, reason: "duplicate-backfill" },
      });
      await recordAudit(tx, {
        entity: "Category",
        entity_id: p.canonical.id,
        action: "UPDATE",
        actor,
        changes: {
          merged_from: p.root.id,
          moved: { sku: p.skuRefs, brand: p.brandRefs, work_price: p.workPriceRefs },
        },
      });
    });
    merged++;
  }

  console.log(`APPLIED — ${merged} duplicate group(s) merged.`);
  console.log("");
  console.log("Verify: category dropdowns no longer show the same name twice,");
  console.log("and SKUs/brands/work prices previously on the root row still show");
  console.log("the (now nested) category they were merged into.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
