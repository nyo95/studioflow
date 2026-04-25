"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * actions.ts — RAD SAAS Server Actions
 *
 * Implements ALL action contracts from:
 *   - PRD 1 (Core): A. approveInternal, B. approveClientPhase, C. rejectPhase,
 *                   D. reopenPhase, E. completeSupervisionPhase
 *   - PRD 2 (Extensions): A. addToProjectSchedule, B. updateGlobalItemStatus,
 *                          C. createLibraryItem, D. insertAuditLog
 *
 * Rules:
 *   - All mutations are atomic via prisma.$transaction.
 *   - No logic, fields or behaviour outside the PRD contracts.
 *   - Role-permission matrix validated at this layer.
 */

import { Role, PhaseName } from "@/generated/prisma";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { sanitizeCssValue } from "@/ui_engine/utils/security";
import { 
  canEditPhase, 
  canEditProjectMetadata, 
  getActorSession,
  assertAdmin,
  assertPhaseOwnerAccess,
  assertPhaseContentMutationAccess,
  assertGlobalChecklistAccess,
  assertDeliverableUploadAccess,
  getOwnedPhaseOrThrow,
  getPhaseWithProjectOrThrow,
  getRevisionWithPhaseOrThrow,
  getActivityWithPhaseOrThrow,
  getChecklistWithPhaseOrThrow,
  getCDItemWithPhaseOrThrow,
  getProjectMembershipOrThrow,
  isGlobalChecklistTemplate,
  ERR,
  GLOBAL_CHECKLIST_PHASE,
  SYSTEM_CONFIG_ID,
  TxClient
} from "@/lib/permissions";
import { calculateBackwardTimeline } from "@/lib/date-utils";
import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";

// ---------------------------------------------------------------------------
// PRD 2 §2 — Snapshot interface (enforced at runtime via this mapping)
// ---------------------------------------------------------------------------
interface LibrarySnapshot {
  internal_code: string;
  item_name: string;
  vendor_name: string | null;
  price_at_snapshot: number;
  specs: Record<string, string>;
  image_url: string | null;
  snapshot_timestamp: string; // ISO string
}

// ---------------------------------------------------------------------------
// Helper — resolve active revision for a phase
// ---------------------------------------------------------------------------
async function getActiveRevision(tx: TxClient, phaseId: string) {
  return tx.revision.findFirst({
    where: { phase_id: phaseId, status_enum: "ACTIVE" },
    include: { activities: true },
    orderBy: [{ major: "desc" }, { minor: "desc" }],
  });
}

// ---------------------------------------------------------------------------
// D (PRD 2) — insertAuditLog (called inside $transaction)
// ---------------------------------------------------------------------------
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

// ===========================================================================
// PRD 1 — CORE ACTION CONTRACTS
// ===========================================================================

// ---------------------------------------------------------------------------
// A. submitForInternalReview(phaseId)
// ---------------------------------------------------------------------------
export async function submitForInternalReview(phaseId: string, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const phase = await getOwnedPhaseOrThrow(tx, phaseId, session.userId, session.role);

    if (phase.is_locked) throw new Error(ERR.PHASE_ALREADY_LOCKED);
    if (phase.status_enum !== "IN_PROGRESS") throw new Error(ERR.INVALID_PHASE_STATE);

    const activeRevision = await getActiveRevision(tx, phaseId);
    const hasOpenTodos = activeRevision?.activities.some(
      (a: any) => a.mode === "TODO" && a.status === "OPEN"
    );
    if (hasOpenTodos) throw new Error(ERR.UNRESOLVED_ACTIVITIES_EXIST);

    await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "ON_REVIEW_INTERNAL" },
    });

    await insertAuditLog(tx, "submitForInternalReview", "Phase", phaseId, session.userId, { phaseId });
  });
}

// ---------------------------------------------------------------------------
// A2. approveInternal(phaseId)
// ---------------------------------------------------------------------------
export async function approveInternal(phaseId: string, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const phase = await getOwnedPhaseOrThrow(tx, phaseId, session.userId, session.role);

    if (phase.is_locked) throw new Error(ERR.PHASE_ALREADY_LOCKED);
    if (phase.status_enum !== "ON_REVIEW_INTERNAL") throw new Error(ERR.INVALID_PHASE_STATE);

    const activeRevision = await getActiveRevision(tx, phaseId);
    const hasOpenActivities = activeRevision?.activities.some((a: any) => a.status === "OPEN");
    if (hasOpenActivities) throw new Error(ERR.UNRESOLVED_ACTIVITIES_EXIST);

    await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "APPROVED_INTERNAL" },
    });

    await insertAuditLog(tx, "approveInternal", "Phase", phaseId, session.userId, { phaseId });
  });
}

// ---------------------------------------------------------------------------
// A3. submitForClientReview(phaseId)
// ---------------------------------------------------------------------------
export async function submitForClientReview(phaseId: string, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const phase = await getOwnedPhaseOrThrow(tx, phaseId, session.userId, session.role);

    if (phase.is_locked) throw new Error(ERR.PHASE_ALREADY_LOCKED);
    if (phase.status_enum !== "APPROVED_INTERNAL") throw new Error(ERR.INVALID_PHASE_STATE);

    await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "ON_REVIEW_CLIENT" },
    });

    await insertAuditLog(tx, "submitForClientReview", "Phase", phaseId, session.userId, { phaseId });
  });
}

