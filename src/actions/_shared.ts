import { TxClient, SYSTEM_CONFIG_ID } from "@/core/rbac/permissions";
import { trimOrNull } from "@/core/utilities/normalize";
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

  const detailsObj = detailsEntry as Record<string, unknown> | null;

  const inferredProjectId =
    detailsObj && typeof detailsObj.project_id === "string" 
      ? (detailsObj.project_id as string)
      : undefined;
      
  const inferredPhaseId =
    detailsObj && typeof detailsObj.phase_id === "string" 
      ? (detailsObj.phase_id as string) 
      : undefined;

  const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
  
  // Verify user exists to prevent Zombie Session crashes (Foreign Key violations)
  const userExists = userId ? await tx.user.findUnique({
    where: { id: userId },
    select: { id: true }
  }) : null;

  const finalUserId = userExists ? userId : ADMIN_ID;

  await tx.auditLog.create({
    data: {
      // PRD Architecture Cleanup v2 §20: satu tabel audit lintas domain.
      // BQ menulis lewat jalur ini dengan kunci `bq_project_id` (kontrak BQ
      // §11) — barisnya ditandai domain BQ, bukan STUDIOFLOW.
      domain:
        detailsObj && typeof detailsObj.bq_project_id === "string"
          ? "BQ"
          : "STUDIOFLOW",
      action,
      entity_type: entityType,
      entity_id: entityId,
      user_id: finalUserId,
      project_id: inferredProjectId,
      phase_id: inferredPhaseId,
      details: detailsEntry ?? undefined,
    },
  });
}

export type RevisionWithActivities = Prisma.RevisionGetPayload<{ include: { activities: true } }>;
export type RevisionWithoutActivities = Prisma.RevisionGetPayload<Record<string, never>>;

export async function getActiveRevision(
  tx: TxClient,
  phaseId: string
): Promise<RevisionWithoutActivities | null> {
  return tx.revision.findFirst({
    where: { phase_id: phaseId, status_enum: "ACTIVE" },
    orderBy: [{ major: "desc" }, { minor: "desc" }],
  });
}

export async function getActiveRevisionWithActivities(
  tx: TxClient,
  phaseId: string
): Promise<RevisionWithActivities | null> {
  return tx.revision.findFirst({
    where: { phase_id: phaseId, status_enum: "ACTIVE" },
    include: { activities: true },
    orderBy: [{ major: "desc" }, { minor: "desc" }],
  });
}

export async function upsertClientByName(
  tx: TxClient,
  clientName?: string,
  defaults?: { address?: string | null }
) {
  const normalizedName = trimOrNull(clientName);

  if (!normalizedName) {
    return null;
  }

  const normalizedAddress = trimOrNull(defaults?.address ?? undefined);
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
  const existing = await tx.systemConfig.findUnique({
    where: { id: SYSTEM_CONFIG_ID },
    select: { id: true, is_auto_naming_enabled: true },
  });

  if (existing) return existing;

  const created = await tx.systemConfig.upsert({
    where: { id: SYSTEM_CONFIG_ID },
    create: { id: SYSTEM_CONFIG_ID, is_auto_naming_enabled: true },
    update: {},
    select: { id: true, is_auto_naming_enabled: true },
  });

  return created;
}

export function normalizeDrawingCode(input: string) {
  const trimmed = input
    .trim()
    .toUpperCase()
    .replace(/^ARS[_\-\s]*/i, "")
    .replace(/^ID[_\-\s]*/i, "")
    .replace(/^CD[_\-\s]*/i, "");

  if (!trimmed || !/^\d+(\.\d+)?$/.test(trimmed)) {
    throwActionError("INVALID_INPUT");
  }

  return `ID_${trimmed}`;
}

export async function findActiveRevisionByPhaseId(tx: TxClient, phaseId: string) {
  return getActiveRevisionWithActivities(tx, phaseId);
}
