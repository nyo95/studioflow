/**
 * APP ACCESS MATRIX — single source of truth for "which role may enter which
 * app surface, and where does a role land after login".
 *
 * ============================================================================
 * WHY THIS FILE EXISTS
 * ============================================================================
 * StudioFlow is the main app and owns login + identity. Two subapps hang off
 * the same session:
 *
 *   /            StudioFlow  — designers (DIC) and drafters (DRIC)
 *   /masterdata  Master Data — STAFF maintenance + admin-level curation
 *   /bq          BQ          — estimators (ESTIMATOR)
 *
 * Before this file, route protection lived in a hand-maintained string list
 * inside auth.config.ts, and anything NOT in that list fell through to
 * `return true` — i.e. was publicly reachable. Adding /masterdata without
 * centralising this would have shipped an unauthenticated master-data page.
 *
 * ============================================================================
 * EDGE RUNTIME CONSTRAINT — READ BEFORE EDITING
 * ============================================================================
 * This module is imported by src/auth.config.ts, which runs inside the Next.js
 * proxy (src/proxy.ts) on the EDGE runtime. Therefore:
 *
 *   - `Role` is imported as `import type` ONLY. A value import from
 *     "@/generated/prisma" pulls the Prisma client into the edge bundle and
 *     the build fails.
 *   - Do NOT import prisma, bcrypt, node:* modules, or anything from
 *     src/core/platform/ here.
 *   - Keep every export a pure function or a plain constant.
 *
 * ============================================================================
 * HOW TO ADD A ROLE
 * ============================================================================
 * 1. Add it to `enum Role` in prisma/schema.prisma (+ additive migration).
 * 2. Add it to ROLE_PERMISSIONS in ./matrix.ts.
 * 3. Add it to APP_ACCESS and LANDING_ROUTE below.
 * Steps 2 and 3 are enforced by the compiler: both are Record<Role, ...>, so
 * TypeScript will not build until the new role is handled. That is intentional
 * — a role must be explicitly granted or explicitly denied, never defaulted.
 *
 * Run `node scripts/verify-access-matrix.mjs` after any change here.
 */

import type { Role } from "@/generated/prisma";

// ---------------------------------------------------------------------------
// App identifiers
// ---------------------------------------------------------------------------

export const APP = {
  STUDIOFLOW: "studioflow",
  MASTERDATA: "masterdata",
  BQ: "bq",
} as const;

export type AppId = (typeof APP)[keyof typeof APP];

// ---------------------------------------------------------------------------
// Route ownership
// ---------------------------------------------------------------------------

/**
 * Path prefixes owned by each app. Order matters in resolveAppForPath: the
 * MOST SPECIFIC prefix must win, so STUDIOFLOW (which owns "/") is checked
 * last.
 *
 * Note: "/today" and "/library" are carried over from the previous
 * auth.config.ts list. Neither has a route folder under src/app/(dashboard)
 * today. They are kept so this refactor changes no existing behaviour; drop
 * them only in a separate, deliberate commit.
 */
export const APP_ROUTE_PREFIXES: Record<AppId, readonly string[]> = {
  masterdata: ["/masterdata"],
  bq: ["/bq"],
  studioflow: [
    "/projects",
    "/settings",
    "/activity-center",
    "/activity",
    "/extensions",
    "/today",
    "/library",
  ],
};

/**
 * Routes reachable without a session. Everything else requires one.
 * `/login` is handled separately because a logged-in user hitting it must be
 * bounced to their landing route, not merely allowed through.
 */
export const PUBLIC_ROUTE_PREFIXES: readonly string[] = ["/login"];

// ---------------------------------------------------------------------------
// Access matrix
// ---------------------------------------------------------------------------

/**
 * Which app surfaces each role may enter.
 *
 * ADMIN / DEVELOPER -> all three. They land on StudioFlow and get nav links
 *                   out to Master Data and BQ.
 * DIC / DRIC     -> StudioFlow only. They are VIEWERS of library data and may
 *                   request promotion (LIBRARY_VIEW + LIBRARY_REQUEST_MATERIAL
 *                   in matrix.ts); approval is admin-level work. They must
 *                   never reach /masterdata or /bq.
 * STAFF          -> Master Data, plus BQ for the settings surface only (see
 *                   the APP_ACCESS entry). See LEGACY_LIBRARY_ACCESS below for
 *                   why StudioFlow is still listed during the transition.
 * ESTIMATOR      -> BQ only.
 */
export const APP_ACCESS: Record<Role, readonly AppId[]> = {
  ADMIN: [APP.STUDIOFLOW, APP.MASTERDATA, APP.BQ],
  DEVELOPER: [APP.STUDIOFLOW, APP.MASTERDATA, APP.BQ],
  DIC: [APP.STUDIOFLOW],
  DRIC: [APP.STUDIOFLOW],
  // BQ removed 2026-08-19: costing fields moved to Sku (P1). STAFF manages
  // them through /masterdata with MASTERDATA_SKU_MANAGE. No BQ access needed.
  STAFF: [APP.MASTERDATA, APP.STUDIOFLOW],
  ESTIMATOR: [APP.BQ],
};

