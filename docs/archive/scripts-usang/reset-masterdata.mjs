/**
 * RESET MASTER DATA — kosongkan seluruh schema master_data untuk uji coba.
 *
 *   node scripts/reset-masterdata.mjs                  # dry-run (default)
 *   node scripts/reset-masterdata.mjs --apply          # hapus beneran
 *   node scripts/reset-masterdata.mjs --apply --force  # hapus walau data proyek terdampak
 *
 * =============================================================================
 * HARD DELETE. TIDAK ADA UNDO. Bukan soft-delete — baris benar-benar hilang.
 * =============================================================================
 *
 * Yang dihapus (seluruh isi schema master_data, termasuk antrean kurasi):
 *   SampleMovementLog, SampleCandidate, MaterialCandidate, SkuCategory,
 *   BrandCategory, MaterialPrice, MaterialLaborPrice, ServicePrice, Sample,
 *   Sku, BrandLink, BrandContact, Brand, Category, ServiceVendor,
 *   CompanyContact, CompanyLink, Company
 *
 * Yang TIDAK disentuh: User, Project, dan seluruh isi schema studioflow.
 *
 * -----------------------------------------------------------------------------
 * PEMERIKSAAN AWAL — kenapa ada
 * -----------------------------------------------------------------------------
 * Empat kolom di schema studioflow menunjuk ke master_data, semuanya SetNull:
 *
 *   ProjectProductRequest.brand_id, .sku_id, .linked_sample_id
 *   ProjectScheduleOption.sku_id, .spec_brand_id
 *
 * Artinya menghapus master data tidak diblokir dan tidak menghapus data proyek,
 * tetapi DIAM-DIAM mengosongkan tautannya. Ini tidak bisa dipulihkan dengan
 * re-seed: baris baru punya UUID baru, jadi tautan lama tidak akan tersambung
 * kembali. Sebuah permintaan produk kehilangan jejak material apa yang diminta,
 * dan sebuah opsi schedule kehilangan SKU-nya (isi data_snapshot memang beku
 * dan selamat, tapi relasinya putus).
 *
 * Karena itu skrip berhenti kalau menemukan baris proyek yang terdampak, dan
 * hanya lanjut kalau nol — atau kalau --force diberikan secara sadar.
 */

import { PrismaClient } from "../src/generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

/**
 * Urutan penghapusan: anak dulu, induk terakhir.
 *
 * Urutan ini mengikuti arah foreign key, bukan abjad. Beberapa relasi memakai
 * Restrict (Sample→Sku, Sku→Brand), jadi menghapus induk lebih dulu akan
 * ditolak database. Yang lain memakai Cascade, tetapi menghapus eksplisit tetap
 * lebih baik: jumlahnya terlaporkan, bukan hilang senyap lewat cascade.
 */
const DELETE_ORDER = [
  ["SampleMovementLog", (tx) => tx.sampleMovementLog.deleteMany({})],
  ["SampleCandidate", (tx) => tx.sampleCandidate.deleteMany({})],
  ["MaterialCandidate", (tx) => tx.materialCandidate.deleteMany({})],
  ["SkuCategory", (tx) => tx.skuCategory.deleteMany({})],
  ["BrandCategory", (tx) => tx.brandCategory.deleteMany({})],
  ["MaterialPrice", (tx) => tx.materialPrice.deleteMany({})],
  ["MaterialLaborPrice", (tx) => tx.materialLaborPrice.deleteMany({})],
  ["ServicePrice", (tx) => tx.servicePrice.deleteMany({})],
  ["Sample", (tx) => tx.sample.deleteMany({})],
  ["Sku", (tx) => tx.sku.deleteMany({})],
  ["BrandLink", (tx) => tx.brandLink.deleteMany({})],
  ["BrandContact", (tx) => tx.brandContact.deleteMany({})],
  ["Brand", (tx) => tx.brand.deleteMany({})],
  ["Category", (tx) => tx.category.deleteMany({})],
  ["ServiceVendor", (tx) => tx.serviceVendor.deleteMany({})],
  ["CompanyContact", (tx) => tx.companyContact.deleteMany({})],
  ["CompanyLink", (tx) => tx.companyLink.deleteMany({})],
  ["Company", (tx) => tx.company.deleteMany({})],
];

const COUNTS = [
  ["Company", (p) => p.company.count()],
  ["CompanyContact", (p) => p.companyContact.count()],
  ["CompanyLink", (p) => p.companyLink.count()],
  ["Brand", (p) => p.brand.count()],
  ["BrandContact", (p) => p.brandContact.count()],
  ["BrandLink", (p) => p.brandLink.count()],
  ["Category", (p) => p.category.count()],
  ["BrandCategory", (p) => p.brandCategory.count()],
  ["SkuCategory", (p) => p.skuCategory.count()],
  ["Sku", (p) => p.sku.count()],
  ["Sample", (p) => p.sample.count()],
  ["SampleMovementLog", (p) => p.sampleMovementLog.count()],
  ["MaterialPrice", (p) => p.materialPrice.count()],
  ["MaterialLaborPrice", (p) => p.materialLaborPrice.count()],
  ["ServiceVendor", (p) => p.serviceVendor.count()],
  ["ServicePrice", (p) => p.servicePrice.count()],
  ["MaterialCandidate", (p) => p.materialCandidate.count()],
  ["SampleCandidate", (p) => p.sampleCandidate.count()],
];

