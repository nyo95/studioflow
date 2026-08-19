import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma v7 Configuration — Dual-URL Pattern for Supabase + Vercel
 *
 * LOCAL DEV: DATABASE_URL dan DIRECT_URL keduanya mengarah ke Postgres lokal (port 5432).
 *
 * PRODUCTION (Supabase + Vercel):
 *   DATABASE_URL  → "Transaction" Pooler URL (port 6543) — digunakan saat runtime/serverless.
 *                   Format: postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
 *   DIRECT_URL    → Direct connection URL (port 5432) — HANYA digunakan oleh `prisma migrate`.
 *                   Format: postgresql://postgres.[ref]:[pass]@db.[ref].supabase.co:5432/postgres
 *
 * Referensi: https://pris.ly/d/config-datasource
 */

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // When running migrations, Prisma CLI will use DIRECT_URL (port 5432) if defined
    // to bypass the connection pooler. Otherwise fall back to DATABASE_URL.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
  migrations: {
    seed: "node scripts/seed.js",
  },
});
