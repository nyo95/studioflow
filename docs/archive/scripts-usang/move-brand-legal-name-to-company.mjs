/**
 * P3-b — Pindahkan Brand.legal_name → Company.legal_name
 *
 * Prasyarat: P3-a sudah dijalankan (brand sudah punya company_id).
 *
 *   node scripts/move-brand-legal-name-to-company.mjs           # dry-run (default)
 *   node scripts/move-brand-legal-name-to-company.mjs --apply   # tulis perubahan
 *
 * Setelah R7 memisahkan Company dari Brand, badan usaha tersimpan di dua tempat.
 * Skrip ini menyisakan satu: Company.legal_name untuk brand yang punya induk,
 * Brand.legal_name hanya untuk brand yang memang berdiri sendiri.
 *
 * Aturan per brand (hanya yang company_id != null DAN legal_name terisi):
 *
 *   1. Company.legal_name kosong          → diisi dari brand, brand dikosongkan.
 *   2. Company.legal_name == brand (sama) → duplikat murni, brand dikosongkan.
 *   3. Company.legal_name != brand (beda) → KONFLIK. Tidak ada yang disentuh,
 *      dilaporkan untuk diputuskan manusia.
 *
 * Aturan 3 penting: menimpa Company.legal_name berarti membuang badan usaha yang
 * mungkin sudah diverifikasi, dan mengosongkan Brand.legal_name berarti membuang
 * satu-satunya bukti bahwa keduanya pernah berbeda. Perbedaan hampir selalu
 * berarti pengelompokan P3-a keliru, bukan datanya yang perlu dirapikan.
 *
 * Perbandingan case-insensitive dengan titik dan spasi ganda dinormalisasi,
 * supaya "PT. Cipta Sani" dan "PT Cipta Sani" tidak dianggap konflik.
 */

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function norm(value) {
  return (value ?? "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const brands = await prisma.brand.findMany({
    where: { deleted_at: null, company_id: { not: null }, legal_name: { not: null } },
    select: {
      id: true,
      brand_name: true,
      legal_name: true,
      company: { select: { id: true, name: true, legal_name: true } },
    },
    orderBy: { brand_name: "asc" },
  });

  const fill = [];      // Company.legal_name kosong → isi
  const dedupe = [];    // sudah sama → cukup kosongkan brand
  const conflicts = []; // beda → laporkan, jangan sentuh

  for (const b of brands) {
    const brandLegal = (b.legal_name ?? "").trim();
    if (!brandLegal || !b.company) continue;

    const companyLegal = (b.company.legal_name ?? "").trim();

    if (!companyLegal) {
      fill.push({ brand: b, companyId: b.company.id, value: brandLegal });
    } else if (norm(companyLegal) === norm(brandLegal)) {
      dedupe.push({ brand: b });
    } else {
      conflicts.push({
        brand: b.brand_name,
        brandLegal,
        company: b.company.name,
        companyLegal,
      });
    }
  }

  console.log(`Brand dengan Company + legal_name : ${brands.length}`);
  console.log(`  Company.legal_name akan diisi   : ${fill.length}`);
  console.log(`  Duplikat, brand dikosongkan     : ${dedupe.length}`);
  console.log(`  KONFLIK (dilewati)              : ${conflicts.length}`);

  if (conflicts.length > 0) {
    console.log("\n--- KONFLIK: badan usaha brand berbeda dari perusahaannya ---");
    for (const c of conflicts) {
      console.log(`  ${c.brand}`);
      console.log(`     brand   : ${c.brandLegal}`);
      console.log(`     company : ${c.companyLegal}  (${c.company})`);
    }
    console.log("Periksa apakah brand ini benar berada di bawah perusahaan tersebut.");
  }

  if (!APPLY) {
    console.log("\nDRY-RUN. Tidak ada yang diubah. Jalankan dengan --apply untuk menulis.");
    return;
  }

  // Satu transaksi: kalau ada yang gagal di tengah, tidak ada brand yang
  // kehilangan legal_name tanpa nilainya sempat mendarat di Company.
  await prisma.$transaction(async (tx) => {
    for (const { companyId, value } of fill) {
      await tx.company.update({ where: { id: companyId }, data: { legal_name: value } });
    }
    const idsToClear = [...fill.map((f) => f.brand.id), ...dedupe.map((d) => d.brand.id)];
    if (idsToClear.length > 0) {
      await tx.brand.updateMany({
        where: { id: { in: idsToClear } },
        data: { legal_name: null },
      });
    }
  });

  console.log(
    `\nSelesai. Company diisi: ${fill.length}, Brand.legal_name dikosongkan: ${fill.length + dedupe.length}.`
  );
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
