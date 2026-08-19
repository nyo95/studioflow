"use server";

/**
 * Server actions for tasks (roadmap §C).
 *
 * Access rules follow what already governs checklists: a task inside a phase is
 * phase content, so it uses `assertPhaseContentMutationAccess` — which also
 * refuses edits to a locked or approved phase. A project-level task (no phase)
 * falls back to project membership, matching how the global checklist section
 * has always behaved.
 */

import {
  getChecklistWithPhaseOrThrow,
  getPhaseWithProjectOrThrow,
  getProjectMembershipOrThrow,
  assertPhaseContentMutationAccess,
  throwActionError,
  ERR,
} from "@/core/rbac/permissions";
import { createAction } from "@/lib/action-wrapper";
import { checklistService } from "@/lib/services/checklist-service";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_PROJECT, REVALIDATE_TODAY } from "@/lib/revalidation-tags";
import {
  AttachTaskLabelSchema,
  CreateSubtaskSchema,
  DetachTaskLabelSchema,
  ReorderTasksSchema,
  TaskIdSchema,
  UpdateTaskSchema,
} from "@/lib/validations";
import type { PrismaTransaction } from "@/types/common";
import type { Role } from "@/generated/prisma";

/**
 * One gate for both shapes of task.
 *
 * Phase tasks go through the phase check so that approving or locking a phase
 * freezes its tasks too — the alternative would let someone keep editing the
 * checklist of a phase that is already signed off.
 */
async function assertTaskMutationAccess(
  tx: PrismaTransaction,
  params: { projectId: string; phaseId: string | null; userId: string; role: Role }
) {
  if (params.phaseId) {
    const phase = await getPhaseWithProjectOrThrow(tx, params.phaseId);
    if (phase.project.id !== params.projectId) {
      throwActionError(ERR.UNAUTHORIZED_ACTION);
    }
    assertPhaseContentMutationAccess(phase, params.userId, params.role);
    return;
  }

  await getProjectMembershipOrThrow(tx, params.projectId, params.userId, params.role);
}

/** Resolves an existing task to its project/phase, then applies the gate. */
async function assertExistingTaskAccess(
  tx: PrismaTransaction,
  params: { taskId: string; userId: string; role: Role }
) {
  const task = await getChecklistWithPhaseOrThrow(tx, params.taskId);
  await assertTaskMutationAccess(tx, {
    projectId: task.project.id,
    phaseId: task.phase_id,
    userId: params.userId,
    role: params.role,
  });
  return task;
}

function revalidateTask(projectId: string) {
  invalidateCache({ scope: REVALIDATE_PROJECT, id: projectId });
  invalidateCache({ scope: REVALIDATE_TODAY });
}

/**
 * Creates a subtask under an existing checklist item.
 *
 * There is no `createTask`. Root checklist items are requirements and come from
 * `ChecklistTemplate` in Studio settings only — see `checklist-service.ts` for
 * why, and `template-manager.tsx` for where an admin adds one.
 *
 * Access is resolved from the PARENT, not from the input. Taking the phase from
 * the caller would let someone file a subtask against a phase they can edit
 * while its parent sits in one they cannot.
 */
export const createSubtask = createAction(
  async ({ input, ctx, tx }) => {
    const parent = await assertExistingTaskAccess(tx, {
      taskId: input.parentId,
      userId: ctx.userId,
      role: ctx.role,
    });

    if (parent.project.id !== input.projectId) {
      throwActionError(ERR.UNAUTHORIZED_ACTION);
    }

    const result = await checklistService.executeCreateSubtask(tx, {
      projectId: input.projectId,
      parentId: input.parentId,
      label: input.label,
      priority: input.priority,
      dueAt: input.dueAt ?? null,
      assignedToId: input.assignedToId ?? null,
      userId: ctx.userId,
    });

    revalidateTask(input.projectId);
    return result;
  },
  { schema: CreateSubtaskSchema }
);

export const updateTask = createAction(
  async ({ input, ctx, tx }) => {
    const task = await assertExistingTaskAccess(tx, {
      taskId: input.taskId,
      userId: ctx.userId,
      role: ctx.role,
    });

    // An assignee must be someone who can actually see the project. Reusing the
    // existing membership check rather than writing a second rule keeps the two
    // from drifting.
    if (input.assignedToId) {
      await getProjectMembershipOrThrow(tx, task.project.id, input.assignedToId, "STAFF" as Role);
    }

    const result = await checklistService.executeUpdateTask(tx, {
      taskId: input.taskId,
      label: input.label,
      priority: input.priority,
      ...("dueAt" in input ? { dueAt: input.dueAt ?? null } : {}),
      ...("assignedToId" in input ? { assignedToId: input.assignedToId ?? null } : {}),
      userId: ctx.userId,
    });

    revalidateTask(task.project.id);
    return result;
  },
  { schema: UpdateTaskSchema }
);

export const deleteTask = createAction(
  async ({ input, ctx, tx }) => {
    const task = await assertExistingTaskAccess(tx, {
      taskId: input.taskId,
      userId: ctx.userId,
      role: ctx.role,
    });

    const result = await checklistService.executeDeleteTask(tx, {
      taskId: input.taskId,
      userId: ctx.userId,
    });

    revalidateTask(task.project.id);
    return result;
  },
  { schema: TaskIdSchema }
);

export const detachTaskFromTemplate = createAction(
  async ({ input, ctx, tx }) => {
    const task = await assertExistingTaskAccess(tx, {
      taskId: input.taskId,
      userId: ctx.userId,
      role: ctx.role,
    });

    const result = await checklistService.executeDetachFromTemplate(tx, {
      taskId: input.taskId,
      userId: ctx.userId,
    });

    revalidateTask(task.project.id);
    return result;
  },
  { schema: TaskIdSchema }
);

export const reorderTasks = createAction(
  async ({ input, ctx, tx }) => {
    // Checking the first id is enough: the service refuses a set that spans
    // more than one sibling group, so they all share a project and phase.
    const task = await assertExistingTaskAccess(tx, {
      taskId: input.taskIds[0],
      userId: ctx.userId,
      role: ctx.role,
    });

    const result = await checklistService.executeReorderTasks(tx, {
      taskIds: input.taskIds,
      userId: ctx.userId,
    });

    revalidateTask(task.project.id);
    return result;
  },
  { schema: ReorderTasksSchema }
);

export const attachTaskLabel = createAction(
  async ({ input, ctx, tx }) => {
    const task = await assertExistingTaskAccess(tx, {
      taskId: input.taskId,
      userId: ctx.userId,
      role: ctx.role,
    });

    const result = await checklistService.executeAttachLabel(tx, {
      taskId: input.taskId,
      name: input.name,
      color: input.color,
      userId: ctx.userId,
    });

    revalidateTask(task.project.id);
    return result;
  },
  { schema: AttachTaskLabelSchema }
);

export const detachTaskLabel = createAction(
  async ({ input, ctx, tx }) => {
    const task = await assertExistingTaskAccess(tx, {
      taskId: input.taskId,
      userId: ctx.userId,
      role: ctx.role,
    });

    const result = await checklistService.executeDetachLabel(tx, {
      taskId: input.taskId,
      labelId: input.labelId,
      userId: ctx.userId,
    });

    revalidateTask(task.project.id);
    return result;
  },
  { schema: DetachTaskLabelSchema }
);
