"use server";
import { PhaseName } from "@/generated/prisma";

import {
  getOwnedPhaseOrThrow,
  getPhaseWithProjectOrThrow,
  getRevisionWithPhaseOrThrow,
  getActivityWithPhaseOrThrow,
  getChecklistWithPhaseOrThrow,
  getCDItemWithPhaseOrThrow,
  assertPhaseContentMutationAccess,
  assertDeliverableUploadAccess,
  assertAdmin,
  assertPhaseOverrideAccess,
  assertPhaseNameEquals,
  getProjectMembershipOrThrow,
  throwActionError,

  ERR,
} from "@/core/rbac/permissions";
import { evaluateAccess, PERMISSION } from "@/core/rbac/rbac";
import { createAction } from "@/lib/action-wrapper";
import { phaseService } from "@/lib/services/phase-service";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_ACTIVITY, REVALIDATE_PROJECT, REVALIDATE_TODAY } from "@/lib/revalidation-tags";
import {
  PhaseIdSchema,
  RejectPhaseSchema,
  ReopenPhaseSchema,
  CreateCDItemSchema,
  UpdateCDItemSchema,
  UpdateCDStatusSchema,
  ToggleChecklistSchema,
  AddChecklistItemSchema,
  AddActivitySchema,
  UpdateActivitySchema,
  ToggleActivityStatusSchema,
  DeleteActivitySchema,
  AddDeliverableSchema,
  OverrideRevisionSchema,
  DeferActivitySchema
} from "@/lib/validations";
import { z } from "zod";
import { IdSchema } from "@/lib/validations";

export const submitForInternalReview = createAction(async ({ input, ctx, tx }) => {
  await getOwnedPhaseOrThrow(tx, input.phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeSubmitForInternalReview(tx, { phaseId: input.phaseId, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: result.project_id });
  invalidateCache({ scope: REVALIDATE_ACTIVITY });
  return result;
}, { schema: PhaseIdSchema });

export const approveInternal = createAction(async ({ input, ctx, tx }) => {
  await getOwnedPhaseOrThrow(tx, input.phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeApproveInternal(tx, { phaseId: input.phaseId, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: result.project_id });
  invalidateCache({ scope: REVALIDATE_ACTIVITY });
  return result;
}, { schema: PhaseIdSchema });

export const submitForClientReview = createAction(async ({ input, ctx, tx }) => {
  await getOwnedPhaseOrThrow(tx, input.phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeSubmitForClientReview(tx, { phaseId: input.phaseId, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: result.project_id });
  invalidateCache({ scope: REVALIDATE_ACTIVITY });
  return result;
}, { schema: PhaseIdSchema });

export const activatePhase = createAction(async ({ input, ctx, tx }) => {
  await getOwnedPhaseOrThrow(tx, input.phaseId, ctx.userId, ctx.role);
  const { phase } = await phaseService.executeActivatePhase(tx, { phaseId: input.phaseId, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: phase.project_id });
  invalidateCache({ scope: REVALIDATE_ACTIVITY });
  return phase;
}, { schema: PhaseIdSchema });

export const approveClientPhase = createAction(async ({ input, ctx, tx }) => {
  await getOwnedPhaseOrThrow(tx, input.phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeApproveClientPhase(tx, { phaseId: input.phaseId, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: result.project_id });
  invalidateCache({ scope: REVALIDATE_ACTIVITY });
  return result;
}, { schema: PhaseIdSchema });

export const rejectPhase = createAction(async ({ input, ctx, tx }) => {
  await getOwnedPhaseOrThrow(tx, input.phaseId, ctx.userId, ctx.role);
  const { phase } = await phaseService.executeRejectPhase(tx, { phaseId: input.phaseId, type: input.type, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: phase.project_id });
  invalidateCache({ scope: REVALIDATE_ACTIVITY });
  return phase;
}, { schema: RejectPhaseSchema });

export const reopenPhase = createAction(async ({ input, ctx, tx }) => {
  await getOwnedPhaseOrThrow(tx, input.phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeReopenPhase(tx, { phaseId: input.phaseId, intent: input.intent, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: result.phase.project_id });
  invalidateCache({ scope: REVALIDATE_ACTIVITY });
  return result.phase;
}, { schema: ReopenPhaseSchema });

export const completeSupervisionPhase = createAction(async ({ input, ctx, tx }) => {
  await getOwnedPhaseOrThrow(tx, input.phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeCompleteSupervisionPhase(tx, { phaseId: input.phaseId, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: result.project_id });
  invalidateCache({ scope: REVALIDATE_ACTIVITY });
  return result;
}, { schema: PhaseIdSchema });

export const createCDItem = createAction(async ({ input, ctx, tx }) => {
  const phase = await getPhaseWithProjectOrThrow(tx, input.phaseId);
  assertPhaseNameEquals(phase.name_enum, "CD");
  assertPhaseContentMutationAccess(phase, ctx.userId, ctx.role);

  const result = await phaseService.executeCreateCDItem(tx, {
    phaseId: input.phaseId,
    groupCode: input.data.group_code,
    drawingName: input.data.drawing_name,
    assignedToId: input.data.assigned_to_id,
    userId: ctx.userId,
  });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: phase.project.id });
  return result;
}, { schema: CreateCDItemSchema });

export const updateCDItem = createAction(async ({ input, ctx, tx }) => {
  const item = await getCDItemWithPhaseOrThrow(tx, input.itemId);
  assertPhaseContentMutationAccess(item.phase, ctx.userId, ctx.role);

  const result = await phaseService.executeUpdateCDItem(tx, {
    itemId: input.itemId,
    groupCode: input.data.group_code,
    drawingName: input.data.drawing_name,
    assignedToId: input.data.assigned_to_id,
    userId: ctx.userId,
  });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: item.phase.project.id });
  return result;
}, { schema: UpdateCDItemSchema });

export const updateCDStatus = createAction(async ({ input, ctx, tx }) => {
  const item = await getCDItemWithPhaseOrThrow(tx, input.itemId);
  assertPhaseContentMutationAccess(item.phase, ctx.userId, ctx.role);

  const result = await phaseService.executeUpdateCDStatus(tx, {
    itemId: input.itemId,
    status: input.status,
    userId: ctx.userId,
  });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: item.phase.project.id });
  return result;
}, { schema: UpdateCDStatusSchema });

