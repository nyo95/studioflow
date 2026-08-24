import { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { PhaseStatus, RevisionStatus, Role } from "@/generated/prisma";
import { isAdminLevel } from "@/core/rbac/rbac";
import { AUDIT_ACTIONS } from "./types";
import { buildAuditDetails, recordAudit } from "./record";
import { findAuditLogByIdCompat } from "./compat";

/**
 * Recovers the phase's PREVIOUS status timestamp from an audit log's details.
 *
 * Undo restores a phase to an earlier status, so it must also restore when the
 * phase entered that status. Stamping `new Date()` here would be a lie with
 * teeth: a phase that has been sitting with the client for two weeks would,
 * after an unrelated undo, report "waiting 0 days" and drop off every stalled-
 * work view — the exact signal src/lib/domain/phase-presenter.ts exists to give.
 *
 * Returns null when the log predates migration 20260803120000 (older rows carry
 * no `previous_status_changed_at`). Null is the honest answer — "we do not know"
 * — and the presenter renders no duration for it.
 */
function restoredStatusChangedAt(details: Record<string, unknown>): Date | null {
  const raw = details.previous_status_changed_at;
  if (typeof raw !== "string" && !(raw instanceof Date)) return null;
  const parsed = raw instanceof Date ? raw : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function executeUndoPhaseTrigger(tx: PrismaTransaction, params: { logId: string; userId: string }) {
  const { logId, userId } = params;

  const log = await findAuditLogByIdCompat(logId, tx);
  if (!log) {
    throw new ActionError("Audit log not found.", "NOT_FOUND");
  }

  if (log.reverted_at) {
    throw new ActionError("This action has already been reverted.", "ALREADY_REVERTED");
  }

  const details = buildAuditDetails(log);

  switch (log.action) {
    case AUDIT_ACTIONS.ACTIVATE_PHASE: {
      const createdRevisionId = String(details.created_revision_id ?? "");
      await tx.phase.update({
        where: { id: log.entity_id },
        data: {
          status_enum: (details.previous_phase_status as PhaseStatus) ?? PhaseStatus.PENDING,
          is_locked: Boolean(details.previous_is_locked ?? false),
          status_changed_at: restoredStatusChangedAt(details),
        },
      });
      if (createdRevisionId) {
        await tx.revision.deleteMany({ where: { id: createdRevisionId } });
      }
      break;
    }

    case AUDIT_ACTIONS.SUBMIT_FOR_INTERNAL_REVIEW:
    case AUDIT_ACTIONS.APPROVE_INTERNAL:
    case AUDIT_ACTIONS.SUBMIT_FOR_CLIENT_REVIEW: {
      await tx.phase.update({
        where: { id: log.entity_id },
        data: {
          status_enum: (details.previous_phase_status as PhaseStatus) ?? PhaseStatus.IN_PROGRESS,
          status_changed_at: restoredStatusChangedAt(details),
        },
      });
      break;
    }

    case AUDIT_ACTIONS.APPROVE_CLIENT_PHASE: {
      const previousRevisionId = String(details.previous_revision_id ?? "");
      await tx.phase.update({
        where: { id: log.entity_id },
        data: {
          status_enum: (details.previous_phase_status as PhaseStatus) ?? PhaseStatus.ON_REVIEW_CLIENT,
          is_locked: Boolean(details.previous_is_locked ?? false),
          status_changed_at: restoredStatusChangedAt(details),
        },
      });
      await tx.project.update({
        where: { id: String(details.project_id) },
        data: { status_progress: String(details.previous_project_status ?? "ACTIVE") as "ACTIVE" | "COMPLETED" | "ON_HOLD" },
      });
      if (previousRevisionId) {
        await tx.revision.update({
          where: { id: previousRevisionId },
          data: { status_enum: (details.previous_revision_status as RevisionStatus) ?? RevisionStatus.ACTIVE },
        });
      }
      break;
    }

    case AUDIT_ACTIONS.REJECT_PHASE_INTERNAL:
    case AUDIT_ACTIONS.REJECT_PHASE_CLIENT: {
      const previousRevisionId = String(details.previous_revision_id ?? "");
      const newRevisionId = String(details.new_revision_id ?? "");

      await tx.phase.update({
        where: { id: log.entity_id },
        data: {
          status_enum: (details.previous_phase_status as PhaseStatus) ?? PhaseStatus.ON_REVIEW_INTERNAL,
          status_changed_at: restoredStatusChangedAt(details),
        },
      });

      if (newRevisionId) {
        await tx.revision.updateMany({
          where: { id: newRevisionId },
          data: { status_enum: "COMPLETED" },
        });
      }

      if (previousRevisionId) {
        await tx.revision.update({
          where: { id: previousRevisionId },
          data: { status_enum: (details.previous_revision_status as RevisionStatus) ?? RevisionStatus.ACTIVE },
        });
      }
      break;
    }

    case AUDIT_ACTIONS.REOPEN_PHASE: {
      const createdRevisionId = String(details.created_revision_id ?? "");
      const previousRevisionId = String(details.previous_revision_id ?? "");

      await tx.phase.update({
        where: { id: log.entity_id },
        data: {
          status_enum: (details.previous_phase_status as PhaseStatus) ?? PhaseStatus.READY_FOR_NEXT,
          is_locked: Boolean(details.previous_is_locked ?? true),
          status_changed_at: restoredStatusChangedAt(details),
        },
      });

      if (createdRevisionId) {
        await tx.activity.deleteMany({ where: { revision_id: createdRevisionId } });
        await tx.file.deleteMany({ where: { revision_id: createdRevisionId } });
        await tx.revision.deleteMany({ where: { id: createdRevisionId } });
      }

      if (previousRevisionId) {
        await tx.revision.update({
          where: { id: previousRevisionId },
          data: { status_enum: (details.previous_revision_status as RevisionStatus) ?? RevisionStatus.ACTIVE },
        });
      }
      break;
    }

    case AUDIT_ACTIONS.COMPLETE_SUPERVISION_PHASE: {
      const previousRevisionId = String(details.previous_revision_id ?? "");

      await tx.phase.update({
        where: { id: log.entity_id },
        data: {
          status_enum: (details.previous_phase_status as PhaseStatus) ?? PhaseStatus.IN_PROGRESS,
          is_locked: Boolean(details.previous_is_locked ?? false),
          status_changed_at: restoredStatusChangedAt(details),
        },
      });

      await tx.project.update({
        where: { id: String(details.project_id) },
        data: {
          status_progress: String(details.previous_project_status ?? "ACTIVE") as "ACTIVE" | "COMPLETED" | "ON_HOLD",
        },
      });

      if (previousRevisionId) {
        await tx.revision.update({
          where: { id: previousRevisionId },
          data: { status_enum: (details.previous_revision_status as RevisionStatus) ?? RevisionStatus.ACTIVE },
        });
      }
      break;
    }

    case AUDIT_ACTIONS.PROJECT_COMPLETED_MANUAL: {
      await tx.project.update({
        where: { id: log.entity_id },
        data: {
          status_progress: String(details.previous_status ?? "ACTIVE") as "ACTIVE" | "COMPLETED" | "ON_HOLD",
        },
      });
      break;
    }

    case AUDIT_ACTIONS.REVISION_OVERRIDE_ADMIN: {
      const previousRevisionId = String(details.previous_revision_id ?? "");
      const newRevisionId = log.entity_id;
      const phaseId = String(details.phase_id ?? "");

      if (newRevisionId) {
        await tx.activity.deleteMany({ where: { revision_id: newRevisionId } });
        await tx.file.deleteMany({ where: { revision_id: newRevisionId } });
        await tx.revision.deleteMany({ where: { id: newRevisionId } });
      }

      if (previousRevisionId) {
        await tx.revision.update({
          where: { id: previousRevisionId },
          data: { status_enum: (details.previous_revision_status as RevisionStatus) ?? RevisionStatus.ACTIVE },
        });
      }

      if (phaseId) {
        await tx.phase.update({
          where: { id: phaseId },
          data: {
            status_enum: (details.previous_phase_status as PhaseStatus) ?? PhaseStatus.IN_PROGRESS,
            is_locked: Boolean(details.previous_is_locked ?? false),
            status_changed_at: restoredStatusChangedAt(details),
          },
        });
      }
      break;
    }

    case AUDIT_ACTIONS.BYPASS_PHASE_TO_COMPLETED: {
      const createdRevisionId = String(details.created_revision_id ?? "");

      await tx.phase.update({
        where: { id: log.entity_id },
        data: {
          status_enum: (details.previous_phase_status as PhaseStatus) ?? PhaseStatus.PENDING,
          is_locked: false,
          status_changed_at: restoredStatusChangedAt(details),
        },
      });

      await tx.project.update({
        where: { id: String(details.project_id) },
        data: { status_progress: "ACTIVE" },
      });

      if (createdRevisionId) {
        await tx.revision.deleteMany({ where: { id: createdRevisionId } });
      }
      break;
    }

    default:
      throw new ActionError(`Undo for '${log.action}' is not supported yet.`, "UNDO_NOT_SUPPORTED");
  }

  await tx.auditLog.update({
    where: { id: logId },
    data: { reverted_at: new Date() },
  });

  await recordAudit(tx, {
    domain: "STUDIOFLOW",
    action: AUDIT_ACTIONS.UNDO_TRIGGER,
    entityType: "AUDIT_LOG",
    entityId: logId,
    userId,
    actorId: userId,
    metadata: {
      reverted_action: log.action,
      reverted_log_id: logId,
    },
  });

  return { success: true };
}

export function canUndoAuditLog(action: string, role: Role) {
  if (!isAdminLevel(role) && role !== "DIC") {
    return false;
  }

  const undoable = new Set<string>([
    AUDIT_ACTIONS.ACTIVATE_PHASE,
    AUDIT_ACTIONS.SUBMIT_FOR_INTERNAL_REVIEW,
    AUDIT_ACTIONS.APPROVE_INTERNAL,
    AUDIT_ACTIONS.SUBMIT_FOR_CLIENT_REVIEW,
    AUDIT_ACTIONS.APPROVE_CLIENT_PHASE,
    AUDIT_ACTIONS.REJECT_PHASE_INTERNAL,
    AUDIT_ACTIONS.REJECT_PHASE_CLIENT,
    AUDIT_ACTIONS.REOPEN_PHASE,
    AUDIT_ACTIONS.COMPLETE_SUPERVISION_PHASE,
    AUDIT_ACTIONS.PROJECT_COMPLETED_MANUAL,
    AUDIT_ACTIONS.REVISION_OVERRIDE_ADMIN,
    AUDIT_ACTIONS.BYPASS_PHASE_TO_COMPLETED,
  ]);

  return undoable.has(action);
}
