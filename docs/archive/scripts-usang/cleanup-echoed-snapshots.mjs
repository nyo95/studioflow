// One-off, idempotent cleanup: strip "echoed" placeholder data from existing
// ProjectScheduleOption snapshots. Older sync/write code copied the item code
// into color/SKU and the Type into product_name/finishing so sparse drafts
// would pass validation. That leaked "CT-3" into Color, "PL-1" into the Library
// SKU, and duplicated the Type as a card title. The write path no longer does
// this (buildMaterialSnapshot/buildFFESnapshot), and ScheduleSnapshotSchema now
// exempts sketchup_plugin drafts — so this script fixes the already-stored rows.
//
// What it nulls (only when the value is an echo, never real data):
//   - catalog_product_name  == sub_category (Type echo)  OR == the item code
//   - specs.catalog_finishing == sub_category (Type echo)
//   - specs.catalog_color   == the item code
//   - specs.catalog_sku     == the item code  (sketchup_plugin origin only;
//                             manual items intentionally use the code as SKU)
//
// Safe to run more than once — a cleaned row has nothing left to change.
//
// STRONGLY recommended: back up first  ->  pg_dump "$DATABASE_URL" > backup.sql
// Run with:
//   node scripts/cleanup-echoed-snapshots.mjs
//   node scripts/cleanup-echoed-snapshots.mjs --dry-run
import { PrismaClient } from "../src/generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const DRY_RUN = process.argv.includes("--dry-run");

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Aborting.");
  process.exit(1);
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Normalise a code to PREFIX-NUMBER (uppercase, no leading zeros) so "CT-01",
// "ct-1" and "CT-1" all compare equal.
const CODE_PATTERN = /^([A-Za-z][A-Za-z0-9]*)-0*(\d+)$/;
function normalizeCode(value) {
  const raw = (value ?? "").toString().trim();
  const match = CODE_PATTERN.exec(raw);
  if (match) return `${match[1].toUpperCase()}-${Number(match[2])}`;
  return raw.toUpperCase();
}

function norm(value) {
  return (value ?? "").toString().trim().toUpperCase();
}

async function main() {
  const options = await prisma.projectScheduleOption.findMany({
    select: { id: true, data_snapshot: true },
  });

  let scanned = 0;
  let changed = 0;
  const samples = [];

  for (const option of options) {
    const snap = option.data_snapshot;
    if (!snap || typeof snap !== "object" || Array.isArray(snap)) continue;
    scanned += 1;

    const specs = snap.specs && typeof snap.specs === "object" ? snap.specs : {};
    const code = snap.schedule_code ?? snap.snapshot_source_external_id ?? null;
    const codeKey = code ? normalizeCode(code) : null;
    const subCat = norm(snap.catalog_sub_category);
    const origin = snap.snapshot_source_origin ?? null;

    let dirty = false;
    const nextSnap = { ...snap, specs: { ...specs } };

    // product_name echoes the Type or the code
    const name = snap.catalog_product_name;
    if (name != null && name !== "") {
      const nameNorm = norm(name);
      if ((subCat && nameNorm === subCat) || (codeKey && normalizeCode(name) === codeKey)) {
        nextSnap.catalog_product_name = null;
        dirty = true;
      }
    }

    // finishing echoes the Type
    const finishing = specs.catalog_finishing;
    if (finishing != null && finishing !== "" && subCat && norm(finishing) === subCat) {
      nextSnap.specs.catalog_finishing = null;
      dirty = true;
    }

    // color echoes the code
    const color = specs.catalog_color;
    if (color != null && color !== "" && codeKey && normalizeCode(color) === codeKey) {
      nextSnap.specs.catalog_color = null;
      dirty = true;
    }

    // sku echoes the code — synced items only (manual items keep code as SKU)
    const sku = specs.catalog_sku;
    if (origin === "sketchup_plugin" && sku != null && sku !== "" && codeKey && normalizeCode(sku) === codeKey) {
      nextSnap.specs.catalog_sku = null;
      dirty = true;
    }

    if (!dirty) continue;
    changed += 1;
    if (samples.length < 15) samples.push({ code, id: option.id });

    if (!DRY_RUN) {
      await prisma.projectScheduleOption.update({
        where: { id: option.id },
        data: { data_snapshot: nextSnap },
      });
    }
  }

  console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Scanned ${scanned} option snapshot(s).`);
  console.log(`${DRY_RUN ? "Would clean" : "Cleaned"} ${changed} snapshot(s).`);
  if (samples.length > 0) {
    console.log("Examples:", samples.map((s) => s.code ?? s.id).join(", "));
  }
}

main()
  .catch((error) => {
    console.error("[CLEANUP_ECHOED_SNAPSHOTS_ERROR]", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
