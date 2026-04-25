import { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { insertAuditLog } from "@/actions/_shared";
import { PhaseStatus, RevisionStatus, Role } from "@/generated/prisma";
import { AUDIT_ACTIONS } from "./types";

export async function executeUndoPhaseTrigger(tx: PrismaTransaction, params: { logId: string; userId: string }) {
  const { logId, userId } = params;

  const log = await tx.auditLog.findUniqueOrThrow({
    where: { id: logId },
  });

  if (log.reverted_at) {
    throw new ActionError("This action has already been reverted.", "ALREADY_REVERTED");
  }

  const details = (log.details ?? {}) as Record<string, unknown>;

  switch (log.action) {
    case AUDIT_ACTIONS.ACTIVATE_PHASE: {
      const createdRevisionId = String(details.created_revision_id ?? "");
      await tx.phase.update({
        where: { id: log.entity_id },
        data: {
          status_enum: (details.previous_phase_status as PhaseStatus) ?? PhaseStatus.PENDING,
          is_locked: Boolean(details.previous_is_locked ?? false),
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
        data: { status_enum: (details.previous_phase_status as PhaseStatus) ?? PhaseStatus.IN_PROGRESS },
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
        data: { status_enum: (details.previous_phase_status as PhaseStatus) ?? PhaseStatus.ON_REVIEW_INTERNAL },
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

  await insertAuditLog(tx, AUDIT_ACTIONS.UNDO_TRIGGER, "AUDIT_LOG", logId, userId, {
    reverted_action: log.action,
    reverted_log_id: logId,
  });

  return { success: true };
}

export function canUndoAuditLog(action: string, role: Role) {
  if (role !== "ADMIN" && role !== "DIC") {
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
