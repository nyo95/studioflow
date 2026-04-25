import { prisma } from "@/core/platform/db";
import { AUDIT_LOG_LIMIT } from "@/lib/constants";
import { AuditFiltersInput, AuditLogWithUser, AuditReferenceRecord, AUDIT_ACTIONS } from "./types";
import { buildWhere, getPhaseIdFromReference } from "./query-builder";
import { ActionError } from "@/lib/error-types";
import { Prisma } from "@/generated/prisma";

export function mapLog(log: AuditLogWithUser) {
  return {
    ...log,
    details: (log.details ?? {}) as Record<string, unknown>,
    user: log.user
      ? {
          id: log.user.id,
          name: log.user.name,
          role: log.user.role,
          image: null,
        }
      : null,
  };
}

async function getFilterReferenceData(
  where: Prisma.AuditLogWhereInput,
  options?: { projectId?: string; fallbackEntityIds?: string[] }
) {
  const scopedWhere: Prisma.AuditLogWhereInput = options?.projectId
    ? {
        AND: [
          where,
          {
            OR: [
              { project_id: options.projectId },
              ...(options.fallbackEntityIds?.length
                ? [{ entity_id: { in: options.fallbackEntityIds } }]
                : []),
            ],
          },
        ],
      }
    : where;

  const references = await prisma.auditLog.findMany({
    where: scopedWhere,
    select: {
      user_id: true,
      phase_id: true,
      entity_type: true,
      entity_id: true,
      details: true,
    },
  });

  const userIds = Array.from(new Set(references.map((reference) => reference.user_id)));
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
  const where = buildWhere(filters);

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { created_at: "desc" },
    include: {
      user: {
        select: { id: true, name: true, role: true },
      },
    },
    take: AUDIT_LOG_LIMIT,
  });

  const { userIds, phaseIds } = await getFilterReferenceData(where);
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
  const where = buildWhere(filters);
  const logWhere: Prisma.AuditLogWhereInput = {
    AND: [
      where,
      {
        OR: [{ project_id: projectId }, { entity_id: { in: fallbackEntityIds } }],
      },
    ],
  };

  const logs = await prisma.auditLog.findMany({
    where: logWhere,
    orderBy: { created_at: "desc" },
    include: {
      user: {
        select: { id: true, name: true, role: true },
      },
    },
    take: AUDIT_LOG_LIMIT,
  });

  const { userIds, phaseIds } = await getFilterReferenceData(where, {
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
