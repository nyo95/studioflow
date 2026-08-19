#!/usr/bin/env node
/**
 * INSPEKSI KEADAAN master_data — laporan B-Q7
 *
 *   node scripts/inspect-masterdata-state.mjs
 *   node scripts/inspect-masterdata-state.mjs --json > docs/masterdata-state.json
 *
 * ============================================================================
 * KENAPA INI ADA — DAN KENAPA BUKAN DIJALANKAN LANGSUNG OLEH AGENT
 * ============================================================================
 * Keputusan owner B-Q7: *"Do NOT ask the owner for the row count or migration
 * state if the repository environment allows inspection."*
 *
 * Lingkungan repo TIDAK mengizinkannya. `DATABASE_URL` menunjuk ke
 * `localhost:5432` — Postgres di dalam `docker-compose.yml` yang jalan di PC
 * owner. Shell agent adalah VM Linux terisolasi; `localhost` di sana adalah VM
 * itu sendiri. Sudah dicoba: localhost, host.docker.internal, 172.17.0.1,
 * 10.0.2.2, 192.168.65.254 — kelimanya connection refused / unreachable.
 *
 * Jadi jawaban jujurnya bukan "saya tidak mau memeriksa" dan bukan pula angka
 * yang dikarang. Skrip ini yang memeriksa, owner yang menjalankannya, dan
 * hasilnya ditempel kembali. HANYA BACA — tidak ada satu pun perintah tulis
 * di berkas ini.
 *
 * ============================================================================
 * YANG DILAPORKAN
 * ============================================================================
 *   1. Status migrasi + apakah 20260811120100 sudah applied
 *   2. Jumlah baris tiap tabel master_data
 *   3. Dampak backfill B-Q4 (arah List/Net Price)
 *   4. Keadaan WorkPrice.code (B-Q2)
 *   5. Kebersihan identitas Excel (B-Q3): slug duplikat
 *   6. Vonis: perlu backfill atau tidak
 */

import { PrismaClient } from "../src/generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const JSON_MODE = process.argv.includes("--json");
const out = {};
const log = (...a) => { if (!JSON_MODE) console.log(...a); };

const { Pool } = pg;
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL / DIRECT_URL tidak ditemukan di .env");
  process.exit(1);
}
const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const q = (sql) => prisma.$queryRawUnsafe(sql);
const n = (v) => (typeof v === "bigint" ? Number(v) : Number(v ?? 0));

