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
  // Sanitize details: Prisma's Json type doesn't like 'undefined' values.
  // Converting to string and back to JSON is a quick way to sanitize it
  // and handle potential circular references if needed, though here we'll just
  // ensure it's a valid record.
  let detailsEntry: Prisma.InputJsonValue | undefined = undefined;

  if (details && typeof details === "object" && !Array.isArray(details)) {
    const rawDetails = details as Record<string, unknown>;
    // Simple sanitization to remove undefined
    const cleanObject = JSON.parse(JSON.stringify(rawDetails));
    detailsEntry = cleanObject as Prisma.InputJsonValue;
  }

  const inferredProjectId =
    typeof (detailsEntry as any)?.project_id === "string" 
      ? (detailsEntry as any).project_id 
      : undefined;
      
  const inferredPhaseId =
    typeof (detailsEntry as any)?.phase_id === "string" 
      ? (detailsEntry as any).phase_id 
      : undefined;

  await tx.auditLog.create({
    data: {
      action,
      entity_type: entityType,
      entity_id: entityId,
      user_id: userId,
      project_id: inferredProjectId,
      phase_id: inferredPhaseId,
      details: detailsEntry ?? undefined,
    },
  });
}

type RevisionWithActivities = Prisma.RevisionGetPayload<{ include: { activities: true } }>;
type RevisionWithoutActivities = Prisma.RevisionGetPayload<Record<string, never>>;

export function getActiveRevision(
  tx: TxClient,
  phaseId: string,
  options: { includeActivities: true }
): Promise<RevisionWithActivities | null>;
export function getActiveRevision(
  tx: TxClient,
  phaseId: string,
  options?: { includeActivities?: false }
): Promise<RevisionWithoutActivities | null>;
export async function getActiveRevision(
  tx: TxClient,
  phaseId: string,
  options?: { includeActivities?: boolean }
) {
  return tx.revision.findFirst({
    where: { phase_id: phaseId, status_enum: "ACTIVE" },
    include: options?.includeActivities ? { activities: true } : undefined,
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
    throwActionError("INVALID_INPUT");
  }

  return `ID_${trimmed}`;
}

export async function findActiveRevisionByPhaseId(tx: TxClient, phaseId: string) {
  return getActiveRevision(tx, phaseId, { includeActivities: true });
}
