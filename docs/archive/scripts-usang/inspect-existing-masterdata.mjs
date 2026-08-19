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
 * INSPECT EXISTING VENDOR / PRODUCT DATA — READ-ONLY
 *
 *   node scripts/inspect-existing-masterdata.mjs
 *
 * ===========================================================================
 * WHY THIS EXISTS
 * ===========================================================================
 * Before the workbook import touches `Vendor` or before anyone deletes the
 * handful of pre-existing `ProductCatalog` rows, two things must be seen with
 * real eyes, not assumed:
 *
 *   1. What do the 3 existing Vendor rows actually contain? (MASTER_SSOT.md
 *      §6.4: they get reused and filled-in, never renamed or deleted — so we
 *      need to know which fields are already populated and must NOT be
 *      overwritten.)
 *   2. Are any of the 4 existing ProductCatalog rows referenced by a
 *      ProjectProductRequest? That FK has no snapshot and no explicit
 *      onDelete (defaults to Restrict) — unlike ProjectScheduleOption, which
 *      is provably safe (see the schedule-service.ts check this script also
 *      performs at the source level, not just via query).
 *
 * This script performs ZERO writes. It only reads and prints. Run it, read
 * the output, and only then decide whether the 4 ProductCatalog rows are safe
 * to delete.
 *
 * ===========================================================================
 * WHY YOU RUN THIS, NOT THE ASSISTANT
 * ===========================================================================
 * The sandbox this assistant runs in cannot reach localhost:5432 — Postgres is
 * only reachable from your machine. This script is written so you (or Codex,
 * with real DB access) can run it and report back the output, or just read it
 * directly.
 */

import pg from "pg";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("✗ DATABASE_URL is not set. Check .env");
  process.exit(1);
}

const isLocal =
  connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

const pool = new pg.Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function printRow(label, value) {
  console.log(`    ${label.padEnd(16)} ${value === null || value === undefined || value === "" ? "(kosong)" : value}`);
}

