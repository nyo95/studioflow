#!/usr/bin/env node

/**
 * Reconstruct Category + BrandCategory from existing MaterialCandidate rows
 * (PLAN-LIBRARY-BRAND-FIRST.md §9 step 3 / MASTER_SSOT.md §6.14).
 *
 * Validation only (no DB):
 *   node scripts/seed-brand-categories.mjs --dry-run --actor-email you@example.com
 *
 * Apply to localhost only:
 *   node scripts/seed-brand-categories.mjs --apply \
 *     --actor-email you@example.com \
 *     --backup <path.dump> --backup-sha256 <SHA256> --ack-review
 *
 * ===========================================================================
 * WHAT AND WHY
 * ===========================================================================
 * §6.13's curation queue already staged 756 MaterialCandidate rows from the
 * reviewed `List`/`Sheet1` workbook, 656 of them with a resolved Brand
 * (candidate_vendor_id or confirmed_vendor_id). Every one carries
 * category_tags_candidate / category_tags_confirmed — exactly the evidence
 * §6.14's Brand-First Library needs, sitting unused because the queue was
 * built to feed `Sku` promotion (SKU-first), and 580 of those 756 rows can
 * never satisfy that path (no SKU, never will — see §6.14).
 *
 * This script does NOT touch MaterialCandidate. It reads it read-only and
 * writes only Category and BrandCategory: two brand-new, purely additive
 * tables. review_status (PENDING/DISMISSED/PROMOTED) is irrelevant here —
 * even a DISMISSED or already-PROMOTED candidate is still true evidence that
 * a brand sells a category. Candidate promotion (to Sku) and category
 * reconstruction are two independent, non-conflicting uses of the same
 * source evidence.
 *
 * ===========================================================================
 * WHAT IT DOES NOT DO — READ THIS BEFORE "IMPROVING" IT
 * ===========================================================================
 * - Does NOT create or modify any Brand row. A candidate with neither
 *   confirmed_vendor_id nor candidate_vendor_id resolved is a blocker, not
 *   an invitation to invent one from brand_candidate/brand_confirmed text.
 * - Does NOT invent a category from source_product_or_type or product name
 *   text. Only category_tags_confirmed (preferred) or category_tags_candidate
 *   (fallback) are read — the same fields the curation queue already
 *   verified against source rows.
 * - Does NOT set sort_order for a (brand, category) pair more than once. The
 *   first candidate processed for a given pair wins; later duplicates are
 *   silently reused, never re-ordered. Order across different source rows
 *   for the same brand is not a fact worth fighting over.
 * - Does NOT delete or merge Category rows. A near-duplicate name
 *   ("Sanitary" vs "Sanitary Ware") is reported as a REVIEW item, not
 *   auto-merged — same discipline as §6.4's alias resolution: merging brand
 *   or category identity is a human decision, never an importer default.
 *
 * ===========================================================================
 * IDEMPOTENCY
 * ===========================================================================
 * Category.slug and BrandCategory.(brand_id, category_id) are both unique.
 * A second run finds every Category/BrandCategory it already created and
 * reports pure reuse with zero writes — same guarantee as the three earlier
 * importers (§6.5, §6.6, migrate-offerings-to-materials).
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAPABLE_ROLES = new Set(["ADMIN", "OWNER", "STAFF", "CURATOR"]);

function fail(message) {
  console.error(`\nABORT: ${message}\n`);
  process.exit(1);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function verifyBackup(backupPath, expectedSha) {
  if (!backupPath) fail("--apply membutuhkan --backup <path>");
  if (!expectedSha) fail("--apply membutuhkan --backup-sha256 <hash>");
  const buf = await fs.readFile(backupPath).catch(() => {
    fail(`Backup tidak terbaca: ${backupPath}`);
  });
  const actual = crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
  if (actual !== expectedSha.toUpperCase()) {
    fail(
      `Backup SHA-256 tidak cocok.\n  expected ${expectedSha.toUpperCase()}\n  actual   ${actual}`,
    );
  }
  return { path: backupPath, bytes: buf.length, sha256: actual };
}

async function resolveActor(prisma, actorEmail) {
  if (!actorEmail) fail("--actor-email wajib diisi dengan User nyata");
  const actor = await prisma.user.findUnique({
    where: { email: actorEmail },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!actor) fail(`Actor ${actorEmail} tidak ditemukan`);
  if (!CAPABLE_ROLES.has(actor.role)) {
    fail(`Actor ${actorEmail} role ${actor.role} tidak boleh menjalankan seed ini`);
  }
  return actor;
}

/** "Window|Roller Blind" -> ["Window", "Roller Blind"]; trims, drops empties. */
function splitTags(raw) {
  if (!raw) return [];
  return raw
    .split("|")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function slugify(name) {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Case-insensitive near-duplicate detector for the human review report only. */
function findNearDuplicate(name, existingNames) {
  const norm = name.toLowerCase().trim();
  for (const other of existingNames) {
    if (other.toLowerCase().trim() === norm) continue; // exact match, not a dupe warning
    const a = other.toLowerCase().trim();
    if (a.includes(norm) || norm.includes(a)) return other;
  }
  return null;
}

async function buildPlan(prisma) {
  const [candidates, existingCategories, existingBrandCategories, brands] =
    await Promise.all([
      prisma.materialCandidate.findMany({
        select: {
          id: true,
          candidate_key: true,
          candidate_vendor_id: true,
          confirmed_vendor_id: true,
          category_tags_candidate: true,
          category_tags_confirmed: true,
        },
        orderBy: { created_at: "asc" },
      }),
      prisma.category.findMany({ select: { id: true, name: true, slug: true } }),
      prisma.brandCategory.findMany({
        select: { brand_id: true, category_id: true },
      }),
      prisma.brand.findMany({ select: { id: true, brand_name: true } }),
    ]);

  const brandById = new Map(brands.map((b) => [b.id, b]));
  const categoryBySlug = new Map(existingCategories.map((c) => [c.slug, c]));
  const existingPairs = new Set(
    existingBrandCategories.map((bc) => `${bc.brand_id}::${bc.category_id}`),
  );

  const categoriesToCreate = new Map(); // slug -> { name, slug }
  const pairsToCreate = []; // { brand_id, category_id (or slug ref), sort_order, source_candidate_key }
  const blockers = [];
  const reviewNearDuplicates = [];
  let candidatesWithNoBrand = 0;
  let candidatesWithNoTags = 0;
  let candidatesReused = 0;

  const seenNamesForReview = new Set(existingCategories.map((c) => c.name));

  for (const cand of candidates) {
    const brandId = cand.confirmed_vendor_id ?? cand.candidate_vendor_id;
    if (!brandId || !brandById.has(brandId)) {
      candidatesWithNoBrand += 1;
      blockers.push({
        candidate_key: cand.candidate_key,
        reason: "Tidak ada Brand relasional terkonfirmasi (confirmed/candidate vendor kosong)",
      });
      continue;
    }

    const tags =
      cand.category_tags_confirmed?.length > 0
        ? cand.category_tags_confirmed
        : cand.category_tags_candidate;

    const tagList = Array.isArray(tags) ? tags : splitTags(String(tags ?? ""));
    if (tagList.length === 0) {
      candidatesWithNoTags += 1;
      blockers.push({
        candidate_key: cand.candidate_key,
        reason: "Tidak ada category_tags (confirmed maupun candidate) untuk diproses",
      });
      continue;
    }

    let sawNewWork = false;
    tagList.forEach((rawTag, index) => {
      const name = rawTag.trim();
      if (!name) return;
      const slug = slugify(name);
      if (!slug) return;

      if (!categoryBySlug.has(slug) && !categoriesToCreate.has(slug)) {
        const nearDupe = findNearDuplicate(name, seenNamesForReview);
        if (nearDupe) {
          reviewNearDuplicates.push({ candidate: name, existing: nearDupe });
        }
        seenNamesForReview.add(name);
        categoriesToCreate.set(slug, { name, slug });
        sawNewWork = true;
      }

      // Category id may not exist yet (still pending creation in this same
      // plan) — resolved to a real id only at apply time. Track by slug.
      const pairKey = `${brandId}::slug:${slug}`;
      const existingRealPair = categoryBySlug.has(slug)
        ? existingPairs.has(`${brandId}::${categoryBySlug.get(slug).id}`)
        : false;
      if (existingRealPair) return;
      if (pairsToCreate.some((p) => p.brand_id === brandId && p.slug === slug)) return;

      sawNewWork = true;
      pairsToCreate.push({
        brand_id: brandId,
        slug,
        category_name: name,
        sort_order: index,
        source_candidate_key: cand.candidate_key,
      });
    });

    if (!sawNewWork) candidatesReused += 1;
  }

  return {
    before: {
      categories: existingCategories.length,
      brandCategories: existingBrandCategories.length,
    },
    actions: {
      categoriesToCreate: categoriesToCreate.size,
      brandCategoryPairsToCreate: pairsToCreate.length,
      candidatesProcessed: candidates.length,
      candidatesWithNoBrand,
      candidatesWithNoTags,
      candidatesFullyReused: candidatesReused,
    },
    blockers,
    reviewNearDuplicates,
    _categoriesToCreate: [...categoriesToCreate.values()],
    _pairsToCreate: pairsToCreate,
  };
}

async function applyPlan(prisma, plan, actor) {
  return prisma.$transaction(async (tx) => {
    const slugToId = new Map();

    for (const cat of plan._categoriesToCreate) {
      const created = await tx.category.create({
        data: { name: cat.name, slug: cat.slug },
        select: { id: true, slug: true },
      });
      slugToId.set(created.slug, created.id);
      await tx.auditLog.create({
        data: {
          action: "SEED_CATEGORY_FROM_CANDIDATE",
          entity_type: "Category",
          entity_id: created.id,
          user_id: actor.id,
          details: { name: cat.name, slug: cat.slug },
        },
      });
    }

    let brandCategoriesCreated = 0;
    for (const pair of plan._pairsToCreate) {
      const categoryId = slugToId.get(pair.slug);
      if (!categoryId) {
        // Category already existed before this run — resolve it now.
        const existing = await tx.category.findUnique({
          where: { slug: pair.slug },
          select: { id: true },
        });
        if (!existing) {
          throw new Error(`Internal: category slug ${pair.slug} resolved neither new nor existing`);
        }
        slugToId.set(pair.slug, existing.id);
      }
      const resolvedCategoryId = slugToId.get(pair.slug);

      const created = await tx.brandCategory.create({
        data: {
          brand_id: pair.brand_id,
          category_id: resolvedCategoryId,
          sort_order: pair.sort_order,
        },
        select: { id: true },
      });
      brandCategoriesCreated += 1;
      await tx.auditLog.create({
        data: {
          action: "SEED_BRAND_CATEGORY_FROM_CANDIDATE",
          entity_type: "BrandCategory",
          entity_id: created.id,
          user_id: actor.id,
          details: {
            brand_id: pair.brand_id,
            category_slug: pair.slug,
            sort_order: pair.sort_order,
            source_candidate_key: pair.source_candidate_key,
          },
        },
      });
    }

    return {
      categoriesCreated: plan._categoriesToCreate.length,
      brandCategoriesCreated,
    };
  });
}

function printReport(plan) {
  console.log("\n=== Seed Brand Categories — Plan ===");
  console.log(`Existing Category rows:        ${plan.before.categories}`);
  console.log(`Existing BrandCategory rows:    ${plan.before.brandCategories}`);
  console.log(`Candidates processed:           ${plan.actions.candidatesProcessed}`);
  console.log(`  - no resolvable Brand:        ${plan.actions.candidatesWithNoBrand}`);
  console.log(`  - no category tags:           ${plan.actions.candidatesWithNoTags}`);
  console.log(`  - fully reused (idempotent):  ${plan.actions.candidatesFullyReused}`);
  console.log(`Category rows to create:        ${plan.actions.categoriesToCreate}`);
  console.log(`BrandCategory pairs to create:   ${plan.actions.brandCategoryPairsToCreate}`);

  if (plan.reviewNearDuplicates.length > 0) {
    console.log(`\n--- REVIEW: possible near-duplicate category names (not merged, human decision) ---`);
    for (const dup of plan.reviewNearDuplicates.slice(0, 50)) {
      console.log(`  "${dup.candidate}" looks close to existing "${dup.existing}"`);
    }
    if (plan.reviewNearDuplicates.length > 50) {
      console.log(`  … and ${plan.reviewNearDuplicates.length - 50} more`);
    }
  }

  if (plan.blockers.length > 0) {
    console.log(`\n--- BLOCKERS (${plan.blockers.length}) — not written, no data invented ---`);
    for (const b of plan.blockers.slice(0, 30)) {
      console.log(`  ${b.candidate_key}: ${b.reason}`);
    }
    if (plan.blockers.length > 30) {
      console.log(`  … and ${plan.blockers.length - 30} more`);
    }
  }
  console.log("");
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const apply = hasFlag("--apply");
  const validateOnly = hasFlag("--validate-only");

  if (validateOnly) {
    console.log("--validate-only: no schema/data assumptions to check offline. Use --dry-run.");
    return;
  }
  if (dryRun === apply) {
    fail("Pilih tepat satu dari --dry-run atau --apply.");
  }

  const databaseUrl = process.env.DATABASE_URL ?? "";
  if (apply && !/localhost|127\.0\.0\.1/.test(databaseUrl)) {
    fail("--apply hanya diizinkan terhadap database localhost.");
  }

  const actorEmail = argValue("--actor-email");
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const actor = await resolveActor(prisma, actorEmail);

    if (apply) {
      await verifyBackup(argValue("--backup"), argValue("--backup-sha256"));
      if (!hasFlag("--ack-review")) {
        fail("--apply membutuhkan --ack-review setelah plan di-review manual.");
      }
    }

    const plan = await buildPlan(prisma);
    printReport(plan);

    if (dryRun) {
      console.log("Dry-run selesai. Tidak ada baris yang ditulis.");
      return;
    }

    const result = await applyPlan(prisma, plan, actor);
    console.log("=== Applied ===");
    console.log(`Category dibuat:      ${result.categoriesCreated}`);
    console.log(`BrandCategory dibuat:  ${result.brandCategoriesCreated}`);
    console.log(`Actor: ${actor.email} (${actor.role})`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
