import { Activity } from "@/generated/prisma";
import { PrismaTransaction } from "@/lib/action-wrapper";
import { ActionError } from "@/lib/result";
import { ERR } from "@/lib/permissions";
import { insertAuditLog, getActiveRevision, normalizeDrawingCode } from "@/actions/_shared";

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
    if (phase.status_enum !== "PENDING") {
      throw new ActionError("Phase is already active or completed.", "INVALID_STATE");
    }

    // Check order index constraint
    if (phase.order_index > 1) {
      const prevPhase = await tx.phase.findFirst({
        where: { 
          project_id: phase.project_id, 
          order_index: phase.order_index - 1 
        },
        select: { status_enum: true }
      });
      if (prevPhase && prevPhase.status_enum !== "READY_FOR_NEXT" && prevPhase.status_enum !== "COMPLETED") {
        throw new ActionError("Fase sebelumnya harus diselesaikan terlebih dahulu.", "PREV_PHASE_NOT_DONE");
      }
    }

    // Update status
    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { 
        status_enum: "IN_PROGRESS", 
        is_locked: false
      },
    });

    // Create initial revision
    const revision = await tx.revision.create({
      data: {
        phase_id: phaseId,
        major: 1,
        minor: 0,
        status_enum: "ACTIVE",
      },
    });

    // Explicit Audit Log as requested by USER
    await insertAuditLog(tx, "activatePhase", "Phase", phaseId, userId, { phaseId });

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
    if (phase.status_enum !== "IN_PROGRESS") throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");

    const activeRevision = await getActiveRevision(tx, phaseId);
    const hasOpenTodos = activeRevision?.activities.some(
      (a: Activity) => a.mode === "TODO" && a.status === "OPEN"
    );
    if (hasOpenTodos) throw new ActionError(ERR.UNRESOLVED_ACTIVITIES_EXIST, "OPEN_TODOS");

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "ON_REVIEW_INTERNAL" },
    });

    await insertAuditLog(tx, "submitForInternalReview", "Phase", phaseId, userId, { phaseId });

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

    if (type === "INTERNAL" && phase.status_enum !== "ON_REVIEW_INTERNAL") throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    if (type === "CLIENT" && phase.status_enum !== "ON_REVIEW_CLIENT") throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");

    const activeRevision = await getActiveRevision(tx, phaseId);
    if (!activeRevision) throw new ActionError(ERR.INVALID_PHASE_STATE, "NO_ACTIVE_REVISION");

    // Close current revision
    await tx.revision.update({
      where: { id: activeRevision.id },
      data: { status_enum: "COMPLETED" },
    });

    // Increment revision logic
    const newMajor = type === "CLIENT" ? activeRevision.major + 1 : activeRevision.major;
    const newMinor = type === "CLIENT" ? 0 : activeRevision.minor + 1;

    const newRevision = await tx.revision.create({
      data: {
        phase_id: phaseId,
        major: newMajor,
        minor: newMinor,
        status_enum: "ACTIVE",
      },
    });

    // Copy feedback to todo in new revision
    const feedbackActivities = activeRevision.activities.filter(
      (a: Activity) => a.mode === "FEEDBACK" && a.status === "OPEN"
    );
    if (feedbackActivities.length > 0) {
      await tx.activity.createMany({
        data: feedbackActivities.map((a: Activity) => ({
          revision_id: newRevision.id,
          content: a.content,
          mode: "TODO",
          status: "OPEN",
        })),
      });
    }

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "IN_PROGRESS" },
    });

    await insertAuditLog(tx, `rejectPhase_${type}`, "Phase", phaseId, userId, { phaseId, type });

    return { phase: updatedPhase, revision: newRevision };
  },

  /**
   * Toggles a checklist item status.
   */
  async executeToggleChecklist(tx: PrismaTransaction, params: { checklistId: string; isChecked: boolean; userId: string }) {
    const { checklistId, isChecked, userId } = params;

    const updated = await tx.projectChecklist.update({
      where: { id: checklistId },
      data: { is_checked: isChecked },
    });

    await insertAuditLog(tx, "toggleChecklist", "ProjectChecklist", checklistId, userId, { isChecked });

    return updated;
  },

  /**
   * Adds a new checklist item to a phase.
   */
  async executeAddChecklistItem(tx: PrismaTransaction, params: { phaseId: string; label: string; userId: string }) {
    const { phaseId, label, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.status_enum !== "IN_PROGRESS") throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");

    const newItem = await tx.projectChecklist.create({
      data: {
        project_id: phase.project_id,
        phase_id: phaseId,
        label: label.trim(),
        is_checked: false,
      },
    });

    await insertAuditLog(tx, "addChecklistItem", "ProjectChecklist", newItem.id, userId, { label });

    return newItem;
  },

  async executeApproveInternal(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.is_locked) throw new ActionError(ERR.PHASE_ALREADY_LOCKED, "LOCKED");
    if (phase.status_enum !== "ON_REVIEW_INTERNAL") {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }

    const activeRevision = await getActiveRevision(tx, phaseId);
    const hasOpenActivities = activeRevision?.activities.some(
      (activity: Activity) => activity.status === "OPEN"
    );
    if (hasOpenActivities) {
      throw new ActionError(ERR.UNRESOLVED_ACTIVITIES_EXIST, "OPEN_ACTIVITIES");
    }

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "APPROVED_INTERNAL" },
    });

    await insertAuditLog(tx, "approveInternal", "Phase", phaseId, userId, { phaseId });

    return updatedPhase;
  },

  async executeSubmitForClientReview(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.is_locked) throw new ActionError(ERR.PHASE_ALREADY_LOCKED, "LOCKED");
    if (phase.status_enum !== "APPROVED_INTERNAL") {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "ON_REVIEW_CLIENT" },
    });

    await insertAuditLog(tx, "submitForClientReview", "Phase", phaseId, userId, { phaseId });

    return updatedPhase;
  },

  async executeApproveClientPhase(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.is_locked) throw new ActionError(ERR.PHASE_ALREADY_LOCKED, "LOCKED");
    if (phase.status_enum !== "ON_REVIEW_CLIENT") {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }

    const activeRevision = await getActiveRevision(tx, phaseId);
    const hasOpenActivities = activeRevision?.activities.some(
      (activity: Activity) => activity.status === "OPEN"
    );
    if (hasOpenActivities) {
      throw new ActionError(ERR.UNRESOLVED_ACTIVITIES_EXIST, "OPEN_ACTIVITIES");
    }

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "READY_FOR_NEXT", is_locked: true },
    });

    if (activeRevision) {
      await tx.revision.update({
        where: { id: activeRevision.id },
        data: { status_enum: "COMPLETED" },
      });
    }

    const nextPhase = await tx.phase.findFirst({
      where: {
        project_id: phase.project_id,
        order_index: phase.order_index + 1,
      },
    });

    if (!nextPhase) {
      await tx.project.update({
        where: { id: phase.project_id },
        data: { status_progress: "COMPLETED" },
      });
    }

    await insertAuditLog(tx, "approveClientPhase", "Phase", phaseId, userId, { phaseId });

    return updatedPhase;
  },

  async executeReopenPhase(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (!phase.is_locked) throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { is_locked: false, status_enum: "IN_PROGRESS" },
    });

    const activeRevision = await getActiveRevision(tx, phaseId);
    let revision;

    if (activeRevision) {
      await tx.revision.update({
        where: { id: activeRevision.id },
        data: { status_enum: "COMPLETED" },
      });

      revision = await tx.revision.create({
        data: {
          phase_id: phaseId,
          major: activeRevision.major + 1,
          minor: 0,
          status_enum: "ACTIVE",
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
          status_enum: "ACTIVE",
        },
      });
    }

    await insertAuditLog(tx, "reopenPhase", "Phase", phaseId, userId, { phaseId });

    return { phase: updatedPhase, revision };
  },

  async executeCompleteSupervisionPhase(tx: PrismaTransaction, params: { phaseId: string }) {
    const { phaseId } = params;

    const phase = await tx.phase.findUnique({ where: { id: phaseId } });
    if (!phase) throw new ActionError("Phase not found", "NOT_FOUND");
    if (phase.name_enum !== "SUPERVISION" || phase.status_enum !== "IN_PROGRESS") {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }

    const updatedPhase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: "COMPLETED", is_locked: true },
    });

    await tx.project.update({
      where: { id: phase.project_id },
      data: { status_progress: "COMPLETED" },
    });

    const activeRevision = await getActiveRevision(tx, phaseId);
    if (activeRevision) {
      await tx.revision.update({
        where: { id: activeRevision.id },
        data: { status_enum: "COMPLETED" },
      });
    }

    return updatedPhase;
  },

  async executeCreateCDItem(
    tx: PrismaTransaction,
    params: { phaseId: string; groupCode: string; drawingName: string; assignedToId?: string }
  ) {
    const normalizedName = params.drawingName.trim();
    if (!normalizedName) throw new ActionError("INVALID_INPUT", "DRAWING_NAME_REQUIRED");

    return tx.cDList.create({
      data: {
        phase_id: params.phaseId,
        group_code: normalizeDrawingCode(params.groupCode),
        drawing_name: normalizedName,
        assigned_to_id: params.assignedToId,
      },
    });
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
    });

    await insertAuditLog(tx, "updateCDItem", "CDList", params.itemId, params.userId, {
      group_code: updatedItem.group_code,
      drawing_name: updatedItem.drawing_name,
    });

    return updatedItem;
  },

  async executeUpdateCDStatus(
    tx: PrismaTransaction,
    params: { itemId: string; status: string; userId: string }
  ) {
    const updatedItem = await tx.cDList.update({
      where: { id: params.itemId },
      data: { status_enum: params.status },
    });

    await insertAuditLog(tx, "updateCDStatus", "CDList", params.itemId, params.userId, {
      status: params.status,
    });

    return updatedItem;
  },

  async executeDeleteCDItem(tx: PrismaTransaction, params: { itemId: string }) {
    return tx.cDList.delete({
      where: { id: params.itemId },
    });
  },

  async executeAddActivity(
    tx: PrismaTransaction,
    params: { revisionId: string; content: string; mode: "TODO" | "FEEDBACK" }
  ) {
    const normalizedContent = params.content.trim();
    if (!normalizedContent) throw new ActionError("INVALID_INPUT", "CONTENT_REQUIRED");

    const revision = await tx.revision.findUnique({
      where: { id: params.revisionId },
      select: { status_enum: true },
    });

    if (!revision) throw new ActionError("Revision not found", "NOT_FOUND");
    if (revision.status_enum !== "ACTIVE") {
      throw new ActionError(ERR.INVALID_PHASE_STATE, "INVALID_STATE");
    }

    return tx.activity.create({
      data: {
        revision_id: params.revisionId,
        content: normalizedContent,
        mode: params.mode,
        status: "OPEN",
      },
    });
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
    });

    await insertAuditLog(tx, "updateActivityContent", "Activity", params.activityId, params.userId, {
      content: normalizedContent,
    });

    return updatedActivity;
  },

  async executeToggleActivityStatus(tx: PrismaTransaction, params: { activityId: string }) {
    const activity = await tx.activity.findUnique({
      where: { id: params.activityId },
      select: { status: true },
    });

    if (!activity) throw new ActionError("Activity not found", "NOT_FOUND");

    return tx.activity.update({
      where: { id: params.activityId },
      data: { status: activity.status === "OPEN" ? "DONE" : "OPEN" },
    });
  },

  async executeDeleteActivity(tx: PrismaTransaction, params: { activityId: string }) {
    return tx.activity.delete({
      where: { id: params.activityId },
    });
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
    return tx.file.create({
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
  },
};
