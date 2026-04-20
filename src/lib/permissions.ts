import { Role, PhaseName } from "@/generated/prisma";
import { requireSession } from "@/lib/auth";
import { ActionError, throwActionError } from "@/lib/error-types";
export { throwActionError };
import type { PrismaTransaction } from "@/types/common";
import { evaluateAccess, PERMISSION } from "@/lib/rbac";

// Re-export constants for consistent error handling
export const ERR = {
  UNAUTHORIZED_ACTION: "UNAUTHORIZED_ACTION",
  INVALID_PHASE_STATE: "INVALID_PHASE_STATE",
  PHASE_ALREADY_LOCKED: "PHASE_ALREADY_LOCKED",
  UNRESOLVED_ACTIVITIES_EXIST: "UNRESOLVED_ACTIVITIES_EXIST",
  RACE_CONDITION_PREVENTED: "RACE_CONDITION_PREVENTED",
  ITEM_NOT_APPROVED: "ITEM_NOT_APPROVED",
} as const;

export const GLOBAL_CHECKLIST_PHASE = "GLOBAL";
export const SYSTEM_CONFIG_ID = "default";
export type TxClient = PrismaTransaction;

// --- Refactored Helpers using RBAC Engine ---

export async function getActorSession() {
  return requireSession();
}

export function assertAdmin(role: Role) {
  if (role !== "ADMIN") throwActionError(ERR.UNAUTHORIZED_ACTION);
}

export function assertAdminOrStaff(role: Role) {
  if (role !== "ADMIN" && role !== "STAFF") throwActionError(ERR.UNAUTHORIZED_ACTION);
}

/**
 * Ensures user is the assigned PIC for a specific phase transition.
 */
export function assertPhaseOwnerAccess(
  phaseName: PhaseName,
  project: { pic_designer_id: string; pic_drafter_id: string },
  userId: string,
  role: Role
) {
  const hasAccess = evaluateAccess(role, PERMISSION.PHASE_SUBMIT_REVIEW, {
    userId,
    picDesignerId: project.pic_designer_id,
    picDrafterId: project.pic_drafter_id,
    phaseName,
  });

  if (!hasAccess) throwActionError(ERR.UNAUTHORIZED_ACTION);
}

/**
 * Ensures user has permission to add/edit/mutate content within a phase.
 */
export function assertPhaseContentMutationAccess(
  phase: {
    name_enum: PhaseName;
    status_enum: string;
    is_locked: boolean;
    project: { pic_designer_id: string; pic_drafter_id: string };
  },
  userId: string,
  role: Role
) {
  if (phase.is_locked) throwActionError(ERR.INVALID_PHASE_STATE);

  const hasAccess = evaluateAccess(role, PERMISSION.PHASE_MUTATE_CONTENT, {
    userId,
    picDesignerId: phase.project.pic_designer_id,
    picDrafterId: phase.project.pic_drafter_id,
    phaseName: phase.name_enum,
  });

  if (!hasAccess) throwActionError(ERR.UNAUTHORIZED_ACTION);
}

/**
 * Access check for syncing project checklists.
 * Allow both Designer and Drafter attached to the project.
 */
export async function getProjectSyncChecklistAccessOrThrow(
  tx: TxClient,
  projectId: string,
  userId: string,
  role: Role
) {
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      id: true,
      pic_designer_id: true,
      pic_drafter_id: true,
    },
  });

  const hasAccess = evaluateAccess(role, PERMISSION.PROJECT_SYNC_CHECKLIST, {
    userId,
    picDesignerId: project.pic_designer_id,
    picDrafterId: project.pic_drafter_id,
  });

  if (!hasAccess) throwActionError(ERR.UNAUTHORIZED_ACTION);
  return project;
}

/**
 * Access check for uploading deliverables.
 */
export function assertDeliverableUploadAccess(
  phaseName: PhaseName,
  project: { pic_designer_id: string; pic_drafter_id: string },
  userId: string,
  role: Role
) {
  const hasAccess = evaluateAccess(role, PERMISSION.PHASE_MUTATE_CONTENT, {
    userId,
    picDesignerId: project.pic_designer_id,
    picDrafterId: project.pic_drafter_id,
    phaseName,
  });

  if (!hasAccess) throwActionError(ERR.UNAUTHORIZED_ACTION);
}

/**
 * Access check for overriding phase revisions.
 * Restricted to Admins and the assigned PIC Designer (DIC).
 */
export function assertPhaseOverrideAccess(
  project: { pic_designer_id: string; pic_drafter_id: string },
  userId: string,
  role: Role
) {
  const hasAccess = evaluateAccess(role, PERMISSION.PHASE_OVERRIDE, {
    userId,
    picDesignerId: project.pic_designer_id,
    picDrafterId: project.pic_drafter_id,
  });

  if (!hasAccess) throwActionError(ERR.UNAUTHORIZED_ACTION);
}

