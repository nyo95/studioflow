import { Role, PhaseName } from "@/generated/prisma";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

import { PrismaTransaction } from "@/lib/action-wrapper";
export type TxClient = PrismaTransaction;

// --- Existing Logic ---

export function canEditPhase(role: Role, phaseName: PhaseName): boolean {
  if (role === "ADMIN") return true;
  if (role === "STAFF") return false;

  if (role === "DIC") {
    // DIC handles all phases except Construction Doc (CD)
    return phaseName !== "CD";
  }

  if (role === "DRIC") {
    // DRIC (Drafter) handles Technical Drawings (CD phase)
    return phaseName === "CD";
  }

  return false;
}

export function canEditProjectMetadata(
  role: Role,
  userId: string,
  picDesignerId: string
): boolean {
  if (role === "ADMIN") return true;
  return role === "DIC" && userId === picDesignerId;
}

// --- Extracted Assertions ---

export async function getActorSession() {
  return requireSession();
}

export function assertAdmin(role: Role) {
  if (role !== "ADMIN") throw new Error(ERR.UNAUTHORIZED_ACTION);
}

export function assertPhaseOwnerAccess(
  phaseName: PhaseName,
  project: { pic_designer_id: string; pic_drafter_id: string },
  userId: string,
  role: Role
) {
  if (role === "ADMIN") return;
  if (!canEditPhase(role, phaseName)) throw new Error(ERR.UNAUTHORIZED_ACTION);

  const ownerId = phaseName === "CD" ? project.pic_drafter_id : project.pic_designer_id;
  if (ownerId !== userId) throw new Error(ERR.UNAUTHORIZED_ACTION);
}

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
  if (phase.is_locked) throw new Error(ERR.INVALID_PHASE_STATE);
  if (role === "ADMIN") return;

  // In CD phase, both Drafter (Owner) and Designer (DIC) can edit/mutate content (activities, etc.)
  if (phase.name_enum === "CD") {
    if (userId === phase.project.pic_drafter_id || userId === phase.project.pic_designer_id) {
      return;
    }
    throw new Error(ERR.UNAUTHORIZED_ACTION);
  }

  // In other phases (Moodboard, Layout, Design 3D, Supervision), strictly the Designer (DIC)
  const ownerId = phase.project.pic_designer_id;
  if (ownerId !== userId) throw new Error(ERR.UNAUTHORIZED_ACTION);
}

export function assertGlobalChecklistAccess(
  project: { pic_designer_id: string; pic_drafter_id: string },
  userId: string,
  role: Role
) {
  if (role === "ADMIN") return;
  if (project.pic_designer_id !== userId && project.pic_drafter_id !== userId) {
    throw new Error(ERR.UNAUTHORIZED_ACTION);
  }
}

export function assertDeliverableUploadAccess(
  phaseName: PhaseName,
  project: { pic_designer_id: string; pic_drafter_id: string },
  userId: string,
  role: Role
) {
  if (role === "ADMIN") return;

  const ownerId = phaseName === "CD" ? project.pic_drafter_id : project.pic_designer_id;
  if (ownerId !== userId) throw new Error(ERR.UNAUTHORIZED_ACTION);
}

// --- Data-backed Auth Helpers ---

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
    throw new Error(ERR.UNAUTHORIZED_ACTION);
  }

  return project;
}

export function isGlobalChecklistTemplate(phaseEnum: string | null | undefined) {
  return phaseEnum == null || phaseEnum === GLOBAL_CHECKLIST_PHASE;
}
