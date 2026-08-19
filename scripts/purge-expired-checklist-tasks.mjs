#!/usr/bin/env node
/**
 * PURGE — permanently remove expired completed checklist tasks
 *
 *   node scripts/purge-expired-checklist-tasks.mjs            # dry-run (default)
 *   node scripts/purge-expired-checklist-tasks.mjs --apply    # delete eligible rows
 *
 * Suggested VPS crontab (the owner installs this during deployment):
 *   15 2 * * * cd /path/to/studioflow && /usr/bin/node scripts/purge-expired-checklist-tasks.mjs --apply >> /var/log/studioflow-checklist-purge.log 2>&1
 *
 * A completed manual checklist row expires after seven days. Completing its
 * project expires it immediately, even when `checked_at` is newer or null.
 * Template-backed rows are always skipped because the normal delete path also
 * refuses them and a later template sync would recreate them.
 *
 * SAFETY: `parent_id` cascades on delete. Eligible leaf rows are therefore
 * deleted first, one by one. A root is deleted only after the database confirms
 * it has no children left. If even one child is ineligible, template-backed, or
 * otherwise survives, the root stays intact and the subtree is reported as
 * deferred. The delete predicates repeat every eligibility check so a row that
 * changes between planning and apply is not removed from a stale snapshot.
 */

import { PrismaClient } from "../src/generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const RETENTION_DAYS = 7;
const APPLY = process.argv.includes("--apply");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--apply");

if (unknownArgs.length > 0) {
  throw new Error(`Unknown argument(s): ${unknownArgs.join(", ")}. Only --apply is supported.`);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to inspect checklist tasks.");
}

const pool = new pg.Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

function isExpired(row, cutoff, projectCompleted) {
  return (
    row.is_checked === true &&
    (projectCompleted || (row.checked_at !== null && row.checked_at < cutoff))
  );
}

function eligibleWhere(cutoff) {
  return {
    is_checked: true,
    OR: [
      { checked_at: { lt: cutoff } },
      { project: { status_progress: "COMPLETED" } },
    ],
  };
}

function describes(row) {
  const checkedAt = row.checked_at?.toISOString() ?? "no checked_at";
  return `${row.project.name} :: ${row.label} (${row.id}, ${checkedAt})`;
}

async function main() {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const candidates = await prisma.projectChecklist.findMany({
    where: eligibleWhere(cutoff),
    select: {
      id: true,
      label: true,
      project_id: true,
      parent_id: true,
      template_id: true,
      is_checked: true,
      checked_at: true,
      project: { select: { name: true, status_progress: true } },
      children: {
        select: {
          id: true,
          template_id: true,
          is_checked: true,
          checked_at: true,
          _count: { select: { children: true } },
        },
      },
      _count: { select: { children: true } },
    },
    orderBy: [{ project_id: "asc" }, { parent_id: "asc" }, { created_at: "asc" }],
  });

  const skippedTemplates = candidates.filter((row) => row.template_id !== null);
  const manualCandidates = candidates.filter((row) => row.template_id === null);

  const leafChildren = manualCandidates.filter(
    (row) => row.parent_id !== null && row._count.children === 0
  );

  const deletableRoots = manualCandidates.filter((row) => {
    if (row.parent_id !== null) return false;

    const projectCompleted = row.project.status_progress === "COMPLETED";
    return row.children.every(
      (child) =>
        child.template_id === null &&
        child._count.children === 0 &&
        isExpired(child, cutoff, projectCompleted)
    );
  });

  const deletableRootIds = new Set(deletableRoots.map((row) => row.id));
  const deferredSubtrees = manualCandidates.filter(
    (row) => row._count.children > 0 && !deletableRootIds.has(row.id)
  );

  console.log("");
  console.log("EXPIRED CHECKLIST TASK PURGE");
  console.log("=".repeat(72));
  console.log(`Cutoff (UTC)              : ${cutoff.toISOString()}`);
  console.log(`Eligible completed rows   : ${candidates.length}`);
  console.log(`Leaf rows planned         : ${leafChildren.length}`);
  console.log(`Root rows planned         : ${deletableRoots.length}`);
  console.log(`Template rows skipped     : ${skippedTemplates.length}`);
  console.log(`Subtrees deferred         : ${deferredSubtrees.length}`);
  console.log("");

  if (leafChildren.length > 0 || deletableRoots.length > 0) {
    console.log("WILL DELETE (eligible leaves first, then empty roots)");
    console.log("-".repeat(72));
    for (const row of leafChildren) console.log(`  LEAF  ${describes(row)}`);
    for (const row of deletableRoots) console.log(`  ROOT  ${describes(row)}`);
    console.log("");
  }

  if (skippedTemplates.length > 0) {
    console.log("SKIPPED — template-backed rows");
    console.log("-".repeat(72));
    for (const row of skippedTemplates) console.log(`  ${describes(row)}`);
    console.log("");
  }

  if (deferredSubtrees.length > 0) {
    console.log("DEFERRED — at least one child must survive this run");
    console.log("-".repeat(72));
    for (const row of deferredSubtrees) console.log(`  ${describes(row)}`);
    console.log("");
  }

  if (!APPLY) {
    console.log("DRY RUN — nothing deleted. Re-run with --apply to commit.");
    return;
  }

  let deletedLeaves = 0;
  let deletedRoots = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of leafChildren) {
      const result = await tx.projectChecklist.deleteMany({
        where: {
          id: row.id,
          parent_id: { not: null },
          template_id: null,
          children: { none: {} },
          ...eligibleWhere(cutoff),
        },
      });
      deletedLeaves += result.count;
    }

    for (const row of deletableRoots) {
      const result = await tx.projectChecklist.deleteMany({
        where: {
          id: row.id,
          parent_id: null,
          template_id: null,
          children: { none: {} },
          ...eligibleWhere(cutoff),
        },
      });
      deletedRoots += result.count;
    }
  });

  const deleted = deletedLeaves + deletedRoots;
  const changedDuringRun = leafChildren.length + deletableRoots.length - deleted;

  console.log(`APPLIED — ${deleted} checklist row(s) deleted.`);
  console.log(`  leaves deleted          : ${deletedLeaves}`);
  console.log(`  roots deleted           : ${deletedRoots}`);
  console.log(`  template rows skipped   : ${skippedTemplates.length}`);
  console.log(`  subtrees deferred       : ${deferredSubtrees.length}`);
  console.log(`  changed during run      : ${changedDuringRun}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
