import { Prisma } from "@/generated/prisma";
import { DEFAULT_DATE_RANGE_DAYS } from "@/lib/constants";
import { AuditFiltersInput, AuditReferenceRecord } from "./types";

export function getDateBounds(dateFrom?: string | null, dateTo?: string | null) {
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - DEFAULT_DATE_RANGE_DAYS);

  const gte = dateFrom ? new Date(`${dateFrom}T00:00:00.000Z`) : defaultStart;
  const lte = dateTo ? new Date(`${dateTo}T23:59:59.999Z`) : now;

  return { gte, lte };
}

export function buildWhere(filters: AuditFiltersInput, entityIds?: string[]): Prisma.AuditLogWhereInput {
  const { gte, lte } = getDateBounds(filters.dateFrom, filters.dateTo);

  return {
    created_at: { gte, lte },
    ...(entityIds?.length ? { entity_id: { in: entityIds } } : {}),
    ...(filters.userIds?.length ? { user_id: { in: filters.userIds } } : {}),
    ...(filters.actions?.length ? { action: { in: filters.actions } } : {}),
    ...(filters.phaseIds?.length
      ? {
          OR: filters.phaseIds.flatMap((phaseId) => [
            { phase_id: phaseId },
            { details: { path: ["phase_id"], equals: phaseId } },
            { entity_type: "PHASE", entity_id: phaseId },
          ]),
        }
      : {}),
  };
}

export function getPhaseIdFromReference(reference: AuditReferenceRecord) {
  if (reference.phase_id) {
    return reference.phase_id;
  }

  if (reference.entity_type === "PHASE") {
    return reference.entity_id;
  }

  if (
    reference.details &&
    typeof reference.details === "object" &&
    !Array.isArray(reference.details) &&
    typeof (reference.details as Record<string, unknown>).phase_id === "string"
  ) {
    return (reference.details as Record<string, string>).phase_id;
  }

  return null;
}
