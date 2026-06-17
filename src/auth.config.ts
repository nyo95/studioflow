import type { NextAuthConfig } from "next-auth";
import { authSecret } from "@/auth.shared";

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
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isDashboardRoute =
        nextUrl.pathname === "/" ||
        nextUrl.pathname.startsWith("/projects") ||
        nextUrl.pathname.startsWith("/settings") ||
        nextUrl.pathname.startsWith("/today") ||
        nextUrl.pathname.startsWith("/library") ||
        nextUrl.pathname.startsWith("/activity") ||
        nextUrl.pathname.startsWith("/extensions");

      if (isDashboardRoute) {
        if (isLoggedIn) return true;
        return false; // Redirect unauthenticated users to login page
      } else if (isLoggedIn && nextUrl.pathname === "/login") {
        return Response.redirect(new URL("/", nextUrl));
      }
      return true;
    },
  },
  providers: [], // Add empty providers array here, this will be filled in auth.ts
} satisfies NextAuthConfig;