// ---------------------------------------------------------------------------
// A4. activatePhase(phaseId) - Transitions a phase from PENDING to IN_PROGRESS
// ---------------------------------------------------------------------------
export async function activatePhase(phaseId: string, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const phase = await getOwnedPhaseOrThrow(tx, phaseId, session.userId, session.role);

    if (phase.status_enum !== "PENDING") throw new Error("Phase is already active or completed.");

    // 0. Sequence Check: Ensure previous phase (if any) is READY_FOR_NEXT or COMPLETED
    if (phase.order_index > 1) {
      const prevPhase = await tx.phase.findFirst({
        where: { 
          project_id: phase.project_id, 
          order_index: phase.order_index - 1 
        },
        select: { status_enum: true }
      });
      if (prevPhase && prevPhase.status_enum !== "READY_FOR_NEXT" && prevPhase.status_enum !== "COMPLETED") {
        throw new Error("Fase sebelumnya harus diselesaikan terlebih dahulu.");
      }
    }

    // 1. Activate phase
    await tx.phase.update({
      where: { id: phaseId },
      data: { 
        status_enum: "IN_PROGRESS", 
        is_locked: false
      },
    });

    // 2. Create initial revision v1.0
    await tx.revision.create({
      data: {
        phase_id: phaseId,
        major: 1,
        minor: 0,
        status_enum: "ACTIVE",
      },
    });

    await insertAuditLog(tx, "activatePhase", "Phase", phaseId, session.userId, { phaseId });
  });
}

// ---------------------------------------------------------------------------
// B. approveClientPhase(phaseId, userId)
// ---------------------------------------------------------------------------
export async function approveClientPhase(phaseId: string, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const phase = await getOwnedPhaseOrThrow(tx, phaseId, session.userId, session.role);

    if (phase.is_locked) throw new Error(ERR.PHASE_ALREADY_LOCKED);
    if (phase.status_enum !== "ON_REVIEW_CLIENT") throw new Error(ERR.INVALID_PHASE_STATE);


    const activeRevision = await getActiveRevision(tx, phaseId);
    const hasOpenActivities = activeRevision?.activities.some((a: any) => a.status === "OPEN");
    if (hasOpenActivities) throw new Error(ERR.UNRESOLVED_ACTIVITIES_EXIST);

    // 1. Lock current phase
    await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "READY_FOR_NEXT", is_locked: true },
    });

    // 2. Complete active revision
    if (activeRevision) {
      await tx.revision.update({
        where: { id: activeRevision.id },
        data: { status_enum: "COMPLETED" },
      });
    }

    // 3. Find next phase
    const nextPhase = await tx.phase.findFirst({
      where: {
        project_id: phase.project_id,
        order_index: phase.order_index + 1,
      },
    });

    if (!nextPhase) {
      // No next phase → project complete
      await tx.project.update({
        where: { id: phase.project_id },
        data: { status_progress: "COMPLETED" },
      });
    }

    // Audit log (PRD 2 §3D)
    await insertAuditLog(tx, "approveClientPhase", "Phase", phaseId, session.userId, { phaseId });
  });
}

// ---------------------------------------------------------------------------
// C. rejectPhase(phaseId, type, userId)
// ---------------------------------------------------------------------------
export async function rejectPhase(
  phaseId: string,
  type: "INTERNAL" | "CLIENT",
  userId: string,
  userRole: Role
) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const phase = await getOwnedPhaseOrThrow(tx, phaseId, session.userId, session.role);

    if (phase.is_locked) throw new Error(ERR.PHASE_ALREADY_LOCKED);

    if (type === "INTERNAL" && phase.status_enum !== "ON_REVIEW_INTERNAL") throw new Error(ERR.INVALID_PHASE_STATE);
    if (type === "CLIENT" && phase.status_enum !== "ON_REVIEW_CLIENT") throw new Error(ERR.INVALID_PHASE_STATE);

    const activeRevision = await getActiveRevision(tx, phaseId);
    if (!activeRevision) throw new Error(ERR.INVALID_PHASE_STATE);

    // 1. Complete current revision
    await tx.revision.update({
      where: { id: activeRevision.id },
      data: { status_enum: "COMPLETED" },
    });

    // 2. Calculate new version
    const newMajor = type === "CLIENT" ? activeRevision.major + 1 : activeRevision.major;
    const newMinor = type === "CLIENT" ? 0 : activeRevision.minor + 1;

    // 3. Create new revision
    const newRevision = await tx.revision.create({
      data: {
        phase_id: phaseId,
        major: newMajor,
        minor: newMinor,
        status_enum: "ACTIVE",
      },
    });

    // 4. Clone FEEDBACK+OPEN activities as TODO into new revision
    const feedbackActivities = activeRevision.activities.filter(
      (a: any) => a.mode === "FEEDBACK" && a.status === "OPEN"
    );
    if (feedbackActivities.length > 0) {
      await tx.activity.createMany({
        data: feedbackActivities.map((a: any) => ({
          revision_id: newRevision.id,
          content: a.content,
          mode: "TODO",
          status: "OPEN",
        })),
      });
    }

    // 5. Reset phase status
    await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "IN_PROGRESS" },
    });
  });
}

