import type { Prisma } from "@/generated/prisma";

export type AuditDomain = "STUDIOFLOW" | "MASTER_DATA" | "BQ";

export interface RecordAuditArgs {
  domain: Exclude<AuditDomain, "STUDIOFLOW">;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  actorName?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

type AuditLogWriter = {
  auditLog: {
    create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown>;
  };
};

function sanitize(
  value: Record<string, unknown> | null | undefined
): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  if (Object.keys(value).length === 0) return undefined;
  const clean = JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  return clean;
}

export async function recordAudit(
  tx: AuditLogWriter,
  args: RecordAuditArgs
): Promise<void> {
  const details = sanitize({
    before: args.before ?? undefined,
    after: args.after ?? undefined,
    ...args.metadata,
  });

  await tx.auditLog.create({
    data: {
      domain: args.domain,
      action: args.action,
      entity_type: args.entityType,
      entity_id: args.entityId,
      actor_id: args.actorId ?? null,
      actor_name: args.actorName ?? null,
      details,
    },
  });
}
