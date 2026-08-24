import { AUDIT_LOG_LIMIT } from "@/lib/constants";
import { AuditFiltersInput, AUDIT_ACTIONS } from "./types";
import { getPhaseIdFromReference } from "./query-builder";
import { ActionError } from "@/lib/error-types";
import { buildAuditDetails } from "./record";
import { findAuditLogsCompat, findAuditReferencesCompat, type AuditCompatLog } from "./compat";
import { prisma } from "@/core/platform/db";

export function mapLog(log: AuditCompatLog) {
  const actorName = log.user?.name ?? log.actor_name ?? null;
  const actorId = log.user?.id ?? log.actor_id ?? undefined;

  return {
    ...log,
    details: buildAuditDetails(log),
    user:
      log.user || actorName
        ? {
            id: actorId,
            name: actorName,
            role: log.user?.role ?? null,
            image: null,
          }
        : null,
  };
}

async function getFilterReferenceData(
  filters: AuditFiltersInput,
  options?: { projectId?: string; fallbackEntityIds?: string[] }
) {
  const references = await findAuditReferencesCompat(filters, {
    projectId: options?.projectId,
    fallbackEntityIds: options?.fallbackEntityIds,
  });

  const userIds = Array.from(
    new Set(
      references
        .flatMap((reference) => [reference.user_id, reference.actor_id])
        .filter((userId): userId is string => Boolean(userId))
    )
  );
  const phaseIds = Array.from(
    new Set(
      references
        .map(getPhaseIdFromReference)
        .filter((phaseId): phaseId is string => Boolean(phaseId))
    )
  );

  return { userIds, phaseIds };
}

export async function getGlobalActivityCenterData(filters: AuditFiltersInput = {}) {
  const logs = await findAuditLogsCompat(filters, {
    limit: AUDIT_LOG_LIMIT,
  });

  const { userIds, phaseIds } = await getFilterReferenceData(filters);
  const [users, phases] = await Promise.all([
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    phaseIds.length > 0
      ? prisma.phase.findMany({
          where: { id: { in: phaseIds } },
          select: {
            id: true,
            name_enum: true,
            order_index: true,
            project: { select: { name: true } },
          },
          orderBy: [{ project: { name: "asc" } }, { order_index: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  return {
    logs: logs.map(mapLog),
    filters: {
      users,
      actions: Object.values(AUDIT_ACTIONS),
      phases: phases.map((phase) => ({
        id: phase.id,
        label: `${phase.project.name} / ${phase.name_enum.replace(/_/g, " ")}`,
      })),
    },
  };
}

export async function getProjectActivityCenterData(projectId: string, filters: AuditFiltersInput = {}) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      phases: {
        select: { id: true, name_enum: true, order_index: true },
        orderBy: { order_index: "asc" },
      },
    },
  });

  if (!project) {
    throw new ActionError("Project not found", "NOT_FOUND");
  }

  const fallbackEntityIds = [projectId, ...project.phases.map((phase) => phase.id)];
  const logs = await findAuditLogsCompat(filters, {
    projectId,
    fallbackEntityIds,
    limit: AUDIT_LOG_LIMIT,
  });

  const { userIds, phaseIds } = await getFilterReferenceData(filters, {
    projectId,
    fallbackEntityIds,
  });
  const [users, phases] = await Promise.all([
    userIds.length > 0
      ? prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    phaseIds.length > 0
      ? prisma.phase.findMany({
          where: {
            project_id: projectId,
            id: { in: phaseIds },
          },
          select: { id: true, name_enum: true, order_index: true },
          orderBy: { order_index: "asc" },
        })
      : Promise.resolve([]),
  ]);

  return {
    project,
    logs: logs.map(mapLog),
    filters: {
      users,
      actions: Object.values(AUDIT_ACTIONS),
      phases: phases.map((phase) => ({
        id: phase.id,
        label: phase.name_enum.replace(/_/g, " "),
      })),
    },
  };
}