// ---------------------------------------------------------------------------
// D. reopenPhase(phaseId, userId, userRole)
// ---------------------------------------------------------------------------
export async function reopenPhase(
  phaseId: string,
  userId: string,
  userRole: Role
) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const phase = await getOwnedPhaseOrThrow(tx, phaseId, session.userId, session.role);

    if (!phase.is_locked) throw new Error(ERR.INVALID_PHASE_STATE);

    // 1. Unlock phase
    await tx.phase.update({
      where: { id: phaseId },
      data: { is_locked: false, status_enum: "IN_PROGRESS" },
    });

    // 2. Complete existing active revision (if any)
    const activeRevision = await getActiveRevision(tx, phaseId);
    if (activeRevision) {
      await tx.revision.update({
        where: { id: activeRevision.id },
        data: { status_enum: "COMPLETED" },
      });

      // 3. Major Reset Rule: new revision with major+1, minor=0
      await tx.revision.create({
        data: {
          phase_id: phaseId,
          major: activeRevision.major + 1,
          minor: 0,
          status_enum: "ACTIVE",
        },
      });
    } else {
      // Fallback: find latest completed revision for major counter
      const latestRevision = await tx.revision.findFirst({
        where: { phase_id: phaseId },
        orderBy: [{ major: "desc" }, { minor: "desc" }],
      });
      await tx.revision.create({
        data: {
          phase_id: phaseId,
          major: (latestRevision?.major ?? 0) + 1,
          minor: 0,
          status_enum: "ACTIVE",
        },
      });
    }

    // Audit log (PRD 2 §3D)
    await insertAuditLog(tx, "reopenPhase", "Phase", phaseId, session.userId, { phaseId });
  });
}

// ---------------------------------------------------------------------------
// E. completeSupervisionPhase(phaseId) — Phase 5 only
// ---------------------------------------------------------------------------
export async function completeSupervisionPhase(phaseId: string, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const phase = await getOwnedPhaseOrThrow(tx, phaseId, session.userId, session.role);

    if (phase.name_enum !== "SUPERVISION") throw new Error(ERR.INVALID_PHASE_STATE);
    if (phase.status_enum !== "IN_PROGRESS") throw new Error(ERR.INVALID_PHASE_STATE);

    // 1. Complete and lock the phase
    await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "COMPLETED", is_locked: true },
    });

    // 2. Complete the project
    await tx.project.update({
      where: { id: phase.project_id },
      data: { status_progress: "COMPLETED" },
    });

    // 3. Complete current revision
    const activeRevision = await getActiveRevision(tx, phaseId);
    if (activeRevision) {
      await tx.revision.update({
        where: { id: activeRevision.id },
        data: { status_enum: "COMPLETED" },
      });
    }
  });
}

// ===========================================================================
// PRD 1 §3 — BOOTSTRAP PROJECT (ATOMIC TRANSACTION)
// ===========================================================================
export async function bootstrapProject(data: {
  name: string;
  pic_designer_id: string;
  pic_drafter_id: string;
  opening_date?: Date;
  project_type?: string;
  client_name?: string;
  client_contact?: string;
  address?: string;
  area?: number;
}) {
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    if (session.role !== "ADMIN") throw new Error(ERR.UNAUTHORIZED_ACTION);
    assertAdmin(session.role);

    const normalizedName = data.name.trim();
    const client = await upsertClientByName(tx, data.client_name, { address: data.address });
    if (!normalizedName) throw new Error("INVALID_INPUT");

    const systemConfig = await getSystemConfigTx(tx);
    let formattedName = normalizedName;

    if (systemConfig.is_auto_naming_enabled) {
      if (/^\d{4}-\d{3}-.+/.test(normalizedName)) {
        throw new Error("Enter only the readable project name. Year and sequence are generated automatically.");
      }

      const currentYear = new Date().getFullYear();
      const yearPrefix = `${currentYear}-`;
      const projectCount = await tx.project.count({
        where: { name: { startsWith: yearPrefix } },
      });
      const nnn = String(projectCount + 1).padStart(3, "0");
      formattedName = `${currentYear}-${nnn}-${normalizedName}`;
    } else if (!/^\d{4}-\d{3}-.+/.test(normalizedName)) {
      throw new Error("Project name must use the format: [YYYY]-[NNN]-[Name].");
    }

    const project = await tx.project.create({
      data: {
        name: formattedName,
        pic_designer_id: data.pic_designer_id,
        pic_drafter_id: data.pic_drafter_id,
        clientId: client?.id,
        opening_date: data.opening_date,
        project_type: data.project_type ?? "RETAIL",
        client_contact: data.client_contact,
        address: data.address,
        area: data.area,
        status_progress: "ACTIVE",
      },
    });

    const PHASE_ORDER = [
      { name: "MOODBOARD" as const, index: 1 },
      { name: "LAYOUT" as const, index: 2 },
      { name: "DESIGN_3D" as const, index: 3 },
      { name: "CD" as const, index: 4 },
      { name: "SUPERVISION" as const, index: 5 },
    ];

    // Calculate timelines inside the same transaction so project bootstrap stays atomic.
    let timelineCalculations: Record<string, { start: Date; end: Date }> = {};
    if (data.opening_date) {
      const templates = await tx.timelineTemplate.findMany();
      timelineCalculations = calculateBackwardTimeline(data.opening_date, templates);
    }

    const phases: Array<{ id: string; name_enum: PhaseName }> = [];
    for (const p of PHASE_ORDER) {
      const phase = await tx.phase.create({
        data: {
          project_id: project.id,
          name_enum: p.name,
          status_enum: p.index === 1 ? "IN_PROGRESS" : "PENDING",
          order_index: p.index,
          is_locked: false,
        },
      });
      phases.push({ id: phase.id, name_enum: phase.name_enum });

      if (timelineCalculations[p.name]) {
        await tx.projectTimeline.create({
          data: {
            project_id: project.id,
            phase_id: phase.id,
            start_date: timelineCalculations[p.name].start,
            end_date: timelineCalculations[p.name].end,
            status: p.index === 1 ? "IN_PROGRESS" : "NOT_STARTED",
          },
        });
      }
    }

    const checklistTemplates = await tx.checklistTemplate.findMany({
      where: { is_active: true },
    });
    if (checklistTemplates.length > 0) {
      const globalChecklistRows = checklistTemplates
        .filter((template: any) => isGlobalChecklistTemplate(template.phase_enum))
        .map((template: any) => ({
          project_id: project.id,
          phase_id: null,
          label: template.label,
          is_checked: false,
        }));
      const phaseChecklistRows = phases.flatMap((phase) =>
        checklistTemplates
          .filter((template: any) => template.phase_enum === phase.name_enum)
          .map((template: any) => ({
            project_id: project.id,
            phase_id: phase.id,
            label: template.label,
            is_checked: false,
          }))
      );
      const checklistRows = [...globalChecklistRows, ...phaseChecklistRows];

      if (checklistRows.length > 0) {
        await tx.projectChecklist.createMany({
          data: checklistRows,
        });
      }
    }

    await tx.revision.create({
      data: {
        phase_id: phases[0].id,
        major: 1,
        minor: 0,
        status_enum: "ACTIVE",
      },
    });

    revalidatePath("/");
    revalidatePath(`/projects/${project.id}`);

    return project;
  });
}

