"use server";

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

import { PrismaClient } from "../generated/prisma/client";
import type { Role } from "../generated/prisma/client";

const prisma = new PrismaClient({} as any);

// ---------------------------------------------------------------------------
// Since Prisma v7 generates with @ts-nocheck, $transaction callback inferencing
// can fail in strict mode. We define a fallback `TxClient` to bypass TS errors.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TxClient = any;

// ---------------------------------------------------------------------------
// Error codes (PRD 1 §2)
// ---------------------------------------------------------------------------
const ERR = {
  UNAUTHORIZED_ACTION: "UNAUTHORIZED_ACTION",
  INVALID_PHASE_STATE: "INVALID_PHASE_STATE",
  PHASE_ALREADY_LOCKED: "PHASE_ALREADY_LOCKED",
  UNRESOLVED_ACTIVITIES_EXIST: "UNRESOLVED_ACTIVITIES_EXIST",
  RACE_CONDITION_PREVENTED: "RACE_CONDITION_PREVENTED",
  // PRD 2
  ITEM_NOT_APPROVED: "ITEM_NOT_APPROVED",
} as const;

// ---------------------------------------------------------------------------
// PRD 2 §2 — Snapshot interface (enforced at runtime via this mapping)
// ---------------------------------------------------------------------------
interface LibrarySnapshot {
  internal_code: string;
  item_name: string;
  vendor_name: string;
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
// A. approveInternal(phaseId)
// ---------------------------------------------------------------------------
export async function approveInternal(phaseId: string) {
  return prisma.$transaction(async (tx: any) => {
    const phase = await tx.phase.findUniqueOrThrow({ where: { id: phaseId } });

    if (phase.is_locked) throw new Error(ERR.PHASE_ALREADY_LOCKED);
    if (phase.status_enum !== "IN_PROGRESS") throw new Error(ERR.INVALID_PHASE_STATE);

    const activeRevision = await getActiveRevision(tx, phaseId);
    const hasOpenActivities = activeRevision?.activities.some((a: any) => a.status === "OPEN");
    if (hasOpenActivities) throw new Error(ERR.UNRESOLVED_ACTIVITIES_EXIST);

    await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "ON_REVIEW_CLIENT" },
    });
  });
}

// ---------------------------------------------------------------------------
// B. approveClientPhase(phaseId, userId)
// ---------------------------------------------------------------------------
export async function approveClientPhase(phaseId: string, userId: string) {
  return prisma.$transaction(async (tx: any) => {
    const phase = await tx.phase.findUniqueOrThrow({
      where: { id: phaseId },
      include: { project: true },
    });

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

    if (nextPhase) {
      // 4a. Activate next phase + new revision
      await tx.phase.update({
        where: { id: nextPhase.id },
        data: { status_enum: "IN_PROGRESS" },
      });
      await tx.revision.create({
        data: {
          phase_id: nextPhase.id,
          major: 1,
          minor: 0,
          status_enum: "ACTIVE",
        },
      });
    } else {
      // 4b. No next phase → project complete
      await tx.project.update({
        where: { id: phase.project_id },
        data: { status_progress: "COMPLETED" },
      });
    }

    // Audit log (PRD 2 §3D)
    await insertAuditLog(tx, "approveClientPhase", "Phase", phaseId, userId, { phaseId });
  });
}

// ---------------------------------------------------------------------------
// C. rejectPhase(phaseId, type, userId)
// ---------------------------------------------------------------------------
export async function rejectPhase(
  phaseId: string,
  type: "INTERNAL" | "CLIENT",
  _userId: string
) {
  return prisma.$transaction(async (tx: any) => {
    const phase = await tx.phase.findUniqueOrThrow({ where: { id: phaseId } });

    if (phase.is_locked) throw new Error(ERR.PHASE_ALREADY_LOCKED);

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
  return prisma.$transaction(async (tx: any) => {
    if (userRole !== "ADMIN") throw new Error(ERR.UNAUTHORIZED_ACTION);

    const phase = await tx.phase.findUniqueOrThrow({ where: { id: phaseId } });

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
    await insertAuditLog(tx, "reopenPhase", "Phase", phaseId, userId, { phaseId });
  });
}

// ---------------------------------------------------------------------------
// E. completeSupervisionPhase(phaseId) — Phase 5 only
// ---------------------------------------------------------------------------
export async function completeSupervisionPhase(phaseId: string) {
  return prisma.$transaction(async (tx: any) => {
    const phase = await tx.phase.findUniqueOrThrow({ where: { id: phaseId } });

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
    // 1. Create Project
    const project = await tx.project.create({
      data: {
        name: data.name,
        pic_designer_id: data.pic_designer_id,
        pic_drafter_id: data.pic_drafter_id,
        opening_date: data.opening_date,
        project_type: data.project_type ?? "RETAIL",
        client_name: data.client_name,
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

    // 2 & 3 & 4. Create 5 phases — index 1 is IN_PROGRESS, rest PENDING
    const phases = [];
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
      phases.push(phase);
    }

    // 5. Create first Revision for Phase[1] (MOODBOARD)
    await tx.revision.create({
      data: {
        phase_id: phases[0].id,
        major: 1,
        minor: 0,
        status_enum: "ACTIVE",
      },
    });

    return project;
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
  return prisma.$transaction(async (tx: any) => {
    // 1. Fetch latest GlobalLibrary item
    const item = await tx.globalLibrary.findUniqueOrThrow({
      where: { id: libraryItemId },
    });

    // 2. Validate status
    if (item.status !== "APPROVED") throw new Error(ERR.ITEM_NOT_APPROVED);

    // 3. Map to LibrarySnapshot
    const snapshot: LibrarySnapshot = {
      internal_code: item.internal_code,
      item_name: item.item_name,
      vendor_name: item.vendor_name,
      price_at_snapshot: item.price,
      specs: item.specs as Record<string, string>,
      image_url: item.image_url ?? null,
      snapshot_timestamp: new Date().toISOString(),
    };

    // 4. Insert ProjectSchedule
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
      userId,
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
  return prisma.$transaction(async (tx: any) => {
    if (userRole !== "ADMIN") throw new Error(ERR.UNAUTHORIZED_ACTION);

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
    vendor_name: string;
    price: number;
    specs: Record<string, string>;
    image_url?: string;
  },
  _userId: string,
  userRole: Role
) {
  return prisma.$transaction(async (tx: any) => {
    // All roles may create; status depends on role (PRD 2 §3C)
    const allowedRoles: Role[] = ["ADMIN", "DIC", "DRIC", "STAFF"];
    if (!allowedRoles.includes(userRole)) throw new Error(ERR.UNAUTHORIZED_ACTION);

    // Status logic: ADMIN → APPROVED, others → PENDING
    const status = userRole === "ADMIN" ? "APPROVED" : "PENDING";

    return tx.globalLibrary.create({
      data: {
        category_enum: data.category_enum,
        internal_code: data.internal_code,
        item_name: data.item_name,
        vendor_name: data.vendor_name,
        price: data.price,
        specs: data.specs,
        image_url: data.image_url,
        status,
      },
    });
  });
}
