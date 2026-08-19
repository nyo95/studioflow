#!/usr/bin/env node

/**
 * Curate Sheet1-derived MaterialCandidate rows using the owner-confirmed rule:
 *
 *   SKU = Tipe + " " + Motif   (Motif omitted when the source has none)
 *   product_name = Tipe
 *
 * ============================================================================
 * WHY THIS SCRIPT EXISTS
 * ============================================================================
 * `docs/RAD - Material + Supplier.xlsx` has no explicit SKU column. The seed
 * importer (scripts/import-masterdata-seed.mjs) correctly refused to guess one
 * and instead queued every Sheet1-derived row into `master_data.MaterialCandidate`
 * with blocker "SKU eksplisit tidak tersedia" — see the "Rules" sheet decision
 * "No... Tipe-as-SKU inference" baked into
 * outputs/019fb6c2-e3c1-7972-bde7-64e5e5e13cda/masterdata-seed-v2/build-masterdata-seed.mjs.
 *
 * On 2026-07-31 the owner (berkah.rad@gmail.com) confirmed, with direct
 * knowledge of how the physical samples are labelled, that for this workbook's
 * `Sheet1` the manufacturer identity IS `Tipe` (series) + `Motif` (colour/finish
 * variant) — e.g. Tipe "Terrain" + Motif "Gravel" = "Terrain Gravel". That is
 * exactly the human confirmation the curation queue exists to collect. This
 * script performs that confirmation at scale instead of one-by-one through
 * `/masterdata/curation`, using the SAME fields, SAME validation, and SAME
 * audit trail as `updateMaterialCandidateAction` / `promoteMaterialCandidateAction`
 * in src/subapps/master-data/actions/curation-actions.ts. It does not touch any
 * row outside that exact rule's scope.
 *
 * Scope is deliberately narrow. Eligible candidate:
 *   - source_sheet = 'Sheet1'
 *   - review_status = PENDING, not yet promoted
 *   - Vendor already resolved (candidate_vendor_id / vendor_key_candidate set)
 *   - brand_candidate, category_tags_candidate, source_product_or_type (Tipe)
 *     all non-empty
 *   - sku_confirmed currently empty
 * Everything else (the 97 rows whose Vendor didn't match the `List` directory,
 * e.g. spelling variants of Roman/Niro/Artile) is left untouched — that is a
 * separate Vendor fuzzy-matching problem, not a SKU problem.
 *
 * ============================================================================
 * REDUNDANT DATA: SAME PRODUCT TYPED TWICE ACROSS TWO SOURCE ROWS
 * ============================================================================
 * Applying the rule above to the 176 eligible rows produces 4 exact
 * (vendor, brand, derived-sku) collisions, all brand "Infiniti". Manual
 * inspection on 2026-07-31 confirmed these are NOT coincidental string clashes
 * between two different products — they are the SAME physical product entered
 * inconsistently in the workbook. Example (Reggio):
 *   matcand_sample_64c7aaa0e3b4 : Tipe "Reggio"       + Motif "Grey"  -> "Reggio Grey"
 *   matcand_sample_4857adac1590: Tipe "Reggio Grey"   + Motif ""      -> "Reggio Grey"
 * One row split series/colour into two cells, the other typed them together in
 * Tipe and left Motif blank. Same pattern for Rotterdam Cream, Stone White,
 * Xenith Cream.
 *
 * These are auto-merged, not just flagged: within a colliding group, the first
 * candidate (by candidate_key) is promoted; the rest are marked DISMISSED
 * (non-destructive takedown, same semantics as REJECTED) with decision_notes
 * pointing at the winner, and any SampleCandidate that pointed at a loser is
 * repointed to the winner's MaterialCandidate id so its suggested Material
 * link still resolves after promotion. A collision is ONLY auto-merged when
 * category_tags_candidate also agrees across the group (extra safety margin
 * beyond the canonical vendor+brand+sku dedup key) — if category disagrees
 * too, the whole group is left PENDING and reported for a human to look at.
 *
 * Modes, same shape as import-masterdata-seed.mjs:
 *
 *   node scripts/curate-sheet1-sku-motif.mjs --validate-only
 *     No database. Reads docs/masterdata-seed/06_material_candidates.csv only.
 *
 *   node scripts/curate-sheet1-sku-motif.mjs --dry-run --actor-email <email>
 *     Read-only against the database. No writes.
 *
 *   node scripts/curate-sheet1-sku-motif.mjs --apply --actor-email <email> \
 *     --backup <path outside project> --backup-sha256 <hash> \
 *     --pg-restore-container <container> --ack-review
 *     Single transaction. For each winning candidate:
 *       1. Dismiss any merged-duplicate losers (see above), repointing their
 *          linked SampleCandidate rows to the winner.
 *       2. Update confirmed_vendor_id/brand_confirmed/category_tags_confirmed/
 *          product_name_confirmed/sku_confirmed + decision_notes, write
 *          AuditLog MASTERDATA_MATERIAL_CANDIDATE_UPDATE (mirrors
 *          updateMaterialCandidateAction exactly).
 *       3. Re-check readiness, create the canonical Material as PENDING via the
 *          same dedup check and field set as LibraryService.createProduct /
 *          promoteMaterialCandidateAction, write AuditLog
 *          MASTERDATA_MATERIAL_CANDIDATE_PROMOTE + CATALOG_CREATE.
 *     A candidate whose derived (vendor, brand, sku) key collides with another
 *     eligible candidate AND disagrees on category, or collides with an
 *     already-promoted Material, is SKIPPED and reported — never forced
 *     through the unique constraint.
 *
 * SAFETY
 * ============================================================================
 * - Refuses to run against a non-localhost DATABASE_URL (same guard as
 *   scripts/resolve-import-actor.mjs).
 * - --apply requires the same backup discipline as
 *   scripts/import-masterdata-seed.mjs: backup outside the project, SHA-256
 *   match, and a successful `pg_restore --list`.
 * - Never touches Vendor, VendorContact, VendorLink, or any row where
 *   source_sheet !== 'Sheet1'. The only SampleCandidate writes are the
 *   material_candidate_id repoint described above.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = path.join(
  root,
  "docs",
  "masterdata-seed",
  "06_material_candidates.csv",
);
const capableRoles = new Set(["ADMIN", "OWNER", "STAFF", "CURATOR"]);
const RULE_NOTE =
  "Auto-confirmed oleh scripts/curate-sheet1-sku-motif.mjs: SKU = Tipe + Motif, " +
  "product_name = Tipe. Aturan dikonfirmasi owner (berkah.rad@gmail.com) 2026-07-31 " +
  "untuk source_sheet=Sheet1. Lihat CHANGELOG-CODEX.md entri terkait untuk bukti.";

function mergeNote(winnerKey) {
  return (
    `Duplikat dari produk fisik yang sama dengan ${winnerKey} (Tipe/Motif ` +
    "ditulis tidak konsisten di sumber, menghasilkan derived SKU identik). " +
    "Di-dismiss otomatis oleh scripts/curate-sheet1-sku-motif.mjs pada " +
    "2026-07-31; sample yang menunjuk baris ini dipindah ke MaterialCandidate " +
    "pemenang."
  );
}

function fail(message) {
  throw new Error(message);
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function compact(value) {
  return String(value == null ? "" : value)
    .trim()
    .replace(/\s+/g, " ");
}

function normalized(value) {
  return compact(value).toLocaleLowerCase("id-ID");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

async function sha256File(filePath) {
  return sha256(await fs.readFile(filePath));
}

/** Minimal RFC4180 parser matching the writer in build-masterdata-seed.mjs. */
function parseCsv(text) {
  const input = text.replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0];
  return rows
    .slice(1)
    .filter((r) => r.length === headers.length && r.some(Boolean))
    .map((r) => {
      const record = {};
      headers.forEach((h, index) => {
        record[h] = r[index] == null ? "" : r[index];
      });
      return record;
    });
}

