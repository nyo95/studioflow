#!/usr/bin/env node
/**
 * BACKFILL PARTY CATEGORIES (Excel Table 1 column K)
 *
 *   node scripts/backfill-party-roles.mjs            # dry-run (default)
 *   node scripts/backfill-party-roles.mjs --apply    # write
 *
 * ============================================================================
 * WHY THIS EXISTS
 * ============================================================================
 * `PartyRole` became writable from the Party form on 2026-08-11. Every Party
 * created before that has NO category at all — and the price pickers only
 * offer parties that have one, so until each is ticked by hand the supplier
 * dropdown is empty.
 *
 * ============================================================================
 * WHAT IT WILL AND WILL NOT GUESS
 * ============================================================================
 * It assigns a category only where the DATA already says what the party is:
 *
 *   already quotes a SkuPrice          -> SUPPLIER    (it sells goods)
 *   already named on a WorkPrice       -> SERVICE_VENDOR
 *   owns at least one Brand            -> MANUFACTURER
 *
 * Everything else is REPORTED, not guessed. A party nobody has bought from and
 * that owns no brand could be anything, and inventing a category for it is how
 * a filter that was supposed to mean something starts meaning nothing — the
 * same reasoning that keeps `Qty` uninterpreted (X12).
 *
 * Additive only: existing roles are never removed, and a party that already
 * has any category is skipped entirely.
 */

import { PrismaClient } from "../src/generated/prisma/index.js";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const APPLY = process.argv.includes("--apply");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const parties = await prisma.party.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      name: true,
      roles: { select: { role: true } },
      _count: {
        select: { supplied_prices: true, work_prices: true, owned_brands: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const skipped = parties.filter((p) => p.roles.length > 0);
  const candidates = parties.filter((p) => p.roles.length === 0);

  const planned = [];
  const unknown = [];

  for (const p of candidates) {
    const roles = [];
    if (p._count.supplied_prices > 0) roles.push("SUPPLIER");
    if (p._count.work_prices > 0) roles.push("SERVICE_VENDOR");
    if (p._count.owned_brands > 0) roles.push("MANUFACTURER");

    if (roles.length === 0) unknown.push(p);
    else planned.push({ party: p, roles });
  }

  console.log("");
  console.log("PARTY CATEGORY BACKFILL");
  console.log("=".repeat(72));
  console.log(`Parties (not deleted)      : ${parties.length}`);
  console.log(`Already categorised, skip  : ${skipped.length}`);
  console.log(`Can be inferred from data  : ${planned.length}`);
  console.log(`Need a human decision      : ${unknown.length}`);
  console.log("");

  if (planned.length > 0) {
    console.log("WILL ASSIGN");
    console.log("-".repeat(72));
    for (const { party, roles } of planned) {
      const why = [
        party._count.supplied_prices > 0 && `${party._count.supplied_prices} price(s) quoted`,
        party._count.work_prices > 0 && `${party._count.work_prices} work rate(s)`,
        party._count.owned_brands > 0 && `${party._count.owned_brands} brand(s) owned`,
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`  ${party.name.padEnd(38)} -> ${roles.join(", ").padEnd(30)} (${why})`);
    }
    console.log("");
  }

  if (unknown.length > 0) {
    console.log("LEFT ALONE — open each on the Suppliers page and tick what it is");
    console.log("-".repeat(72));
    for (const p of unknown) console.log(`  ${p.name}`);
    console.log("");
    console.log("  These are not failures. Nothing in the database says what they");
    console.log("  are, and a guess here would be indistinguishable from a fact.");
    console.log("");
  }

  if (!APPLY) {
    console.log("DRY RUN — nothing written. Re-run with --apply to commit.");
    return;
  }

  if (planned.length === 0) {
    console.log("Nothing to write.");
    return;
  }

  let written = 0;
  for (const { party, roles } of planned) {
    await prisma.partyRole.createMany({
      data: roles.map((role) => ({ party_id: party.id, role })),
      skipDuplicates: true,
    });
    written += roles.length;
  }
  console.log(`APPLIED — ${written} category row(s) written across ${planned.length} parties.`);
  console.log("");
  console.log("Verify: open Master Data -> Pricing -> Add Price and confirm the");
  console.log("supplier picker now lists names.");
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
