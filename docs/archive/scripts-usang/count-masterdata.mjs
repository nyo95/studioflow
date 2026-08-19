/**
 * Menghitung isi schema `master_data` v1 — jawaban untuk Q2 di
 * `docs/TANYA-SEBELUM-EKSEKUSI.md`.
 *
 * Read-only. Tidak menulis, tidak mengubah, tidak butuh flag pengaman.
 *
 *   node scripts/count-masterdata.mjs
 *
 * Memakai nama tabel FISIK (bukan nama model Prisma), karena beberapa di-@@map:
 *   Brand → "Vendor", Sku → "Material", BrandLink → "VendorLink",
 *   BrandContact → "VendorContact".
 *
 * Kirim balik keluarannya apa adanya — angka-angka ini yang menentukan apakah
 * M2 pekerjaan satu sore atau butuh jendela migrasi.
 */

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

/** [label, nama tabel fisik di schema master_data] */
const TABLES = [
  ["Company", "Company"],
  ["CompanyContact", "CompanyContact"],
  ["CompanyLink", "CompanyLink"],
  ["Brand", "Vendor"],
  ["BrandContact", "VendorContact"],
  ["BrandLink", "VendorLink"],
  ["Category", "Category"],
  ["BrandCategory", "BrandCategory"],
  ["SkuCategory", "SkuCategory"],
  ["Sku", "Material"],
  ["Sample", "Sample"],
  ["SampleMovementLog", "SampleMovementLog"],
  ["MaterialPrice", "MaterialPrice"],
  ["ServiceVendor", "ServiceVendor"],
  ["ServicePrice", "ServicePrice"],
  ["MaterialLaborPrice", "MaterialLaborPrice"],
  ["MaterialCandidate", "MaterialCandidate"],
  ["SampleCandidate", "SampleCandidate"],
];

async function countOf(table) {
  // Tabel yang belum ada (mis. SkuCategory kalau migrasi A1 belum diterapkan)
  // dilaporkan apa adanya, bukan membuat seluruh skrip gagal — justru itu yang
  // ingin diketahui.
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM master_data."${table}"`
    );
    return rows[0].n;
  } catch (error) {
    if (String(error?.message ?? "").includes("does not exist")) return "TIDAK ADA";
    throw error;
  }
}

async function main() {
  const results = [];
  for (const [label, table] of TABLES) {
    results.push([label, await countOf(table)]);
  }

  const width = Math.max(...results.map(([label]) => label.length));
  console.log("\nIsi schema master_data\n" + "─".repeat(width + 12));
  for (const [label, n] of results) {
    console.log(`${label.padEnd(width)}  ${String(n).padStart(8)}`);
  }

  // Titik paling berisiko di M2 (roadmap §M2): v1 menyimpan harga di dua
  // tempat tanpa satu pun dinyatakan benar. Kalau angka ini > 0, seeding v2
  // tidak bisa memilih otomatis.
  try {
    const conflict = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int AS n
      FROM master_data."Material" m
      JOIN master_data."MaterialPrice" p ON p.sku_id = m.id
      WHERE m.price_after_discount IS NOT NULL
        AND p.price_after_discount IS NOT NULL
        AND m.price_after_discount <> p.price_after_discount
    `);
    console.log(
      "\nSKU dengan harga BERBEDA di Material vs MaterialPrice: " + conflict[0].n
    );
    console.log("(> 0 berarti tiap barisnya butuh keputusan manusia saat seeding v2)");
  } catch {
    console.log("\nCek konflik harga dilewati — salah satu tabelnya belum ada.");
  }

  console.log();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