async function main() {
  console.log("=".repeat(64));
  console.log("RESET MASTER DATA" + (APPLY ? "  [--apply]" : "  [DRY-RUN]"));
  console.log("=".repeat(64));

  // ---- isi saat ini -------------------------------------------------------
  console.log("\nIsi master_data saat ini:");
  let total = 0;
  for (const [label, fn] of COUNTS) {
    let n;
    try {
      n = await fn(prisma);
    } catch {
      // SkuCategory belum ada kalau migrasi C12 belum diterapkan.
      console.log(`  ${label.padEnd(20)} —  (tabel belum ada)`);
      continue;
    }
    total += n;
    console.log(`  ${label.padEnd(20)} ${String(n).padStart(6)}`);
  }
  console.log(`  ${"TOTAL".padEnd(20)} ${String(total).padStart(6)}`);

  if (total === 0) {
    console.log("\nMaster data sudah kosong. Tidak ada yang perlu dilakukan.");
    return;
  }

  // ---- pemeriksaan awal: data proyek yang terdampak ------------------------
  const [reqBrand, reqSku, reqSample, optSku, optBrand] = await Promise.all([
    prisma.projectProductRequest.count({ where: { brand_id: { not: null } } }),
    prisma.projectProductRequest.count({ where: { sku_id: { not: null } } }),
    prisma.projectProductRequest.count({ where: { linked_sample_id: { not: null } } }),
    prisma.projectScheduleOption.count({ where: { sku_id: { not: null } } }),
    prisma.projectScheduleOption.count({ where: { spec_brand_id: { not: null } } }),
  ]);
  const affected = reqBrand + reqSku + reqSample + optSku + optBrand;

  console.log("\nData proyek yang menunjuk ke master data:");
  console.log(`  ProjectProductRequest.brand_id        ${String(reqBrand).padStart(6)}`);
  console.log(`  ProjectProductRequest.sku_id          ${String(reqSku).padStart(6)}`);
  console.log(`  ProjectProductRequest.linked_sample_id${String(reqSample).padStart(6)}`);
  console.log(`  ProjectScheduleOption.sku_id          ${String(optSku).padStart(6)}`);
  console.log(`  ProjectScheduleOption.spec_brand_id   ${String(optBrand).padStart(6)}`);

  if (affected > 0 && !FORCE) {
    console.log("\n" + "!".repeat(64));
    console.log(`BERHENTI. ${affected} tautan pada data proyek akan dikosongkan.`);
    console.log("!".repeat(64));
    console.log(
      "\nTautan ini TIDAK bisa dipulihkan dengan re-seed — baris baru punya UUID\n" +
      "baru. Permintaan produk akan kehilangan jejak material yang diminta, dan\n" +
      "opsi schedule kehilangan SKU-nya (data_snapshot tetap utuh, relasinya putus).\n" +
      "\nKalau database ini memang untuk uji coba dan itu tidak masalah, jalankan:\n" +
      "  node scripts/reset-masterdata.mjs --apply --force\n"
    );
    process.exitCode = 1;
    return;
  }

  if (affected === 0) {
    console.log("  → nol. Tidak ada data proyek yang terdampak.");
  } else {
    console.log(`  → ${affected} tautan akan dikosongkan (--force diberikan).`);
  }

  if (!APPLY) {
    console.log("\nDRY-RUN. Tidak ada yang dihapus.");
    console.log("Jalankan dengan --apply untuk menghapus.");
    return;
  }

  // ---- eksekusi -----------------------------------------------------------
  // Satu transaksi: kalau ada satu langkah gagal, tidak ada yang terhapus
  // separuh jalan dan meninggalkan master data dalam keadaan tidak konsisten.
  console.log("\nMenghapus…");
  const deleted = await prisma.$transaction(async (tx) => {
    const rows = [];
    for (const [label, fn] of DELETE_ORDER) {
      try {
        const r = await fn(tx);
        rows.push([label, r.count]);
      } catch (e) {
        if (
          e instanceof TypeError ||
          e?.code === "P2021" ||
          /does not exist/i.test(e?.message ?? "")
        ) {
          rows.push([label, null]); // tabel belum ada (mis. SkuCategory)
          continue;
        }
        throw e;
      }
    }
    return rows;
  }, { timeout: 120_000 });

  let removed = 0;
  for (const [label, n] of deleted) {
    if (n === null) {
      console.log(`  ${label.padEnd(20)} —  (tabel belum ada)`);
    } else {
      removed += n;
      console.log(`  ${label.padEnd(20)} ${String(n).padStart(6)} dihapus`);
    }
  }

  console.log(`\nSelesai. ${removed} baris dihapus. Master data sekarang kosong.`);
  console.log("Halaman Supplier, Materials, Harga, dan Kurasi akan tampil kosong.");
}

main()
  .catch((e) => { console.error("\nGAGAL:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
