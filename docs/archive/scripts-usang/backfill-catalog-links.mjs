// One-off, idempotent backfill: attach every coded SketchupMaterial/SketchupFFE
// that predates the Catalog-is-the-Product-Schedule change to a matching
// ProjectScheduleEntry (creating one if none exists), carrying over any
// StudioFlow-side edits (brand/type/item_no/qty/unit/color_size/unit_cost/
// notes/location/image_url/catalog_fields) into the entry's snapshot.
//
// Safe to run more than once — items that are already linked are skipped.
//
// Run with:
//   node scripts/backfill-catalog-links.mjs
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

const CODE_PATTERN = /^([A-Za-z][A-Za-z0-9]*)-0*(\d+)$/;
const PLACEHOLDERS = new Set(["", "—", "N/A", "PENDING", "DRAFT", "GENERIC", "CUSTOM", "[RESERVED]", "MANUAL ITEM"]);

function realStr(value) {
  const trimmed = (value ?? "").trim();
  return trimmed && !PLACEHOLDERS.has(trimmed.toUpperCase()) ? trimmed : null;
}

function splitColorSize(value) {
  const normalized = realStr(value);
  if (!normalized) return { color: null, dimensions: null };
  const parts = normalized.split(/\s+\/\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return { color: normalized, dimensions: null };
  return { color: parts[0] || null, dimensions: parts.slice(1).join(" / ") || null };
}

function calculateInitialsType({ catalog_motif, catalog_color, catalog_finishing }) {
  return Array.from(new Set([catalog_motif, catalog_color, catalog_finishing])).filter(Boolean).join(" / ") || null;
}

function buildMaterialSnapshot(mat, category, isComplete) {
  const colorSize = splitColorSize(mat.color_size);
  const color = colorSize.color || (!isComplete ? mat.code : null);
  const finishing = realStr(mat.finish) || realStr(mat.type);
  return {
    snapshot_source_kind: "manual",
    snapshot_source_origin: "sketchup_plugin",
    snapshot_source_external_id: mat.code,
    product_catalog_id: null,
    catalog_type: "material",
    schedule_category: category,
    catalog_sub_category: realStr(mat.type),
    catalog_product_name: realStr(mat.type) || "Manual Item",
    catalog_brand: realStr(mat.brand) || "Custom",
    catalog_initials_type: calculateInitialsType({ catalog_motif: null, catalog_color: color, catalog_finishing: finishing }),
    catalog_price: mat.unit_cost ?? null,
    catalog_notes: mat.notes ?? null,
    catalog_image_url: realStr(mat.image_url),
    catalog_reference_url: null,
    catalog_contact_name: null,
    catalog_contact_phone: null,
    catalog_contact_email: null,
    catalog_has_sample: false,
    specs: {
      catalog_sku: realStr(mat.item_no) || mat.code,
      catalog_motif: null,
      catalog_structured_tags: [],
      catalog_dimensions: colorSize.dimensions || "N/A",
      catalog_dimension_p: null,
      catalog_dimension_l: null,
      catalog_dimension_t: null,
      catalog_dimension_unit: "cm",
      catalog_color: color,
      catalog_finishing: finishing,
      catalog_reference_url: null,
      catalog_metadata: {},
    },
    schedule_code: mat.code,
    snapshot_captured_at: new Date().toISOString(),
  };
}

function buildFFESnapshot(ffe, meta, category, isComplete) {
  const colorSize = splitColorSize(meta.color_size);
  const color = colorSize.color || (!isComplete ? ffe.code : null);
  return {
    snapshot_source_kind: "manual",
    snapshot_source_origin: "sketchup_plugin",
    snapshot_source_external_id: ffe.code,
    product_catalog_id: null,
    catalog_type: "fixture",
    schedule_category: category,
    catalog_sub_category: realStr(meta.type),
    catalog_product_name: realStr(meta.product_name) || realStr(meta.type) || "Manual Item",
    catalog_brand: realStr(meta.brand) || "Custom",
    catalog_initials_type: calculateInitialsType({ catalog_motif: null, catalog_color: color, catalog_finishing: null }),
    catalog_price: meta.unit_cost ?? null,
    catalog_notes: meta.notes ?? null,
    catalog_image_url: realStr(meta.image_url),
    catalog_reference_url: null,
    catalog_contact_name: null,
    catalog_contact_phone: null,
    catalog_contact_email: null,
    catalog_has_sample: false,
    specs: {
      catalog_sku: realStr(meta.item_no) || ffe.code,
      catalog_motif: null,
      catalog_structured_tags: [],
      catalog_dimensions: colorSize.dimensions || "N/A",
      catalog_dimension_p: null,
      catalog_dimension_l: null,
      catalog_dimension_t: null,
      catalog_dimension_unit: "cm",
      catalog_color: color,
      catalog_finishing: null,
      catalog_reference_url: null,
      catalog_metadata: {},
    },
    schedule_code: ffe.code,
    snapshot_captured_at: new Date().toISOString(),
  };
}

async function linkMaterial(mat) {
  const match = CODE_PATTERN.exec(mat.code.trim());
  if (!match) return { skipped: "invalid code" };
  const prefix = match[1].toUpperCase();
  const increment = Number(match[2]);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.projectScheduleEntry.findFirst({
      where: { project_id: mat.projectId, section: "material", schedule_prefix: prefix, schedule_increment: increment },
      include: { options: true },
    });

    if (existing) {
      const claimedBy = await tx.sketchupMaterial.findFirst({ where: { linked_entry_id: existing.id }, select: { id: true } });
      if (claimedBy) return { skipped: `entry ${prefix}-${increment} already linked to another material` };
      await tx.sketchupMaterial.update({ where: { id: mat.id }, data: { linked_entry_id: existing.id } });
      const isComplete = Boolean(realStr(mat.brand) && realStr(mat.type));
      const snapshot = buildMaterialSnapshot(mat, existing.schedule_category, isComplete);
      const option = existing.options.find((o) => o.is_final) ?? existing.options[0];
      if (option) {
        await tx.projectScheduleOption.update({ where: { id: option.id }, data: { data_snapshot: snapshot, status: isComplete ? "APPROVED" : option.status } });
      } else {
        await tx.projectScheduleOption.create({ data: { entry_id: existing.id, option_label: "A", is_final: true, status: isComplete ? "APPROVED" : "DRAFT", data_snapshot: snapshot } });
      }
      await tx.projectScheduleEntry.update({
        where: { id: existing.id },
        data: {
          schedule_qty: mat.qty ?? existing.schedule_qty,
          schedule_unit: realStr(mat.unit) ?? existing.schedule_unit,
          schedule_location: realStr(mat.location_notes) ?? existing.schedule_location,
        },
      });
      return { linked: existing.id, mode: "matched-existing-entry" };
    }

    let prefixDict = await tx.prefixDictionary.findFirst({ where: { prefix, section: "material" } });
    const category = (prefixDict?.schedule_category || prefix).toUpperCase();
    if (!prefixDict) {
      prefixDict = await tx.prefixDictionary.create({ data: { schedule_category: category, prefix, section: "material" } });
    }
    const isComplete = Boolean(realStr(mat.brand) && realStr(mat.type));
    const snapshot = buildMaterialSnapshot(mat, category, isComplete);
    const lastEntry = await tx.projectScheduleEntry.findFirst({
      where: { project_id: mat.projectId, section: "material", schedule_category: category },
      orderBy: { schedule_sort_order: "desc" },
    });
    const entry = await tx.projectScheduleEntry.create({
      data: {
        project_id: mat.projectId, schedule_category: category, section: "material",
        schedule_sort_order: (lastEntry?.schedule_sort_order ?? 0) + 1,
        index_number: increment, schedule_prefix: prefix, schedule_increment: increment,
        prefix_id: prefixDict.id, schedule_qty: mat.qty, schedule_unit: realStr(mat.unit),
        schedule_location: realStr(mat.location_notes),
      },
    });
    await tx.projectScheduleOption.create({ data: { entry_id: entry.id, option_label: "A", is_final: true, status: isComplete ? "APPROVED" : "DRAFT", data_snapshot: snapshot } });
    await tx.sketchupMaterial.update({ where: { id: mat.id }, data: { linked_entry_id: entry.id } });
    return { linked: entry.id, mode: "created-entry" };
  });
}

