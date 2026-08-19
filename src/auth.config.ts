import type { NextAuthConfig } from "next-auth";
import type { Role } from "@/generated/prisma";
import { authSecret } from "@/auth.shared";
// EDGE-SAFE import. app-access.ts is deliberately free of Prisma/node deps so
// it can be pulled into the proxy bundle. Do not add heavier imports here.
import {
  canEnterPath,
  isPublicRoute,
  landingRouteFor,
  LEAST_PRIVILEGE_ROLE,
} from "@/core/rbac/app-access";

export const authConfig = {
  secret: authSecret,
  pages: {
    signIn: "/login",
  },
  logger: {
    error(error) {
      const message = error instanceof Error ? error.message : String(error);
      const name = error instanceof Error ? error.name : "";

      if (
        name === "JWTSessionError" ||
        message.includes("no matching decryption secret")
      ) {
        return;
      }

      console.error(error);
    },
  },
  callbacks: {
    /**
     * Route gate, running in the edge proxy (src/proxy.ts).
     *
     * PREVIOUS BEHAVIOUR AND WHY IT CHANGED
     * -------------------------------------
     * This used to test the path against a hand-written list of dashboard
     * prefixes and `return true` for everything else. That final `return true`
     * ran for unauthenticated requests too, so ANY path outside the list was
     * publicly reachable. Adding /masterdata to that design would have shipped
     * an unauthenticated master-data page.
     *
     * It is now fail-closed and role-aware. Route ownership and the role matrix
     * live in one place: src/core/rbac/app-access.ts.
     *
     * Three outcomes:
     *   1. Public route            -> allow.
     *   2. No session              -> deny (next-auth redirects to /login).
     *   3. Session without access  -> redirect to that role's landing route.
     *
     * This is the OUTER gate only. Each subapp layout re-checks server-side
     * (defense in depth) so a proxy misconfiguration cannot expose data.
     */
    authorized({ auth, request: { nextUrl } }) {
      const { pathname } = nextUrl;
      const isLoggedIn = !!auth?.user;
      const role = auth?.user?.role as Role | undefined;

      // 1. Login page: bounce an authenticated user to where they belong.
      //    Previously hardcoded to "/", which would have dumped STAFF and
      //    ESTIMATOR onto a StudioFlow page they have no business seeing.
      if (pathname === "/login") {
        if (isLoggedIn) {
          return Response.redirect(new URL(landingRouteFor(role), nextUrl));
        }
        return true;
      }

      if (isPublicRoute(pathname)) return true;

      // 2. Fail closed. Every non-public path needs a session.
      if (!isLoggedIn) return false;

      // 3. Wrong app for this role -> send them home rather than 403, so a
      //    stale bookmark degrades gracefully instead of dead-ending.
      const effectiveRole = role ?? LEAST_PRIVILEGE_ROLE;
      if (!canEnterPath(effectiveRole, pathname)) {
        const destination = landingRouteFor(effectiveRole);
        // Guard against a redirect loop if the matrix is ever misconfigured.
        // verify-access-matrix.mjs asserts this can't happen, but the proxy
        // must not spin even if someone edits the matrix without running it.
        if (!canEnterPath(effectiveRole, destination)) return false;
        return Response.redirect(new URL(destination, nextUrl));
      }

      return true;
    },
  },
  providers: [], // Add empty providers array here, this will be filled in auth.ts
} satisfies NextAuthConfig;
