import { PrismaClient, Prisma } from "@/generated/prisma"; // Refreshed for Dynamic UI Engine
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = `${process.env.DATABASE_URL}`;
const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");

const pool = new Pool({
  connectionString,
  ssl: !isLocal ? { rejectUnauthorized: false } : undefined,
  // Connection pool limits to prevent exhaustion
  max: 20, // Maximum connections in pool
  min: 2, // Minimum connections to maintain
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Timeout after 5s if cannot connect
});

// Handle pool errors to prevent memory leaks
pool.on("error", (err) => {
  console.error("Unexpected pool error:", err);
  process.exit(-1);
});

// PrismaPg ships its own pg types, so this cast avoids duplicate-type incompatibility.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = (() => {
  if (process.env.NODE_ENV !== "production") {
    // If the existing global client is missing new models or critical fields, force a new one
    const p = globalForPrisma.prisma as any;
    const isStale = p && (
      !("temporaryAttachment" in p) || 
      (p.project && !p.project.fields?.project_code)
    );

    if (isStale) {
      console.log("[DB_REFRESH] Forcing fresh PrismaClient due to schema changes...");
      globalForPrisma.prisma = new PrismaClient({ adapter });
    }
  }
  return globalForPrisma.prisma ?? new PrismaClient({ adapter });
})();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Preflight check to ensure the database schema is aligned with the required extensions.
 * Blocks execution if critical tables or columns are missing.
 * Skip in development unless SKIP_DB_PREFLIGHT=false.
 */
export async function ensureDbSchemaPreflight() {
  const skipPreflight = process.env.NODE_ENV === "development" && process.env.SKIP_DB_PREFLIGHT !== "false";
  
  if (skipPreflight) {
    return;
  }

  try {
    // 1. Check for required extension tables
    const requiredTables = [
      "ProductCatalog",
      "VendorContact",
      "PhysicalSample",
      "ProjectProductRequest",
      "AuditLog",
      "TemporaryAttachment",
      "Project"
    ];

    const tableCheck = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN (${Prisma.join(requiredTables)})
    `;

    const foundTables = tableCheck.map(t => t.table_name);
    const missingTables = requiredTables.filter(t => !foundTables.includes(t));

    if (missingTables.length > 0) {
      throw new Error(`Critical DB tables missing: ${missingTables.join(", ")}. Please run migrations or db push.`);
    }

    // 2. Check for required columns in AuditLog and Project
    const requiredAuditColumns = ["project_id", "phase_id", "reverted_at"];
    const requiredProjectColumns = ["project_code"];

    const columnCheck = await prisma.$queryRaw<{ table_name: string, column_name: string }[]>`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE (table_name = 'AuditLog' AND column_name IN (${Prisma.join(requiredAuditColumns)}))
      OR (table_name = 'Project' AND column_name IN (${Prisma.join(requiredProjectColumns)}))
    `;

    const auditMissing = requiredAuditColumns.filter(col => !columnCheck.some(c => c.table_name === 'AuditLog' && c.column_name === col));
    const projectMissing = requiredProjectColumns.filter(col => !columnCheck.some(c => c.table_name === 'Project' && c.column_name === col));

    if (auditMissing.length > 0 || projectMissing.length > 0) {
      throw new Error(`Critical columns missing. AuditLog: [${auditMissing.join(", ")}], Project: [${projectMissing.join(", ")}]. Please run migrations.`);
    }

  } catch (error) {
    console.error("[DB_PREFLIGHT_FAILURE]:", error);
    throw error;
  }
}

// Force client refresh version: 1.0.7 (Refreshed at 2026-04-29T17:03:00)