// --- Data-backed Core Generic Helpers ---

export async function getOwnedPhaseOrThrow(tx: TxClient, phaseId: string, userId: string, role: Role) {
  const phase = await getPhaseWithProjectOrThrow(tx, phaseId);
  assertPhaseOwnerAccess(phase.name_enum as PhaseName, phase.project, userId, role);
  return phase;
}

export async function getPhaseWithProjectOrThrow(tx: TxClient, phaseId: string) {
  return tx.phase.findUniqueOrThrow({
    where: { id: phaseId },
    include: {
      project: {
        select: {
          id: true,
          pic_designer_id: true,
          pic_drafter_id: true,
        },
      },
    },
  });
}

export async function getRevisionWithPhaseOrThrow(tx: TxClient, revisionId: string) {
  return tx.revision.findUniqueOrThrow({
    where: { id: revisionId },
    include: {
      phase: {
        include: {
          project: {
            select: {
              id: true,
              pic_designer_id: true,
              pic_drafter_id: true,
            },
          },
        },
      },
    },
  });
}

export async function getActivityWithPhaseOrThrow(tx: TxClient, activityId: string) {
  return tx.activity.findUniqueOrThrow({
    where: { id: activityId },
    include: {
      project: {
        select: {
          id: true,
          pic_designer_id: true,
          pic_drafter_id: true,
        },
      },
      revision: {
        include: {
          phase: {
            include: {
              project: {
                select: {
                  id: true,
                  pic_designer_id: true,
                  pic_drafter_id: true,
                },
              },
            },
          },
        },
      },
    },
  });
}


export async function getChecklistWithPhaseOrThrow(tx: TxClient, checklistId: string) {
  return tx.projectChecklist.findUniqueOrThrow({
    where: { id: checklistId },
    include: {
      project: {
        select: {
          id: true,
          pic_designer_id: true,
          pic_drafter_id: true,
        },
      },
      phase: {
        include: {
          project: {
            select: {
              id: true,
              pic_designer_id: true,
              pic_drafter_id: true,
            },
          },
        },
      },
    },
  });
}

export async function getCDItemWithPhaseOrThrow(tx: TxClient, itemId: string) {
  return tx.cDList.findUniqueOrThrow({
    where: { id: itemId },
    include: {
      phase: {
        include: {
          project: {
            select: {
              id: true,
              pic_designer_id: true,
              pic_drafter_id: true,
            },
          },
        },
      },
    },
  });
}

export async function getProjectMembershipOrThrow(tx: TxClient, projectId: string, userId: string, role: Role) {
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      id: true,
      pic_designer_id: true,
      pic_drafter_id: true,
    },
  });

  if (role === "ADMIN") return project;
  if (project.pic_designer_id !== userId && project.pic_drafter_id !== userId) {
    throwActionError(ERR.UNAUTHORIZED_ACTION);
  }

  return project;
}

export function assertSelfOrAdmin(actorUserId: string, targetUserId: string, role: Role) {
  if (role !== "ADMIN" && actorUserId !== targetUserId) {
    throwActionError(ERR.UNAUTHORIZED_ACTION);
  }
}

export function assertAnyRole(role: Role, allowedRoles: readonly Role[]) {
  if (!allowedRoles.includes(role)) {
    throwActionError(ERR.UNAUTHORIZED_ACTION);
  }
}

export function assertApprovedLibraryItem(status: string) {
  if (status !== "APPROVED") {
    throwActionError(ERR.ITEM_NOT_APPROVED);
  }
}

export function assertPhaseNameEquals(actual: PhaseName, expected: PhaseName) {
  if (actual !== expected) {
    throwActionError(ERR.UNAUTHORIZED_ACTION);
  }
}

export function canEditProjectMetadata(role: Role, userId: string, picDesignerId: string) {
  return evaluateAccess(role, PERMISSION.PROJECT_EDIT_METADATA, {
    userId,
    picDesignerId,
  });
}

export async function getProjectMetadataAccessOrThrow(
  tx: TxClient,
  projectId: string,
  userId: string,
  role: Role
) {
  const project = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    select: {
      id: true,
      pic_designer_id: true,
      pic_drafter_id: true,
    },
  });

  const hasAccess = evaluateAccess(role, PERMISSION.PROJECT_EDIT_METADATA, {
    userId,
    picDesignerId: project.pic_designer_id,
  });

  if (!hasAccess) {
    throw new ActionError(ERR.UNAUTHORIZED_ACTION, ERR.UNAUTHORIZED_ACTION);
  }

  return project;
}

export function isGlobalChecklistTemplate(phaseEnum: string | null | undefined) {
  return phaseEnum == null || phaseEnum === GLOBAL_CHECKLIST_PHASE;
}
