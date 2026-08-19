// READ-ONLY diagnostic for the SketchUp <-> Product Schedule code bridge.
//
// Writes nothing. Prints the ground truth needed to explain a queue that
// won't drain or renames that keep flip-flopping:
//   * every SketchUp material, the code the MODEL has, and the code its
//     LINKED schedule entry has  -> a mismatch is a live divergence
//   * schedule entries with no material, and materials with no entry
//   * the full merge-action queue, pending and executed
//
// Run:
//   node scripts/diagnose-sketchup-codes.mjs
//   node scripts/diagnose-sketchup-codes.mjs --project=<projectId>
//   node scripts/diagnose-sketchup-codes.mjs --prefix=ACR
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
const projectArg = args.find((a) => a.startsWith("--project="));
const prefixArg = args.find((a) => a.startsWith("--prefix="));
const PROJECT_ID = projectArg ? projectArg.split("=")[1] : null;
const PREFIX = prefixArg ? prefixArg.split("=")[1].toUpperCase() : null;

function norm(code) {
  const t = (code ?? "").trim().toUpperCase();
  const m = /^([A-Z][A-Z0-9]*)-0*(\d+)$/.exec(t);
  return m ? `${m[1]}-${Number(m[2])}` : t;
}

function matchesPrefix(code) {
  if (!PREFIX) return true;
  return norm(code).startsWith(`${PREFIX}-`);
}

