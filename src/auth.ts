import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { Role } from "@/generated/prisma";
import { authConfig } from "./auth.config";
import { authSecret } from "./auth.shared";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: authSecret,
  trustHost: true,
  useSecureCookies: process.env.NODE_ENV === "production",
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      },
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const password = String(credentials?.password ?? "");

        if (!email || !password) {
          console.log("[AUTH_DEBUG]: Email or password missing");
          return null;
        }

        console.log(`[AUTH_DEBUG]: Attempting login for email: ${email}`);

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            password: true,
            role: true,
          },
        });

        if (!user) {
          console.log(`[AUTH_DEBUG]: User not found for email: ${email}`);
          return null;
        }

        console.log(`[AUTH_DEBUG]: User found. Comparing passwords...`);

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
          console.log(`[AUTH_DEBUG]: Password mismatch for user: ${email}`);
          return null;
        }

        console.log(`[AUTH_DEBUG]: Login successful for user: ${email}`);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: Role }).role;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = (token.role as Role | undefined) ?? "STAFF";
      }

      return session;
    },
  },
});
