// One-off, idempotent backfill for the "Schedule owns catalog content" redesign.
//
// Before the redesign, catalog content (brand / type / finish / item no /
// colour+size / unit cost / notes / image / reference url / field visibility)
// was written to BOTH the Product Schedule snapshot and the SketchUp staging
// row (SketchupMaterial columns, SketchupFFE.metadata keys). Those staging
// fields are now DORMANT: the app no longer writes them, reads the snapshot
// first, and only falls back to the dormant value when the snapshot has
// nothing for that field.
//
// This script performs that fallback once, permanently: for every linked item
// it copies any dormant value the snapshot is MISSING into the snapshot. After
// it has run, the fallback never fires again for these rows.
//
// SAFETY — this script is additive only:
//   * It never deletes or clears anything.
//   * It never overwrites a value the snapshot already has; a field is only
//     filled when the snapshot side is empty/placeholder.
//   * It leaves the dormant staging columns exactly as they are, so the old
//     values remain available and rollback is "revert the code", nothing more.
//   * Re-running it is a no-op once every gap is filled.
//
// Run a preview first (writes nothing):
//   node scripts/backfill-catalog-snapshots.mjs --dry-run
// Then apply:
//   node scripts/backfill-catalog-snapshots.mjs
// Restrict to one project:
//   node scripts/backfill-catalog-snapshots.mjs --project=<projectId>
import { PrismaClient } from "../src/generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set. Aborting.");
  process.exit(1);
}
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const PROJECT_ARG = args.find((a) => a.startsWith("--project="));
const PROJECT_ID = PROJECT_ARG ? PROJECT_ARG.split("=")[1] : null;

const PLACEHOLDERS = new Set([
  "", "—", "-", "N/A", "PENDING", "DRAFT", "GENERIC", "CUSTOM", "[RESERVED]",
]);

function realStr(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && !PLACEHOLDERS.has(trimmed.toUpperCase()) ? trimmed : null;
}

