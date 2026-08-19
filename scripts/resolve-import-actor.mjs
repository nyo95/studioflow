#!/usr/bin/env node
/**
 * RESOLVE THE IMPORT ACTOR
 *
 *   node scripts/resolve-import-actor.mjs                    # read-only report
 *   node scripts/resolve-import-actor.mjs --fix-name "Berkah" # rename only, opt-in
 *
 * ===========================================================================
 * WHY THIS REPLACED create-import-actor.mjs
 * ===========================================================================
 * The earlier script created a new dedicated "Administrator" account. That was
 * built on a wrong premise. The owner's account, berkah.rad@gmail.com, already
 * exists with role ADMIN — and it is the SAME ROW that scripts/seed.js calls
 * "Admin Rad". There is nothing to create.
 *
 * So this script only READS and reports which user id the importer should use.
 * The single optional write it can perform is a display-name change, and only
 * when explicitly asked.
 *
 * ===========================================================================
 * WHAT IT CHECKS, AND WHY EACH CHECK EXISTS
 * ===========================================================================
 * 1. Does the actor exist, and what is its role?
 *      The importer needs LIBRARY_* and MASTERDATA_* permissions. ADMIN and
 *      OWNER hold everything; STAFF and CURATOR hold enough.
 *      DIC/DRIC/ESTIMATOR do not.
 *
 * 2. Is the actor's password still the seeded "admin123"?
 *      scripts/seed.js upserts this exact email with
 *      `update: { password: hash("admin123") }` — so every run RESETS the
 *      password back to a value committed in this repository. If the check
 *      below says the seeded password still matches, the account is open.
 *
 * 3. Is the actor id a real uuid or the hardcoded seed id?
 *      seed.js pins `id: "00000000-0000-4000-8000-000000000001"`. The owner's
 *      own import rules forbid fabricated UUIDs as actors. This is worth knowing
 *      before hundreds of AuditLog rows point at it — it is cosmetically ugly
 *      but NOT a reason to change the id: rewriting a User primary key would
 *      orphan every existing AuditLog, Project PIC and comment reference. Report
 *      it, do not "fix" it.
 *
 * 4. Which other users could act, and which are seed accounts?
 *
 * ===========================================================================
 * SAFETY
 * ===========================================================================
 * - Read-only by default. The ONLY possible write is --fix-name, which touches
 *   `User.name` on one row and nothing else.
 * - Never resets, prints or changes a password.
 * - Refuses to run against a non-localhost DATABASE_URL.
 */

import bcrypt from "bcryptjs";
import pg from "pg";
import dotenv from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/index.js";

dotenv.config();

const ACTOR_EMAIL = "berkah.rad@gmail.com";
const SEED_ID = "00000000-0000-4000-8000-000000000001";
const SEEDED_PASSWORD = "admin123";
const SEEDED_EMAILS = [
  "berkah.rad@gmail.com",
  "dic.rad@gmail.com",
  "drafter.rad@gmail.com",
  "staff.rad@gmail.com",
];
/** Roles that hold enough permission to run the import. */
const CAPABLE_ROLES = ["ADMIN", "OWNER", "STAFF", "CURATOR"];

const args = process.argv.slice(2);
const fixNameIndex = args.indexOf("--fix-name");
const NEW_NAME = fixNameIndex >= 0 ? args[fixNameIndex + 1] : null;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("✗ DATABASE_URL is not set. Check .env");
  process.exit(1);
}

const isLocal =
  connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

const pool = new pg.Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  console.log("\nRESOLVE IMPORT ACTOR\n" + "=".repeat(64));
  console.log(
    `  database : ${connectionString.replace(/(:\/\/[^:]+:)[^@]*(@)/, "$1***$2")}`
  );

  if (!isLocal) {
    console.error(
      "\n✗ ABORT: DATABASE_URL is not localhost. This script targets the local" +
        "\n  database only.\n"
    );
    process.exit(1);
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, password: true },
    orderBy: { name: "asc" },
  });

  console.log(`\nAll users (${users.length}):`);
  console.log(
    "  " + "ROLE".padEnd(10) + "NAME".padEnd(22) + "EMAIL".padEnd(30) + "FLAGS"
  );
  for (const u of users) {
    const flags = [];
    if (SEEDED_EMAILS.includes(u.email.toLowerCase())) flags.push("seed-managed");
    if (u.id === SEED_ID) flags.push("hardcoded-seed-id");
    if (!CAPABLE_ROLES.includes(u.role)) flags.push("cannot-import");
    console.log(
      "  " +
        u.role.padEnd(10) +
        u.name.padEnd(22) +
        u.email.padEnd(30) +
        flags.join(", ")
    );
  }

  const actor = users.find(
    (u) => u.email.toLowerCase() === ACTOR_EMAIL.toLowerCase()
  );

  console.log("\n" + "-".repeat(64));
  if (!actor) {
    console.error(
      `✗ Actor ${ACTOR_EMAIL} NOT FOUND. Import cannot proceed — pick another` +
        `\n  account from the list above and update ACTOR_EMAIL in this script.\n`
    );
    process.exitCode = 1;
    return;
  }

  console.log("IMPORT ACTOR");
  console.log(`  id    : ${actor.id}`);
  console.log(`  name  : ${actor.name}`);
  console.log(`  email : ${actor.email}`);
  console.log(`  role  : ${actor.role}`);

  const problems = [];

  if (!CAPABLE_ROLES.includes(actor.role)) {
    problems.push(
      `role ${actor.role} lacks the permissions the import needs (need one of ${CAPABLE_ROLES.join("/")})`
    );
  }

  // The important one. bcrypt.compare against the value committed in seed.js.
  const seededPasswordStillWorks = await bcrypt.compare(
    SEEDED_PASSWORD,
    actor.password
  );
  if (seededPasswordStillWorks) {
    problems.push(
      `PASSWORD IS STILL THE SEEDED VALUE committed in scripts/seed.js. ` +
        `This account is ADMIN. Change it before anything else.`
    );
  }

  if (actor.id === SEED_ID) {
    problems.push(
      `id is the hardcoded seed uuid (${SEED_ID}), not a generated one. ` +
        `Report only — do NOT rewrite it, that would orphan every AuditLog, ` +
        `project PIC and comment reference pointing at this user.`
    );
  }

  if (problems.length === 0) {
    console.log("\n✓ Actor is valid and clean. Use the id above for the import.\n");
  } else {
    console.log(`\n⚠ ${problems.length} issue(s):`);
    for (const p of problems) console.log(`  - ${p}`);
    console.log(
      "\n  The actor is still USABLE for the import — these are hygiene" +
        "\n  problems, not blockers. Fix the password one regardless.\n"
    );
  }

  if (NEW_NAME) {
    if (NEW_NAME === actor.name) {
      console.log(`Name is already "${NEW_NAME}" — nothing to do.\n`);
      return;
    }
    const updated = await prisma.user.update({
      where: { id: actor.id },
      data: { name: NEW_NAME },
      select: { name: true },
    });
    console.log(`✓ Renamed "${actor.name}" -> "${updated.name}".`);
    console.log(
      "  Note: AuditLog stores user_id, not the name, so existing audit rows" +
        "\n  will now render the new name too. That is usually what you want.\n"
    );
  }
}

main()
  .catch((err) => {
    console.error("\n✗ Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
