import { auth } from "./auth";

export default auth;

/**
 * EDGE ROUTE GATE. The actual decision lives in
 * src/auth.config.ts -> callbacks.authorized, which reads the role matrix in
 * src/core/rbac/app-access.ts. This file only decides WHICH paths that callback
 * gets to see.
 *
 * WHY "login" IS NO LONGER EXCLUDED
 * ---------------------------------
 * The matcher used to read `(?!api|_next/static|_next/image|favicon.ico|login)`.
 * Excluding `login` meant middleware never ran on /login, which made the
 * `pathname === "/login"` branch in authorized() unreachable dead code — an
 * already-authenticated user opening /login was served the sign-in form again
 * instead of being bounced to their landing route.
 *
 * authorized() handles /login explicitly and returns `true` for anonymous
 * visitors, so including it here does NOT lock anyone out; it only adds the
 * logged-in bounce. `api` stays excluded because /api/auth/* must not be gated
 * by the gate that depends on it.
 *
 * If you add another excluded prefix here, remember that anything excluded is
 * unprotected at the edge — the subapp layouts re-check server-side for exactly
 * that reason (see src/app/masterdata/layout.tsx).
 */
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