async function linkFixture(ffe, projectId) {
  const meta = ffe.metadata && typeof ffe.metadata === "object" && !Array.isArray(ffe.metadata) ? ffe.metadata : {};
  if (typeof meta.linked_entry_id === "string") return { skipped: "already linked" };
  const match = CODE_PATTERN.exec(ffe.code.trim());
  if (!match) return { skipped: "invalid code" };
  const prefix = match[1].toUpperCase();
  const increment = Number(match[2]);

  return prisma.$transaction(async (tx) => {
    let entry = await tx.projectScheduleEntry.findFirst({
      where: { project_id: projectId, section: "fixture", schedule_prefix: prefix, schedule_increment: increment },
      include: { options: true },
    });
    const category = entry?.schedule_category || (realStr(meta.category) || prefix).toUpperCase();

    if (!entry) {
      let prefixDict = await tx.prefixDictionary.findFirst({ where: { prefix, section: "fixture" } });
      if (!prefixDict) {
        prefixDict = await tx.prefixDictionary.create({ data: { schedule_category: category, prefix, section: "fixture" } });
      }
      entry = await tx.projectScheduleEntry.create({
        data: {
          project_id: projectId, schedule_category: category, section: "fixture",
          schedule_sort_order: increment, index_number: increment, schedule_prefix: prefix, schedule_increment: increment,
          prefix_id: prefixDict.id, schedule_qty: meta.qty ?? ffe.instance_count,
          schedule_unit: realStr(meta.unit) || "pcs", schedule_location: realStr(meta.location_notes),
        },
        include: { options: true },
      });
    }

    const isComplete = Boolean(realStr(meta.brand) && (realStr(meta.product_name) || realStr(meta.type)));
    const snapshot = buildFFESnapshot(ffe, meta, category, isComplete);
    const option = entry.options.find((o) => o.is_final) ?? entry.options[0];
    if (option) {
      await tx.projectScheduleOption.update({ where: { id: option.id }, data: { data_snapshot: snapshot, status: isComplete ? "APPROVED" : option.status } });
    } else {
      await tx.projectScheduleOption.create({ data: { entry_id: entry.id, option_label: "A", is_final: true, status: isComplete ? "APPROVED" : "DRAFT", data_snapshot: snapshot } });
    }
    await tx.projectScheduleEntry.update({
      where: { id: entry.id },
      data: {
        schedule_qty: meta.qty ?? entry.schedule_qty ?? ffe.instance_count,
        schedule_unit: realStr(meta.unit) ?? entry.schedule_unit ?? "pcs",
        schedule_location: realStr(meta.location_notes) ?? entry.schedule_location,
      },
    });
    const nextMetadata = { ...meta, linked_entry_id: entry.id };
    await tx.sketchupFFE.update({ where: { id: ffe.id }, data: { metadata: nextMetadata } });
    return { linked: entry.id, mode: entry ? "matched-or-created" : "created-entry" };
  });
}