async function main() {
  console.log("\nINSPEKSI DATA EXISTING — READ ONLY, TIDAK ADA TULIS\n" + "=".repeat(64));
  console.log(
    `  database: ${connectionString.replace(/(:\/\/[^:]+:)[^@]*(@)/, "$1***$2")}`
  );

  if (!isLocal) {
    console.error(
      "\n✗ ABORT: DATABASE_URL bukan localhost. Script ini untuk database lokal saja.\n"
    );
    process.exit(1);
  }

  // --- 1. Vendors, in full, including contacts -----------------------------

  const vendors = await prisma.vendor.findMany({
    include: { contacts: true, products: { select: { id: true, catalog_sku: true, catalog_product_name: true, deleted_at: true } } },
    orderBy: { brand_name: "asc" },
  });

  console.log(`\n1. VENDOR — ${vendors.length} baris (aktif + soft-deleted)\n${"-".repeat(64)}`);
  for (const v of vendors) {
    console.log(`\n  [${v.deleted_at ? "SOFT-DELETED" : "AKTIF"}] ${v.brand_name}  (id: ${v.id})`);
    printRow("company_name", v.company_name);
    printRow("company_pt", v.company_pt);
    printRow("address", v.address);
    printRow("website_url", v.website_url);
    printRow("instagram_url", v.instagram_url);
    console.log(`    kontak: ${v.contacts.length} baris`);
    for (const c of v.contacts) {
      console.log(`      - ${c.contact_person} (${c.contact_role}) — ${c.phone_number ?? "(kosong)"} ${c.email ? `/ ${c.email}` : ""}`);
    }
    console.log(`    produk: ${v.products.length} baris`);
    for (const p of v.products) {
      console.log(`      - [${p.deleted_at ? "SOFT-DELETED" : "AKTIF"}] sku=${p.catalog_sku} name=${p.catalog_product_name ?? "(kosong)"} (id: ${p.id})`);
    }
  }

  // --- 2. ProductCatalog rows + everything that could reference them -------

  const products = await prisma.productCatalog.findMany({
    select: {
      id: true,
      catalog_sku: true,
      catalog_product_name: true,
      catalog_brand: true,
      catalog_status: true,
      deleted_at: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { created_at: "asc" },
  });

  console.log(`\n\n2. PRODUCTCATALOG — ${products.length} baris\n${"-".repeat(64)}`);
  for (const p of products) {
    console.log(`\n  [${p.deleted_at ? "SOFT-DELETED" : "AKTIF"}] ${p.catalog_sku} — ${p.catalog_product_name ?? "(tanpa nama)"} (id: ${p.id})`);
    printRow("brand", p.catalog_brand);
    printRow("status", p.catalog_status);
    printRow("created_at", p.created_at.toISOString());
    printRow("updated_at", p.updated_at ? p.updated_at.toISOString() : null);
  }

  if (products.length === 0) {
    console.log("\n  (tidak ada baris — tidak ada yang perlu diperiksa referensinya)");
    return finish();
  }

  const productIds = products.map((p) => p.id);

  // --- 3. THE gate: is any of them referenced by something without a snapshot ---

  const [scheduleOptions, productRequests, samples] = await Promise.all([
    prisma.projectScheduleOption.findMany({
      where: { product_catalog_id: { in: productIds } },
      select: { id: true, product_catalog_id: true, data_snapshot: true, entry: { select: { project_id: true } } },
    }),
    prisma.projectProductRequest.findMany({
      where: { product_catalog_id: { in: productIds } },
      select: { id: true, product_catalog_id: true, status: true, project_id: true },
    }),
    prisma.physicalSample.findMany({
      where: { product_id: { in: productIds } },
      select: { id: true, product_id: true, deleted_at: true, catalog_status: true },
    }),
  ]);

  console.log(`\n\n3. REFERENSI KE 4 PRODUK DI ATAS\n${"-".repeat(64)}`);

  console.log(`\n  ProjectScheduleOption (aman — punya data_snapshot beku, FK SetNull): ${scheduleOptions.length} baris`);
  for (const s of scheduleOptions) {
    const hasSnapshot = s.data_snapshot && Object.keys(s.data_snapshot).length > 0;
    console.log(`    - option ${s.id} -> project ${s.entry.project_id} | snapshot: ${hasSnapshot ? "ADA" : "⚠ KOSONG — investigasi manual"}`);
  }

  console.log(`\n  ProjectProductRequest (⚠ TIDAK punya snapshot, FK default Restrict): ${productRequests.length} baris`);
  if (productRequests.length > 0) {
    console.log("    ⚠ ADA REFERENSI. Jangan hapus produk ini sebelum menyelesaikan baris berikut:");
    for (const r of productRequests) {
      console.log(`    - request ${r.id} | status=${r.status} | project=${r.project_id} | product=${r.product_catalog_id}`);
    }
  } else {
    console.log("    Tidak ada referensi. Aman dari sisi ini.");
  }

  console.log(`\n  PhysicalSample (akan ikut cascade-delete kalau produk dihapus): ${samples.length} baris`);
  for (const s of samples) {
    console.log(`    - sample ${s.id} | status=${s.catalog_status} | ${s.deleted_at ? "sudah soft-deleted" : "AKTIF — akan ikut terhapus permanen"}`);
  }

  // --- Verdict ---------------------------------------------------------------

  console.log(`\n\n${"=".repeat(64)}`);
  if (productRequests.length === 0) {
    console.log("VERDICT: ke-4 ProductCatalog di atas AMAN dihapus (tidak ada ProjectProductRequest");
    console.log("yang menunjuk ke sana). Jadwal proyek (ProjectScheduleOption) tetap utuh karena");
    console.log("snapshot-nya sudah beku dan FK-nya SetNull.");
    if (samples.some((s) => !s.deleted_at)) {
      console.log("\nCatatan: ada PhysicalSample aktif yang akan ikut terhapus permanen (cascade).");
      console.log("Pastikan itu memang yang dimaksud sebelum menjalankan delete.");
    }
  } else {
    console.log("VERDICT: JANGAN HAPUS DULU. Ada ProjectProductRequest yang menunjuk ke salah satu");
    console.log("dari ke-4 produk ini, dan FK itu tidak punya snapshot pengganti. Selesaikan baris");
    console.log("itu (batalkan request, atau relokasi manual) sebelum delete.");
  }
  console.log("=".repeat(64) + "\n");

  await finish();
}

async function finish() {
  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error("\n✗ Gagal:", err.message);
  process.exitCode = 1;
  return finish();
});
