/* eslint-disable @typescript-eslint/no-explicit-any */

import { TxClient, SYSTEM_CONFIG_ID } from "@/lib/permissions";

export async function insertAuditLog(
  tx: TxClient,
  action: string,
  entityType: string,
  entityId: string,
  userId: string,
  details?: object
) {
  await tx.auditLog.create({
    data: {
      action,
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      details: details ?? undefined,
    },
  });
}

export async function getActiveRevision(tx: TxClient, phaseId: string) {
  return tx.revision.findFirst({
    where: { phase_id: phaseId, status_enum: "ACTIVE" },
    include: { activities: true },
    orderBy: [{ major: "desc" }, { minor: "desc" }],
  });
}

export function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export async function upsertClientByName(
  tx: TxClient,
  clientName?: string,
  defaults?: { address?: string | null }
) {
  const normalizedName = normalizeOptionalString(clientName);

  if (!normalizedName) {
    return null;
  }

  const normalizedAddress = normalizeOptionalString(defaults?.address ?? undefined);
  const existingClient = await tx.client.findFirst({
    where: {
      name: {
        equals: normalizedName,
        mode: "insensitive",
      },
    },
  });

  if (existingClient) {
    if (!existingClient.address && normalizedAddress) {
      return tx.client.update({
        where: { id: existingClient.id },
        data: { address: normalizedAddress },
      });
    }

    return existingClient;
  }

  return tx.client.create({
    data: {
      name: normalizedName,
      address: normalizedAddress,
    },
  });
}

export async function getSystemConfigTx(tx: TxClient) {
  const rows = await tx.$queryRaw<Array<{ id: string; is_auto_naming_enabled: boolean }>>`
    SELECT "id", "is_auto_naming_enabled"
    FROM "SystemConfig"
    WHERE "id" = ${SYSTEM_CONFIG_ID}
    LIMIT 1
  `;

  if (Array.isArray(rows) && rows[0]) {
    return rows[0];
  }

  await tx.$executeRaw`
    INSERT INTO "SystemConfig" ("id", "is_auto_naming_enabled")
    VALUES (${SYSTEM_CONFIG_ID}, true)
    ON CONFLICT ("id") DO NOTHING
  `;

  return { id: SYSTEM_CONFIG_ID, is_auto_naming_enabled: true };
}

export function normalizeDrawingCode(input: string) {
  const trimmed = input
    .trim()
    .toUpperCase()
    .replace(/^ARS[_\-\s]*/i, "")
    .replace(/^ID[_\-\s]*/i, "");

  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("INVALID_INPUT");
  }

  return `ID_${trimmed}`;
}

export async function findActiveRevisionByPhaseId(tx: TxClient, phaseId: string) {
  return tx.revision.findFirst({
    where: { phase_id: phaseId, status_enum: "ACTIVE" },
    include: { activities: true },
    orderBy: [{ major: "desc" }, { minor: "desc" }],
  });
}