async function main() {
  console.log("Backfilling catalog <-> schedule links...\n");

  const unlinkedMaterials = await prisma.sketchupMaterial.findMany({
    where: { linked_entry_id: null },
    include: { sketchup_project: { select: { project_id: true } } },
  });
  console.log(`Found ${unlinkedMaterials.length} unlinked material(s).`);
  let materialLinked = 0, materialSkipped = 0, materialFailed = 0;
  for (const mat of unlinkedMaterials) {
    const withProject = { ...mat, projectId: mat.sketchup_project.project_id };
    try {
      const result = await linkMaterial(withProject);
      if (result.skipped) { materialSkipped++; console.log(`  SKIP  ${mat.code}: ${result.skipped}`); }
      else { materialLinked++; console.log(`  LINK  ${mat.code} -> entry ${result.linked} (${result.mode})`); }
    } catch (error) {
      materialFailed++;
      console.error(`  FAIL  ${mat.code}:`, error.message || error);
    }
  }

  const allFfes = await prisma.sketchupFFE.findMany({ include: { sketchup_project: { select: { project_id: true } } } });
  const unlinkedFfes = allFfes.filter((f) => {
    const meta = f.metadata && typeof f.metadata === "object" && !Array.isArray(f.metadata) ? f.metadata : {};
    return typeof meta.linked_entry_id !== "string";
  });
  console.log(`\nFound ${unlinkedFfes.length} unlinked fixture(s).`);
  let fixtureLinked = 0, fixtureSkipped = 0, fixtureFailed = 0;
  for (const ffe of unlinkedFfes) {
    try {
      const result = await linkFixture(ffe, ffe.sketchup_project.project_id);
      if (result.skipped) { fixtureSkipped++; console.log(`  SKIP  ${ffe.code}: ${result.skipped}`); }
      else { fixtureLinked++; console.log(`  LINK  ${ffe.code} -> entry ${result.linked} (${result.mode})`); }
    } catch (error) {
      fixtureFailed++;
      console.error(`  FAIL  ${ffe.code}:`, error.message || error);
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Materials: ${materialLinked} linked, ${materialSkipped} skipped, ${materialFailed} failed`);
  console.log(`Fixtures:  ${fixtureLinked} linked, ${fixtureSkipped} skipped, ${fixtureFailed} failed`);
}

main()
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