function deriveSkuAndName(row) {
  const tipe = compact(row.source_product_or_type);
  const motif = compact(row.motif_candidate);
  if (!tipe) return null;
  return {
    productName: tipe,
    sku: motif ? tipe + " " + motif : tipe,
  };
}

function isEligibleCsvRow(row) {
  return (
    row.source_sheet === "Sheet1" &&
    compact(row.vendor_key_candidate) !== "" &&
    compact(row.brand_candidate) !== "" &&
    compact(row.category_tags_candidate) !== "" &&
    compact(row.source_product_or_type) !== "" &&
    compact(row.sku_confirmed) === ""
  );
}

const KEY_SEP = "";

function collisionKey(vendorKey, brand, sku) {
  return [vendorKey, normalized(brand), normalized(sku)].join(KEY_SEP);
}

/**
 * A colliding pair is auto-mergeable (not just "flag for a human") when the
 * two rows also share category_tags_candidate. Every collision found in this
 * workbook (4 pairs, all brand Infiniti) turned out to be the SAME physical
 * product typed inconsistently across two source rows. Requiring category
 * agreement too is an extra safety margin: the canonical dedup key is
 * vendor+brand+sku (MASTERDATA_CSV_SEEDING_GUIDE.md), but a collision where
 * category ALSO differs is treated as suspicious and still routed to a human.
 */