export async function updateProjectMetadata(data: {
  projectId: string;
  name?: string;
  client_name?: string;
  clientId?: string | null;
  area?: number;
  opening_date?: Date;
  pic_designer_id?: string;
  pic_drafter_id?: string;
}) {
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const project = await tx.project.findUniqueOrThrow({
      where: { id: data.projectId },
      select: {
        id: true,
        name: true,
        clientId: true,
        area: true,
        opening_date: true,
        pic_designer_id: true,
        pic_drafter_id: true,
      },
    });

    if (!canEditProjectMetadata(session.role, session.userId, project.pic_designer_id)) {
      throw new Error(ERR.UNAUTHORIZED_ACTION);
    }

    const normalizedName = data.name?.trim();
    let resolvedClientId = project.clientId;
    const sanitizedArea = typeof data.area === "number" ? data.area : null;
    const sanitizedOpeningDate = data.opening_date ?? null;

    if (session.role === "ADMIN" && data.name !== undefined && !normalizedName) {
      throw new Error("INVALID_INPUT");
    }

    if (session.role === "ADMIN") {
      if (data.clientId !== undefined) {
        if (data.clientId === null) {
          resolvedClientId = null;
        } else {
          const client = await tx.client.findUnique({
            where: { id: data.clientId },
            select: { id: true },
          });

          if (!client) {
            throw new Error("CLIENT_NOT_FOUND");
          }

          resolvedClientId = client.id;
        }
      } else if (data.client_name !== undefined) {
        const client = await upsertClientByName(tx, data.client_name);
        resolvedClientId = client?.id ?? null;
      }
    }

    const updateData =
      session.role === "ADMIN"
        ? {
            name: normalizedName || project.name,
            clientId: resolvedClientId,
            area: sanitizedArea,
            opening_date: sanitizedOpeningDate,
            pic_designer_id: data.pic_designer_id || project.pic_designer_id,
            pic_drafter_id: data.pic_drafter_id || project.pic_drafter_id,
          }
        : {
            area: sanitizedArea,
            opening_date: sanitizedOpeningDate,
          };

    const updatedProject = await tx.project.update({
      where: { id: data.projectId },
      data: updateData,
    });

    const auditDetails =
      session.role === "ADMIN"
        ? {
            name: updateData.name,
            clientId: updateData.clientId,
            area: updateData.area,
            opening_date: updateData.opening_date?.toISOString() ?? null,
            pic_designer_id: updateData.pic_designer_id,
            pic_drafter_id: updateData.pic_drafter_id,
          }
        : {
            area: updateData.area,
            opening_date: updateData.opening_date?.toISOString() ?? null,
          };

    await insertAuditLog(tx, "updateProjectMetadata", "Project", data.projectId, session.userId, auditDetails);

    revalidatePath("/");
    revalidatePath(`/projects/${data.projectId}`);

    return updatedProject;
  });
}

export async function deleteClient(clientId: string) {
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    assertAdmin(session.role);

    const client = await tx.client.findUniqueOrThrow({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        projects: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (client.projects.length > 0) {
      throw new Error("CLIENT_HAS_ACTIVE_PROJECTS");
    }

    await tx.client.delete({
      where: { id: clientId },
    });

    await insertAuditLog(tx, "deleteClient", "Client", client.id, session.userId, {
      name: client.name,
    });

    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/settings/clients");

    return { id: client.id };
  });
}