export const deleteCDItem = createAction(async ({ input, ctx, tx }) => {
  const item = await getCDItemWithPhaseOrThrow(tx, input.itemId);
  assertPhaseContentMutationAccess(item.phase, ctx.userId, ctx.role);

  const result = await phaseService.executeDeleteCDItem(tx, { itemId: input.itemId, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: item.phase.project.id });
  return result;
}, { schema: z.object({ itemId: IdSchema }) });

export const toggleChecklist = createAction(async ({ input, ctx, tx }) => {
  const checklist = await getChecklistWithPhaseOrThrow(tx, input.checklistId);
  if (checklist.phase_id && checklist.phase) {
    assertPhaseContentMutationAccess(checklist.phase, ctx.userId, ctx.role);
  } else {
    // Both Designer and Drafter on the project can toggle global checklists
    const projectPermissions = evaluateAccess(ctx.role, PERMISSION.PROJECT_SYNC_CHECKLIST, {
      userId: ctx.userId,
      picDesignerId: checklist.project.pic_designer_id,
      picDrafterId: checklist.project.pic_drafter_id,
    });
    if (!projectPermissions) throwActionError(ERR.UNAUTHORIZED_ACTION);
  }

  const result = await phaseService.executeToggleChecklist(tx, { checklistId: input.checklistId, isChecked: input.isChecked, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: result.project_id });
  invalidateCache({ scope: REVALIDATE_TODAY });
  return result;
}, { schema: ToggleChecklistSchema });

export const addChecklistItem = createAction(async ({ input, ctx, tx }) => {
  const phase = await getPhaseWithProjectOrThrow(tx, input.phaseId);
  assertPhaseContentMutationAccess(phase, ctx.userId, ctx.role);

  const result = await phaseService.executeAddChecklistItem(tx, { phaseId: input.phaseId, label: input.label, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_TODAY });
  invalidateCache({ scope: REVALIDATE_PROJECT, id: result.project_id });
  return result;
}, { schema: AddChecklistItemSchema });

export const addActivity = createAction(async ({ input, ctx, tx }) => {
  const revision = await getRevisionWithPhaseOrThrow(tx, input.revisionId);
  assertPhaseContentMutationAccess(revision.phase, ctx.userId, ctx.role);

  const result = await phaseService.executeAddActivity(tx, { revisionId: input.revisionId, content: input.content, mode: input.mode, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: revision.phase.project.id });
  invalidateCache({ scope: REVALIDATE_TODAY });
  return result;
}, { schema: AddActivitySchema });

export const updateActivityContent = createAction(async ({ input, ctx, tx }) => {
  const activity = await getActivityWithPhaseOrThrow(tx, input.activityId);
  if (activity.revision) {
    assertPhaseContentMutationAccess(activity.revision.phase, ctx.userId, ctx.role);
  } else if (activity.project_id) {
    await getProjectMembershipOrThrow(tx, activity.project_id, ctx.userId, ctx.role);
  }


  const result = await phaseService.executeUpdateActivityContent(tx, {
    activityId: input.activityId,
    content: input.content,
    userId: ctx.userId,
  });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: activity.revision?.phase.project.id || activity.project_id! });

  invalidateCache({ scope: REVALIDATE_TODAY });
  return result;
}, { schema: UpdateActivitySchema });

