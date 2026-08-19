import { PrismaClient } from "@/generated/prisma";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * DB Client — Driver Adapter Pattern (required by generated client engine type).
 *
 * Connection strategy:
 * - LOCAL DEV:    DATABASE_URL → localhost:5432, Pool max:10 (persistent, normal)
 * - PRODUCTION:   DATABASE_URL → Supabase Pooler port 6543 (PgBouncer)
 *                 Pool max:1 karena Vercel serverless = isolated invocations.
 *                 PgBouncer di sisi Supabase yang handle actual connection pooling.
 *
 * Referensi pool sizing untuk serverless:
 * https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases/supabase
 *
 * Force client refresh version: 2.1.0 (Serverless-safe pool — 2026-06-23)
 */

const connectionString = process.env.DATABASE_URL!;
const isLocal =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1");

const pool = new Pool({
  connectionString,
  ssl: !isLocal ? { rejectUnauthorized: false } : undefined,
  // KRITIS untuk serverless (Vercel):
  // max:1 mencegah connection exhaustion karena setiap function invocation
  // adalah proses terpisah. PgBouncer di Supabase yang handle pooling sesungguhnya.
  // Di dev lokal, pakai max:10 untuk kenyamanan.
  max: process.env.NODE_ENV === "production" ? 1 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", (err) => {
  console.error("[DB_POOL_ERROR]:", err);
});

// PrismaPg ships its own pg types — cast avoids duplicate-type incompatibility.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any);

// Bump this whenever a schema change adds new top-level models, and add the
// new delegate to hasExpectedDelegates below. Without both, a dev-server
// hot-reload can keep serving a cached client from *before* the model
// existed — `prisma.<newModel>` is then `undefined` at runtime (e.g. render
// board actions throwing "Cannot read properties of undefined (reading
// 'findFirst')") even though the generated client and DB migration are fine.
const PRISMA_CLIENT_SIGNATURE = "studioflow-prisma-v3.1.0-checklist-filter-view";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSignature: string | undefined;
};

function createPrismaClient() {
  return new PrismaClient({ adapter });
}

function hasExpectedDelegates(client: PrismaClient) {
  const c = client as PrismaClient & {
    projectMomDocument?: unknown;
    renderBoard?: unknown;
    renderAnnotation?: unknown;
    party?: unknown;
    sku?: unknown;
    skuPrice?: unknown;
    workPrice?: unknown;
    sampleMovement?: unknown;
    checklistFilterView?: unknown;
  };
  // Sentinels MUST all still exist in the current schema. A sentinel that has
  // been dropped makes this return false forever, which silently inverts the
  // guard: the client is rebuilt on every request AND a genuinely stale cached
  // client is never detected as stale. That is exactly what happened on
  // 2026-08-10 — the Master Data v2 rework dropped `company`,
  // `materialCandidate`, `sampleCandidate` and `materialLaborPrice` while they
  // were still listed here, so the dev server kept serving a pre-v2 client and
  // `prisma.party` came back undefined.
  //
  // The sentinels below are all Master Data v2 models, so the next rework that
  // removes one will trip this same comment rather than the same bug.
  return (
    typeof c.projectMomDocument !== "undefined" &&
    typeof c.renderBoard !== "undefined" &&
    typeof c.renderAnnotation !== "undefined" &&
    typeof c.party !== "undefined" &&
    typeof c.sku !== "undefined" &&
    typeof c.skuPrice !== "undefined" &&
    typeof c.workPrice !== "undefined" &&
    typeof c.sampleMovement !== "undefined" &&
    typeof c.checklistFilterView !== "undefined"
  );
}

function getPrismaClient() {
  const cachedClient = globalForPrisma.prisma;
  const cachedSignature = globalForPrisma.prismaSignature;

  if (
    cachedClient &&
    cachedSignature === PRISMA_CLIENT_SIGNATURE &&
    hasExpectedDelegates(cachedClient)
  ) {
    return cachedClient;
  }

  const client = createPrismaClient();

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaSignature = PRISMA_CLIENT_SIGNATURE;
  }

  return client;
}

export const prisma = getPrismaClient();

/**
 * Menutup adapter pool untuk proses berumur pendek seperti CLI/test integrasi.
 * Server aplikasi tidak memanggil ini—pool global harus tetap hidup sepanjang
 * proses Next.js. Prisma v7 dengan driver adapter tidak selalu menutup `pg.Pool`
 * saat `$disconnect()`, sehingga tanpa `pool.end()` Node menunggu idle timeout.
 */
export async function closePrismaConnection() {
  await prisma.$disconnect();
  await pool.end();
}

/**
 * Preflight check to ensure the database schema is aligned with the required extensions.
 * Blocks execution if critical tables or columns are missing.
 * Skip in development unless SKIP_DB_PREFLIGHT=false.
 */
