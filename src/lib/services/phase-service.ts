import { Activity, ActivityStatus, PhaseStatus, RevisionStatus, CDItemStatus, ProjectStatus } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { ERR } from "@/core/rbac/permissions";
import { insertAuditLog, getActiveRevision, normalizeDrawingCode } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit";
import { PhasePolicy } from "@/lib/domain/phase-policy";

/**
 * Functional Service Layer for Phase operations.
 * Pure business logic should reside here, detached from the Action/Web context.
 */
export const phaseService = {
  /**
   * Activates a PENDING phase, moving it to IN_PROGRESS and creating the first Revision (1.0).
   */
  async executeActivatePhase(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({
      where: { id: phaseId },
    });

    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (!PhasePolicy.isValidTransition(phase.status_enum as PhaseStatus, PhaseStatus.IN_PROGRESS)) {
      throw new ActionError(`Phase is already in ${phase.status_enum} state.`, "INVALID_STATE");
    }

    // Note: We enforce sequential phase activation per SSOT 4.1.
    if (phase.order_index > 0) {
      const prevPhase = await tx.phase.findFirst({
        where: {
          project_id: phase.project_id,
          order_index: phase.order_index - 1,
        },
      });

      if (!PhasePolicy.canActivate(phase, prevPhase || undefined)) {
        throw new ActionError(
          `Cannot activate "${phase.name_enum}". Previous phase "${prevPhase?.name_enum}" must be READY_FOR_NEXT first.`,
          "SEQUENTIAL_VIOLATION"
        );
      }
    }

    // Check if project is ACTIVE
    const project = await tx.project.findUnique({
      where: { id: phase.project_id },
      select: { status_progress: true }
    });

    if (project?.status_progress !== ProjectStatus.ACTIVE) {
      throw new ActionError("Project must be ACTIVE to activate a phase.", "PROJECT_NOT_ACTIVE");
    }

    // Update status
    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { 
        status_enum: PhaseStatus.IN_PROGRESS, 
        is_locked: false
      },
    });

    // Create initial revision
    const revision = await tx.revision.create({
      data: {
        phase_id: phaseId,
        major: 1,
        minor: 0,
        status_enum: RevisionStatus.ACTIVE,
      },
    });

    // Explicit Audit Log as requested by USER
    await insertAuditLog(tx, AUDIT_ACTIONS.ACTIVATE_PHASE, "PHASE", phaseId, userId, {
      phase_id: phaseId,
      project_id: phase.project_id,
      previous_phase_status: phase.status_enum,
      previous_is_locked: phase.is_locked,
      created_revision_id: revision.id,
    });

    return { phase: updatedPhase, revision };
  },

  /**
   * Bypasses the standard phase workflow and marks a PENDING phase as completed immediately.
   */
  async executeBypassToCompleted(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({
      where: { id: phaseId },
      include: { project: { select: { status_progress: true } } }
    });

    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.status_enum !== PhaseStatus.PENDING) {
      throw new ActionError("Phase must be PENDING to bypass.", "INVALID_STATE");
    }

    if (phase.project.status_progress !== ProjectStatus.ACTIVE) {
      throw new ActionError("Project must be ACTIVE to bypass a phase.", "PROJECT_NOT_ACTIVE");
    }

    const nextPhase = await tx.phase.findFirst({
      where: {
        project_id: phase.project_id,
        order_index: phase.order_index + 1,
      },
      select: { id: true },
    });

    const targetPhaseStatus = nextPhase ? PhaseStatus.READY_FOR_NEXT : PhaseStatus.COMPLETED;

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: {
        status_enum: targetPhaseStatus,
        is_locked: true,
      },
    });

    const revision = await tx.revision.create({
      data: {
        phase_id: phaseId,
        major: 1,
        minor: 0,
        status_enum: RevisionStatus.COMPLETED,
      },
    });

    if (!nextPhase) {
      await tx.project.update({
        where: { id: phase.project_id },
        data: { status_progress: ProjectStatus.COMPLETED },
      });
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.BYPASS_PHASE_TO_COMPLETED, "PHASE", phaseId, userId, {
      phase_id: phaseId,
      project_id: phase.project_id,
      previous_phase_status: phase.status_enum,
      resulting_phase_status: updatedPhase.status_enum,
      created_revision_id: revision.id,
      bypassed: true,
    });

    return { phase: updatedPhase, revision };
  },

  /**
   * Submits an IN_PROGRESS phase for internal review.
   */
  async executeSubmitForInternalReview(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");

    if (phase.is_locked) throw new ActionError(ERR.PHASE_ALREADY_LOCKED, "LOCKED");
    if (!PhasePolicy.isValidTransition(phase.status_enum as PhaseStatus, PhaseStatus.ON_REVIEW_INTERNAL)) {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }

    const activeRevision = await getActiveRevision(tx, phaseId, { includeActivities: true });
    if (!activeRevision) {
      throw new ActionError(
        "Phase must be activated first. No active revision found.",
        "NO_ACTIVE_REVISION"
      );
    }

    // Contextual Block: Check open activities in active revision OR tagged to this phase specifically
    const hasOpenTodosInPhase = activeRevision.activities.some(
      (a: Activity) => a.mode === "TODO" && a.status === ActivityStatus.OPEN
    ) || (await tx.activity.count({
      where: {
        project_id: phase.project_id,
        phase_id: phaseId,
        revision_id: null, // "Global" task tagged to this phase
        mode: "TODO",
        status: ActivityStatus.OPEN
      }
    }) > 0);

    if (hasOpenTodosInPhase) throw new ActionError(ERR.UNRESOLVED_ACTIVITIES_EXIST, "OPEN_TODOS");

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: PhaseStatus.ON_REVIEW_INTERNAL },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.SUBMIT_FOR_INTERNAL_REVIEW, "PHASE", phaseId, userId, {
      phase_id: phaseId,
      project_id: phase.project_id,
      previous_phase_status: phase.status_enum,
    });

    return updatedPhase;
  },

  /**
   * Rejects a phase (Internal or Client), increments revision, and moves back to IN_PROGRESS.
   */
  async executeRejectPhase(
    tx: PrismaTransaction, 
    params: { phaseId: string; type: "INTERNAL" | "CLIENT"; userId: string }
  ) {
    const { phaseId, type, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.is_locked) throw new ActionError(ERR.PHASE_ALREADY_LOCKED, "LOCKED");

    const internalReviewStates: PhaseStatus[] = [PhaseStatus.ON_REVIEW_INTERNAL, PhaseStatus.ON_REVIEW_CLIENT];
    if (type === "INTERNAL" && !internalReviewStates.includes(phase.status_enum)) {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }
    if (type === "CLIENT" && phase.status_enum !== PhaseStatus.ON_REVIEW_CLIENT) throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");

    const activeRevision = await getActiveRevision(tx, phaseId, { includeActivities: true });
    if (!activeRevision) throw new ActionError(ERR.INVALID_PHASE_STATE, "NO_ACTIVE_REVISION");

    // Close current revision
    await tx.revision.update({
      where: { id: activeRevision.id },
      data: { status_enum: RevisionStatus.COMPLETED },
    });

    // Increment revision logic
    const newMajor = type === "CLIENT" ? activeRevision.major + 1 : activeRevision.major;
    const newMinor = type === "CLIENT" ? 0 : activeRevision.minor + 1;

    const newRevision = await tx.revision.create({
      data: {
        phase_id: phaseId,
        major: newMajor,
        minor: newMinor,
        status_enum: RevisionStatus.ACTIVE,
      },
    });

    // Copy feedback to todo in new revision with assignment preservation or default to Designer (Issue #2)
    const feedbackActivities = activeRevision.activities.filter(
      (a: Activity) => a.mode === "FEEDBACK" && a.status === ActivityStatus.OPEN
    );

    if (feedbackActivities.length > 0) {
      // Get project PIC Designer for fallback
      const project = await tx.project.findUniqueOrThrow({
        where: { id: phase.project_id },
        select: { pic_designer_id: true },
      });
      const defaultAssigneeId = project.pic_designer_id;

      const createdActivities: Activity[] = [];
      for (const a of feedbackActivities) {
        const newAct = await tx.activity.create({
          data: {
            revision_id: newRevision.id,
            project_id: phase.project_id,
            content: a.content,
            mode: "TODO",
            status: ActivityStatus.OPEN,
            assigned_to_id: a.assigned_to_id || defaultAssigneeId,
            phase_id: phaseId,
          },
        });
        createdActivities.push(newAct);

        // Audit each conversion (Issue #4)
        await insertAuditLog(
          tx,
          AUDIT_ACTIONS.ACTIVITY_CONVERTED_FEEDBACK_TO_TODO,
          "Activity",
          newAct.id,
          userId,
          {
            phase_id: phaseId,
            project_id: phase.project_id,
            original_revision_id: activeRevision.id,
            new_revision_id: newRevision.id,
            original_assigned_to_id: a.assigned_to_id,
            new_assigned_to_id: newAct.assigned_to_id,
            conversion_reason: `${type}_REJECTION`,
          }
        );
      }
    }

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: PhaseStatus.IN_PROGRESS },
    });

    await insertAuditLog(
      tx,
      type === "INTERNAL" ? AUDIT_ACTIONS.REJECT_PHASE_INTERNAL : AUDIT_ACTIONS.REJECT_PHASE_CLIENT,
      "PHASE",
      phaseId,
      userId,
      {
        phase_id: phaseId,
        project_id: phase.project_id,
        previous_phase_status: phase.status_enum,
        previous_revision_id: activeRevision.id,
        previous_revision_status: activeRevision.status_enum,
        new_revision_id: newRevision.id,
      }
    );

    return { phase: updatedPhase, revision: newRevision };
  },

  /**
   * Admin Revision Override with 2 modes:
   * 1. HARD_RESET_ACTIVE: Wipe all and recreate active revision with chosen version number.
   * 2. HARD_RESET_PENDING: Wipe all and revert to Pending.
   */
  async executeOverrideRevision(tx: PrismaTransaction, params: {
    phaseId: string;
    targetMajorVersion?: number;
    targetMinorVersion?: number;
    note: string;
    userId: string;
    mode: "HARD_RESET_ACTIVE" | "HARD_RESET_PENDING";
  }) {
    const { phaseId, targetMajorVersion, targetMinorVersion, note, userId, mode } = params;

    const phase = await tx.phase.findUniqueOrThrow({
      where: { id: phaseId },
      include: {
        revisions: {
          include: {
            activities: true,
            files: true,
          },
          orderBy: [{ major: "desc" }, { minor: "desc" }],
        },
      },
    });

    const activeRevision = phase.revisions.find((r) => r.status_enum === RevisionStatus.ACTIVE);

    // Snapshot history for Audit Log traceability before wiping
    const historySnapshot = phase.revisions.map((rev) => ({
      version: `v${rev.major}.${rev.minor}`,
      status: rev.status_enum,
      created_at: rev.created_at,
      activities: rev.activities.map((a) => ({
        content: a.content,
        mode: a.mode,
        status: a.status,
      })),
      files: rev.files.map((f) => ({
        name: f.file_name,
        type: f.file_type,
        url: f.file_url,
        link: f.link_url,
        external: f.is_external,
      })),
    }));

    // Delete ALL previous revisions for this phase (history wipe)
    await tx.revision.deleteMany({
      where: { phase_id: phaseId },
    });

    let newRevisionId = null;

    if (mode === "HARD_RESET_ACTIVE") {
      if (targetMajorVersion === undefined || targetMinorVersion === undefined) {
        throw new ActionError("Target versions are required for ACTIVE reset.", "VALIDATION_ERROR");
      }
      const newRevision = await tx.revision.create({
        data: {
          phase_id: phaseId,
          major: targetMajorVersion,
          minor: targetMinorVersion,
          status_enum: RevisionStatus.ACTIVE,
        },
      });
      newRevisionId = newRevision.id;

      await tx.phase.update({
        where: { id: phaseId },
        data: { status_enum: PhaseStatus.IN_PROGRESS, is_locked: false },
      });
    } else {
      // HARD_RESET_PENDING
      await tx.phase.update({
        where: { id: phaseId },
        data: { status_enum: PhaseStatus.PENDING, is_locked: false },
      });
    }

    const targetPhaseStatus =
      mode === "HARD_RESET_PENDING" ? PhaseStatus.PENDING : PhaseStatus.IN_PROGRESS;

    await insertAuditLog(tx, AUDIT_ACTIONS.REVISION_OVERRIDE_ADMIN, "REVISION", newRevisionId || phaseId, userId, {
      phase_id: phaseId,
      project_id: phase.project_id,
      mode,
      previous_revision_id: activeRevision?.id ?? null,
      previous_phase_status: phase.status_enum,
      target_version: mode === "HARD_RESET_ACTIVE" ? `v${targetMajorVersion}.${targetMinorVersion}` : "N/A (Pending)",
      resulting_phase_status: targetPhaseStatus,
      admin_note: note,
      history_snapshot: historySnapshot,
    });

    return { success: true };
  },

  /**
   * Toggles a checklist item status.
   */
  async executeToggleChecklist(tx: PrismaTransaction, params: { checklistId: string; isChecked: boolean; userId: string }) {
    const { checklistId, isChecked, userId } = params;

    const updated = await tx.projectChecklist.update({
      where: { id: checklistId },
      data: { is_checked: isChecked },
      include: {
        phase: { select: { project_id: true } }
      }
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.TOGGLE_CHECKLIST, "ProjectChecklist", checklistId, userId, { 
      project_id: updated.project_id,
      phase_id: updated.phase_id,
      isChecked 
    });

    return updated;
  },

  /**
   * Adds a new checklist item to a phase.
   */
  async executeAddChecklistItem(tx: PrismaTransaction, params: { phaseId: string; label: string; userId: string }) {
    const { phaseId, label, userId } = params;

    const phase = await tx.phase.findUnique({
      where: { id: phaseId },
      include: {
        project: {
          select: { id: true },
        },
      },
    });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.status_enum !== PhaseStatus.IN_PROGRESS) throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");

    const newItem = await tx.projectChecklist.create({
      data: {
        project_id: phase.project_id,
        phase_id: phaseId,
        label: label.trim(),
        is_checked: false,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.ADD_CHECKLIST_ITEM, "ProjectChecklist", newItem.id, userId, { 
      project_id: phase.project_id,
      phase_id: phaseId,
      label 
    });

    return newItem;
  },

  async executeApproveInternal(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.is_locked) throw new ActionError(ERR.PHASE_ALREADY_LOCKED, "LOCKED");

    if (phase.status_enum !== PhaseStatus.ON_REVIEW_INTERNAL) {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }

    const activeRevision = await getActiveRevision(tx, phaseId, { includeActivities: true });
    const hasOpenActivities = activeRevision?.activities.some(
      (activity: Activity) => activity.status === ActivityStatus.OPEN
    );
    if (hasOpenActivities) {
      throw new ActionError(ERR.UNRESOLVED_ACTIVITIES_EXIST, "OPEN_ACTIVITIES");
    }

    const nextStatus = PhaseStatus.APPROVED_INTERNAL;

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: nextStatus },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.APPROVE_INTERNAL, "PHASE", phaseId, userId, {
      phase_id: phaseId,
      project_id: phase.project_id,
      previous_phase_status: phase.status_enum,
      resulting_phase_status: updatedPhase.status_enum,
    });

    return updatedPhase;
  },

  async executeSubmitForClientReview(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.is_locked) throw new ActionError(ERR.PHASE_ALREADY_LOCKED, "LOCKED");

    const allowedSubmitStates: PhaseStatus[] = [PhaseStatus.IN_PROGRESS, PhaseStatus.ON_REVIEW_INTERNAL, PhaseStatus.APPROVED_INTERNAL];
    if (!allowedSubmitStates.includes(phase.status_enum)) {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: PhaseStatus.ON_REVIEW_CLIENT },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.SUBMIT_FOR_CLIENT_REVIEW, "PHASE", phaseId, userId, {
      phase_id: phaseId,
      project_id: phase.project_id,
      previous_phase_status: phase.status_enum,
    });

    return updatedPhase;
  },

  async executeApproveClientPhase(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.is_locked) throw new ActionError(ERR.PHASE_ALREADY_LOCKED, "LOCKED");
    if (phase.status_enum !== PhaseStatus.ON_REVIEW_CLIENT) {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }

    const activeRevision = await getActiveRevision(tx, phaseId, { includeActivities: true });
    const hasOpenActivities = activeRevision?.activities.some(
      (activity: Activity) => activity.status === ActivityStatus.OPEN
    );
    if (hasOpenActivities) {
      throw new ActionError(ERR.UNRESOLVED_ACTIVITIES_EXIST, "OPEN_ACTIVITIES");
    }

    const project = await tx.project.findUniqueOrThrow({
      where: { id: phase.project_id },
      select: { status_progress: true },
    });

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: PhaseStatus.READY_FOR_NEXT, is_locked: true },
    });

    if (activeRevision) {
      await tx.revision.update({
        where: { id: activeRevision.id },
        data: { status_enum: RevisionStatus.COMPLETED },
      });
    }

    const nextPhase = await tx.phase.findFirst({
      where: {
        project_id: phase.project_id,
        order_index: phase.order_index + 1,
      },
      select: { id: true },
    });

    if (!nextPhase) {
      await tx.project.update({
        where: { id: phase.project_id },
        data: { status_progress: "COMPLETED" },
      });
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.APPROVE_CLIENT_PHASE, "PHASE", phaseId, userId, {
      phase_id: phaseId,
      project_id: phase.project_id,
      previous_phase_status: phase.status_enum,
      previous_is_locked: phase.is_locked,
      previous_revision_id: activeRevision?.id ?? null,
      previous_revision_status: activeRevision?.status_enum ?? null,
      previous_project_status: project.status_progress,
    });

    return updatedPhase;
  },

  async executeReopenPhase(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (!phase.is_locked && phase.status_enum !== PhaseStatus.PENDING) {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { is_locked: false, status_enum: PhaseStatus.IN_PROGRESS },
    });

    const activeRevision = await getActiveRevision(tx, phaseId, { includeActivities: true });
    let revision;

    if (activeRevision) {
      await tx.revision.update({
        where: { id: activeRevision.id },
        data: { status_enum: RevisionStatus.COMPLETED },
      });

      revision = await tx.revision.create({
        data: {
          phase_id: phaseId,
          major: activeRevision.major + 1,
          minor: 0,
          status_enum: RevisionStatus.ACTIVE,
        },
      });
    } else {
      const latestRevision = await tx.revision.findFirst({
        where: { phase_id: phaseId },
        orderBy: [{ major: "desc" }, { minor: "desc" }],
      });

      revision = await tx.revision.create({
        data: {
          phase_id: phaseId,
          major: (latestRevision?.major ?? 0) + 1,
          minor: 0,
          status_enum: RevisionStatus.ACTIVE,
        },
      });
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.REOPEN_PHASE, "PHASE", phaseId, userId, {
      phase_id: phaseId,
      project_id: phase.project_id,
      previous_phase_status: phase.status_enum,
      previous_is_locked: phase.is_locked,
      previous_revision_id: activeRevision?.id ?? null,
      previous_revision_status: activeRevision?.status_enum ?? null,
      created_revision_id: revision.id,
    });

    return { phase: updatedPhase, revision };
  },

  async executeCompleteSupervisionPhase(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.name_enum !== "SUPERVISION" || phase.status_enum !== PhaseStatus.IN_PROGRESS) {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }

    const project = await tx.project.findUniqueOrThrow({
      where: { id: phase.project_id },
      select: { status_progress: true },
    });

    const activeRevision = await getActiveRevision(tx, phaseId);

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: PhaseStatus.COMPLETED, is_locked: true },
    });

    await tx.project.update({
      where: { id: phase.project_id },
      data: { status_progress: "COMPLETED" },
    });

    if (activeRevision) {
      await tx.revision.update({
        where: { id: activeRevision.id },
        data: { status_enum: RevisionStatus.COMPLETED },
      });
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.COMPLETE_SUPERVISION_PHASE, "PHASE", phaseId, userId, {
      phase_id: phaseId,
      project_id: phase.project_id,
      previous_phase_status: phase.status_enum,
      previous_is_locked: phase.is_locked,
      previous_project_status: project.status_progress,
      previous_revision_id: activeRevision?.id ?? null,
      previous_revision_status: activeRevision?.status_enum ?? null,
    });

    return updatedPhase;
  },

  async executeCreateCDItem(
    tx: PrismaTransaction,
    params: { phaseId: string; groupCode: string; drawingName: string; assignedToId?: string; userId: string }
  ) {
    const normalizedName = params.drawingName.trim();
    if (!normalizedName) throw new ActionError("INVALID_INPUT", "DRAWING_NAME_REQUIRED");

    const phase = await tx.phase.findUniqueOrThrow({
      where: { id: params.phaseId },
      select: { project_id: true },
    });

    const newItem = await tx.cDList.create({
      data: {
        phase_id: params.phaseId,
        group_code: normalizeDrawingCode(params.groupCode),
        drawing_name: normalizedName,
        assigned_to_id: params.assignedToId,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.CREATE_CD_ITEM, "CDList", newItem.id, params.userId, {
      project_id: phase.project_id,
      phase_id: params.phaseId,
      group_code: newItem.group_code,
      drawing_name: newItem.drawing_name,
    });

    return newItem;
  },

  async executeUpdateCDItem(
    tx: PrismaTransaction,
    params: { itemId: string; groupCode: string; drawingName: string; userId: string }
  ) {
    const normalizedName = params.drawingName.trim();
    if (!normalizedName) throw new ActionError("INVALID_INPUT", "DRAWING_NAME_REQUIRED");

    const updatedItem = await tx.cDList.update({
      where: { id: params.itemId },
      data: {
        group_code: normalizeDrawingCode(params.groupCode),
        drawing_name: normalizedName,
      },
      include: {
        phase: { select: { project_id: true } }
      }
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_CD_ITEM, "CDList", params.itemId, params.userId, {
      project_id: updatedItem.phase.project_id,
      phase_id: updatedItem.phase_id,
      group_code: updatedItem.group_code,
      drawing_name: updatedItem.drawing_name,
    });

    return updatedItem;
  },

  async executeUpdateCDStatus(
    tx: PrismaTransaction,
    params: { itemId: string; status: CDItemStatus; userId: string }
  ) {
    const updatedItem = await tx.cDList.update({
      where: { id: params.itemId },
      data: { status_enum: params.status },
      include: {
        phase: { select: { project_id: true } }
      }
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_CD_STATUS, "CDList", params.itemId, params.userId, {
      project_id: updatedItem.phase.project_id,
      phase_id: updatedItem.phase_id,
      status: params.status,
    });

    return updatedItem;
  },

  async executeDeleteCDItem(tx: PrismaTransaction, params: { itemId: string; userId: string }) {
    const item = await tx.cDList.findUniqueOrThrow({
      where: { id: params.itemId },
      include: { phase: { select: { project_id: true } } },
    });

    const deleted = await tx.cDList.delete({
      where: { id: params.itemId },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.DELETE_CD_ITEM, "CDList", params.itemId, params.userId, {
      project_id: item.phase.project_id,
      phase_id: item.phase_id,
      drawing_name: item.drawing_name,
    });

    return deleted;
  },

  async executeAddActivity(
    tx: PrismaTransaction,
    params: { revisionId: string; content: string; mode: "TODO" | "FEEDBACK"; userId: string }
  ) {
    const normalizedContent = params.content.trim();
    if (!normalizedContent) throw new ActionError("INVALID_INPUT", "CONTENT_REQUIRED");

    const revision = await tx.revision.findUnique({
      where: { id: params.revisionId },
      include: { phase: { select: { id: true, project_id: true } } },
    });

    if (!revision) throw new ActionError("Revision not found", "NOT_FOUND");
    
    const isTodo = params.mode === "TODO";
    const isActive = revision.status_enum === RevisionStatus.ACTIVE;

    if (isTodo && !isActive) {
      throw new ActionError("Tidak bisa menambahkan TODO ke revision yang tidak aktif.", "INVALID_STATE");
    }
    
    // For FEEDBACK, we allow it even if status is not ACTIVE (e.g. while in review)
    // as per Agile Creation SSOT 4.2

    const newActivity = await tx.activity.create({
      data: {
        revision_id: params.revisionId,
        project_id: revision.phase.project_id,
        content: normalizedContent,
        mode: params.mode,
        status: ActivityStatus.OPEN,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.ADD_ACTIVITY, "Activity", newActivity.id, params.userId, {
      project_id: revision.phase.project_id,
      phase_id: revision.phase.id,
      revision_id: params.revisionId,
      content: normalizedContent,
      mode: params.mode,
    });

    return newActivity;
  },

  async executeUpdateActivityContent(
    tx: PrismaTransaction,
    params: { activityId: string; content: string; userId: string }
  ) {
    const normalizedContent = params.content.trim();
    if (!normalizedContent) throw new ActionError("INVALID_INPUT", "CONTENT_REQUIRED");

    const updatedActivity = await tx.activity.update({
      where: { id: params.activityId },
      data: { content: normalizedContent },
      include: {
        revision: {
          include: {
            phase: { select: { id: true, project_id: true } }
          }
        }
      }
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_ACTIVITY_CONTENT, "Activity", params.activityId, params.userId, {
      project_id: updatedActivity.project_id || updatedActivity.revision?.phase.project_id,
      phase_id: updatedActivity.revision?.phase.id,
      revision_id: updatedActivity.revision_id,
      content: normalizedContent,
    });


    return updatedActivity;
  },

  async executeToggleActivityStatus(tx: PrismaTransaction, params: { activityId: string; userId: string }) {
    const activity = await tx.activity.findUnique({
      where: { id: params.activityId },
      include: {
        revision: {
          include: { phase: { select: { id: true, project_id: true } } }
        }
      }
    });

    if (!activity) throw new ActionError("Activity not found", "NOT_FOUND");

    const newStatus = activity.status === ActivityStatus.OPEN ? ActivityStatus.COMPLETED : ActivityStatus.OPEN;

    const updated = await tx.activity.update({
      where: { id: params.activityId },
      data: { status: newStatus },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.TOGGLE_ACTIVITY_STATUS, "Activity", params.activityId, params.userId, {
      project_id: activity.project_id || activity.revision?.phase.project_id,
      phase_id: activity.revision?.phase.id,
      previous_status: activity.status,
      new_status: newStatus,
    });


    return updated;
  },

  async executeDeleteActivity(tx: PrismaTransaction, params: { activityId: string; userId: string }) {
    const activity = await tx.activity.findUniqueOrThrow({
      where: { id: params.activityId },
      include: {
        revision: {
          include: { phase: { select: { id: true, project_id: true } } }
        }
      }
    });

    const deleted = await tx.activity.delete({
      where: { id: params.activityId },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.DELETE_ACTIVITY, "Activity", params.activityId, params.userId, {
      project_id: activity.project_id || activity.revision?.phase.project_id,
      phase_id: activity.revision?.phase.id,
      content: activity.content,
    });


    return deleted;
  },

  async executeAddDeliverable(
    tx: PrismaTransaction,
    params: {
      revisionId: string;
      fileName: string;
      fileType: string;
      fileUrl?: string;
      linkUrl?: string;
      isExternal: boolean;
      uploadedBy: string;
    }
  ) {
    const revision = await tx.revision.findUniqueOrThrow({
      where: { id: params.revisionId },
      include: { phase: { select: { id: true, project_id: true } } },
    });

    const newFile = await tx.file.create({
      data: {
        revision_id: params.revisionId,
        file_name: params.fileName,
        file_type: params.fileType,
        file_url: params.fileUrl ?? "",
        link_url: params.linkUrl,
        is_external: params.isExternal,
        uploaded_by: params.uploadedBy,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.ADD_DELIVERABLE, "File", newFile.id, params.uploadedBy, {
      project_id: revision.phase.project_id,
      phase_id: revision.phase.id,
      file_name: params.fileName,
    });

    return newFile;
  },

  async executeDeferActivity(tx: PrismaTransaction, params: { activityId: string; userId: string }) {
    const { activityId, userId } = params;

    const activity = await tx.activity.findUniqueOrThrow({
      where: { id: activityId },
      include: { 
        revision: { 
          include: { phase: { select: { id: true, name_enum: true, project_id: true } } } 
        } 
      }
    });

    if (activity.mode === "FEEDBACK") {
      throw new ActionError("Cannot defer feedback activities. They must be addressed in the current phase.", "DEFER_BLOCKED_BY_TYPE");
    }

    if (!activity.revision) {
      throw new ActionError("Activity is already a project-level task.", "ALREADY_DEFERRED");
    }

    const { phase } = activity.revision;
    const versionStr = `v${activity.revision.major}.${activity.revision.minor}`;

    const updated = await tx.activity.update({
      where: { id: activityId },
      data: {
        revision_id: null, // Unlink from revision
        phase_id: phase.id,
        deferred_from_version: versionStr
      }
    });

    await insertAuditLog(tx, "DEFER_ACTIVITY", "Activity", activityId, userId, {
      project_id: phase.project_id,
      phase_id: phase.id,
      activity_mode: activity.mode,
      deferred_from: `${phase.name_enum} (${versionStr})`
    });

    return updated;
  },
};
