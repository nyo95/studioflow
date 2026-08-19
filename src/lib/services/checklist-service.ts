/**
 * Write paths for tasks (roadmap §C).
 *
 * The read side lives in `checklist-task.ts`. Toggling and the original
 * template-driven add stay in `phase-service.ts` where they have always been —
 * moving them would churn every caller for no gain.
 *
 * The rule this file exists to protect: a row with `template_id != null` is
 * regenerable and belongs to a template; a row with `template_id = null` was
 * typed by a person and is gone for good if deleted. Nothing here may create a
 * user task carrying a template_id, and nothing may quietly delete a user task.
 */

import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit";
import {
  CHECKLIST_SORT_STEP,
  CHECKLIST_PRIORITY_NONE,
  MAX_CHECKLIST_DEPTH,
} from "@/lib/constants";
import { CHECKLIST_TASK_ORDER_BY, CHECKLIST_TASK_SELECT, toChecklistTask } from "./checklist-task";

/**
 * Strips the time component. Due dates are date-only by construction — no UI
 * offers a time picker — and normalising on write keeps that true even if a
 * caller passes a full timestamp. See roadmap §C1 for why the alternative
 * (a `due_has_time` flag) was deferred rather than dropped.
 */
function normaliseDueDate(value: Date | null | undefined): Date | null {
  if (!value) return null;
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

async function nextSortOrder(
  tx: PrismaTransaction,
  params: { projectId: string; phaseId: string | null; parentId: string | null }
): Promise<number> {
  const last = await tx.projectChecklist.findFirst({
    where: {
      project_id: params.projectId,
      phase_id: params.phaseId,
      parent_id: params.parentId,
    },
    orderBy: { sort_order: "desc" },
    select: { sort_order: true },
  });

  return (last?.sort_order ?? 0) + CHECKLIST_SORT_STEP;
}

/**
 * Rejects a parent that is itself a subtask.
 *
 * Depth is capped in validation rather than in the schema so that raising the
 * cap later needs no migration. `MAX_CHECKLIST_DEPTH = 1` means: roots may have
 * children, children may not.
 */
async function assertCanNest(tx: PrismaTransaction, parentId: string) {
  const parent = await tx.projectChecklist.findUnique({
    where: { id: parentId },
    select: { id: true, parent_id: true, project_id: true, phase_id: true },
  });

  if (!parent) {
    throw new ActionError("Parent task not found", "NOT_FOUND");
  }

  if (MAX_CHECKLIST_DEPTH <= 1 && parent.parent_id !== null) {
    throw new ActionError(
      "Subtasks cannot have subtasks of their own.",
      "VALIDATION_ERROR"
    );
  }

  return parent;
}

export const checklistService = {
  /**
   * Creates a SUBTASK under an existing checklist item.
   *
   * Root items cannot be created here, and that is the rule this whole module
   * exists to protect (roadmap §C, corrected 2026-08-10). A checklist item is a
   * **requirement**: defined once by an admin in Studio settings, generated into
   * every project by `executeSyncProjectChecklists`, and counted by the phase
   * approval gate. Letting anyone add a root item per project would mean the
   * same phase demands different things in different projects, and the template
   * would stop describing what it claims to describe.
   *
   * A subtask is a different thing and is allowed on purpose: it breaks down a
   * requirement that **already exists**, adds no new obligation, and by design
   * does not count toward the approval gate (see `assertNoPendingTasks`).
   *
   * A subtask inherits its parent's project and phase rather than accepting
   * them from the caller. Letting them diverge would produce a subtask that is
   * invisible in its parent's list and — worse — counted against a different
   * phase's approval gate.
   */
  async executeCreateSubtask(
    tx: PrismaTransaction,
    params: {
      projectId: string;
      parentId: string;
      label: string;
      priority?: number;
      dueAt?: Date | null;
      assignedToId?: string | null;
      userId: string;
    }
  ) {
    const { projectId, parentId, label, userId } = params;

    if (!parentId) {
      throw new ActionError(
        "Checklist items come from templates. Add it in Studio settings so every project gets it.",
        "VALIDATION_ERROR"
      );
    }

    const parent = await assertCanNest(tx, parentId);
    if (parent.project_id !== projectId) {
      throw new ActionError("Parent task belongs to another project", "VALIDATION_ERROR");
    }
    const phaseId = parent.phase_id;

    const created = await tx.projectChecklist.create({
      data: {
        project_id: projectId,
        phase_id: phaseId,
        parent_id: parentId,
        label: label.trim(),
        is_checked: false,
        priority: params.priority ?? CHECKLIST_PRIORITY_NONE,
        due_at: normaliseDueDate(params.dueAt),
        assigned_to_id: params.assignedToId ?? null,
        // Never a template_id: this row was typed by a person, and the sync
        // dedup must not treat it as a template's row. Only subtasks can reach
        // this branch, and templates have no notion of nesting.
        template_id: null,
        sort_order: await nextSortOrder(tx, { projectId, phaseId, parentId }),
      },
      select: CHECKLIST_TASK_SELECT,
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.ADD_CHECKLIST_ITEM, "ProjectChecklist", created.id, userId, {
      project_id: projectId,
      phase_id: phaseId,
      label: created.label,
      parent_id: parentId,
    });

    return toChecklistTask(created);
  },

  /**
   * Updates the task fields a person can edit.
   *
   * `undefined` means "leave alone" and `null` means "clear" — which is why
   * every optional field is checked with `in` rather than for truthiness. Using
   * truthiness would make clearing a due date impossible.
   */
  async executeUpdateTask(
    tx: PrismaTransaction,
    params: {
      taskId: string;
      label?: string;
      priority?: number;
      dueAt?: Date | null;
      assignedToId?: string | null;
      userId: string;
    }
  ) {
    const { taskId, userId } = params;

    const existing = await tx.projectChecklist.findUnique({
      where: { id: taskId },
      select: { id: true, project_id: true, phase_id: true, label: true },
    });
    if (!existing) throw new ActionError("Task not found", "NOT_FOUND");

    const data: {
      label?: string;
      priority?: number;
      due_at?: Date | null;
      assigned_to_id?: string | null;
    } = {};

    if (params.label !== undefined) data.label = params.label.trim();
    if (params.priority !== undefined) data.priority = params.priority;
    if ("dueAt" in params) data.due_at = normaliseDueDate(params.dueAt);
    if ("assignedToId" in params) data.assigned_to_id = params.assignedToId ?? null;

    if (Object.keys(data).length === 0) {
      const unchanged = await tx.projectChecklist.findUniqueOrThrow({
        where: { id: taskId },
        select: CHECKLIST_TASK_SELECT,
      });
      return toChecklistTask(unchanged);
    }

    const updated = await tx.projectChecklist.update({
      where: { id: taskId },
      data,
      select: CHECKLIST_TASK_SELECT,
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_CHECKLIST_ITEM, "ProjectChecklist", taskId, userId, {
      project_id: existing.project_id,
      phase_id: existing.phase_id,
      changed: Object.keys(data),
    });

    return toChecklistTask(updated);
  },

  /**
   * Deletes a task and, by FK cascade, its subtasks, labels and comments.
   *
   * Template rows are refused. Deleting one looks like it works and then the
   * next sync brings it straight back, which reads as a bug. Unlinking the
   * template first is the honest path: it makes the row a user task, and then
   * deleting it means what it says.
   */
  async executeDeleteTask(tx: PrismaTransaction, params: { taskId: string; userId: string }) {
    const { taskId, userId } = params;

    const existing = await tx.projectChecklist.findUnique({
      where: { id: taskId },
      select: { id: true, project_id: true, phase_id: true, label: true, template_id: true },
    });
    if (!existing) throw new ActionError("Task not found", "NOT_FOUND");

    if (existing.template_id !== null) {
      throw new ActionError(
        "This item comes from a checklist template and would reappear on the next sync. Detach it from the template first, or deactivate the template in Studio settings.",
        "VALIDATION_ERROR"
      );
    }

    const childCount = await tx.projectChecklist.count({ where: { parent_id: taskId } });

    await tx.projectChecklist.delete({ where: { id: taskId } });

    await insertAuditLog(tx, AUDIT_ACTIONS.DELETE_CHECKLIST_ITEM, "ProjectChecklist", taskId, userId, {
      project_id: existing.project_id,
      phase_id: existing.phase_id,
      label: existing.label,
      subtasks_destroyed: childCount,
    });

    return { id: taskId, subtasksDestroyed: childCount };
  },

  /**
   * Detaches a row from its template, turning it into a plain user task.
   *
   * The escape hatch for the refusal above, and the only supported way to get
   * rid of an item a template keeps regenerating without editing the template
   * itself — which would affect every other project.
   */
  async executeDetachFromTemplate(tx: PrismaTransaction, params: { taskId: string; userId: string }) {
    const { taskId, userId } = params;

    const existing = await tx.projectChecklist.findUnique({
      where: { id: taskId },
      select: { id: true, project_id: true, phase_id: true, template_id: true },
    });
    if (!existing) throw new ActionError("Task not found", "NOT_FOUND");
    if (existing.template_id === null) {
      throw new ActionError("This task is not linked to a template.", "VALIDATION_ERROR");
    }

    const updated = await tx.projectChecklist.update({
      where: { id: taskId },
      data: { template_id: null },
      select: CHECKLIST_TASK_SELECT,
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.DETACH_CHECKLIST_TEMPLATE, "ProjectChecklist", taskId, userId, {
      project_id: existing.project_id,
      phase_id: existing.phase_id,
      template_id: existing.template_id,
    });

    return toChecklistTask(updated);
  },

  /**
   * Rewrites `sort_order` for a set of sibling tasks.
   *
   * The caller sends the ids in their new order and the whole sibling group is
   * renumbered from scratch with a fixed step. Renumbering rather than
   * computing a midpoint avoids the float-precision drift that eventually
   * breaks fractional-index schemes, and a checklist is far too small for the
   * write cost to matter.
   */
  async executeReorderTasks(
    tx: PrismaTransaction,
    params: { taskIds: string[]; userId: string }
  ) {
    const { taskIds, userId } = params;
    if (taskIds.length === 0) return { count: 0 };

    const rows = await tx.projectChecklist.findMany({
      where: { id: { in: taskIds } },
      select: { id: true, project_id: true, phase_id: true, parent_id: true },
    });

    if (rows.length !== taskIds.length) {
      throw new ActionError("Some tasks no longer exist", "NOT_FOUND");
    }

    // Reordering only means anything within one sibling group. Accepting a
    // mixed set would silently move tasks between phases or out of their parent.
    const groupKey = (r: { project_id: string; phase_id: string | null; parent_id: string | null }) =>
      `${r.project_id}::${r.phase_id ?? "GLOBAL"}::${r.parent_id ?? "ROOT"}`;
    const groups = new Set(rows.map(groupKey));
    if (groups.size > 1) {
      throw new ActionError("Tasks must belong to the same list to be reordered", "VALIDATION_ERROR");
    }

    for (const [index, id] of taskIds.entries()) {
      await tx.projectChecklist.update({
        where: { id },
        data: { sort_order: (index + 1) * CHECKLIST_SORT_STEP },
      });
    }

    await insertAuditLog(tx, AUDIT_ACTIONS.REORDER_CHECKLIST, "ProjectChecklist", taskIds[0], userId, {
      project_id: rows[0].project_id,
      phase_id: rows[0].phase_id,
      count: taskIds.length,
    });

    return { count: taskIds.length };
  },

  /**
   * Attaches a label, creating it on first use.
   *
   * Labels are global and matched case-insensitively on write, so "Urgent" and
   * "urgent" do not become two chips that look identical in the UI.
   */
  async executeAttachLabel(
    tx: PrismaTransaction,
    params: { taskId: string; name: string; color?: string; userId: string }
  ) {
    const { taskId, userId } = params;
    const name = params.name.trim();
    if (!name) throw new ActionError("Label name is required", "VALIDATION_ERROR");

    const task = await tx.projectChecklist.findUnique({
      where: { id: taskId },
      select: { id: true, project_id: true, phase_id: true },
    });
    if (!task) throw new ActionError("Task not found", "NOT_FOUND");

    const existing = await tx.checklistLabel.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });

    const label =
      existing ??
      (await tx.checklistLabel.create({
        data: { name, color: params.color ?? "slate" },
        select: { id: true },
      }));

    await tx.checklistLabelOnItem.upsert({
      where: { checklist_id_label_id: { checklist_id: taskId, label_id: label.id } },
      create: { checklist_id: taskId, label_id: label.id },
      update: {},
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_CHECKLIST_ITEM, "ProjectChecklist", taskId, userId, {
      project_id: task.project_id,
      phase_id: task.phase_id,
      changed: ["labels"],
      label_added: name,
    });

    const refreshed = await tx.projectChecklist.findUniqueOrThrow({
      where: { id: taskId },
      select: CHECKLIST_TASK_SELECT,
    });
    return toChecklistTask(refreshed);
  },

  /**
   * Detaches a label from one task.
   *
   * The `ChecklistLabel` row survives even when nothing references it any more.
   * Deleting orphans here would race with another task being labelled in a
   * parallel request, and an unused label costs one row.
   */
  async executeDetachLabel(
    tx: PrismaTransaction,
    params: { taskId: string; labelId: string; userId: string }
  ) {
    const { taskId, labelId, userId } = params;

    const task = await tx.projectChecklist.findUnique({
      where: { id: taskId },
      select: { id: true, project_id: true, phase_id: true },
    });
    if (!task) throw new ActionError("Task not found", "NOT_FOUND");

    await tx.checklistLabelOnItem.deleteMany({
      where: { checklist_id: taskId, label_id: labelId },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_CHECKLIST_ITEM, "ProjectChecklist", taskId, userId, {
      project_id: task.project_id,
      phase_id: task.phase_id,
      changed: ["labels"],
      label_removed: labelId,
    });

    const refreshed = await tx.projectChecklist.findUniqueOrThrow({
      where: { id: taskId },
      select: CHECKLIST_TASK_SELECT,
    });
    return toChecklistTask(refreshed);
  },

  /** Every label in use, for the picker. */
  async listLabels(tx: PrismaTransaction) {
    return tx.checklistLabel.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    });
  },

  /** All tasks for a project, ordered by the shared rule. */
  async listProjectTasks(tx: PrismaTransaction, projectId: string) {
    const rows = await tx.projectChecklist.findMany({
      where: { project_id: projectId },
      select: CHECKLIST_TASK_SELECT,
      orderBy: CHECKLIST_TASK_ORDER_BY,
    });
    return rows.map(toChecklistTask);
  },
};