async function main() {
  log("═".repeat(72));
  log("INSPEKSI master_data —", new Date().toISOString());
  log("Host:", connectionString.replace(/:[^:@]+@/, ":***@"));
  log("═".repeat(72));

  // ── 1. Migrasi ───────────────────────────────────────────────────────────
  log("\n1. MIGRASI");
  const migs = await q(`
    SELECT migration_name, finished_at, rolled_back_at
    FROM "_prisma_migrations" ORDER BY started_at`);
  const applied = migs.filter((m) => m.finished_at && !m.rolled_back_at);
  const failed = migs.filter((m) => !m.finished_at || m.rolled_back_at);

  out.migrations = {
    total: migs.length,
    applied: applied.length,
    failed: failed.map((m) => m.migration_name),
    has_20260811120000: applied.some((m) => m.migration_name.startsWith("20260811120000")),
    has_20260811120100: applied.some((m) => m.migration_name.startsWith("20260811120100")),
    last: applied.at(-1)?.migration_name ?? null,
  };
  log(`   applied ${applied.length}/${migs.length}, terakhir: ${out.migrations.last}`);
  log(`   20260811120000 (WorkPrice single price) : ${out.migrations.has_20260811120000 ? "✅ APPLIED" : "❌ BELUM"}`);
  log(`   20260811120100 (redefine v_bq_work_rate): ${out.migrations.has_20260811120100 ? "✅ APPLIED" : "❌ BELUM"}`);
  if (failed.length) log(`   ⚠️  GAGAL/ROLLED BACK: ${failed.map((m) => m.migration_name).join(", ")}`);

  // Bukti fisik, bukan cuma catatan migrasi: kolom lama benar-benar hilang?
  const wpCols = await q(`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_schema='master_data' AND table_name='WorkPrice'`);
  const wpColNames = wpCols.map((c) => c.column_name);
  out.workprice_drift_closed =
    !wpColNames.includes("material_price") &&
    !wpColNames.includes("labor_price") &&
    wpColNames.includes("price") &&
    wpColNames.includes("kind");
  log(`   drift WorkPrice benar-benar tertutup di DB: ${out.workprice_drift_closed ? "✅ YA" : "❌ TIDAK — kolom lama masih ada"}`);

  // ── 2. Jumlah baris ──────────────────────────────────────────────────────
  log("\n2. JUMLAH BARIS master_data");
  const tables = [
    "Party", "PartyRole", "PartyContact", "PartyLink",
    "Brand", "BrandLink", "BrandSupplier", "BrandCategory",
    "Category", "Sku", "SkuCategory", "SkuMedia", "SkuPrice",
    "WorkPrice", "WorkPriceProjectRef",
    "Sample", "SampleMovement", "MasterDataAudit",
  ];
  out.rows = {};
  let total = 0;
  for (const t of tables) {
    try {
      const [r] = await q(`SELECT COUNT(*)::bigint AS c FROM "master_data"."${t}"`);
      out.rows[t] = n(r.c);
      total += out.rows[t];
      log(`   ${t.padEnd(22)} ${String(out.rows[t]).padStart(7)}`);
    } catch {
      out.rows[t] = null;
      log(`   ${t.padEnd(22)} ${"TABEL TIDAK ADA".padStart(7)}`);
    }
  }
  out.rows_total = total;
  log(`   ${"TOTAL".padEnd(22)} ${String(total).padStart(7)}`);

  if (out.rows.MasterDataAudit === 0) {
    log("   → MasterDataAudit = 0 baris. Mengonfirmasi temuan: tabelnya tidak pernah ditulis.");
  }

  // ── 3. Dampak B-Q4 (arah List/Net Price) ─────────────────────────────────
  log("\n3. DAMPAK B-Q4 — List Price wajib, Net Price opsional");
  const [p] = await q(`
    SELECT COUNT(*)::bigint AS total,
           COUNT(*) FILTER (WHERE price_list IS NULL)::bigint AS list_null,
           COUNT(*) FILTER (WHERE price_list IS NULL AND price_net IS NOT NULL)::bigint AS list_null_net_set,
           COUNT(*) FILTER (WHERE price_list IS NOT NULL)::bigint AS list_set
    FROM "master_data"."SkuPrice"`);
  out.bq4 = {
    total: n(p.total),
    price_list_null: n(p.list_null),
    price_list_null_but_net_set: n(p.list_null_net_set),
    price_list_set: n(p.list_set),
  };
  log(`   SkuPrice total                     : ${out.bq4.total}`);
  log(`   price_list NULL                    : ${out.bq4.price_list_null}`);
  log(`   price_list NULL tapi price_net ada : ${out.bq4.price_list_null_but_net_set}   ← baris bermasalah`);
  log(`   price_list terisi                  : ${out.bq4.price_list_set}`);

  if (out.bq4.price_list_null === 0) {
    out.bq4.verdict = "AMAN — NOT NULL bisa dipasang tanpa backfill sama sekali.";
  } else {
    out.bq4.verdict =
      `${out.bq4.price_list_null} baris akan melanggar NOT NULL. Owner melarang mengarang ` +
      `price_list dari price_net, jadi pilihannya: (a) price_list dibiarkan nullable di DB ` +
      `dan kewajiban ditegakkan di form saja; (b) baris lama diisi tangan lebih dulu. ` +
      `JANGAN backfill otomatis.`;
  }
  log(`   VONIS: ${out.bq4.verdict}`);

  // ── 4. B-Q2 WorkPrice.code ───────────────────────────────────────────────
  log("\n4. B-Q2 — WorkPrice.code");
  const [w] = await q(`
    SELECT COUNT(*)::bigint AS total,
           COUNT(DISTINCT code)::bigint AS distinct_code,
           COUNT(*) FILTER (WHERE code IS NULL OR btrim(code) = '')::bigint AS empty_code
    FROM "master_data"."WorkPrice"`);
  out.bq2 = { total: n(w.total), distinct_code: n(w.distinct_code), empty_code: n(w.empty_code) };
  log(`   WorkPrice total: ${out.bq2.total}, code unik: ${out.bq2.distinct_code}, code kosong: ${out.bq2.empty_code}`);
  log(`   → generator harus menghindari ${out.bq2.distinct_code} kode yang sudah dipakai.`);

  // ── 5. B-Q3 kebersihan identitas Excel ───────────────────────────────────
  log("\n5. B-Q3 — slug duplikat (yang akan ditolak import sebagai duplikat)");
  out.bq3 = {};
  for (const [label, sql] of [
    ["Sku (per brand)", `SELECT COUNT(*)::bigint AS c FROM (SELECT brand_id, slug FROM "master_data"."Sku" WHERE deleted_at IS NULL GROUP BY 1,2 HAVING COUNT(*)>1) x`],
    ["Brand", `SELECT COUNT(*)::bigint AS c FROM (SELECT slug FROM "master_data"."Brand" GROUP BY 1 HAVING COUNT(*)>1) x`],
    ["Party", `SELECT COUNT(*)::bigint AS c FROM (SELECT slug FROM "master_data"."Party" GROUP BY 1 HAVING COUNT(*)>1) x`],
  ]) {
    const [r] = await q(sql);
    out.bq3[label] = n(r.c);
    log(`   ${label.padEnd(18)} grup slug duplikat: ${out.bq3[label]}`);
  }

  // Bukti slugifikasi tidak konsisten: slug yang kehilangan huruf beraksen.
  const [s] = await q(`
    SELECT COUNT(*)::bigint AS c FROM "master_data"."Party"
    WHERE name ~ '[^\\x00-\\x7F]' AND slug ~ '--|^-|-$'`);
  out.slug_diacritic_damage = n(s.c);
  log(`   Party bernama non-ASCII dengan slug cacat: ${out.slug_diacritic_damage}`);
  log(`   → bukti langsung 6 implementasi slugify yang tidak sama (Fase 0.b).`);

  // ── 6. Ringkasan ─────────────────────────────────────────────────────────
  log("\n" + "═".repeat(72));
  log("VONIS UNTUK RENCANA EKSEKUSI");
  log("═".repeat(72));
  log(`  Fase 1.1 verifikasi drift    : ${out.workprice_drift_closed ? "LEWAT — tidak ada pekerjaan" : "GAGAL — masih ada drift"}`);
  log(`  Fase 1.2 audit trail         : ${out.rows.MasterDataAudit === 0 ? "GAP TERKONFIRMASI (0 baris)" : `${out.rows.MasterDataAudit} baris — ada penulis`}`);
  log(`  Fase 1.4 backfill B-Q4       : ${out.bq4.price_list_null === 0 ? "TIDAK PERLU" : `${out.bq4.price_list_null} baris terdampak — butuh keputusan`}`);
  log(`  Backup sebelum migrasi       : ${out.rows_total > 0 ? "WAJIB — tabel berisi data" : "opsional — schema masih kosong"}`);
  if (out.rows_total > 0) {
    log("\n  pg_dump -n master_data -Fc studioflow > backups/masterdata_pre_bq4_$(date +%Y%m%d).dump");
  }

  if (JSON_MODE) console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error("\n❌ Gagal:", e.message);
    console.error("\nKalau ini connection refused: `docker compose up -d db` dulu.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
