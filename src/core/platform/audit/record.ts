import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma";
import { Prisma as PrismaNamespace } from "@/generated/prisma";
import { getAuditLogSchemaCapabilities, hasFinalAuditPayloadColumns } from "./compat";

export type AuditDomain = "STUDIOFLOW" | "MASTER_DATA" | "BQ";
export type AuditJsonObject = Record<string, unknown>;

export interface RecordAuditArgs {
  domain: AuditDomain;
  entityType: string;
  entityId: string;
  action: string;
  userId?: string | null;
  projectId?: string | null;
  phaseId?: string | null;
  actorId?: string | null;
  actorName?: string | null;
  before?: AuditJsonObject | null;
  after?: AuditJsonObject | null;
  metadata?: AuditJsonObject | null;
}

type AuditLogWriter = {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
  };
  $queryRaw: <T = unknown>(
    query: TemplateStringsArray | PrismaNamespace.Sql,
    ...values: unknown[]
  ) => PromiseLike<T>;
  $executeRaw: (query: TemplateStringsArray | PrismaNamespace.Sql, ...values: unknown[]) => Promise<unknown>;
};

function sanitize(
  value: AuditJsonObject | null | undefined
): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  if (Object.keys(value).length === 0) return undefined;
  const clean = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  return clean;
}

function toRecord(value: Prisma.JsonValue | null): AuditJsonObject {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AuditJsonObject)
    : {};
}

export function buildAuditDetails(source: {
  before_json?: Prisma.JsonValue | null;
  after_json?: Prisma.JsonValue | null;
  metadata_json?: Prisma.JsonValue | null;
  details?: Prisma.JsonValue | null;
}): AuditJsonObject {
  const details = {
    ...toRecord(source.metadata_json ?? source.details ?? null),
  };
  const before = toRecord(source.before_json ?? null);
  const after = toRecord(source.after_json ?? null);
  if (Object.keys(before).length > 0) {
    details.before = before;
  }
  if (Object.keys(after).length > 0) {
    details.after = after;
  }
  return details;
}

export async function recordAudit(
  tx: AuditLogWriter,
  args: RecordAuditArgs
): Promise<void> {
  const capabilities = await getAuditLogSchemaCapabilities(tx);

  if (!hasFinalAuditPayloadColumns(capabilities)) {
    const legacyDetails = sanitize({
      ...(args.metadata ?? {}),
      ...(args.before ? { before: args.before } : {}),
      ...(args.after ? { after: args.after } : {}),
    });

    const userId =
      capabilities.hasDomain
        ? args.userId ?? null
        : (args.userId ?? "00000000-0000-4000-8000-000000000001");

    const columns: PrismaNamespace.Sql[] = [
      PrismaNamespace.sql`"id"`,
      PrismaNamespace.sql`"action"`,
      PrismaNamespace.sql`"entity_type"`,
      PrismaNamespace.sql`"entity_id"`,
      PrismaNamespace.sql`"user_id"`,
      PrismaNamespace.sql`"project_id"`,
      PrismaNamespace.sql`"phase_id"`,
      PrismaNamespace.sql`"created_at"`,
      PrismaNamespace.sql`"reverted_at"`,
    ];
    const values: unknown[] = [
      randomUUID(),
      args.action,
      args.entityType,
      args.entityId,
      userId,
      args.projectId ?? null,
      args.phaseId ?? null,
      new Date(),
      null,
    ];

    if (capabilities.hasDomain) {
      columns.push(PrismaNamespace.sql`"domain"`);
      values.push(args.domain);
    }
    if (capabilities.hasActorId) {
      columns.push(PrismaNamespace.sql`"actor_id"`);
      values.push(args.actorId ?? null);
    }
    if (capabilities.hasActorName) {
      columns.push(PrismaNamespace.sql`"actor_name"`);
      values.push(args.actorName ?? null);
    }
    if (capabilities.hasDetails) {
      columns.push(PrismaNamespace.sql`"details"`);
      values.push(legacyDetails ?? null);
    }

    await tx.$executeRaw(
      PrismaNamespace.sql`
        INSERT INTO "studioflow"."AuditLog" (${PrismaNamespace.join(columns, ", ")})
        VALUES (${PrismaNamespace.join(values)})
      `
    );
    return;
  }

  await tx.auditLog.create({
    data: {
      domain: args.domain,
      action: args.action,
      entity_type: args.entityType,
      entity_id: args.entityId,
      user_id: args.userId ?? null,
      project_id: args.projectId ?? null,
      phase_id: args.phaseId ?? null,
      actor_id: args.actorId ?? null,
      actor_name: args.actorName ?? null,
      before_json: sanitize(args.before),
      after_json: sanitize(args.after),
      metadata_json: sanitize(args.metadata),
    },
  });
}