export async function mergeClients(data: {
  sourceClientId: string;
  targetClientId: string;
}) {
  const result = await prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    assertAdmin(session.role);

    if (data.sourceClientId === data.targetClientId) {
      throw new Error("INVALID_INPUT");
    }

    const [sourceClient, targetClient] = await Promise.all([
      tx.client.findUnique({
        where: { id: data.sourceClientId },
        select: {
          id: true,
          name: true,
          projects: {
            select: { id: true },
          },
        },
      }),
      tx.client.findUnique({
        where: { id: data.targetClientId },
        select: {
          id: true,
          name: true,
        },
      }),
    ]);

    if (!sourceClient || !targetClient) {
      throw new Error("CLIENT_NOT_FOUND");
    }

    const movedProjectIds = sourceClient.projects.map((project: { id: string }) => project.id);

    await tx.project.updateMany({
      where: { clientId: sourceClient.id },
      data: { clientId: targetClient.id },
    });

    await tx.client.delete({
      where: { id: sourceClient.id },
    });

    await insertAuditLog(tx, "mergeClients", "Client", sourceClient.id, session.userId, {
      sourceClientId: sourceClient.id,
      sourceClientName: sourceClient.name,
      targetClientId: targetClient.id,
      targetClientName: targetClient.name,
      movedProjectIds,
    });

    return {
      movedProjectIds,
      sourceClientId: sourceClient.id,
      targetClientId: targetClient.id,
    };
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings");
  revalidatePath("/settings/clients");
  revalidatePath("/today");

  for (const projectId of result.movedProjectIds) {
    revalidatePath(`/projects/${projectId}`);
  }

  return result;
}

export async function setAutoNamingEnabled(isEnabled: boolean) {
  const session = await getActorSession();
  assertAdmin(session.role);

  await prisma.$executeRaw`
    INSERT INTO "SystemConfig" ("id", "is_auto_naming_enabled")
    VALUES (${SYSTEM_CONFIG_ID}, ${isEnabled})
    ON CONFLICT ("id")
    DO UPDATE SET "is_auto_naming_enabled" = EXCLUDED."is_auto_naming_enabled"
  `;

  revalidatePath("/");
  revalidatePath("/settings");

  return { id: SYSTEM_CONFIG_ID, is_auto_naming_enabled: isEnabled };
}

export async function updateClientBranding(data: {
  clientId: string;
  address?: string;
  logo_url?: string;
}) {
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    assertAdmin(session.role);

    const normalizedAddress = normalizeOptionalString(data.address);
    const normalizedLogoUrl = normalizeOptionalString(data.logo_url);

    const client = await tx.client.update({
      where: { id: data.clientId },
      data: {
        address: normalizedAddress,
        logo_url: normalizedLogoUrl,
      },
    });

    await insertAuditLog(tx, "updateClientBranding", "Client", client.id, session.userId, {
      address: client.address,
      logo_url: client.logo_url,
    });

    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/settings/clients");
    return client;
  });
}

// ---------------------------------------------------------------------------
// CD List Actions (PRD PATCH §4)
// ---------------------------------------------------------------------------
export async function createCDItem(phaseId: string, data: { group_code: string; drawing_name: string; assigned_to_id?: string }, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const phase = await getPhaseWithProjectOrThrow(tx, phaseId);
    if (phase.name_enum !== "CD") throw new Error(ERR.UNAUTHORIZED_ACTION);
    assertPhaseContentMutationAccess(phase, session.userId, session.role);
    
    return tx.cDList.create({
      data: {
        phase_id: phaseId,
        group_code: normalizeDrawingCode(data.group_code),
        drawing_name: data.drawing_name.trim(),
        assigned_to_id: data.assigned_to_id,
      }
    });
  });
}

export async function updateCDItem(
  itemId: string,
  data: { group_code: string; drawing_name: string },
  userId: string,
  userRole: Role
) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const item = await getCDItemWithPhaseOrThrow(tx, itemId);
    assertPhaseContentMutationAccess(item.phase, session.userId, session.role);

    const groupCode = normalizeDrawingCode(data.group_code);
    const drawingName = data.drawing_name.trim();

    if (!groupCode || !drawingName) {
      throw new Error("INVALID_INPUT");
    }

    const updatedItem = await tx.cDList.update({
      where: { id: itemId },
      data: {
        group_code: groupCode,
        drawing_name: drawingName,
      },
    });

    await insertAuditLog(tx, "updateCDItem", "CDList", itemId, session.userId, {
      group_code: groupCode,
      drawing_name: drawingName,
    });

    return updatedItem;
  });
}

export async function updateCDStatus(itemId: string, status: string, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const item = await getCDItemWithPhaseOrThrow(tx, itemId);
    assertPhaseContentMutationAccess(item.phase, session.userId, session.role);

    const updatedItem = await tx.cDList.update({
      where: { id: itemId },
      data: { status_enum: status }
    });

    await insertAuditLog(tx, "updateCDStatus", "CDList", itemId, session.userId, { status });
    return updatedItem;
  });
}

export async function deleteCDItem(itemId: string, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const item = await getCDItemWithPhaseOrThrow(tx, itemId);
    assertPhaseContentMutationAccess(item.phase, session.userId, session.role);
    return tx.cDList.delete({ where: { id: itemId } });
  });
}

// ---------------------------------------------------------------------------
// Checklist Actions (PRD PATCH §5)
// ---------------------------------------------------------------------------
export async function toggleChecklist(checklistId: string, isChecked: boolean) {
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const checklist = await getChecklistWithPhaseOrThrow(tx, checklistId);
    if (checklist.phase_id) {
      assertPhaseContentMutationAccess(checklist.phase, session.userId, session.role);
    } else {
      assertGlobalChecklistAccess(checklist.project, session.userId, session.role);
    }

    const updated = await tx.projectChecklist.update({
      where: { id: checklistId },
      data: { is_checked: isChecked },
    });

    return updated;
  });
}

