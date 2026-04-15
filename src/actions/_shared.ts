import { TxClient, SYSTEM_CONFIG_ID } from "@/lib/permissions";
import { throwActionError } from "@/lib/error-types";
import type { Prisma } from "@/generated/prisma";

export async function insertAuditLog(
  tx: TxClient,
  action: string,
  entityType: string,
  entityId: string,
  userId: string,
  details?: object
) {
  let detailsEntry: Prisma.InputJsonValue | undefined = undefined;
  if (details && typeof details === "object" && !Array.isArray(details)) {
    detailsEntry = JSON.parse(JSON.stringify(details)) as Prisma.InputJsonValue;
  }

  await tx.auditLog.create({
    data: {
      action,
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      details: detailsEntry ?? undefined,
    },
  });
}

export function normalizeOptionalString(value?: string | null) {
  return value?.trim() || null;
}

export function normalizeDrawingCode(input: string) {
  const trimmed = input.trim().toUpperCase().replace(/^(ARS|ID)[_\-\s]*/i, "");
  return `ID_${trimmed}`;
}