function splitColorSize(value) {
  const normalized = realStr(value);
  if (!normalized) return { color: null, dimensions: null };
  const parts = normalized.split(/\s+\/\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { color: normalized, dimensions: null };
  return { color: parts[0] || null, dimensions: parts.slice(1).join(" / ") || null };
}

const CATALOG_FIELD_KEYS = new Set([
  "type", "brand", "item_no", "qty", "color", "size", "finish",
  "unit_cost", "location", "url", "notes",
]);

// Legacy stored field lists may use a single "color_size" key.
function normalizeFieldKeys(value) {
  if (!Array.isArray(value)) return null;
  const mapped = [];
  for (const key of value) {
    if (key === "color_size") mapped.push("color", "size");
    else if (typeof key === "string") mapped.push(key);
  }
  const filtered = mapped.filter((k) => CATALOG_FIELD_KEYS.has(k));
  return filtered.length > 0 ? Array.from(new Set(filtered)) : null;
}

/**
 * Fill snapshot gaps from the dormant values. Returns the updated snapshot and
 * the list of field names that were actually filled, or null when there was
 * nothing to do.
 */
function fillSnapshotGaps(snapshot, dormant, entry) {
  if (!snapshot || typeof snapshot !== "object") return null;
  const next = structuredClone(snapshot);
  next.specs = next.specs && typeof next.specs === "object" ? { ...next.specs } : {};
  const filled = [];

  const fillTop = (key, dormantValue) => {
    if (realStr(next[key])) return;
    const value = realStr(dormantValue);
    if (!value) return;
    next[key] = value;
    filled.push(key);
  };
  const fillSpec = (key, dormantValue) => {
    if (realStr(next.specs[key])) return;
    const value = realStr(dormantValue);
    if (!value) return;
    next.specs[key] = value;
    filled.push(`specs.${key}`);
  };

  fillTop("catalog_sub_category", dormant.type);
  fillTop("catalog_product_name", dormant.product_name);
  fillTop("catalog_image_url", dormant.image_url);
  fillTop("catalog_notes", dormant.notes);
  fillTop("catalog_reference_url", dormant.reference_url);
  fillSpec("catalog_sku", dormant.item_no);
  fillSpec("catalog_finishing", dormant.finish);
  fillSpec("catalog_reference_url", dormant.reference_url);

  // catalog_brand defaults to the literal "Custom", which is a placeholder —
  // treat it as empty so a real dormant brand can land.
  if (!realStr(next.catalog_brand) && realStr(dormant.brand)) {
    next.catalog_brand = realStr(dormant.brand);
    filled.push("catalog_brand");
  }

  if (next.catalog_price == null && dormant.unit_cost != null) {
    next.catalog_price = dormant.unit_cost;
    filled.push("catalog_price");
  }

  // Colour and size share one dormant string. Only fill the halves that are
  // empty on the snapshot side. "N/A" is the schema's empty for dimensions.
  const dormantColorSize = splitColorSize(dormant.color_size);
  if (!realStr(next.specs.catalog_color) && dormantColorSize.color) {
    next.specs.catalog_color = dormantColorSize.color;
    filled.push("specs.catalog_color");
  }
  if (!realStr(next.specs.catalog_dimensions) && dormantColorSize.dimensions) {
    next.specs.catalog_dimensions = dormantColorSize.dimensions;
    filled.push("specs.catalog_dimensions");
  }
  if (next.specs.catalog_dimensions == null) next.specs.catalog_dimensions = "N/A";

  // Field visibility lives in the snapshot's metadata bag.
  const metadata = next.specs.catalog_metadata && typeof next.specs.catalog_metadata === "object"
    ? { ...next.specs.catalog_metadata }
    : {};
  if (!Array.isArray(metadata.catalog_fields)) {
    const dormantFields = normalizeFieldKeys(dormant.catalog_fields);
    if (dormantFields) {
      metadata.catalog_fields = dormantFields;
      filled.push("specs.catalog_metadata.catalog_fields");
    }
  }
  next.specs.catalog_metadata = metadata;

  // catalog_initials_type is derived; refresh it if its inputs changed.
  if (filled.some((f) => f === "specs.catalog_color" || f === "specs.catalog_finishing")) {
    next.catalog_initials_type = Array.from(
      new Set([next.specs.catalog_motif, next.specs.catalog_color, next.specs.catalog_finishing])
    ).filter(Boolean).join(" / ") || null;
  }

  // qty / unit / location live on the entry, not the snapshot.
  const entryPatch = {};
  if (entry.schedule_qty == null && dormant.qty != null) entryPatch.schedule_qty = dormant.qty;
  if (!realStr(entry.schedule_unit) && realStr(dormant.unit)) entryPatch.schedule_unit = realStr(dormant.unit);
  if (!realStr(entry.schedule_location) && realStr(dormant.location_notes)) {
    entryPatch.schedule_location = realStr(dormant.location_notes);
  }

  if (filled.length === 0 && Object.keys(entryPatch).length === 0) return null;
  return { snapshot: next, filled, entryPatch };
}

function selectedOption(entry) {
  return entry.options.find((o) => o.is_final) ?? entry.options[entry.active_index] ?? entry.options[0] ?? null;
}

async function run() {
  const projectFilter = PROJECT_ID ? { project_id: PROJECT_ID } : {};

  const materials = await prisma.sketchupMaterial.findMany({
    where: {
      linked_entry_id: { not: null },
      sketchup_project: PROJECT_ID ? { project_id: PROJECT_ID } : undefined,
    },
    include: {
      linked_entry: { include: { options: true } },
    },
  });

  const fixtures = await prisma.sketchupFFE.findMany({
    where: { sketchup_project: PROJECT_ID ? { project_id: PROJECT_ID } : undefined },
  });

  let materialsUpdated = 0;
  let fixturesUpdated = 0;
  let entriesUpdated = 0;
  let skipped = 0;

  for (const mat of materials) {
    const entry = mat.linked_entry;
    if (!entry) { skipped += 1; continue; }
    const option = selectedOption(entry);
    if (!option) { skipped += 1; continue; }

    const result = fillSnapshotGaps(option.data_snapshot, {
      brand: mat.brand,
      type: mat.type,
      product_name: null,
      finish: mat.finish,
      item_no: mat.item_no,
      color_size: mat.color_size,
      unit_cost: mat.unit_cost,
      notes: mat.notes,
      image_url: mat.image_url,
      reference_url: mat.reference_url,
      qty: mat.qty,
      unit: mat.unit,
      location_notes: mat.location_notes,
      catalog_fields: mat.catalog_fields,
    }, entry);

    if (!result) { skipped += 1; continue; }

    console.log(
      `${DRY_RUN ? "[dry-run] " : ""}material ${mat.code} -> entry ${entry.schedule_prefix}-${entry.schedule_increment}: ` +
      `${result.filled.length ? `filled ${result.filled.join(", ")}` : "no snapshot change"}` +
      `${Object.keys(result.entryPatch).length ? `; entry ${Object.keys(result.entryPatch).join(", ")}` : ""}`
    );

    if (!DRY_RUN) {
      if (result.filled.length > 0) {
        await prisma.projectScheduleOption.update({
          where: { id: option.id },
          data: { data_snapshot: result.snapshot },
        });
      }
      if (Object.keys(result.entryPatch).length > 0) {
        await prisma.projectScheduleEntry.update({
          where: { id: entry.id },
          data: result.entryPatch,
        });
        entriesUpdated += 1;
      }
    }
    materialsUpdated += 1;
  }

  for (const ffe of fixtures) {
    const meta = ffe.metadata && typeof ffe.metadata === "object" && !Array.isArray(ffe.metadata)
      ? ffe.metadata
      : {};
    const linkedEntryId = typeof meta.linked_entry_id === "string" ? meta.linked_entry_id : null;
    if (!linkedEntryId) { skipped += 1; continue; }

    const entry = await prisma.projectScheduleEntry.findFirst({
      where: { id: linkedEntryId, ...projectFilter },
      include: { options: true },
    });
    if (!entry) { skipped += 1; continue; }
    const option = selectedOption(entry);
    if (!option) { skipped += 1; continue; }

    const result = fillSnapshotGaps(option.data_snapshot, {
      brand: meta.brand,
      type: meta.type,
      product_name: meta.product_name,
      finish: meta.finish,
      item_no: meta.item_no,
      color_size: meta.color_size,
      unit_cost: typeof meta.unit_cost === "number" ? meta.unit_cost : null,
      notes: meta.notes,
      image_url: meta.image_url,
      reference_url: meta.reference_url,
      qty: typeof meta.qty === "number" ? meta.qty : null,
      unit: meta.unit,
      location_notes: meta.location_notes,
      catalog_fields: meta.catalog_fields,
    }, entry);

    if (!result) { skipped += 1; continue; }

    console.log(
      `${DRY_RUN ? "[dry-run] " : ""}fixture ${ffe.code} -> entry ${entry.schedule_prefix}-${entry.schedule_increment}: ` +
      `${result.filled.length ? `filled ${result.filled.join(", ")}` : "no snapshot change"}` +
      `${Object.keys(result.entryPatch).length ? `; entry ${Object.keys(result.entryPatch).join(", ")}` : ""}`
    );

    if (!DRY_RUN) {
      if (result.filled.length > 0) {
        await prisma.projectScheduleOption.update({
          where: { id: option.id },
          data: { data_snapshot: result.snapshot },
        });
      }
      if (Object.keys(result.entryPatch).length > 0) {
        await prisma.projectScheduleEntry.update({
          where: { id: entry.id },
          data: result.entryPatch,
        });
        entriesUpdated += 1;
      }
    }
    fixturesUpdated += 1;
  }

  console.log("");
  console.log(DRY_RUN ? "── Dry run summary (nothing written) ──" : "── Backfill summary ──");
  console.log(`  materials with gaps filled : ${materialsUpdated}`);
  console.log(`  fixtures with gaps filled  : ${fixturesUpdated}`);
  console.log(`  entry rows touched         : ${entriesUpdated}`);
  console.log(`  already complete / skipped : ${skipped}`);
  console.log("");
  console.log("Dormant staging columns were left untouched.");
  if (DRY_RUN) console.log("Re-run without --dry-run to apply.");
}

run()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