// ---------------------------------------------------------------------------
// Quick-Add: addChecklistItem(phaseId, label)
// Adds a new todo item to an IN_PROGRESS phase's checklist from Today's View.
// ---------------------------------------------------------------------------
export async function addChecklistItem(phaseId: string, label: string) {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) throw new Error("INVALID_INPUT");

  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const phase = await getPhaseWithProjectOrThrow(tx, phaseId);

    if (phase.status_enum !== "IN_PROGRESS") throw new Error(ERR.INVALID_PHASE_STATE);
    assertPhaseContentMutationAccess(phase, session.userId, session.role);

    const newItem = await tx.projectChecklist.create({
      data: {
        project_id: phase.project_id,
        phase_id: phaseId,
        label: trimmedLabel,
        is_checked: false,
      },
    });

    revalidatePath("/today");
    revalidatePath(`/projects/${phase.project_id}`);

    return newItem;
  });
}

// ---------------------------------------------------------------------------
// ADMIN-ONLY: updateProjectPriority(projectId, priority)
// Sets the priority level of a project. ADMIN role required.
// ---------------------------------------------------------------------------
export async function updateProjectPriority(projectId: string, priority: string) {
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();

    // STRICT: Admin-only access control
    if (session.role !== "ADMIN") {
      throw new Error("UNAUTHORIZED_ACTION");
    }

    // Verify project exists
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
    });

    // Update project priority
    const updated = await tx.project.update({
      where: { id: projectId },
      data: { priority },
    });

    // Audit log
    await insertAuditLog(tx, "updateProjectPriority", "Project", projectId, session.userId, {
      projectId,
      newPriority: priority,
      previousPriority: project.priority,
    });

    revalidatePath("/");

    return updated;
  });
}