function sameCategoryTags(a, b) {
  const norm = (value) =>
    String(value == null ? "" : value)
      .split("|")
      .map((tag) => normalized(tag))
      .filter(Boolean)
      .sort()
      .join("|");
  return norm(a) === norm(b);
}

function planFromCandidates(candidates, vendorKeyOf) {
  const eligible = [];
  const skippedIneligible = [];
  for (const row of candidates) {
    const derived = deriveSkuAndName(row);
    if (!derived) {
      skippedIneligible.push({ row, reason: "Tipe kosong" });
      continue;
    }
    eligible.push({ row, derived });
  }

  // Deterministic order so re-runs pick the same winner.
  eligible.sort((a, b) =>
    (a.row.candidate_key || "").localeCompare(b.row.candidate_key || ""),
  );

  const groups = new Map();
  for (const item of eligible) {
    const key = collisionKey(
      vendorKeyOf(item.row),
      item.row.brand_candidate,
      item.derived.sku,
    );
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  const winners = [];
  const skippedCollision = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      winners.push({ ...group[0], mergedFrom: [] });
      continue;
    }
    const allSameCategory = group.every((item) =>
      sameCategoryTags(
        item.row.category_tags_candidate,
        group[0].row.category_tags_candidate,
      ),
    );
    if (!allSameCategory) {
      for (const item of group) {
        skippedCollision.push({
          ...item,
          collidesWith: group[0].row.candidate_key,
        });
      }
      continue;
    }
    const [winner, ...losers] = group;
    winners.push({
      ...winner,
      mergedFrom: losers.map((l) => l.row.candidate_key),
    });
  }
  return { winners, skippedCollision, skippedIneligible };
}

async function runValidateOnly() {
  const text = await fs.readFile(csvPath, "utf8");
  const rows = parseCsv(text);
  const sheet1Rows = rows.filter((r) => r.source_sheet === "Sheet1");
  const eligible = sheet1Rows.filter(isEligibleCsvRow);
  const { winners, skippedCollision, skippedIneligible } = planFromCandidates(
    eligible,
    (row) => compact(row.vendor_key_candidate),
  );
  const mergedCount = winners.reduce(
    (sum, w) => sum + w.mergedFrom.length,
    0,
  );

  console.log("\nCURATE SHEET1 SKU+MOTIF — VALIDATE ONLY (CSV, no database)");
  console.log("=".repeat(72));
  console.log(`  staging file          : ${path.relative(root, csvPath)}`);
  console.log(`  Sheet1 candidates      : ${sheet1Rows.length}`);
  console.log(
    `  eligible (vendor+brand+tags+Tipe present, SKU empty) : ${eligible.length}`,
  );
  console.log(`  would confirm+promote  : ${winners.length}`);
  console.log(
    `  of which absorb a duplicate (auto-merge, loser -> DISMISSED) : ${mergedCount}`,
  );
  console.log(
    `  skipped: collision with category disagreement (needs human) : ${skippedCollision.length}`,
  );
  console.log(
    `  skipped: still ineligible (no Tipe)   : ${skippedIneligible.length}`,
  );
  console.log(
    `  untouched (Vendor not resolved / other blocker) : ${
      sheet1Rows.length - eligible.length
    }`,
  );

  const merges = winners.filter((w) => w.mergedFrom.length > 0);
  if (merges.length > 0) {
    console.log("\nAuto-merges (same product, inconsistent Tipe/Motif split):");
    for (const item of merges) {
      console.log(
        `  winner ${item.row.candidate_key} ("${item.derived.sku}") absorbs: ${item.mergedFrom.join(", ")}`,
      );
    }
  }

  if (skippedCollision.length > 0) {
    console.log("\nCollisions NOT auto-merged (category disagrees, needs a human):");
    for (const item of skippedCollision) {
      console.log(
        `  ${item.row.candidate_key} -> "${item.derived.sku}" collides with ${item.collidesWith}`,
      );
    }
  }

  console.log("\nSample of rows that would be confirmed+promoted:");
  for (const item of winners.slice(0, 8)) {
    console.log(
      `  ${item.row.candidate_key} | ${item.row.brand_candidate} | product_name="${item.derived.productName}" sku="${item.derived.sku}"`,
    );
  }
  console.log(
    "\nNOTE: this mode never touches the database. Run --dry-run against a " +
      "reachable local Postgres to confirm these rows still match live state " +
      "before --apply.\n",
  );
  return { winners, skippedCollision, skippedIneligible, sheet1Rows, eligible };
}

