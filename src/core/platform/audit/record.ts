import type { Prisma } from "@/generated/prisma";

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
}): AuditJsonObject {
  const details = {
    ...toRecord(source.metadata_json ?? null),
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