async function upsertClientByName(
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

async function getSystemConfigTx(tx: TxClient) {
  const rows = await tx.$queryRaw`
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

function normalizeOptionalString(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeDrawingCode(input: string) {
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

// ---------------------------------------------------------------------------
// Settings Templates Actions (PRD PATCH §2)
// ---------------------------------------------------------------------------
export async function upsertTimelineTemplate(phaseEnum: string, durationDays: number, userRole: Role) {
  void userRole;
  const session = await getActorSession();
  assertAdmin(session.role);
  
  return prisma.timelineTemplate.upsert({
    where: { phase_enum: phaseEnum },
    update: { duration_days: durationDays },
    create: { phase_enum: phaseEnum, duration_days: durationDays }
  });
}

export async function createChecklistTemplate(phaseEnum: string | null, label: string, userRole: Role) {
  void userRole;
  const session = await getActorSession();
  assertAdmin(session.role);
  const normalizedLabel = label.trim();
  if (!normalizedLabel) throw new Error("INVALID_INPUT");
  const normalizedPhaseEnum =
    phaseEnum === GLOBAL_CHECKLIST_PHASE || phaseEnum == null ? GLOBAL_CHECKLIST_PHASE : phaseEnum;
  
  return prisma.checklistTemplate.create({
    data: { phase_enum: normalizedPhaseEnum, label: normalizedLabel, is_active: true }
  });
}

export async function deleteChecklistTemplate(id: string, userRole: Role) {
  void userRole;
  const session = await getActorSession();
  assertAdmin(session.role);
  return prisma.checklistTemplate.delete({ where: { id } });
}

export async function syncProjectChecklists(projectId: string) {
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { id: true, pic_designer_id: true, pic_drafter_id: true }
    });

    if (!canEditProjectMetadata(session.role, session.userId, project.pic_designer_id)) {
      throw new Error(ERR.UNAUTHORIZED_ACTION);
    }

    const phases = await tx.phase.findMany({
      where: { project_id: projectId },
      select: { id: true, name_enum: true }
    });

    const activeTemplates = await tx.checklistTemplate.findMany({
      where: { is_active: true }
    });

    const existingChecklists = await tx.projectChecklist.findMany({
      where: { project_id: projectId },
      select: { phase_id: true, label: true }
    });

    const newRows = [];
    const globalTemplates = activeTemplates.filter((t: any) => isGlobalChecklistTemplate(t.phase_enum));
    const existingGlobalChecklists = existingChecklists.filter((c: any) => c.phase_id == null);

    for (const template of globalTemplates) {
      if (!existingGlobalChecklists.some((c: any) => c.label === template.label)) {
        newRows.push({
          project_id: projectId,
          phase_id: null,
          label: template.label,
          is_checked: false
        });
      }
    }

    for (const phase of phases) {
      const templatesForPhase = activeTemplates.filter((t: any) => t.phase_enum === phase.name_enum);
      const phaseChecklists = existingChecklists.filter((c: any) => c.phase_id === phase.id);

      for (const t of templatesForPhase) {
        if (!phaseChecklists.some((c: any) => c.label === t.label)) {
          newRows.push({
            project_id: projectId,
            phase_id: phase.id,
            label: t.label,
            is_checked: false
          });
        }
      }
    }

    if (newRows.length > 0) {
      await tx.projectChecklist.createMany({
        data: newRows
      });
    }

    revalidatePath(`/projects/${projectId}`);
    return { count: newRows.length };
  });
}

// ---------------------------------------------------------------------------
// Vendor Actions (PRD PATCH §1)
// ---------------------------------------------------------------------------
export async function createVendor(data: { name: string; contact_person?: string; phone?: string; address?: string }, userRole: Role) {
  void userRole;
  const session = await getActorSession();
  assertAdmin(session.role);
  return prisma.vendor.create({ data });
}

// ---------------------------------------------------------------------------
// Deliverables Actions (PRD PATCH §6)
// ---------------------------------------------------------------------------
export async function addDeliverable(
  revisionId: string, 
  data: { file_name: string; file_type: string; file_url?: string; link_url?: string; is_external: boolean }, 
  userId: string, 
  userRole: Role
) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const revision = await getRevisionWithPhaseOrThrow(tx, revisionId);
    assertDeliverableUploadAccess(
      revision.phase.name_enum as PhaseName,
      revision.phase.project,
      session.userId,
      session.role
    );

    return tx.file.create({
      data: {
        revision_id: revisionId,
        file_name: data.file_name,
        file_type: data.file_type,
        file_url: data.file_url ?? "",
        link_url: data.link_url,
        is_external: data.is_external,
        uploaded_by: session.userId,
      },
    });
  });
}

// ===========================================================================
// PRD 2 — EXTENSION ACTION CONTRACTS
// ===========================================================================

// ---------------------------------------------------------------------------
// A. addToProjectSchedule(projectId, libraryItemId, userId)
// ---------------------------------------------------------------------------
export async function addToProjectSchedule(
  projectId: string,
  libraryItemId: string,
  userId: string
) {
  void userId;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    await getProjectMembershipOrThrow(tx, projectId, session.userId, session.role);

    const item = await tx.globalLibrary.findUniqueOrThrow({
      where: { id: libraryItemId },
      include: { vendor: true },
    });

    if (item.status !== "APPROVED") throw new Error(ERR.ITEM_NOT_APPROVED);

    const snapshot: LibrarySnapshot = {
      internal_code: item.internal_code,
      item_name: item.item_name,
      vendor_name: item.vendor?.name ?? null,
      price_at_snapshot: item.price,
      specs: item.specs as Record<string, string>,
      image_url: item.image_url ?? null,
      snapshot_timestamp: new Date().toISOString(),
    };

    const schedule = await tx.projectSchedule.create({
      data: {
        project_id: projectId,
        category_enum: item.category_enum,
        data_snapshot: snapshot,
        original_library_id: item.id,
      },
    });

    // Audit log (PRD 2 §3D)
    await insertAuditLog(
      tx,
      "addToProjectSchedule",
      "ProjectSchedule",
      schedule.id,
      session.userId,
      { libraryItemId, projectId }
    );

    return schedule;
  });
}

// ---------------------------------------------------------------------------
// B. updateGlobalItemStatus(libraryItemId, newStatus, userId, userRole)
// ---------------------------------------------------------------------------
export async function updateGlobalItemStatus(
  libraryItemId: string,
  newStatus: "PENDING" | "APPROVED",
  _userId: string,
  userRole: Role
) {
  void _userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    assertAdmin(session.role);

    return tx.globalLibrary.update({
      where: { id: libraryItemId },
      data: { status: newStatus },
    });
  });
}

// ---------------------------------------------------------------------------
// C. createLibraryItem(data, userId, userRole)
// ---------------------------------------------------------------------------
export async function createLibraryItem(
  data: {
    category_enum: string;
    internal_code: string;
    item_name: string;
    vendor_id?: string;
    price: number;
    specs: Record<string, string>;
    image_url?: string;
  },
  _userId: string,
  userRole: Role
) {
  void _userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    // All roles may create; status depends on role (PRD 2 §3C)
    const session = await getActorSession();
    const allowedRoles: Role[] = ["ADMIN", "DIC", "DRIC", "STAFF"];
    if (!allowedRoles.includes(session.role)) throw new Error(ERR.UNAUTHORIZED_ACTION);

    // Status logic: ADMIN → APPROVED, others → PENDING
    const status = session.role === "ADMIN" ? "APPROVED" : "PENDING";

    return tx.globalLibrary.create({
      data: {
        category_enum: data.category_enum,
        internal_code: data.internal_code,
        item_name: data.item_name,
        vendor_id: data.vendor_id,
        price: data.price,
        specs: data.specs,
        image_url: data.image_url,
        status,
      },
    });
  });
}

// ---------------------------------------------------------------------------
// D. deleteProject(projectId)
// ---------------------------------------------------------------------------
export async function deleteProject(projectId: string, userRole: Role) {
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    assertAdmin(session.role);

    // 1. Find all phases for this project
    const phases = await tx.phase.findMany({
      where: { project_id: projectId },
      select: { id: true },
    });
    const phaseIds = phases.map((p: any) => p.id);

    // 2. Find all revisions on those phases
    const revisions = await tx.revision.findMany({
      where: { phase_id: { in: phaseIds } },
      select: { id: true },
    });
    const revisionIds = revisions.map((r: any) => r.id);

    // 3. Delete deep objects: Files, Activities, Timelines, Schedules
    await tx.file.deleteMany({
      where: { revision_id: { in: revisionIds } },
    });

    await tx.activity.deleteMany({
      where: { revision_id: { in: revisionIds } },
    });

    await tx.projectTimeline.deleteMany({
      where: {
        OR: [
          { project_id: projectId },
          { phase_id: { in: phaseIds } },
        ],
      },
    });

    await tx.projectSchedule.deleteMany({
      where: { project_id: projectId },
    });

    await tx.projectChecklist.deleteMany({
      where: { project_id: projectId },
    });

    await tx.cDList.deleteMany({
      where: { phase_id: { in: phaseIds } },
    });

    await tx.revision.deleteMany({
      where: { id: { in: revisionIds } },
    });

    await tx.phase.deleteMany({
      where: { id: { in: phaseIds } },
    });

    return tx.project.delete({
      where: { id: projectId },
    });
  });
}

// ===========================================================================
// PHASE 3 — ACTIVITY CRUD ACTIONS
// ===========================================================================

// ---------------------------------------------------------------------------
// 1. addActivity(revisionId, content, mode)
// ---------------------------------------------------------------------------
export async function addActivity(
  revisionId: string,
  content: string,
  mode: "TODO" | "FEEDBACK",
  userId: string,
  userRole: Role
) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const revision = await getRevisionWithPhaseOrThrow(tx, revisionId);
    assertPhaseContentMutationAccess(revision.phase, session.userId, session.role);
    if (revision.status_enum !== "ACTIVE") throw new Error(ERR.INVALID_PHASE_STATE);

    return tx.activity.create({
      data: {
        revision_id: revisionId,
        content: content.trim(),
        mode,
        status: "OPEN",
      },
    });
  });
}

export async function updateActivityContent(
  activityId: string,
  content: string,
  userId: string,
  userRole: Role
) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const activity = await getActivityWithPhaseOrThrow(tx, activityId);
    assertPhaseContentMutationAccess(activity.revision.phase, session.userId, session.role);

    const normalizedContent = content.trim();
    if (!normalizedContent) throw new Error("INVALID_INPUT");

    const updatedActivity = await tx.activity.update({
      where: { id: activityId },
      data: { content: normalizedContent },
    });

    await insertAuditLog(tx, "updateActivityContent", "Activity", activityId, session.userId, {
      content: normalizedContent,
    });

    return updatedActivity;
  });
}

// ---------------------------------------------------------------------------
// 2. toggleActivityStatus(activityId)
// ---------------------------------------------------------------------------
export async function toggleActivityStatus(activityId: string, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const activity = await getActivityWithPhaseOrThrow(tx, activityId);
    assertPhaseContentMutationAccess(activity.revision.phase, session.userId, session.role);

    const newStatus = activity.status === "OPEN" ? "DONE" : "OPEN";

    return tx.activity.update({
      where: { id: activityId },
      data: { status: newStatus },
    });
  });
}

// ---------------------------------------------------------------------------
// 3. deleteActivity(activityId)
// ---------------------------------------------------------------------------
export async function deleteActivity(activityId: string, userId: string, userRole: Role) {
  void userId;
  void userRole;
  return prisma.$transaction(async (tx: any) => {
    const session = await getActorSession();
    const activity = await getActivityWithPhaseOrThrow(tx, activityId);
    assertPhaseContentMutationAccess(activity.revision.phase, session.userId, session.role);

    return tx.activity.delete({
      where: { id: activityId },
    });
  });
}

// ===========================================================================
// PHASE 4.5 — USER & SESSION MANAGEMENT
// ===========================================================================

/**
 * logout() — Destroy session
 */
export async function logout() {
  await signOut({ redirectTo: "/login" });
}

/**
 * createUser(name, role)
 */
export async function createUser(
  data: { name: string; email: string; password: string; role: Role },
  requesterRole: Role
) {
  void requesterRole;
  const session = await getActorSession();
  assertAdmin(session.role);

  const normalizedName = data.name.trim();
  const normalizedEmail = data.email.trim().toLowerCase();
  const normalizedPassword = data.password.trim();

  if (!normalizedName || !normalizedEmail || !normalizedPassword) {
    throw new Error("INVALID_INPUT");
  }

  const hashedPassword = await bcrypt.hash(normalizedPassword, 12);

  const user = await prisma.user.create({
    data: {
      name: normalizedName,
      email: normalizedEmail,
      password: hashedPassword,
      role: data.role,
    },
  });

  revalidatePath("/settings");
  return user;
}

/**
 * updateUserRole(targetUserId, newRole, requesterRole)
 */
export async function updateUserRole(targetUserId: string, newRole: Role, requesterRole: Role) {
  void requesterRole;
  const session = await getActorSession();
  assertAdmin(session.role);

  const user = await prisma.user.update({
    where: { id: targetUserId },
    data: { role: newRole },
  });

  revalidatePath("/settings");
  return user;
}

/**
 * updateUserName(userId, newName)
 */
export async function updateUserName(userId: string, newName: string) {
  const session = await getActorSession();
  if (session.role !== "ADMIN" && session.userId !== userId) throw new Error(ERR.UNAUTHORIZED_ACTION);
  const normalizedName = newName.trim();
  if (!normalizedName) throw new Error("INVALID_INPUT");

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name: normalizedName },
  });

  revalidatePath("/settings");
  return user;
}

export async function updateUISettings(uiSettings: any, appTitle?: string) {
  const session = await getActorSession();
  assertAdmin(session.role);

  // Sanitize all string values in uiSettings
  const sanitizedSettings: any = {};
  if (uiSettings && typeof uiSettings === "object") {
    for (const key in uiSettings) {
      if (typeof uiSettings[key] === "string") {
        sanitizedSettings[key] = sanitizeCssValue(uiSettings[key]);
      } else {
        sanitizedSettings[key] = uiSettings[key];
      }
    }
  }

  await prisma.systemConfig.upsert({
    where: { id: SYSTEM_CONFIG_ID },
    update: { 
      ui_settings: sanitizedSettings,
      app_title: appTitle || undefined,
    },
    create: { 
      id: SYSTEM_CONFIG_ID, 
      ui_settings: sanitizedSettings,
      app_title: appTitle || "StudioFlow",
    },
  });

  revalidatePath("/", "layout");
  revalidatePath("/settings/studio");

  return sanitizedSettings;
}