async function run() {
  const sketchupProjects = await prisma.sketchupProject.findMany({
    where: PROJECT_ID ? { project_id: PROJECT_ID } : {},
    include: {
      project: { select: { name: true } },
      materials: { include: { linked_entry: true } },
      ffes: true,
      merge_actions: { orderBy: [{ queue_order: "asc" }, { created_at: "asc" }] },
    },
    orderBy: { created_at: "asc" },
  });

  if (sketchupProjects.length === 0) {
    console.log("No SketchUp projects found for that filter.");
    return;
  }

  for (const sp of sketchupProjects) {
    console.log("");
    console.log("=".repeat(78));
    console.log(`PROJECT  ${sp.project?.name ?? "(unknown)"}`);
    console.log(`  studioflow project_id : ${sp.project_id}`);
    console.log(`  sketchup model        : ${sp.sketchup_model_name}`);
    console.log("=".repeat(78));

    const entries = await prisma.projectScheduleEntry.findMany({
      where: { project_id: sp.project_id },
      orderBy: [{ section: "asc" }, { schedule_prefix: "asc" }, { schedule_increment: "asc" }],
    });

    // ── Materials vs their linked entry ────────────────────────────────────
    const materials = sp.materials.filter((m) => matchesPrefix(m.code));
    console.log("");
    console.log(`MATERIALS (${materials.length}${PREFIX ? ` with prefix ${PREFIX}` : ""})`);
    console.log("");
    console.log(
      "  " +
      "MODEL CODE".padEnd(14) +
      "SCHEDULE CODE".padEnd(16) +
      "STATUS".padEnd(14) +
      "RESERVED".padEnd(10) +
      "UUID"
    );
    console.log("  " + "-".repeat(74));

    let divergent = 0;
    let unlinked = 0;
    for (const mat of [...materials].sort((a, b) => norm(a.code).localeCompare(norm(b.code)))) {
      const entry = mat.linked_entry;
      const scheduleCode = entry
        ? `${entry.schedule_prefix}-${entry.schedule_increment}`
        : "(none)";
      let status;
      if (!entry) { status = "UNLINKED"; unlinked += 1; }
      else if (norm(scheduleCode) === norm(mat.code)) status = "ok";
      else { status = ">> DIVERGENT"; divergent += 1; }

      console.log(
        "  " +
        norm(mat.code).padEnd(14) +
        norm(scheduleCode).padEnd(16) +
        status.padEnd(14) +
        String(mat.is_reserved).padEnd(10) +
        mat.uuid.slice(0, 8)
      );
    }
    console.log("");
    console.log(`  divergent: ${divergent}   unlinked: ${unlinked}`);

    // ── Schedule entries with no SketchUp material ─────────────────────────
    const linkedEntryIds = new Set(
      sp.materials.map((m) => m.linked_entry_id).filter(Boolean)
    );
    const orphanEntries = entries.filter(
      (e) => !linkedEntryIds.has(e.id) && matchesPrefix(`${e.schedule_prefix}-${e.schedule_increment}`)
    );
    console.log("");
    console.log(`SCHEDULE ENTRIES WITH NO LINKED MATERIAL (${orphanEntries.length})`);
    if (orphanEntries.length === 0) {
      console.log("  (none)");
    } else {
      for (const e of orphanEntries) {
        console.log(
          `  ${norm(`${e.schedule_prefix}-${e.schedule_increment}`).padEnd(14)}` +
          `section=${String(e.section).padEnd(10)}` +
          `sort=${String(e.schedule_sort_order).padEnd(6)}` +
          `category=${e.schedule_category}`
        );
      }
    }

    // ── Duplicate / invalid increments ─────────────────────────────────────
    const byCode = new Map();
    for (const e of entries) {
      const key = `${e.section}|${norm(`${e.schedule_prefix}-${e.schedule_increment}`)}`;
      byCode.set(key, (byCode.get(key) ?? 0) + 1);
    }
    const dupes = [...byCode.entries()].filter(([, n]) => n > 1);
    const nonPositive = entries.filter((e) => e.schedule_increment <= 0);
    console.log("");
    console.log(`INTEGRITY`);
    console.log(`  duplicate schedule codes      : ${dupes.length}${dupes.length ? " -> " + dupes.map(([k]) => k).join(", ") : ""}`);
    console.log(`  entries with increment <= 0   : ${nonPositive.length}${nonPositive.length ? " (stuck placeholders!)" : ""}`);
    for (const e of nonPositive) {
      console.log(`      id=${e.id} ${e.schedule_prefix}-${e.schedule_increment} category=${e.schedule_category}`);
    }

    // ── Merge queue ────────────────────────────────────────────────────────
    const pending = sp.merge_actions.filter((a) => !a.executed_at && matchesPrefix(a.source_code));
    const executed = sp.merge_actions.filter((a) => a.executed_at && matchesPrefix(a.source_code));
    console.log("");
    console.log(`MERGE QUEUE — PENDING (${pending.length})`);
    if (pending.length === 0) {
      console.log("  (empty)");
    } else {
      for (const a of pending) {
        console.log(
          `  #${String(a.queue_order).padEnd(4)} ${norm(a.source_code).padEnd(12)} -> ${norm(a.target_code).padEnd(12)} created=${a.created_at.toISOString()}`
        );
      }
    }

    const recentExecuted = executed.slice(-15);
    console.log("");
    console.log(`MERGE QUEUE — EXECUTED (${executed.length}, showing last ${recentExecuted.length})`);
    if (recentExecuted.length === 0) {
      console.log("  (none)");
    } else {
      for (const a of recentExecuted) {
        console.log(
          `  #${String(a.queue_order).padEnd(4)} ${norm(a.source_code).padEnd(12)} -> ${norm(a.target_code).padEnd(12)} executed=${a.executed_at.toISOString()}`
        );
      }
    }

    // ── Reading of the situation ───────────────────────────────────────────
    console.log("");
    console.log("READING");
    if (divergent > 0) {
      console.log(`  ${divergent} material(s) sit on a different code than their schedule entry.`);
      console.log("  Each of those will queue a rename on the next push (schedule wins).");
      console.log("  If the SAME pair keeps reappearing after applying, the schedule side");
      console.log("  is being changed back by something else between pushes.");
    } else {
      console.log("  Model and schedule agree on every linked material code.");
      if (pending.length > 0) {
        console.log("  The pending rows below are therefore STALE — they describe renames");
        console.log("  that already happened. They should have been confirmed and closed.");
      }
    }
  }
}

run()
  .catch((error) => {
    console.error("Diagnostic failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
