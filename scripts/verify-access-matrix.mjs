#!/usr/bin/env node
/**
 * ACCESS MATRIX VERIFIER
 *
 *   node scripts/verify-access-matrix.mjs
 *
 * Run this after ANY edit to:
 *   - prisma/schema.prisma        (enum Role)
 *   - src/core/rbac/matrix.ts     (ROLE_PERMISSIONS)
 *   - src/core/rbac/app-access.ts (APP_ACCESS, LANDING_ROUTE)
 *   - src/auth.config.ts          (authorized callback)
 *
 * WHY A PLAIN SCRIPT AND NOT A TEST
 * ---------------------------------
 * This repo has no test runner installed (no vitest, no jest — checked in
 * package.json). Adding one just for this would be a bigger change than the
 * feature. This script therefore has ZERO dependencies: it parses the source
 * files as text and asserts the invariants. It runs anywhere node runs, needs no
 * database, and cannot touch data.
 *
 * WHAT IT ASSERTS
 * ---------------
 *  1. Every Role in schema.prisma appears in ROLE_PERMISSIONS.
 *  2. Every Role in schema.prisma appears in APP_ACCESS and LANDING_ROUTE.
 *  3. Every role's LANDING_ROUTE is inside its own APP_ACCESS  <- prevents the
 *     redirect loop that would lock a user out of the app entirely.
 *  4. DIC and DRIC hold no MASTERDATA_* and no BQ_* permission  <- designers are
 *     viewers; price must never reach them.
 *  5. ESTIMATOR holds no PROJECT_*, PHASE_* or LIBRARY_* permission.
 *  6. Only ADMIN/DEVELOPER can enter more than one app surface, except STAFF
 *     while LEGACY_LIBRARY_ACCESS_FOR_STAFF is true.
 *  7. Every PERMISSION referenced in matrix.ts exists in constants.ts.
 *
 * Exit code 0 = all invariants hold. 1 = at least one violated.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

const failures = [];
const notes = [];
const fail = (msg) => failures.push(msg);

// ---------------------------------------------------------------------------
// Parse sources
// ---------------------------------------------------------------------------

const schema = read("prisma/schema.prisma");
const constantsSrc = read("src/core/rbac/constants.ts");
const matrixSrc = read("src/core/rbac/matrix.ts");
const accessSrc = read("src/core/rbac/app-access.ts");

/** Roles declared in the Prisma enum. */
function parseRoles() {
  const block = schema.match(/enum Role \{([\s\S]*?)\n\}/);
  if (!block) throw new Error("enum Role not found in prisma/schema.prisma");
  return block[1]
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter((l) => /^[A-Z_]+$/.test(l));
}

/** Permission names declared in constants.ts. */
function parsePermissions() {
  const block = constantsSrc.match(/export enum PERMISSION \{([\s\S]*?)\n\}/);
  if (!block) throw new Error("export enum PERMISSION not found");
  return [...block[1].matchAll(/^\s*([A-Z_]+)\s*=/gm)].map((m) => m[1]);
}

/**
 * ROLE_PERMISSIONS as { ROLE: [PERMISSION, ...] }.
 * ADMIN/OWNER use `Object.values(PERMISSION)`, represented here as "*".
 */
function parseRolePermissions(roles) {
  const block = matrixSrc.match(
    /ROLE_PERMISSIONS: Record<Role, PERMISSION\[\]> = \{([\s\S]*)\n\};/
  );
  if (!block) throw new Error("ROLE_PERMISSIONS not found in matrix.ts");
  const body = block[1];
  const out = {};

  for (const role of roles) {
    // Match "ROLE:" up to the next top-level role key or end of block.
    const re = new RegExp(
      `\\b${role}\\s*:\\s*([\\s\\S]*?)(?=\\n\\s{2}(?:${roles.join("|")})\\s*:|$)`
    );
    const m = body.match(re);
    if (!m) continue;
    const chunk = m[1];
    if (/Object\.values\(PERMISSION\)/.test(chunk)) {
      out[role] = "*";
    } else {
      out[role] = [...chunk.matchAll(/PERMISSION\.([A-Z_]+)/g)].map((x) => x[1]);
    }
  }
  return out;
}