export const toggleActivityStatus = createAction(async ({ input, ctx, tx }) => {
  const activity = await getActivityWithPhaseOrThrow(tx, input.activityId);
  if (activity.revision) {
    assertPhaseContentMutationAccess(activity.revision.phase, ctx.userId, ctx.role);
  } else if (activity.project_id) {
    await getProjectMembershipOrThrow(tx, activity.project_id, ctx.userId, ctx.role);
  }


  const result = await phaseService.executeToggleActivityStatus(tx, { activityId: input.activityId, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: activity.revision?.phase.project.id || activity.project_id! });

  invalidateCache({ scope: REVALIDATE_TODAY });
  return result;
}, { schema: ToggleActivityStatusSchema });

export const deleteActivity = createAction(async ({ input, ctx, tx }) => {
  const activity = await getActivityWithPhaseOrThrow(tx, input.activityId);
  if (activity.revision) {
    assertPhaseContentMutationAccess(activity.revision.phase, ctx.userId, ctx.role);
  } else if (activity.project_id) {
    await getProjectMembershipOrThrow(tx, activity.project_id, ctx.userId, ctx.role);
  }


  const result = await phaseService.executeDeleteActivity(tx, { activityId: input.activityId, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: activity.revision?.phase.project.id || activity.project_id! });

  invalidateCache({ scope: REVALIDATE_TODAY });
  return result;
}, { schema: DeleteActivitySchema });

export const addDeliverable = createAction(async ({ input, ctx, tx }) => {
  const revision = await getRevisionWithPhaseOrThrow(tx, input.revisionId);
  assertDeliverableUploadAccess(
    revision.phase.name_enum as PhaseName,
    revision.phase.project,
    ctx.userId,
    ctx.role
  );

  const result = await phaseService.executeAddDeliverable(tx, {
    revisionId: input.revisionId,
    fileName: input.data.file_name,
    fileType: input.data.file_type,
    fileUrl: input.data.file_url,
    linkUrl: input.data.link_url,
    isExternal: input.data.is_external,
    uploadedBy: ctx.userId,
  });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: revision.phase.project.id });
  return result;
}, { schema: AddDeliverableSchema });

export const overrideRevision = createAction(async ({ input, ctx, tx }) => {
  const phase = await tx.phase.findUniqueOrThrow({
    where: { id: input.phaseId },
    include: {
      project: {
        select: {
          pic_designer_id: true,
          pic_drafter_id: true,
        },
      },
    },
  });

  assertPhaseOverrideAccess(phase.project, ctx.userId, ctx.role);

  const result = await phaseService.executeOverrideRevision(tx, {
    phaseId: input.phaseId,
    targetMajorVersion: input.targetMajorVersion,
    targetMinorVersion: input.targetMinorVersion,
    note: input.note,
    mode: input.mode,
    userId: ctx.userId,
  });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: phase.project_id });
  invalidateCache({ scope: REVALIDATE_ACTIVITY });
  return result;
}, { schema: OverrideRevisionSchema });

export const bypassPhaseToCompleted = createAction(async ({ input, ctx, tx }) => {
  await getOwnedPhaseOrThrow(tx, input.phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeBypassToCompleted(tx, { phaseId: input.phaseId, userId: ctx.userId });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: result.phase.project_id });
  invalidateCache({ scope: REVALIDATE_ACTIVITY });
  return result;
}, { schema: PhaseIdSchema });

export const deferActivity = createAction(async ({ input, ctx, tx }) => {
  const activity = await getActivityWithPhaseOrThrow(tx, input.activityId);
  const project = activity.revision?.phase.project || activity.project;
  
  if (!project) throw new Error("Activity project context not found");


  // RBAC: DIC (Designer) or Admin only
  const canDefer = evaluateAccess(ctx.role, PERMISSION.PROJECT_SYNC_CHECKLIST, {
    userId: ctx.userId,
    picDesignerId: project.pic_designer_id,
  }) || ctx.role === "ADMIN";

  if (!canDefer) throwActionError(ERR.UNAUTHORIZED_ACTION);

  const result = await phaseService.executeDeferActivity(tx, {
    activityId: input.activityId,
    userId: ctx.userId,
  });

  invalidateCache({ scope: REVALIDATE_PROJECT, id: project.id });
  invalidateCache({ scope: REVALIDATE_ACTIVITY });
  invalidateCache({ scope: REVALIDATE_TODAY });

  return result;
}, { schema: DeferActivitySchema });

