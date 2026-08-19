#!/usr/bin/env node
/**
 * ===========================================================================
 * OBSOLETE as of 31 July 2026 — DOES NOT RUN.
 * ===========================================================================
 * This script targets `Vendor`, `VendorContact`, `VendorOffering` and/or
 * `ProductCatalog`. The master-data entity rework
 * (prisma/migrations/20260731190000_master_data_entity_rework) dropped all of
 * them; the shape is now Brand / BrandLink / BrandContact / Category /
 * Product / Sku / Sample.
 *
 * It is kept rather than deleted because it documents exactly how the office
 * workbook was parsed — the column mapping, the checksum rules and the
 * placeholder bans are all still the right rules, and rewriting an importer
 * for the new schema should start from them.
 *
 * The guard below is deliberate. Without it this fails deep inside Prisma with
 * "cannot read property findMany of undefined", which tells the next person
 * nothing about why.
 * ===========================================================================
 */

throw new Error(
  "OBSOLETE: this importer targets tables dropped by the 31 Jul 2026 master-data " +
  "rework (Vendor / VendorContact / VendorOffering / ProductCatalog). Port it to " +
  "Brand / Category / Product / Sku before running it again."
);

/**
 * MIGRATE VendorOffering -> ProductCatalog (Material)
 *
 *   node scripts/migrate-offerings-to-materials.mjs --dry-run --actor-email you@example.com
 *   node scripts/migrate-offerings-to-materials.mjs --apply   --actor-email you@example.com \
 *        --backup <path.dump> --backup-sha256 <HASH> --ack-review
 *
 * ===========================================================================
 * WHAT AND WHY
 * ===========================================================================
 * `VendorOffering` and `ProductCatalog` were two tables holding the same shape
 * of data at different confidence levels — they share seven semantic fields.
 * This copies each offering into ProductCatalog as a PENDING material with no
 * SKU and no colour, which is exactly what an offering is: a supplier
 * capability whose specific product is not yet identified.
 *
 * After this runs, `/masterdata/materials` reads ONE table.
 *
 * ===========================================================================
 * WHAT IT DOES NOT DO — READ THIS BEFORE "IMPROVING" IT
 * ===========================================================================
 * - Does NOT delete or modify any VendorOffering row. The source table is left
 *   fully intact as provenance (owner direction, MASTER_SSOT §6.7). Dropping it
 *   is a separate decision that nobody has made.
 * - Does NOT invent a SKU, colour, image or price. Offerings have none. Any
 *   `LEGACY-*`, `N/A`, row number or generated code is forbidden.
 * - Does NOT set anything to APPROVED. Every migrated row is PENDING, so the
 *   catalog approval gate is untouched.
 * - Does NOT guess `catalog_type`. Offerings carry no material/fixture signal,
 *   so rows land on the schema default (`material`) and are flagged in the
 *   report for human review rather than classified by keyword matching.
 *
 * ===========================================================================
 * IDEMPOTENCY
 * ===========================================================================
 * `ProductCatalog.source_offering_id` is UNIQUE. A second run finds the
 * existing material for each offering and reports it as reused, writing
 * nothing. This is the same guarantee the two earlier importers proved.
 */

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CAPABLE_ROLES = new Set(["ADMIN", "OWNER", "STAFF"]);