/** APP_ACCESS as { ROLE: [appId, ...] }. */
function parseAppAccess(roles) {
  const block = accessSrc.match(
    /APP_ACCESS: Record<Role, readonly AppId\[\]> = \{([\s\S]*?)\n\};/
  );
  if (!block) throw new Error("APP_ACCESS not found in app-access.ts");
  const out = {};
  for (const role of roles) {
    const m = block[1].match(new RegExp(`\\b${role}\\s*:\\s*\\[([^\\]]*)\\]`));
    if (!m) continue;
    out[role] = [...m[1].matchAll(/APP\.([A-Z_]+)/g)].map((x) =>
      x[1].toLowerCase()
    );
  }
  return out;
}

/** LANDING_ROUTE as { ROLE: "/path" }. */
function parseLandingRoutes(roles) {
  const block = accessSrc.match(
    /LANDING_ROUTE: Record<Role, string> = \{([\s\S]*?)\n\};/
  );
  if (!block) throw new Error("LANDING_ROUTE not found in app-access.ts");
  const out = {};
  for (const role of roles) {
    const m = block[1].match(new RegExp(`\\b${role}\\s*:\\s*"([^"]+)"`));
    if (m) out[role] = m[1];
  }
  return out;
}

/** Mirror of resolveAppForPath() in app-access.ts. */
function resolveAppForPath(pathname) {
  if (pathname === "/masterdata" || pathname.startsWith("/masterdata/"))
    return "masterdata";
  if (pathname === "/bq" || pathname.startsWith("/bq/")) return "bq";
  return "studioflow";
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const roles = parseRoles();
const permissions = parsePermissions();
const rolePermissions = parseRolePermissions(roles);
const appAccess = parseAppAccess(roles);
const landingRoutes = parseLandingRoutes(roles);
const legacyStaffAccess = /LEGACY_LIBRARY_ACCESS_FOR_STAFF = true/.test(accessSrc);

notes.push(`Roles found: ${roles.join(", ")}`);
notes.push(`Permissions found: ${permissions.length}`);
notes.push(`LEGACY_LIBRARY_ACCESS_FOR_STAFF: ${legacyStaffAccess}`);

const permsFor = (role) =>
  rolePermissions[role] === "*" ? permissions : rolePermissions[role] ?? [];

// 1 + 2: total coverage.
for (const role of roles) {
  if (!(role in rolePermissions))
    fail(`[1] Role ${role} missing from ROLE_PERMISSIONS (matrix.ts)`);
  if (!(role in appAccess))
    fail(`[2] Role ${role} missing from APP_ACCESS (app-access.ts)`);
  if (!(role in landingRoutes))
    fail(`[2] Role ${role} missing from LANDING_ROUTE (app-access.ts)`);
}

// 3: no redirect loop.
for (const role of roles) {
  const landing = landingRoutes[role];
  const apps = appAccess[role];
  if (!landing || !apps) continue;
  const app = resolveAppForPath(landing);
  if (!apps.includes(app)) {
    fail(
      `[3] REDIRECT LOOP: ${role} lands on "${landing}" (app "${app}") but APP_ACCESS is [${apps.join(", ")}]`
    );
  }
}

// 4: designers see no master data and no BQ.
for (const role of ["DIC", "DRIC"]) {
  if (!roles.includes(role)) continue;
  for (const p of permsFor(role)) {
    if (p.startsWith("MASTERDATA_") || p.startsWith("BQ_")) {
      fail(`[4] ${role} must not hold ${p} — designers are library viewers only`);
    }
  }
  if ((appAccess[role] ?? []).some((a) => a !== "studioflow")) {
    fail(`[4] ${role} must only access studioflow, got [${appAccess[role].join(", ")}]`);
  }
}

// 5: estimator has no StudioFlow authority.
if (roles.includes("ESTIMATOR")) {
  for (const p of permsFor("ESTIMATOR")) {
    if (/^(PROJECT_|PHASE_|LIBRARY_|PLUGIN_|SYSTEM_)/.test(p)) {
      fail(`[5] ESTIMATOR must not hold ${p} — no StudioFlow authority`);
    }
  }
  const apps = appAccess.ESTIMATOR ?? [];
  if (apps.length !== 1 || apps[0] !== "bq") {
    fail(`[5] ESTIMATOR must access bq only, got [${apps.join(", ")}]`);
  }
}

// 6: multi-app access is restricted.
for (const role of roles) {
  const apps = appAccess[role] ?? [];
  if (apps.length <= 1) continue;
  const isAdminLevel = role === "ADMIN" || role === "DEVELOPER";
  // STAFF's allowed set, and nothing wider:
  //   masterdata  - its home.
  //   studioflow  - the documented transition (LEGACY_LIBRARY_ACCESS_FOR_STAFF).
  //   bq          - added 2026-08-19. bq.BqMaterialProfile (conversion, waste,
  //                 minimum order, rounding) lives in BQ but is maintained by
  //                 whoever maintains materials - PRD_Fixture_Breakdown.md
  //                 5.1's "Admin Bahan". Rule 8 below is what keeps that door
  //                 from becoming project authority.
  const staffAllowed = new Set(
    legacyStaffAccess ? ["masterdata", "studioflow", "bq"] : ["masterdata", "bq"]
  );
  const isStaffTransition =
    role === "STAFF" && apps.every((a) => staffAllowed.has(a));
  if (!isAdminLevel && !isStaffTransition) {
    fail(
      `[6] ${role} has multi-app access [${apps.join(", ")}] but is neither admin-level nor the documented STAFF transition`
    );
  }
}
if (!legacyStaffAccess && (appAccess.STAFF ?? []).includes("studioflow")) {
  fail(
    "[6] LEGACY_LIBRARY_ACCESS_FOR_STAFF is false but STAFF still lists studioflow in APP_ACCESS"
  );
}

// 8: STAFF's BQ access is settings-only.
//
// Added 2026-08-19 together with the /bq door in rule 6. Granting STAFF an app
// surface is the kind of change that looks small and grows quietly: the next
// person to add a BQ permission to STAFF would face no objection from any
// check, and PRD_Fixture_Breakdown.md 5.1 ("Admin Bahan ... tidak bisa ubah
// isi project") would be violated by a one-line diff. This is that objection.
if (roles.includes("STAFF") && (appAccess.STAFF ?? []).includes("bq")) {
  const allowedBqForStaff = new Set(["BQ_ACCESS", "BQ_SETTINGS_MANAGE"]);
  for (const p of permsFor("STAFF")) {
    if (p.startsWith("BQ_") && !allowedBqForStaff.has(p)) {
      fail(
        `[8] STAFF must not hold ${p} - STAFF's BQ access is the material-admin settings surface only, not project authority (PRD 5.1)`
      );
    }
  }
}

// 7: no phantom permissions.
for (const role of roles) {
  if (rolePermissions[role] === "*") continue;
  for (const p of rolePermissions[role] ?? []) {
    if (!permissions.includes(p)) {
      fail(`[7] ${role} references PERMISSION.${p}, which is not in constants.ts`);
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log("\nACCESS MATRIX VERIFICATION\n" + "=".repeat(60));
for (const n of notes) console.log("  " + n);

console.log("\nEffective matrix:");
console.log(
  "  " +
    "ROLE".padEnd(11) +
    "APPS".padEnd(34) +
    "LANDING".padEnd(14) +
    "PERMS"
);
for (const role of roles) {
  const apps = (appAccess[role] ?? []).join(",") || "-";
  const count = rolePermissions[role] === "*" ? `ALL (${permissions.length})` : String((rolePermissions[role] ?? []).length);
  console.log(
    "  " +
      role.padEnd(11) +
      apps.padEnd(34) +
      (landingRoutes[role] ?? "-").padEnd(14) +
      count
  );
}

if (failures.length === 0) {
  console.log("\n✓ All invariants hold.\n");
  process.exit(0);
}

console.log(`\n✗ ${failures.length} violation(s):\n`);
for (const f of failures) console.log("  - " + f);
console.log("");
process.exit(1);
