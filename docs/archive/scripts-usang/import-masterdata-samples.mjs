#!/usr/bin/env node
/**
 * ===========================================================================
 * OBSOLETE as of 31 July 2026 — DOES NOT RUN.
 * ===========================================================================
 * Targets `PhysicalSample`, `ProductCatalog` and `Vendor`. The master-data
 * entity rework (prisma/migrations/20260731190000_master_data_entity_rework)
 * renamed and moved all three: samples are now `master_data.Sample` with
 * `sku_id`, and the catalog is `master_data.Sku`.
 *
 * The 287 rows this script originally imported were PRESERVED by that
 * migration — the table was moved with ALTER TABLE, not recreated — so there
 * is nothing to re-import. Kept for its column mapping and checksum rules.
 * ===========================================================================
 */

throw new Error(
  "OBSOLETE: do not run this importer. Follow docs/MASTERDATA_CSV_SEEDING_GUIDE.md. " +
  "A Sample may be seeded only after its physical existence is verified and it " +
  "matches exactly one Material."
);

/**
 * Import the reviewed `Sheet1` physical-sample staging into PhysicalSample.
 *
 * Dry-run:
 *   node scripts/import-masterdata-samples.mjs --dry-run \
 *     --actor-email user@example.com
 *
 * Apply:
 *   node scripts/import-masterdata-samples.mjs --apply \
 *     --actor-email user@example.com \
 *     --backup backups/studioflow_pre_samples_YYYYMMDD_HHMMSS.dump \
 *     --backup-sha256 <sha256> \
 *     --ack-review
 *
 * Safety properties:
 * - localhost databases only;
 * - workbook SHA-256 and row-by-row CSV reconciliation are mandatory;
 * - apply requires a verified backup and explicit review acknowledgement;
 * - one transaction for PhysicalSample and AuditLog;
 * - source row identity makes the import idempotent;
 * - ProductCatalog, Vendor and SampleMovementLog are never written;
 * - empty source fields stay empty: no invented SKU, brand, colour or image.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import ExcelJS from "exceljs";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const ROOT = process.cwd();
const DEFAULT_STAGING_DIR = path.join(
  ROOT,
  "docs",
  "masterdata-sample-staging"
);
const BACKUPS_DIR = path.resolve(ROOT, "backups");
const CAPABLE_ROLES = new Set(["ADMIN", "OWNER", "STAFF"]);
const EXPECTED_HEADERS = [
  "source_sheet",
  "source_row",
  "source_number",
  "category_raw",
  "brand_raw",
  "type_raw",
  "motif_raw",
  "rack_number",
  "box_number",
  "status",
  "current_borrower_name",
  "notes",
  "source_checksum",
];
const EXPECTED_WORKBOOK_HEADERS = [
  "No",
  "Jenis",
  "Brand",
  "Tipe",
  "Motif",
  "Lokasi",
  "Container box",
  "Nama",
  "Keterangan",
];
const ALLOWED_STATUSES = new Set(["AVAILABLE", "BORROWED"]);

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function fail(message) {
  throw new Error(message);
}

function text(value) {
  return value == null ? "" : String(value).trim();
}

function nullable(value) {
  const normalized = text(value);
  return normalized === "" ? null : normalized;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
}

async function sha256File(filePath) {
  return sha256(await fs.readFile(filePath));
}

function parseCsv(inputText, label) {
  const input = inputText.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (quoted) fail(`${label}: CSV berakhir di dalam quoted field`);
  if (field !== "" || row.length > 0) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (rows.length < 2) fail(`${label}: CSV kosong`);

  const headers = rows[0];
  if (
    headers.length !== EXPECTED_HEADERS.length ||
    headers.some((header, index) => header !== EXPECTED_HEADERS[index])
  ) {
    fail(`${label}: header tidak sesuai`);
  }

  return rows.slice(1).map((values, index) => {
    if (values.length !== headers.length) {
      fail(
        `${label}: baris ${index + 2} memiliki ${values.length} kolom, ` +
          `seharusnya ${headers.length}`
      );
    }
    return Object.fromEntries(
      headers.map((header, column) => [header, values[column]])
    );
  });
}

function sourceKey(sample) {
  return [
    sample.source_checksum,
    sample.source_sheet,
    String(sample.source_row),
  ].join("\u001F");
}

function redactConnectionString(connectionString) {
  return connectionString.replace(/(:\/\/[^:]+:)[^@]*(@)/, "$1***$2");
}

async function workbookRows(workbookPath, sourceChecksum) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const sheet = workbook.getWorksheet("Sheet1");
  if (!sheet) fail("Sheet1 tidak ditemukan");

  const headers = EXPECTED_WORKBOOK_HEADERS.map((_, index) =>
    text(sheet.getCell(3, index + 1).text)
  );
  if (
    headers.some(
      (header, index) => header !== EXPECTED_WORKBOOK_HEADERS[index]
    )
  ) {
    fail(`Header Sheet1 berubah: ${JSON.stringify(headers)}`);
  }

  const rows = [];
  for (let sourceRow = 4; sourceRow <= 290; sourceRow += 1) {
    const values = EXPECTED_WORKBOOK_HEADERS.map((_, index) =>
      text(sheet.getCell(sourceRow, index + 1).text)
    );
    if (values.every((value) => value === "")) continue;

    const borrower = values[7];
    rows.push({
      source_sheet: "Sheet1",
      source_row: sourceRow,
      source_number: values[0],
      category_raw: values[1],
      brand_raw: values[2],
      type_raw: values[3],
      motif_raw: values[4],
      rack_number: values[5],
      box_number: values[6],
      status: borrower ? "BORROWED" : "AVAILABLE",
      current_borrower_name: borrower,
      notes: values[8],
      source_checksum: sourceChecksum,
    });
  }
  return rows;
}

function assertSameRows(csvRows, workbookData) {
  if (csvRows.length !== workbookData.length) {
    fail(
      `Jumlah CSV ${csvRows.length} tidak sama dengan workbook ` +
        `${workbookData.length}`
    );
  }

  for (let index = 0; index < workbookData.length; index += 1) {
    const csv = csvRows[index];
    const source = workbookData[index];
    for (const header of EXPECTED_HEADERS) {
      if (String(csv[header]) !== String(source[header])) {
        fail(
          `CSV baris ${index + 2}, ${header}: ` +
            `actual=${JSON.stringify(csv[header])}, ` +
            `workbook=${JSON.stringify(source[header])}`
        );
      }
    }
  }
}

async function loadStaging(stagingDir) {
  const workbookPath = path.resolve(
    stagingDir,
    "..",
    "RAD - Material + Supplier.xlsx"
  );
  const csvPath = path.join(stagingDir, "01_physical_samples.csv");
  const summaryPath = path.join(stagingDir, "BUILD_SUMMARY.json");

  const [workbookBuffer, csvText, summaryText] = await Promise.all([
    fs.readFile(workbookPath),
    fs.readFile(csvPath, "utf8"),
    fs.readFile(summaryPath, "utf8"),
  ]);
  const sourceChecksum = sha256(workbookBuffer);
  const summary = JSON.parse(summaryText);
  if (summary.source_checksum !== sourceChecksum) {
    fail(
      `Checksum workbook tidak cocok: actual=${sourceChecksum}, ` +
        `expected=${summary.source_checksum}`
    );
  }
  if (summary.blockers !== 0) {
    fail(`Import diblokir: ${summary.blockers} blocker masih terbuka`);
  }

  const csvRows = parseCsv(csvText, "01_physical_samples.csv");
  const sourceRows = await workbookRows(workbookPath, sourceChecksum);
  assertSameRows(csvRows, sourceRows);
  if (sourceRows.length !== summary.rows) {
    fail("Jumlah staging tidak cocok dengan BUILD_SUMMARY.json");
  }

  const seen = new Set();
  const samples = sourceRows.map((row) => {
    const label = `${row.source_sheet}:${row.source_row}`;
    if (!row.category_raw) fail(`${label}: category_raw wajib`);
    if (!row.rack_number || !row.box_number) {
      fail(`${label}: rack_number dan box_number wajib`);
    }
    if (!ALLOWED_STATUSES.has(row.status)) {
      fail(`${label}: status tidak dikenal`);
    }
    if (
      (row.status === "BORROWED") !== Boolean(row.current_borrower_name)
    ) {
      fail(`${label}: status tidak konsisten dengan Nama`);
    }
    const key = sourceKey(row);
    if (seen.has(key)) fail(`${label}: source key duplikat`);
    seen.add(key);
    return row;
  });

  return { sourceChecksum, summary, samples };
}

async function resolveActor(prisma, actorEmail) {
  if (!actorEmail) fail("--actor-email wajib diisi dengan User nyata");
  const actor = await prisma.user.findUnique({
    where: { email: actorEmail },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!actor) fail(`Actor ${actorEmail} tidak ditemukan`);
  if (!CAPABLE_ROLES.has(actor.role)) {
    fail(`Actor ${actorEmail} dengan role ${actor.role} tidak boleh import`);
  }
  return actor;
}

async function buildPlan(prisma, staging) {
  const [existing, counts] = await Promise.all([
    prisma.physicalSample.findMany({
      where: { source_checksum: staging.sourceChecksum },
      select: {
        id: true,
        source_checksum: true,
        source_sheet: true,
        source_row: true,
      },
    }),
    Promise.all([
      prisma.physicalSample.count(),
      prisma.productCatalog.count(),
      prisma.vendor.count(),
      prisma.sampleMovementLog.count(),
      prisma.auditLog.count(),
    ]),
  ]);
  const existingKeys = new Set(existing.map(sourceKey));
  const inserts = staging.samples.filter(
    (sample) => !existingKeys.has(sourceKey(sample))
  ).length;

  return {
    before: {
      physicalSamples: counts[0],
      productCatalogs: counts[1],
      vendors: counts[2],
      sampleMovements: counts[3],
      auditLogs: counts[4],
    },
    actions: {
      physicalSamples: {
        insert: inserts,
        reuse: staging.samples.length - inserts,
      },
      auditLogs: { insert: inserts },
    },
    projectedAfter: {
      physicalSamples: counts[0] + inserts,
      productCatalogs: counts[1],
      vendors: counts[2],
      sampleMovements: counts[3],
      auditLogs: counts[4] + inserts,
    },
  };
}

async function applyImport(prisma, staging, actor) {
  return prisma.$transaction(
    async (tx) => {
      const existing = await tx.physicalSample.findMany({
        where: { source_checksum: staging.sourceChecksum },
        select: {
          id: true,
          source_checksum: true,
          source_sheet: true,
          source_row: true,
        },
      });
      const existingKeys = new Set(existing.map(sourceKey));
      let inserted = 0;
      let reused = 0;

      for (const sample of staging.samples) {
        const key = sourceKey(sample);
        if (existingKeys.has(key)) {
          reused += 1;
          continue;
        }

        const created = await tx.physicalSample.create({
          data: {
            product_id: null,
            catalog_rack_number: sample.rack_number,
            catalog_box_number: sample.box_number,
            catalog_notes: nullable(sample.notes),
            catalog_status: sample.status,
            current_borrower_name: nullable(sample.current_borrower_name),
            catalog_source_number: nullable(sample.source_number),
            catalog_source_category: sample.category_raw,
            catalog_source_brand: nullable(sample.brand_raw),
            catalog_source_type: nullable(sample.type_raw),
            catalog_source_motif: nullable(sample.motif_raw),
            source_sheet: sample.source_sheet,
            source_row: sample.source_row,
            source_checksum: sample.source_checksum,
          },
        });
        existingKeys.add(key);
        inserted += 1;

        await tx.auditLog.create({
          data: {
            action: "IMPORT_PHYSICAL_SAMPLE_CREATE",
            entity_type: "PhysicalSample",
            entity_id: created.id,
            user_id: actor.id,
            details: {
              source: "RAD - Material + Supplier.xlsx",
              source_sheet: sample.source_sheet,
              source_row: sample.source_row,
              source_checksum: sample.source_checksum,
              product_id: null,
              rack_number: sample.rack_number,
              box_number: sample.box_number,
              initial_status: sample.status,
            },
          },
        });
      }

      const after = await Promise.all([
        tx.physicalSample.count(),
        tx.productCatalog.count(),
        tx.vendor.count(),
        tx.sampleMovementLog.count(),
        tx.auditLog.count(),
      ]);
      return {
        physicalSamples: { inserted, reused },
        after: {
          physicalSamples: after[0],
          productCatalogs: after[1],
          vendors: after[2],
          sampleMovements: after[3],
          auditLogs: after[4],
        },
      };
    },
    { maxWait: 10_000, timeout: 180_000 }
  );
}

async function verifyBackup(backupPathArg, expectedHash) {
  if (!backupPathArg || !expectedHash) {
    fail("--apply membutuhkan --backup dan --backup-sha256");
  }
  const backupPath = path.resolve(ROOT, backupPathArg);
  const relative = path.relative(BACKUPS_DIR, backupPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    fail("Backup harus berada di folder workspace backups/");
  }
  const stats = await fs.stat(backupPath);
  if (!stats.isFile() || stats.size === 0) fail("Backup tidak valid/kosong");
  const actualHash = await sha256File(backupPath);
  if (actualHash !== expectedHash.toUpperCase()) {
    fail(`Hash backup tidak cocok: actual=${actualHash}`);
  }
  return { path: backupPath, bytes: stats.size, sha256: actualHash };
}

async function writeReport(report) {
  const outputDir = path.join(ROOT, "outputs", "masterdata-sample-import");
  await fs.mkdir(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    outputDir,
    `physical-sample-import-${report.mode}-${timestamp}.json`
  );
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const explicitDryRun = process.argv.includes("--dry-run");
  if (apply === explicitDryRun) {
    fail("Pilih tepat satu mode: --dry-run atau --apply");
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) fail("DATABASE_URL tidak tersedia");
  const databaseUrl = new URL(connectionString);
  if (!["localhost", "127.0.0.1"].includes(databaseUrl.hostname)) {
    fail("Importer hanya boleh dijalankan terhadap database localhost");
  }
  if (apply && !process.argv.includes("--ack-review")) {
    fail("--apply membutuhkan --ack-review");
  }

  const stagingDir = path.resolve(
    ROOT,
    argValue("--staging-dir") ?? DEFAULT_STAGING_DIR
  );
  const backup = apply
    ? await verifyBackup(argValue("--backup"), argValue("--backup-sha256"))
    : null;
  const staging = await loadStaging(stagingDir);

  const pool = new pg.Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
  try {
    const actor = await resolveActor(prisma, argValue("--actor-email"));
    const plan = await buildPlan(prisma, staging);
    const baseReport = {
      mode: apply ? "apply" : "dry-run",
      generatedAt: new Date().toISOString(),
      database: redactConnectionString(connectionString),
      actor,
      source: {
        workbook: "RAD - Material + Supplier.xlsx",
        sheet: "Sheet1",
        checksum: staging.sourceChecksum,
      },
      staging: staging.summary,
      plan,
      backup,
    };

    if (!apply) {
      const reportPath = await writeReport(baseReport);
      console.log(JSON.stringify({ ...baseReport, reportPath }, null, 2));
      console.log("\nDRY-RUN PASS — zero database writes.");
      return;
    }

    const result = await applyImport(prisma, staging, actor);
    const report = { ...baseReport, result };
    const reportPath = await writeReport(report);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
    console.log("\nAPPLY PASS — transaction committed.");
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`\nIMPORT FAILED: ${error.message}`);
  process.exitCode = 1;
});