function fail(message) {
  console.error(`\nABORT: ${message}\n`);
  process.exit(1);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function redact(url) {
  return url.replace(/(:\/\/[^:]+:)[^@]*(@)/, "$1***$2");
}

async function verifyBackup(backupPath, expectedSha) {
  if (!backupPath) fail("--apply membutuhkan --backup <path>");
  if (!expectedSha) fail("--apply membutuhkan --backup-sha256 <hash>");
  const buf = await fs.readFile(backupPath).catch(() => {
    fail(`Backup tidak terbaca: ${backupPath}`);
  });
  const actual = crypto.createHash("sha256").update(buf).digest("hex").toUpperCase();
  if (actual !== expectedSha.toUpperCase()) {
    fail(`Backup SHA-256 tidak cocok.\n  expected ${expectedSha.toUpperCase()}\n  actual   ${actual}`);
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
    fail(`Actor ${actorEmail} role ${actor.role} tidak boleh menjalankan migrasi ini`);
  }
  return actor;
}

/**
 * Maps one offering onto material columns.
 *
 * Every field either comes straight from the source or stays null. The
 * `catalog_metadata` blob keeps the offering's curation provenance (Jess
 * status, curator, source sheet/row/checksum) so nothing learned during the
 * workbook import is lost in the move.
 */
function toMaterial(offering, brandName) {
  return {
    vendor_id: offering.vendor_id,
    catalog_category: offering.category_raw,
    catalog_brand: brandName,
    catalog_product_name: offering.product_family_name,
    catalog_tags: offering.tags ?? [],
    catalog_reference_url: offering.reference_url,
    catalog_folder_url: offering.folder_url,
    // No SKU, no colour, no image, no price. An offering has none of these.
    catalog_sku: null,
    catalog_color: null,
    catalog_status: "PENDING",
    source_offering_id: offering.id,
    catalog_metadata: {
      migrated_from: "VendorOffering",
      migrated_at: new Date().toISOString(),
      offering_id: offering.id,
      jess_status: offering.jess_status,
      curated_by: offering.curated_by,
      offering_active_status: offering.active_status,
      source_notes: offering.source_notes,
      source_sheet: offering.source_sheet,
      source_row: offering.source_row,
      source_checksum: offering.source_checksum,
      needs_review_multiline: offering.needs_review_multiline,
    },
  };
}

async function buildPlan(prisma) {
  const [offerings, existingMaterials, vendors, counts] = await Promise.all([
    prisma.vendorOffering.findMany({ orderBy: { source_row: "asc" } }),
    prisma.productCatalog.findMany({
      where: { source_offering_id: { not: null } },
      select: { id: true, source_offering_id: true },
    }),
    prisma.vendor.findMany({ select: { id: true, brand_name: true, deleted_at: true } }),
    Promise.all([
      prisma.productCatalog.count(),
      prisma.vendorOffering.count(),
      prisma.auditLog.count(),
    ]),
  ]);

  const alreadyMigrated = new Set(existingMaterials.map((m) => m.source_offering_id));
  const vendorById = new Map(vendors.map((v) => [v.id, v]));

  const toInsert = [];
  const reuse = [];
  const blockers = [];

  for (const offering of offerings) {
    const vendor = vendorById.get(offering.vendor_id);
    if (!vendor) {
      blockers.push({
        offering_id: offering.id,
        source_row: offering.source_row,
        reason: "vendor_id tidak ditemukan — FK akan gagal",
      });
      continue;
    }
    if (vendor.deleted_at) {
      // Not auto-revived: reviving a supplier is a curation decision, not a
      // side effect of a data move.
      blockers.push({
        offering_id: offering.id,
        source_row: offering.source_row,
        reason: `vendor ${vendor.brand_name} soft-deleted — perlu keputusan manual`,
      });
      continue;
    }
    if (!offering.category_raw?.trim()) {
      blockers.push({
        offering_id: offering.id,
        source_row: offering.source_row,
        reason: "category_raw kosong — ProductCatalog.catalog_category NOT NULL",
      });
      continue;
    }
    if (alreadyMigrated.has(offering.id)) {
      reuse.push(offering.id);
      continue;
    }
    toInsert.push(toMaterial(offering, vendor.brand_name));
  }

  return {
    before: { productCatalog: counts[0], vendorOffering: counts[1], auditLogs: counts[2] },
    actions: {
      materials: { insert: toInsert.length, reuse: reuse.length },
      auditLogs: { insert: toInsert.length },
      blockers: blockers.length,
    },
    blockers,
    projectedAfter: {
      productCatalog: counts[0] + toInsert.length,
      vendorOffering: counts[1],
      auditLogs: counts[2] + toInsert.length,
    },
    _toInsert: toInsert,
  };
}

async function applyMigration(prisma, plan, actor) {
  return prisma.$transaction(async (tx) => {
    let inserted = 0;
    for (const material of plan._toInsert) {
      const created = await tx.productCatalog.create({
        data: {
          ...material,
          catalog_metadata: material.catalog_metadata,
        },
        select: { id: true, catalog_category: true, catalog_brand: true },
      });

      // entity_type casing must match what library-service.ts emits, or the
      // Update column lookup in Master Data silently returns nothing.
      await tx.auditLog.create({
        data: {
          action: "IMPORT_MATERIAL_FROM_OFFERING",
          entity_type: "ProductCatalog",
          entity_id: created.id,
          user_id: actor.id,
          details: {
            source_offering_id: material.source_offering_id,
            category: created.catalog_category,
            brand: created.catalog_brand,
          },
        },
      });
      inserted += 1;
    }

    const after = await Promise.all([
      tx.productCatalog.count(),
      tx.vendorOffering.count(),
      tx.auditLog.count(),
    ]);

    return {
      materials: { inserted },
      after: { productCatalog: after[0], vendorOffering: after[1], auditLogs: after[2] },
    };
  }, { timeout: 120_000 });
}

async function writeReport(report) {
  const dir = path.join(ROOT, "outputs", "offering-to-material");
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(dir, `offering-to-material-${report.mode}-${stamp}.json`);
  await fs.writeFile(file, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return file;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = process.argv.includes("--dry-run");
  if (apply === dryRun) fail("Pilih tepat satu mode: --dry-run atau --apply");

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL tidak tersedia");
  const url = new URL(connectionString);
  if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
    fail("Migrasi ini hanya boleh dijalankan terhadap database localhost");
  }
  if (apply && !process.argv.includes("--ack-review")) {
    fail("--apply membutuhkan --ack-review");
  }

  const backup = apply
    ? await verifyBackup(argValue("--backup"), argValue("--backup-sha256"))
    : null;

  const pool = new pg.Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const actor = await resolveActor(prisma, argValue("--actor-email"));
    const plan = await buildPlan(prisma);

    const base = {
      mode: apply ? "apply" : "dry-run",
      generatedAt: new Date().toISOString(),
      database: redact(connectionString),
      actor,
      backup,
      plan: {
        before: plan.before,
        actions: plan.actions,
        projectedAfter: plan.projectedAfter,
      },
      blockers: plan.blockers,
    };

    if (plan.blockers.length > 0) {
      console.warn(
        `\n${plan.blockers.length} baris diblokir dan TIDAK akan dimigrasi. ` +
          `Lihat daftar di report.\n`
      );
    }

    if (!apply) {
      const file = await writeReport(base);
      console.log(JSON.stringify({ ...base, reportPath: file }, null, 2));
      console.log("\nDRY-RUN PASS — nol write ke database.");
      return;
    }

    const result = await applyMigration(prisma, plan, actor);
    const report = { ...base, result };
    const file = await writeReport(report);
    console.log(JSON.stringify({ ...report, reportPath: file }, null, 2));
    console.log("\nAPPLY PASS — transaksi ter-commit.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`\nMIGRASI GAGAL: ${error.message}`);
  process.exitCode = 1;
});
