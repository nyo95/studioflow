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
  assertGlobalChecklistAccess,
  ERR,
} from "@/lib/permissions";
import { createAction } from "@/lib/action-wrapper";
import { phaseService } from "@/lib/services/phase-service";
import { revalidatePath } from "next/cache";

export const submitForInternalReview = createAction(async ({ input, ctx, tx }) => {
  const { phaseId } = input as { phaseId: string };

  await getOwnedPhaseOrThrow(tx, phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeSubmitForInternalReview(tx, { phaseId, userId: ctx.userId });

  revalidatePath(`/projects/${result.project_id}`);
  return result;
});

export const approveInternal = createAction(async ({ input, ctx, tx }) => {
  const { phaseId } = input as { phaseId: string };

  await getOwnedPhaseOrThrow(tx, phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeApproveInternal(tx, { phaseId, userId: ctx.userId });

  revalidatePath(`/projects/${result.project_id}`);
  return result;
});

export const submitForClientReview = createAction(async ({ input, ctx, tx }) => {
  const { phaseId } = input as { phaseId: string };

  await getOwnedPhaseOrThrow(tx, phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeSubmitForClientReview(tx, { phaseId, userId: ctx.userId });

  revalidatePath(`/projects/${result.project_id}`);
  return result;
});

export const activatePhase = createAction(async ({ input, ctx, tx }) => {
  const { phaseId } = input as { phaseId: string };

  await getOwnedPhaseOrThrow(tx, phaseId, ctx.userId, ctx.role);
  const { phase } = await phaseService.executeActivatePhase(tx, { phaseId, userId: ctx.userId });

  revalidatePath(`/projects/${phase.project_id}`);
  return phase;
});

export const approveClientPhase = createAction(async ({ input, ctx, tx }) => {
  const { phaseId } = input as { phaseId: string };

  await getOwnedPhaseOrThrow(tx, phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeApproveClientPhase(tx, { phaseId, userId: ctx.userId });

  revalidatePath(`/projects/${result.project_id}`);
  return result;
});

export const rejectPhase = createAction(async ({ input, ctx, tx }) => {
  const { phaseId, type } = input as { phaseId: string; type: "INTERNAL" | "CLIENT" };

  await getOwnedPhaseOrThrow(tx, phaseId, ctx.userId, ctx.role);
  const { phase } = await phaseService.executeRejectPhase(tx, { phaseId, type, userId: ctx.userId });

  revalidatePath(`/projects/${phase.project_id}`);
  return phase;
});

export const reopenPhase = createAction(async ({ input, ctx, tx }) => {
  const { phaseId } = input as { phaseId: string };

  await getOwnedPhaseOrThrow(tx, phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeReopenPhase(tx, { phaseId, userId: ctx.userId });

  revalidatePath(`/projects/${result.phase.project_id}`);
  return result.phase;
});

export const completeSupervisionPhase = createAction(async ({ input, ctx, tx }) => {
  const { phaseId } = input as { phaseId: string };

  await getOwnedPhaseOrThrow(tx, phaseId, ctx.userId, ctx.role);
  const result = await phaseService.executeCompleteSupervisionPhase(tx, { phaseId });

  revalidatePath(`/projects/${result.project_id}`);
  return result;
});

export const createCDItem = createAction(async ({ input, ctx, tx }) => {
  const { phaseId, data } = input as {
    phaseId: string;
    data: { group_code: string; drawing_name: string; assigned_to_id?: string };
  };

  const phase = await getPhaseWithProjectOrThrow(tx, phaseId);
  if (phase.name_enum !== "CD") throw new Error(ERR.UNAUTHORIZED_ACTION);
  assertPhaseContentMutationAccess(phase, ctx.userId, ctx.role);

  const result = await phaseService.executeCreateCDItem(tx, {
    phaseId,
    groupCode: data.group_code,
    drawingName: data.drawing_name,
    assignedToId: data.assigned_to_id,
  });

  revalidatePath(`/projects/${phase.project.id}`);
  return result;
});

export const updateCDItem = createAction(async ({ input, ctx, tx }) => {
  const { itemId, data } = input as {
    itemId: string;
    data: { group_code: string; drawing_name: string };
  };

  const item = await getCDItemWithPhaseOrThrow(tx, itemId);
  assertPhaseContentMutationAccess(item.phase, ctx.userId, ctx.role);

  const result = await phaseService.executeUpdateCDItem(tx, {
    itemId,
    groupCode: data.group_code,
    drawingName: data.drawing_name,
    userId: ctx.userId,
  });

  revalidatePath(`/projects/${item.phase.project.id}`);
  return result;
});

export const updateCDStatus = createAction(async ({ input, ctx, tx }) => {
  const { itemId, status } = input as { itemId: string; status: string };

  const item = await getCDItemWithPhaseOrThrow(tx, itemId);
  assertPhaseContentMutationAccess(item.phase, ctx.userId, ctx.role);

  const result = await phaseService.executeUpdateCDStatus(tx, {
    itemId,
    status,
    userId: ctx.userId,
  });

  revalidatePath(`/projects/${item.phase.project.id}`);
  return result;
});

export const deleteCDItem = createAction(async ({ input, ctx, tx }) => {
  const { itemId } = input as { itemId: string };

  const item = await getCDItemWithPhaseOrThrow(tx, itemId);
  assertPhaseContentMutationAccess(item.phase, ctx.userId, ctx.role);

  const result = await phaseService.executeDeleteCDItem(tx, { itemId });

  revalidatePath(`/projects/${item.phase.project.id}`);
  return result;
});

export const toggleChecklist = createAction(async ({ input, ctx, tx }) => {
  const { checklistId, isChecked } = input as { checklistId: string; isChecked: boolean };

  const checklist = await getChecklistWithPhaseOrThrow(tx, checklistId);
  if (checklist.phase_id && checklist.phase) {
    assertPhaseContentMutationAccess(checklist.phase, ctx.userId, ctx.role);
  } else {
    assertGlobalChecklistAccess(checklist.project, ctx.userId, ctx.role);
  }

  const result = await phaseService.executeToggleChecklist(tx, { checklistId, isChecked, userId: ctx.userId });

  revalidatePath(`/projects/${result.project_id}`);
  revalidatePath("/today");
  return result;
});

export const addChecklistItem = createAction(async ({ input, ctx, tx }) => {
  const { phaseId, label } = input as { phaseId: string; label: string };

  const phase = await getPhaseWithProjectOrThrow(tx, phaseId);
  assertPhaseContentMutationAccess(phase, ctx.userId, ctx.role);

  const result = await phaseService.executeAddChecklistItem(tx, { phaseId, label, userId: ctx.userId });

  revalidatePath("/today");
  revalidatePath(`/projects/${result.project_id}`);
  return result;
});

export const addActivity = createAction(async ({ input, ctx, tx }) => {
  const { revisionId, content, mode } = input as {
    revisionId: string;
    content: string;
    mode: "TODO" | "FEEDBACK";
  };

  const revision = await getRevisionWithPhaseOrThrow(tx, revisionId);
  assertPhaseContentMutationAccess(revision.phase, ctx.userId, ctx.role);

  const result = await phaseService.executeAddActivity(tx, { revisionId, content, mode });

  revalidatePath(`/projects/${revision.phase.project.id}`);
  revalidatePath("/today");
  return result;
});

export const updateActivityContent = createAction(async ({ input, ctx, tx }) => {
  const { activityId, content } = input as { activityId: string; content: string };

  const activity = await getActivityWithPhaseOrThrow(tx, activityId);
  assertPhaseContentMutationAccess(activity.revision.phase, ctx.userId, ctx.role);

  const result = await phaseService.executeUpdateActivityContent(tx, {
    activityId,
    content,
    userId: ctx.userId,
  });

  revalidatePath(`/projects/${activity.revision.phase.project.id}`);
  revalidatePath("/today");
  return result;
});

export const toggleActivityStatus = createAction(async ({ input, ctx, tx }) => {
  const { activityId } = input as { activityId: string };

  const activity = await getActivityWithPhaseOrThrow(tx, activityId);
  assertPhaseContentMutationAccess(activity.revision.phase, ctx.userId, ctx.role);

  const result = await phaseService.executeToggleActivityStatus(tx, { activityId });

  revalidatePath(`/projects/${activity.revision.phase.project.id}`);
  revalidatePath("/today");
  return result;
});

export const deleteActivity = createAction(async ({ input, ctx, tx }) => {
  const { activityId } = input as { activityId: string };

  const activity = await getActivityWithPhaseOrThrow(tx, activityId);
  assertPhaseContentMutationAccess(activity.revision.phase, ctx.userId, ctx.role);

  const result = await phaseService.executeDeleteActivity(tx, { activityId });

  revalidatePath(`/projects/${activity.revision.phase.project.id}`);
  revalidatePath("/today");
  return result;
});

export const addDeliverable = createAction(async ({ input, ctx, tx }) => {
  const { revisionId, data } = input as {
    revisionId: string;
    data: {
      file_name: string;
      file_type: string;
      file_url?: string;
      link_url?: string;
      is_external: boolean;
    };
  };

  const revision = await getRevisionWithPhaseOrThrow(tx, revisionId);
  assertDeliverableUploadAccess(
    revision.phase.name_enum as PhaseName,
    revision.phase.project,
    ctx.userId,
    ctx.role
  );

  const result = await phaseService.executeAddDeliverable(tx, {
    revisionId,
    fileName: data.file_name,
    fileType: data.file_type,
    fileUrl: data.file_url,
    linkUrl: data.link_url,
    isExternal: data.is_external,
    uploadedBy: ctx.userId,
  });

  revalidatePath(`/projects/${revision.phase.project.id}`);
  return result;
});