async function connectPrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL is not set. Check .env");
  const isLocal =
    connectionString.includes("localhost") ||
    connectionString.includes("127.0.0.1");
  if (!isLocal) {
    fail(
      "ABORT: DATABASE_URL is not localhost. This script only targets the " +
        "local database, same guard as scripts/resolve-import-actor.mjs.",
    );
  }
  const pool = new pg.Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  // Fail fast with a clear message instead of hanging if the DB is unreachable
  // (e.g. this script is being run from an environment without a route to the
  // user's local Postgres, such as a sandboxed agent workspace).
  await Promise.race([
    prisma.$queryRawUnsafe("SELECT 1"),
    new Promise((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(
              "Timed out reaching DATABASE_URL. This environment likely has no " +
                "network route to the local Postgres — run this script from a " +
                "machine/terminal that can reach it directly.",
            ),
          ),
        5000,
      ),
    ),
  ]);
  return { prisma, pool };
}

async function resolveActor(prisma, actorEmail) {
  if (!actorEmail) fail("--actor-email wajib diisi dengan User nyata.");
  const actor = await prisma.user.findUnique({
    where: { email: actorEmail },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!actor) fail(`Actor ${actorEmail} tidak ditemukan.`);
  if (!capableRoles.has(actor.role)) {
    fail(`Role ${actor.role} tidak boleh mengelola Master Data.`);
  }
  return actor;
}

async function loadDbCandidates(prisma) {
  return prisma.materialCandidate.findMany({
    where: {
      source_sheet: "Sheet1",
      review_status: "PENDING",
      promoted_material_id: null,
      candidate_vendor_id: { not: null },
      brand_candidate: { not: null },
      source_product_or_type: { not: null },
    },
  });
}

function dbRowToCsvShape(row) {
  return {
    candidate_key: row.candidate_key,
    source_sheet: row.source_sheet,
    vendor_key_candidate: row.candidate_vendor_id || "",
    brand_candidate: row.brand_candidate || "",
    category_tags_candidate: (row.category_tags_candidate || []).join("|"),
    source_product_or_type: row.source_product_or_type || "",
    motif_candidate: row.motif_candidate || "",
    sku_confirmed: row.sku_confirmed || "",
  };
}

async function buildDbPlan(prisma) {
  const dbRows = await loadDbCandidates(prisma);
  const shaped = dbRows.map(dbRowToCsvShape).filter(isEligibleCsvRow);
  const byKey = new Map(dbRows.map((r) => [r.candidate_key, r]));
  const { winners, skippedCollision, skippedIneligible } = planFromCandidates(
    shaped,
    (row) => row.vendor_key_candidate, // candidate_vendor_id (a real DB id) in DB mode
  );
  return {
    winners: winners.map((w) => ({
      ...w,
      dbRow: byKey.get(w.row.candidate_key),
      mergedFromDbRows: w.mergedFrom.map((key) => byKey.get(key)),
    })),
    skippedCollision,
    skippedIneligible,
    totalEligible: shaped.length,
  };
}

async function runDryRun() {
  const actorEmail = argValue("--actor-email");
  const { prisma, pool } = await connectPrisma();
  try {
    const actor = await resolveActor(prisma, actorEmail);
    const plan = await buildDbPlan(prisma);
    const mergedCount = plan.winners.reduce(
      (sum, w) => sum + w.mergedFrom.length,
      0,
    );
    console.log("\nCURATE SHEET1 SKU+MOTIF — DRY RUN (database, read-only)");
    console.log("=".repeat(72));
    console.log(`  actor                  : ${actor.email} (${actor.role})`);
    console.log(`  eligible candidates    : ${plan.totalEligible}`);
    console.log(`  would confirm+promote  : ${plan.winners.length}`);
    console.log(`  of which absorb a duplicate : ${mergedCount}`);
    console.log(`  skipped (category-disagreeing collision) : ${plan.skippedCollision.length}`);
    for (const item of plan.winners.slice(0, 10)) {
      console.log(
        `  ${item.row.candidate_key} | ${item.row.brand_candidate} | sku="${item.derived.sku}"` +
          (item.mergedFrom.length ? ` | absorbs ${item.mergedFrom.join(",")}` : ""),
      );
    }
    console.log("\nNo writes performed.\n");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function verifyBackup(backupPathArgument, expectedHash, pgRestoreCommand, pgRestoreContainer) {
  if (!backupPathArgument || !expectedHash) {
    fail("--apply membutuhkan --backup dan --backup-sha256.");
  }
  const backupPath = path.resolve(backupPathArgument);
  const relativeToProject = path.relative(root, backupPath);
  if (
    relativeToProject === "" ||
    (!relativeToProject.startsWith("..") && !path.isAbsolute(relativeToProject))
  ) {
    fail("Backup wajib berada di luar folder project.");
  }
  const stats = await fs.stat(backupPath);
  if (!stats.isFile() || stats.size === 0) fail("Backup kosong/tidak valid.");
  const actualHash = await sha256File(backupPath);
  if (actualHash !== expectedHash.toUpperCase()) {
    fail(`Backup SHA-256 tidak cocok. Actual ${actualHash}.`);
  }
  let restoreCheck;
  if (pgRestoreContainer) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(pgRestoreContainer)) {
      fail("--pg-restore-container berisi nama container yang tidak valid.");
    }
    const containerBackupPath = `/tmp/studioflow-sku-curation-${actualHash.slice(0, 16)}.dump`;
    const copyCheck = spawnSync(
      "docker",
      ["cp", backupPath, `${pgRestoreContainer}:${containerBackupPath}`],
      { encoding: "utf8", windowsHide: true },
    );
    if (copyCheck.error || copyCheck.status !== 0) {
      fail(`Backup tidak dapat disalin ke container ${pgRestoreContainer}.`);
    }
    restoreCheck = spawnSync(
      "docker",
      ["exec", pgRestoreContainer, "pg_restore", "--list", containerBackupPath],
      { encoding: "utf8", windowsHide: true },
    );
    spawnSync(
      "docker",
      ["exec", pgRestoreContainer, "rm", "-f", containerBackupPath],
      { encoding: "utf8", windowsHide: true },
    );
  } else {
    restoreCheck = spawnSync(pgRestoreCommand || "pg_restore", ["--list", backupPath], {
      encoding: "utf8",
      windowsHide: true,
    });
  }
  if (restoreCheck.error || restoreCheck.status !== 0 || !restoreCheck.stdout.trim()) {
    fail("Backup gagal pg_restore --list.");
  }
  return { path: backupPath, sha256: actualHash };
}

async function runApply() {
  if (!process.argv.includes("--ack-review")) fail("--apply membutuhkan --ack-review.");
  const actorEmail = argValue("--actor-email");
  const { prisma, pool } = await connectPrisma();
  try {
    const actor = await resolveActor(prisma, actorEmail);
    await verifyBackup(
      argValue("--backup"),
      argValue("--backup-sha256"),
      argValue("--pg-restore"),
      argValue("--pg-restore-container"),
    );
    const plan = await buildDbPlan(prisma);
    console.log(
      `Applying ${plan.winners.length} confirm+promote operations as ${actor.email}...`,
    );

    const results = { dismissed: 0, confirmed: 0, promoted: 0, skipped: 0 };
    await prisma.$transaction(async (tx) => {
      for (const item of plan.winners) {
        const current = await tx.materialCandidate.findUnique({
          where: { id: item.dbRow.id },
        });
        if (!current || current.review_status !== "PENDING" || current.promoted_material_id) {
          results.skipped += 1;
          continue;
        }

        // Step 1: dismiss merged-duplicate losers and repoint their samples.
        for (const loser of item.mergedFromDbRows) {
          if (!loser) continue;
          const loserCurrent = await tx.materialCandidate.findUnique({
            where: { id: loser.id },
          });
          if (!loserCurrent || loserCurrent.review_status === "PROMOTED") continue;
          await tx.sampleCandidate.updateMany({
            where: { material_candidate_id: loser.id },
            data: { material_candidate_id: current.id },
          });
          await tx.materialCandidate.update({
            where: { id: loser.id },
            data: {
              review_status: "DISMISSED",
              decision_notes: loserCurrent.decision_notes
                ? `${loserCurrent.decision_notes}\n${mergeNote(current.candidate_key)}`
                : mergeNote(current.candidate_key),
              reviewed_by_id: actor.id,
              reviewed_at: new Date(),
            },
          });
          await tx.auditLog.create({
            data: {
              action: "MASTERDATA_MATERIAL_CANDIDATE_DISMISS",
              entity_type: "MaterialCandidate",
              entity_id: loser.id,
              user_id: actor.id,
              details: {
                candidate_key: loserCurrent.candidate_key,
                reason: "duplicate_of",
                duplicate_of: current.candidate_key,
              },
            },
          });
          results.dismissed += 1;
        }

        // Step 2: confirm the winner.
        const categoryTags = current.category_tags_candidate;
        await tx.materialCandidate.update({
          where: { id: current.id },
          data: {
            confirmed_vendor_id: current.candidate_vendor_id,
            brand_confirmed: current.brand_candidate,
            category_tags_confirmed: categoryTags,
            product_name_confirmed: item.derived.productName,
            sku_confirmed: item.derived.sku,
            decision_notes: current.decision_notes
              ? `${current.decision_notes}\n${RULE_NOTE}`
              : RULE_NOTE,
            review_status: "PENDING",
            reviewed_by_id: actor.id,
            reviewed_at: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            action: "MASTERDATA_MATERIAL_CANDIDATE_UPDATE",
            entity_type: "MaterialCandidate",
            entity_id: current.id,
            user_id: actor.id,
            details: {
              candidate_key: current.candidate_key,
              confirmed_vendor_id: current.candidate_vendor_id,
              sku_confirmed: item.derived.sku,
              merged_from: item.mergedFrom,
            },
          },
        });
        results.confirmed += 1;

        // Step 3: promote, guarded by the same dedup check as
        // LibraryService.createProduct.
        const existingDup = await tx.sku.findFirst({
          where: {
            brand_id: current.candidate_vendor_id,
            catalog_brand: current.brand_candidate,
            catalog_sku: item.derived.sku,
            deleted_at: null,
          },
        });
        if (existingDup) {
          results.skipped += 1;
          continue;
        }
        const material = await tx.sku.create({
          data: {
            brand_id: current.candidate_vendor_id,
            catalog_brand: current.brand_candidate,
            catalog_type: "material",
            catalog_sku: item.derived.sku,
            catalog_product_name: item.derived.productName,
            catalog_motif: current.motif_candidate,
            catalog_tags: categoryTags,
            catalog_dimension_unit: "cm",
            catalog_reference_url: current.reference_url_candidate,
            catalog_folder_url: current.folder_url_candidate,
            catalog_price: current.price_after_discount,
            catalog_vendor_price: current.price_before_discount,
            catalog_price_unit: current.price_unit,
            catalog_status: "PENDING",
            catalog_metadata: {
              curation_candidate_key: current.candidate_key,
              source_context: current.source_context,
              source_sheet: current.source_sheet,
              source_rows: current.source_rows,
              source_checksum: current.source_checksum,
              merged_candidate_keys: item.mergedFrom,
            },
          },
        });
        await tx.materialCandidate.update({
          where: { id: current.id },
          data: {
            review_status: "PROMOTED",
            promoted_material_id: material.id,
            reviewed_by_id: actor.id,
            reviewed_at: new Date(),
          },
        });
        await tx.auditLog.create({
          data: {
            action: "MASTERDATA_MATERIAL_CANDIDATE_PROMOTE",
            entity_type: "MaterialCandidate",
            entity_id: current.id,
            user_id: actor.id,
            details: { candidate_key: current.candidate_key, material_id: material.id },
          },
        });
        await tx.auditLog.create({
          data: {
            action: "CATALOG_CREATE",
            entity_type: "Sku",
            entity_id: material.id,
            user_id: actor.id,
            details: { sku: material.catalog_sku, category_tags: material.catalog_tags },
          },
        });
        results.promoted += 1;
      }
    });

    console.log(
      `Done. dismissed=${results.dismissed} confirmed=${results.confirmed} promoted=${results.promoted} skipped=${results.skipped}`,
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

async function main() {
  const validateOnly = process.argv.includes("--validate-only");
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  const modeCount = [validateOnly, dryRun, apply].filter(Boolean).length;
  if (modeCount !== 1) {
    fail("Pilih tepat satu mode: --validate-only, --dry-run, atau --apply.");
  }
  if (validateOnly) return runValidateOnly();
  if (dryRun) return runDryRun();
  return runApply();
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}\n`);
  process.exitCode = 1;
});