export async function ensureDbSchemaPreflight() {
  const skipPreflight =
    process.env.NODE_ENV === "development" &&
    process.env.SKIP_DB_PREFLIGHT !== "false";

  if (skipPreflight) {
    return;
  }

  try {
    const { Prisma } = await import("@/generated/prisma");

    // This guard runs before any query, so it has to be kept in step with the
    // schema by hand — it is deliberately not generated, because its whole job
    // is to fail loudly when the deployed database and the code disagree.
    //
    // Rewritten 2026-08-10 for Master Data v2. Every table it used to name
    // (Vendor, Material, SampleMovementLog, ServicePrice, MaterialCandidate,
    // SampleCandidate) was dropped by that migration, so in production this
    // would have thrown on the FIRST server action — it runs on every one of
    // them (see lib/action-wrapper.ts). Dev never noticed because
    // SKIP_DB_PREFLIGHT defaults to skipping it there.
    const studioflowTables = [
      "ProjectProductRequest",
      "AuditLog",
      "TemporaryAttachment",
      "Project",
      "ProjectMomDocument",
      "ProjectMomItem",
      "ProjectMomPoint",
      "ProjectMomImage",
      "ChecklistFilterView",
    ];
    const masterDataTables = [
      "Party",
      "PartyContact",
      "PartyLink",
      "Brand",
      "BrandLink",
      "BrandCategory",
      "Category",
      "Sku",
      "SkuPrice",
      "SkuCategory",
      "SkuMedia",
      "WorkPrice",
      "Sample",
      "SampleMovement",
    ];

    const tableCheck = await prisma.$queryRaw<
      { table_schema: string; table_name: string }[]
    >`
      SELECT table_schema, table_name
      FROM information_schema.tables 
      WHERE (
        table_schema = 'studioflow'
        AND table_name IN (${Prisma.join(studioflowTables)})
      )
      OR (
        table_schema = 'master_data'
        AND table_name IN (${Prisma.join(masterDataTables)})
      )
    `;

    const foundTables = new Set(
      tableCheck.map((t) => `${t.table_schema}.${t.table_name}`)
    );
    const missingTables = [
      ...studioflowTables.map((table) => `studioflow.${table}`),
      ...masterDataTables.map((table) => `master_data.${table}`),
    ].filter((table) => !foundTables.has(table));

    if (missingTables.length > 0) {
      throw new Error(
        `Critical DB tables missing: ${missingTables.join(", ")}. Please run migrations or db push.`
      );
    }

    const requiredAuditColumns = ["project_id", "phase_id", "reverted_at"];
    const requiredProjectColumns = ["project_code"];
    const requiredActivityColumns = ["due_at"];
    const requiredProjectChecklistColumns = [
      "parent_id",
      "sort_order",
      "priority",
      "due_at",
      "assigned_to_id",
      "template_id",
      "created_at",
    ];
    // Master Data v2 shapes. `code` is deliberately NOT required on Sku — Q7
    // made it nullable, and a column check cannot express nullability anyway.
    const requiredSkuColumns = [
      "brand_id",
      "code",
      "name",
      "slug",
      "kind",
      "status",
      "spec",
      "base_unit",
    ];
    const requiredSkuPriceColumns = [
      "sku_id",
      // `price_list` dihapus 2026-08-14 — SkuPrice sekarang satu kolom harga.
      "price_net",
      "unit",
      "is_current",
      "valid_from",
    ];
    const requiredSampleColumns = ["sku_id", "rack_number", "box_number", "status"];
    const requiredPartyColumns = ["name", "slug", "legal_name", "type"];
    const requiredBrandColumns = ["name", "slug", "owner_party_id"];
    // `material_price`, `labor_price`, and `total_price` were removed by
    // migration 20260811120000 — WorkPrice now stores a single `price` column.
    const requiredWorkPriceColumns = [
      "code",
      "name",
      "category_id",
      "unit",
      "price",
    ];
    // Added by the v2 rework so a request can name its brand/SKU without
    // joining into master_data (M5). Missing here means the snapshot write
    // path would throw on every receive.
    const requiredProductRequestColumns = [
      "brand_name_snapshot",
      "sku_name_snapshot",
    ];

    // Sample lives in master_data, so this can no longer be a single
    // table_schema = 'studioflow' query.
    const columnCheck = await prisma.$queryRaw<
      { table_schema: string; table_name: string; column_name: string }[]
    >`
      SELECT table_schema, table_name, column_name
      FROM information_schema.columns
      WHERE (
        table_schema = 'studioflow'
        AND (
          (table_name = 'AuditLog' AND column_name IN (${Prisma.join(requiredAuditColumns)}))
          OR (table_name = 'Project' AND column_name IN (${Prisma.join(requiredProjectColumns)}))
          OR (table_name = 'Activity' AND column_name IN (${Prisma.join(requiredActivityColumns)}))
          OR (table_name = 'ProjectChecklist' AND column_name IN (${Prisma.join(requiredProjectChecklistColumns)}))
          OR (table_name = 'ProjectProductRequest' AND column_name IN (${Prisma.join(requiredProductRequestColumns)}))
        )
      )
      OR (
        table_schema = 'master_data'
        AND (
          (table_name = 'Sku' AND column_name IN (${Prisma.join(requiredSkuColumns)}))
          OR (table_name = 'SkuPrice' AND column_name IN (${Prisma.join(requiredSkuPriceColumns)}))
          OR (table_name = 'Sample' AND column_name IN (${Prisma.join(requiredSampleColumns)}))
          OR (table_name = 'Party' AND column_name IN (${Prisma.join(requiredPartyColumns)}))
          OR (table_name = 'Brand' AND column_name IN (${Prisma.join(requiredBrandColumns)}))
          OR (table_name = 'WorkPrice' AND column_name IN (${Prisma.join(requiredWorkPriceColumns)}))
        )
      )
    `;

    const auditMissing = requiredAuditColumns.filter(
      (col) =>
        !columnCheck.some(
          (c) => c.table_name === "AuditLog" && c.column_name === col
        )
    );
    const projectMissing = requiredProjectColumns.filter(
      (col) =>
        !columnCheck.some(
          (c) => c.table_name === "Project" && c.column_name === col
        )
    );
    const activityMissing = requiredActivityColumns.filter(
      (col) =>
        !columnCheck.some(
          (c) => c.table_name === "Activity" && c.column_name === col
        )
    );
    const projectChecklistMissing = requiredProjectChecklistColumns.filter(
      (col) =>
        !columnCheck.some(
          (c) => c.table_name === "ProjectChecklist" && c.column_name === col
        )
    );
    const productRequestMissing = requiredProductRequestColumns.filter(
      (col) =>
        !columnCheck.some(
          (c) =>
            c.table_name === "ProjectProductRequest" && c.column_name === col
        )
    );
    const sampleMissing = requiredSampleColumns.filter(
      (col) =>
        !columnCheck.some(
          (c) => c.table_name === "Sample" && c.column_name === col
        )
    );
    const skuMissing = requiredSkuColumns.filter(
      (col) =>
        !columnCheck.some(
          (c) => c.table_name === "Sku" && c.column_name === col
        )
    );
    const skuPriceMissing = requiredSkuPriceColumns.filter(
      (col) =>
        !columnCheck.some(
          (c) => c.table_name === "SkuPrice" && c.column_name === col
        )
    );
    const partyMissing = requiredPartyColumns.filter(
      (col) =>
        !columnCheck.some(
          (c) => c.table_name === "Party" && c.column_name === col
        )
    );
    const brandMissing = requiredBrandColumns.filter(
      (col) =>
        !columnCheck.some(
          (c) => c.table_name === "Brand" && c.column_name === col
        )
    );
    const workPriceMissing = requiredWorkPriceColumns.filter(
      (col) =>
        !columnCheck.some(
          (c) => c.table_name === "WorkPrice" && c.column_name === col
        )
    );

    if (
      auditMissing.length > 0 ||
      projectMissing.length > 0 ||
      activityMissing.length > 0 ||
      projectChecklistMissing.length > 0 ||
      productRequestMissing.length > 0 ||
      sampleMissing.length > 0 ||
      skuMissing.length > 0 ||
      skuPriceMissing.length > 0 ||
      partyMissing.length > 0 ||
      brandMissing.length > 0 ||
      workPriceMissing.length > 0
    ) {
      throw new Error(
        `Critical columns missing. AuditLog: [${auditMissing.join(", ")}], ` +
          `Project: [${projectMissing.join(", ")}], Activity: ` +
          `[${activityMissing.join(", ")}], ProjectChecklist: ` +
          `[${projectChecklistMissing.join(", ")}], ProjectProductRequest: ` +
          `[${productRequestMissing.join(", ")}], Party: ` +
          `[${partyMissing.join(", ")}], Brand: ` +
          `[${brandMissing.join(", ")}], Sku: ` +
          `[${skuMissing.join(", ")}], SkuPrice: ` +
          `[${skuPriceMissing.join(", ")}], WorkPrice: ` +
          `[${workPriceMissing.join(", ")}], Sample: ` +
          `[${sampleMissing.join(", ")}]. Please run migrations.`
      );
    }

    const roleValues = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enum_value.enumlabel
      FROM pg_type AS enum_type
      JOIN pg_enum AS enum_value ON enum_type.oid = enum_value.enumtypid
      JOIN pg_namespace AS enum_schema ON enum_schema.oid = enum_type.typnamespace
      WHERE enum_schema.nspname = 'studioflow'
        AND enum_type.typname = 'Role'
    `;

    if (!roleValues.some((value) => value.enumlabel === "DEVELOPER")) {
      throw new Error(
        "Critical Role enum value missing: DEVELOPER. Please run migrations."
      );
    }
  } catch (error) {
    console.error("[DB_PREFLIGHT_FAILURE]:", error);
    throw error;
  }
}
