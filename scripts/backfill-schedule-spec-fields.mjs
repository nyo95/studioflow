#!/usr/bin/env node
/**
 * BACKFILL SCHEDULE SPEC FIELDS
 *
 *   node scripts/backfill-schedule-spec-fields.mjs            # dry-run
 *   node scripts/backfill-schedule-spec-fields.mjs --apply    # tulis ke DB
 *
 * KAPAN DIJALANKAN:
 *   Setelah Fase 1 ter-deploy ke production. Jangan jalankan --apply sebelum
 *   schedule-option-writer.ts ada di production, karena tanpanya baris baru
 *   masih akan masuk tanpa spec_*.
 *
 * APA YANG DILAKUKAN:
 *   Iterasi ProjectScheduleOption per batch (500), baca data_snapshot, hitung
 *   ulang spec_* menggunakan logika yang SAMA dengan Fase 1 (diimpor dari
 *   schedule-spec-fields.ts, bukan disalin). Update baris yang berbeda.
 *
 * IDEMPOTEN: jalan dua kali → perubahan kedua = 0.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 500;

// --------------------------------------------------------------------------
// Muat deriveScheduleSpecFields dari schedule-spec-fields.ts
// tanpa tsx / ts-node.
//
// schedule-spec-fields.ts sengaja bebas dependensi runtime (hanya punya
// `import type` yang hilang saat transpile). Namun TypeScript function
// signature annotations (`: TypeName`, `): ReturnType`) juga harus distrip
// agar file bisa dijalankan sebagai ESM biasa oleh Node.js.
//
// Stripping dilakukan dalam 4 pass:
//   1. Buang baris `import type …`
//   2. Buang return-type annotation sebelum `{`: ): TypeName {
//   3. Buang type-predicate di arrow function: (x): x is T =>
//   4. Buang parameter type annotations di dalam function declaration parens
//
// Pass 4 sengaja hanya menyentuh baris yang dimulai dengan `function` atau
// `export function` — jadi assignment `key: value` di dalam object literal
// tidak ikut terstrip.
// --------------------------------------------------------------------------
function stripTypeAnnotations(src) {
  return (
    src
      // 1. Buang baris import type
      .replace(/^import type[^\n]*\n/gm, "")
      // 2. Buang return type annotation sebelum {: ): boolean { → ) {
      .replace(/\)\s*:\s*\w+(?:\s*\[\])?\s*(?=\{)/g, ") ")
      // 3. Buang type predicate di arrow fn: (part): part is string =>
      .replace(/\((\w+)\)\s*:\s*\w+\s+is\s+\w+\s*=>/g, "($1) =>")
      // 4. Buang param type annotations — hanya di dalam function declaration
      //    Pola: ^(export )?function name(params) — tangkap params dan strip tiap annotation
      .replace(
        /^((?:export\s+)?function\s+\w+\s*)\(([^)]*)\)/gm,
        (_, funcHead, params) => {
          const clean = params.replace(
            /(\w+)\s*:\s*[\w\s|<>?,[\].]+/g,
            "$1"
          );
          return funcHead + "(" + clean + ")";
        }
      )
  );
}

async function loadDeriveSpecFields() {
  const tsSrc = join(ROOT, "src/extensions/schedule/services/schedule-spec-fields.ts");
  const tmpDir = join(ROOT, "tmp", "backfill-out");
  const outFile = join(tmpDir, "schedule-spec-fields.mjs");

  mkdirSync(tmpDir, { recursive: true });

  const raw = readFileSync(tsSrc, "utf-8");
  const stripped = stripTypeAnnotations(raw);

  writeFileSync(outFile, stripped, "utf-8");

  // Windows: import() absolute paths perlu file:// URL, kalau tidak Node ESM
  // melempar ERR_UNSUPPORTED_ESM_URL_SCHEME ("Received protocol 'd:'").
  const mod = await import(pathToFileURL(outFile).href + "?bust=" + Date.now());
  return mod.deriveScheduleSpecFields;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log("\nSCHEDULE SPEC FIELDS BACKFILL");
  console.log("=".repeat(72));

  const deriveSpecFields = await loadDeriveSpecFields();

  // Hitung total dulu (tanpa load data)
  const total = await prisma.projectScheduleOption.count();
  console.log(`Total ProjectScheduleOption : ${total}`);
  console.log(`Batch size                  : ${BATCH_SIZE}`);
  console.log(`Mode                        : ${APPLY ? "APPLY (akan menulis)" : "DRY RUN"}`);
  console.log("");

  let cursor = undefined;
  let read = 0;
  let changed = 0;
  let nullKeyBefore = 0;
  let nullKeyAfter = 0;
  let skippedBadSnapshot = 0;
  const sampleKeys = [];

  while (true) {
    const batch = await prisma.projectScheduleOption.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        data_snapshot: true,
        spec_search_key: true,
        spec_brand_id: true,
        spec_product_name: true,
        spec_color: true,
        spec_finishing: true,
      },
    });

    if (batch.length === 0) break;
    cursor = batch[batch.length - 1].id;
    read += batch.length;

    for (const row of batch) {
      if (!row.data_snapshot || typeof row.data_snapshot !== "object") {
        skippedBadSnapshot++;
        continue;
      }

      if (row.spec_search_key === null) nullKeyBefore++;

      let derived;
      try {
        derived = deriveSpecFields(row.data_snapshot);
      } catch {
        skippedBadSnapshot++;
        continue;
      }

      if (derived.spec_search_key === null) nullKeyAfter++;

      // Cek apakah ada perbedaan
      const isDifferent =
        derived.spec_search_key !== row.spec_search_key ||
        derived.spec_brand_id !== row.spec_brand_id ||
        derived.spec_product_name !== row.spec_product_name ||
        derived.spec_color !== row.spec_color ||
        derived.spec_finishing !== row.spec_finishing;

      if (!isDifferent) continue;
      changed++;

      if (sampleKeys.length < 10 && derived.spec_search_key) {
        sampleKeys.push(derived.spec_search_key);
      }

      if (APPLY) {
        await prisma.projectScheduleOption.update({
          where: { id: row.id },
          data: derived,
        });
      }
    }

    process.stdout.write(`  Diproses: ${read}/${total}\r`);
  }

  console.log("\n");
  console.log("RINGKASAN");
  console.log("-".repeat(72));
  console.log(`Dibaca                      : ${read}`);
  console.log(`Snapshot tidak valid, skip  : ${skippedBadSnapshot}`);
  console.log(`Perlu diupdate              : ${changed}`);
  console.log(`spec_search_key null SEBELUM: ${nullKeyBefore}`);
  console.log(`spec_search_key null SESUDAH: ${nullKeyAfter} (estimasi)`);
  console.log("");

  if (sampleKeys.length > 0) {
    console.log("Contoh key hasil (maks 10):");
    sampleKeys.forEach((k) => console.log(`  ${k}`));
    console.log("");
  }

  if (!APPLY) {
    console.log("DRY RUN — tidak ada yang ditulis.");
    console.log("Jalankan dengan --apply setelah Fase 1 ter-deploy ke production.");
  } else {
    console.log(`APPLIED — ${changed} baris diperbarui.`);
  }
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
