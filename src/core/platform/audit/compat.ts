import { prisma } from "@/core/platform/db";
import { Prisma } from "@/generated/prisma";
import { getDateBounds } from "./query-builder";
import type { AuditFiltersInput, AuditReferenceRecord } from "./types";

type AuditSqlClient = {
  $queryRaw: <T = unknown>(
    query: Prisma.Sql | TemplateStringsArray,
    ...values: unknown[]
  ) => PromiseLike<T>;
};

export type AuditLogSchemaCapabilities = {
  hasDomain: boolean;
  hasActorId: boolean;
  hasActorName: boolean;
  hasDetails: boolean;
  hasBeforeJson: boolean;
  hasAfterJson: boolean;
  hasMetadataJson: boolean;
};

export type AuditCompatLog = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  project_id: string | null;
  phase_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  before_json: Prisma.JsonValue | null;
  after_json: Prisma.JsonValue | null;
  metadata_json: Prisma.JsonValue | null;
  created_at: Date;
  reverted_at: Date | null;
  user: { id: string | null; name: string | null; role: string | null } | null;
  project: { id: string; name: string } | null;
};

type AuditCompatRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  user_id: string | null;
  project_id: string | null;
  phase_id: string | null;
  actor_id: string | null;
  actor_name: string | null;
  before_json: Prisma.JsonValue | null;
  after_json: Prisma.JsonValue | null;
  metadata_json: Prisma.JsonValue | null;
  created_at: Date;
  reverted_at: Date | null;
  user_rel_id: string | null;
  user_rel_name: string | null;
  user_rel_role: string | null;
  project_rel_id: string | null;
  project_rel_name: string | null;
};

type AuditListScope = {
  domain?: "STUDIOFLOW" | "MASTER_DATA" | "BQ";
  entityType?: string;
  entityIds?: string[];
  projectId?: string;
  fallbackEntityIds?: string[];
  limit?: number;
};

let cachedCapabilities: Promise<AuditLogSchemaCapabilities> | null = null;

function runAuditQuery<T>(db: AuditSqlClient, query: Prisma.Sql): Promise<T> {
  return db.$queryRaw(query) as Promise<T>;
}

function mapCompatLog(row: AuditCompatRow): AuditCompatLog {
  return {
    id: row.id,
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    user_id: row.user_id,
    project_id: row.project_id,
    phase_id: row.phase_id,
    actor_id: row.actor_id,
    actor_name: row.actor_name,
    before_json: row.before_json,
    after_json: row.after_json,
    metadata_json: row.metadata_json,
    created_at: row.created_at,
    reverted_at: row.reverted_at,
    user:
      row.user_rel_id || row.user_rel_name || row.user_rel_role
        ? {
            id: row.user_rel_id,
            name: row.user_rel_name,
            role: row.user_rel_role,
          }
        : null,
    project:
      row.project_rel_id && row.project_rel_name
        ? {
            id: row.project_rel_id,
            name: row.project_rel_name,
          }
        : null,
  };
}