/**
 * TRANSITION FLAG — remove once /masterdata fully replaces the staff-facing
 * Library surface.
 *
 * STAFF's day-to-day work currently lives at /extensions/library. Removing
 * StudioFlow from STAFF's APP_ACCESS today would lock them out of the Library
 * BEFORE /masterdata can do that job — a functional regression, not a
 * migration.
 *
 * So STAFF keeps StudioFlow access for now. When the Master Data screens cover
 * vendor / offering / SKU / sample management, change STAFF's APP_ACCESS entry
 * to `[APP.MASTERDATA]`, set this to false, and re-run the verify script.
 *
 * This is the ONLY place that decision is encoded. Do not scatter it.
 */
export const LEGACY_LIBRARY_ACCESS_FOR_STAFF = true;

/**
 * Where each role goes after login, and where a role is redirected when it
 * hits an app surface it may not enter.
 *
 * Every landing route MUST be inside that role's APP_ACCESS, otherwise login
 * becomes a redirect loop. verify-access-matrix.mjs asserts exactly this.
 */
export const LANDING_ROUTE: Record<Role, string> = {
  ADMIN: "/",
  DEVELOPER: "/",
  DIC: "/",
  DRIC: "/",
  STAFF: "/masterdata",
  ESTIMATOR: "/bq",
};

/**
 * Fallback role for a session whose `role` claim is missing or unrecognised.
 *
 * SECURITY: this used to be "STAFF", inherited from before STAFF owned master
 * data. A malformed or stale JWT therefore resolved to the role that can write
 * vendors, SKUs and pricing. That is a privilege-escalation path and is why
 * this constant exists.
 *
 * DRIC is the safe floor: it holds no master-data, BQ, pricing or admin
 * authority, and every permission it does hold (PHASE_MUTATE_CONTENT,
 * PHASE_UPLOAD_FILE) is ownership-gated in guards.ts — a stale token that is
 * not the assigned PIC gains nothing at all.
 *
 * Prefer rejecting the session outright where the call site allows it. Use this
 * only where the type demands a concrete Role.
 */
export const LEAST_PRIVILEGE_ROLE: Role = "DRIC";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

function matchesPrefix(pathname: string, prefix: string): boolean {
  // Exact match, or a real path segment boundary. Guards against "/bqx"
  // matching the "/bq" prefix.
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** True when the path needs no session at all. */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTE_PREFIXES.some((p) => matchesPrefix(pathname, p));
}

/**
 * Which app owns this path. Checked most-specific first; "/" and any unknown
 * authenticated path fall through to StudioFlow.
 *
 * Returning STUDIOFLOW rather than null for unknown paths is deliberate:
 * fail-closed. An unrecognised route is treated as a protected StudioFlow
 * route, so a new page added without touching this file is guarded by default
 * instead of being silently public.
 */
export function resolveAppForPath(pathname: string): AppId {
  for (const prefix of APP_ROUTE_PREFIXES.masterdata) {
    if (matchesPrefix(pathname, prefix)) return APP.MASTERDATA;
  }
  for (const prefix of APP_ROUTE_PREFIXES.bq) {
    if (matchesPrefix(pathname, prefix)) return APP.BQ;
  }
  return APP.STUDIOFLOW;
}

/** May this role enter this app surface? */
export function canEnterApp(role: Role, app: AppId): boolean {
  return APP_ACCESS[role]?.includes(app) ?? false;
}

/** May this role enter the app that owns this path? */
export function canEnterPath(role: Role, pathname: string): boolean {
  return canEnterApp(role, resolveAppForPath(pathname));
}

/** Post-login destination, falling back to the least-privileged landing. */
export function landingRouteFor(role: Role | null | undefined): string {
  if (!role) return LANDING_ROUTE[LEAST_PRIVILEGE_ROLE];
  return LANDING_ROUTE[role] ?? LANDING_ROUTE[LEAST_PRIVILEGE_ROLE];
}

/**
 * Subapp links to render for a role. ADMIN/DEVELOPER get both; everyone else
 * gets nothing, so no role ever sees a link it cannot follow.
 */
export function subappLinksFor(role: Role): readonly { href: string; label: string }[] {
  const links: { href: string; label: string }[] = [];
  if (canEnterApp(role, APP.MASTERDATA) && LANDING_ROUTE[role] !== "/masterdata") {
    links.push({ href: "/masterdata", label: "Master Data" });
  }
  if (canEnterApp(role, APP.BQ) && LANDING_ROUTE[role] !== "/bq") {
    links.push({ href: "/bq", label: "BQ" });
  }
  return links;
}
