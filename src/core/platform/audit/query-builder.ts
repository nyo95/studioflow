import { Prisma } from "@/generated/prisma";
import { toJakartaDateBoundary } from "@/core/utilities/datetime";
import { DEFAULT_DATE_RANGE_DAYS } from "@/lib/constants";
import { AuditFiltersInput, AuditReferenceRecord } from "./types";

export function getDateBounds(dateFrom?: string | null, dateTo?: string | null) {
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() - DEFAULT_DATE_RANGE_DAYS);

  const gte = dateFrom ? toJakartaDateBoundary(dateFrom, false) : defaultStart;
  const lte = dateTo ? toJakartaDateBoundary(dateTo, true) : now;

  return { gte, lte };
}

export function buildWhere(filters: AuditFiltersInput, entityIds?: string[]): Prisma.AuditLogWhereInput {
  const { gte, lte } = getDateBounds(filters.dateFrom, filters.dateTo);
  const andClauses: Prisma.AuditLogWhereInput[] = [{ created_at: { gte, lte } }];

  if (entityIds?.length) {
    andClauses.push({ entity_id: { in: entityIds } });
  }
  if (filters.userIds?.length) {
    andClauses.push({
      OR: [
        { user_id: { in: filters.userIds } },
        { actor_id: { in: filters.userIds } },
      ],
    });
  }
  if (filters.actions?.length) {
    andClauses.push({ action: { in: filters.actions } });
  }
  if (filters.phaseIds?.length) {
    andClauses.push({
      OR: filters.phaseIds.flatMap((phaseId) => [
        { phase_id: phaseId },
        { metadata_json: { path: ["phase_id"], equals: phaseId } },
        { entity_type: "PHASE", entity_id: phaseId },
      ]),
    });
  }

  return andClauses.length === 1 ? andClauses[0] : { AND: andClauses };
}

export function getPhaseIdFromReference(reference: AuditReferenceRecord) {
  if (reference.phase_id) {
    return reference.phase_id;
  }

  if (reference.entity_type === "PHASE") {
    return reference.entity_id;
  }

  if (
    reference.metadata_json &&
    typeof reference.metadata_json === "object" &&
    !Array.isArray(reference.metadata_json) &&
    typeof (reference.metadata_json as Record<string, unknown>).phase_id === "string"
  ) {
    return (reference.metadata_json as Record<string, string>).phase_id;
  }

  return null;
}