function buildAuditWhereSql(
  filters: AuditFiltersInput,
  capabilities: AuditLogSchemaCapabilities,
  scope: AuditListScope = {}
) {
  const { gte, lte } = getDateBounds(filters.dateFrom, filters.dateTo);
  const clauses: Prisma.Sql[] = [
    Prisma.sql`a."created_at" >= ${gte}`,
    Prisma.sql`a."created_at" <= ${lte}`,
  ];

  if (scope.domain) {
    if (capabilities.hasDomain) {
      clauses.push(Prisma.sql`a."domain"::text = ${scope.domain}`);
    } else if (scope.domain !== "STUDIOFLOW") {
      clauses.push(Prisma.sql`1 = 0`);
    }
  }

  if (scope.entityType) {
    clauses.push(Prisma.sql`a."entity_type" = ${scope.entityType}`);
  }

  if (scope.entityIds?.length) {
    clauses.push(Prisma.sql`a."entity_id" IN (${Prisma.join(scope.entityIds)})`);
  }

  if (filters.userIds?.length) {
    clauses.push(
      capabilities.hasActorId
        ? Prisma.sql`(a."user_id" IN (${Prisma.join(filters.userIds)}) OR a."actor_id" IN (${Prisma.join(filters.userIds)}))`
        : Prisma.sql`a."user_id" IN (${Prisma.join(filters.userIds)})`
    );
  }

  if (filters.actions?.length) {
    clauses.push(Prisma.sql`a."action" IN (${Prisma.join(filters.actions)})`);
  }

  if (filters.phaseIds?.length) {
    const phaseClauses = filters.phaseIds.map((phaseId) => {
      const options: Prisma.Sql[] = [
        Prisma.sql`a."phase_id" = ${phaseId}`,
        Prisma.sql`(a."entity_type" = 'PHASE' AND a."entity_id" = ${phaseId})`,
      ];

      if (capabilities.hasMetadataJson) {
        options.splice(1, 0, Prisma.sql`a."metadata_json"->>'phase_id' = ${phaseId}`);
      } else if (capabilities.hasDetails) {
        options.splice(1, 0, Prisma.sql`a."details"->>'phase_id' = ${phaseId}`);
      }

      return Prisma.sql`(${Prisma.join(options, " OR ")})`;
    });

    clauses.push(Prisma.sql`(${Prisma.join(phaseClauses, " OR ")})`);
  }

  if (scope.projectId) {
    const projectScope: Prisma.Sql[] = [Prisma.sql`a."project_id" = ${scope.projectId}`];
    if (scope.fallbackEntityIds?.length) {
      projectScope.push(Prisma.sql`a."entity_id" IN (${Prisma.join(scope.fallbackEntityIds)})`);
    }
    clauses.push(Prisma.sql`(${Prisma.join(projectScope, " OR ")})`);
  }

  return Prisma.sql`WHERE ${Prisma.join(clauses, " AND ")}`;
}

function buildPayloadSelectSql(capabilities: AuditLogSchemaCapabilities) {
  return Prisma.sql`
    ${capabilities.hasActorId ? Prisma.sql`a."actor_id"` : Prisma.sql`NULL::text`} AS "actor_id",
    ${capabilities.hasActorName ? Prisma.sql`a."actor_name"` : Prisma.sql`NULL::text`} AS "actor_name",
    ${capabilities.hasBeforeJson ? Prisma.sql`a."before_json"` : Prisma.sql`NULL::jsonb`} AS "before_json",
    ${capabilities.hasAfterJson ? Prisma.sql`a."after_json"` : Prisma.sql`NULL::jsonb`} AS "after_json",
    ${
      capabilities.hasMetadataJson
        ? Prisma.sql`a."metadata_json"`
        : capabilities.hasDetails
          ? Prisma.sql`a."details"`
          : Prisma.sql`NULL::jsonb`
    } AS "metadata_json"
  `;
}

export async function getAuditLogSchemaCapabilities(
  db: AuditSqlClient = prisma
): Promise<AuditLogSchemaCapabilities> {
  if (db === prisma && cachedCapabilities) {
    return cachedCapabilities;
  }

  const load = runAuditQuery<{ column_name: string }[]>(
    db,
    Prisma.sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'studioflow'
        AND table_name = 'AuditLog'
        AND column_name IN ('domain', 'actor_id', 'actor_name', 'details', 'before_json', 'after_json', 'metadata_json')
    `
  ).then((rows) => {
    const columns = new Set(rows.map((row) => row.column_name));
    return {
      hasDomain: columns.has("domain"),
      hasActorId: columns.has("actor_id"),
      hasActorName: columns.has("actor_name"),
      hasDetails: columns.has("details"),
      hasBeforeJson: columns.has("before_json"),
      hasAfterJson: columns.has("after_json"),
      hasMetadataJson: columns.has("metadata_json"),
    };
  });

  if (db === prisma) {
    cachedCapabilities = load;
  }

  return load;
}

export function hasFinalAuditPayloadColumns(capabilities: AuditLogSchemaCapabilities) {
  return capabilities.hasBeforeJson && capabilities.hasAfterJson && capabilities.hasMetadataJson;
}

export async function findAuditLogsCompat(
  filters: AuditFiltersInput = {},
  scope: AuditListScope = {},
  db: AuditSqlClient = prisma
): Promise<AuditCompatLog[]> {
  const capabilities = await getAuditLogSchemaCapabilities(db);
  const where = buildAuditWhereSql(filters, capabilities, scope);
  const limitSql = typeof scope.limit === "number" ? Prisma.sql`LIMIT ${scope.limit}` : Prisma.empty;

  const rows = await runAuditQuery<AuditCompatRow[]>(db, Prisma.sql`
    SELECT
      a."id",
      a."action",
      a."entity_type",
      a."entity_id",
      a."user_id",
      a."project_id",
      a."phase_id",
      ${buildPayloadSelectSql(capabilities)},
      a."created_at",
      a."reverted_at",
      u."id" AS "user_rel_id",
      u."name" AS "user_rel_name",
      u."role"::text AS "user_rel_role",
      p."id" AS "project_rel_id",
      p."name" AS "project_rel_name"
    FROM "studioflow"."AuditLog" a
    LEFT JOIN "studioflow"."User" u
      ON u."id" = a."user_id"
    LEFT JOIN "studioflow"."Project" p
      ON p."id" = a."project_id"
    ${where}
    ORDER BY a."created_at" DESC
    ${limitSql}
  `);

  return rows.map(mapCompatLog);
}

export async function findAuditReferencesCompat(
  filters: AuditFiltersInput = {},
  scope: AuditListScope = {},
  db: AuditSqlClient = prisma
): Promise<AuditReferenceRecord[]> {
  const capabilities = await getAuditLogSchemaCapabilities(db);
  const where = buildAuditWhereSql(filters, capabilities, scope);

  return runAuditQuery<AuditReferenceRecord[]>(db, Prisma.sql`
    SELECT
      a."user_id",
      ${capabilities.hasActorId ? Prisma.sql`a."actor_id"` : Prisma.sql`NULL::text`} AS "actor_id",
      a."phase_id",
      a."entity_type",
      a."entity_id",
      ${
        capabilities.hasMetadataJson
          ? Prisma.sql`a."metadata_json"`
          : capabilities.hasDetails
            ? Prisma.sql`a."details"`
            : Prisma.sql`NULL::jsonb`
      } AS "metadata_json"
    FROM "studioflow"."AuditLog" a
    ${where}
  `);
}

export async function findAuditLogByIdCompat(
  id: string,
  db: AuditSqlClient = prisma
): Promise<AuditCompatLog | null> {
  const capabilities = await getAuditLogSchemaCapabilities(db);
  const rows = await runAuditQuery<AuditCompatRow[]>(db, Prisma.sql`
    SELECT
      a."id",
      a."action",
      a."entity_type",
      a."entity_id",
      a."user_id",
      a."project_id",
      a."phase_id",
      ${buildPayloadSelectSql(capabilities)},
      a."created_at",
      a."reverted_at",
      u."id" AS "user_rel_id",
      u."name" AS "user_rel_name",
      u."role"::text AS "user_rel_role",
      p."id" AS "project_rel_id",
      p."name" AS "project_rel_name"
    FROM "studioflow"."AuditLog" a
    LEFT JOIN "studioflow"."User" u
      ON u."id" = a."user_id"
    LEFT JOIN "studioflow"."Project" p
      ON p."id" = a."project_id"
    WHERE a."id" = ${id}
    LIMIT 1
  `);

  return rows[0] ? mapCompatLog(rows[0]) : null;
}
