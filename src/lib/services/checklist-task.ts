/**
 * The single place that decides how a checklist row is selected, ordered, and
 * shaped. Every reader goes through here.
 *
 * This module exists because of a specific bug class: `phase-heartbeat.ts` used
 * `orderBy: { id: "asc" }` over a UUID — which is not an order at all — while
 * `project-checklist-overview.tsx` patched it with `label.localeCompare` in the
 * browser. Two readers, two rules, neither correct. Manual ordering is
 * impossible on top of that, so the rule had to become shared before
 * `sort_order` could mean anything.
 */

import type { Prisma } from "@/generated/prisma";
import type {
  ChecklistFilter,
  ChecklistTask,
  ChecklistTaskNode,
  FilterableTask,
} from "@/types/checklist";

/**
 * The ordering rule. Both readers must use this.
 *
 * `sort_order` first so drag-and-drop wins; `created_at` breaks ties (rows
 * created in the same batch share a sort_order until reordered); `id` makes the
 * result deterministic when two rows were created in the same millisecond,
 * which matters for `createMany`.
 */
export const CHECKLIST_TASK_ORDER_BY: Prisma.ProjectChecklistOrderByWithRelationInput[] = [
  { sort_order: "asc" },
  { created_at: "asc" },
  { id: "asc" },
];

export const CHECKLIST_TASK_SELECT = {
  id: true,
  label: true,
  is_checked: true,
  project_id: true,
  phase_id: true,
  parent_id: true,
  sort_order: true,
  priority: true,
  due_at: true,
  template_id: true,
  created_at: true,
  checked_at: true,
  assigned_to: { select: { id: true, name: true } },
  labels: {
    select: { label: { select: { id: true, name: true, color: true } } },
  },
  _count: { select: { comments: true } },
} satisfies Prisma.ProjectChecklistSelect;

type ChecklistTaskRow = Prisma.ProjectChecklistGetPayload<{
  select: typeof CHECKLIST_TASK_SELECT;
}>;

export function toChecklistTask(row: ChecklistTaskRow): ChecklistTask {
  return {
    id: row.id,
    label: row.label,
    is_checked: row.is_checked,
    project_id: row.project_id,
    phase_id: row.phase_id,
    parent_id: row.parent_id,
    sort_order: row.sort_order,
    priority: row.priority,
    due_at: row.due_at ? row.due_at.toISOString() : null,
    assigned_to: row.assigned_to ? { id: row.assigned_to.id, name: row.assigned_to.name } : null,
    template_id: row.template_id,
    created_at: row.created_at.toISOString(),
    checked_at: row.checked_at ? row.checked_at.toISOString() : null,
    labels: row.labels.map((entry) => entry.label),
    comment_count: row._count.comments,
  };
}

/**
 * Nests subtasks under their parents, preserving the order the rows arrived in.
 *
 * A subtask whose parent is not in the same result set is promoted to a root
 * rather than dropped. That happens when a filter matches the child but not the
 * parent — hiding it would make the task silently unreachable, which is worse
 * than showing it without its context.
 */
export function buildChecklistTree(tasks: ChecklistTask[]): ChecklistTaskNode[] {
  const roots: ChecklistTaskNode[] = [];
  const nodeById = new Map<string, ChecklistTaskNode>();

  for (const task of tasks) {
    if (task.parent_id === null) {
      const node: ChecklistTaskNode = { ...task, children: [] };
      nodeById.set(task.id, node);
      roots.push(node);
    }
  }

  for (const task of tasks) {
    if (task.parent_id === null) continue;
    const parent = nodeById.get(task.parent_id);
    if (parent) {
      parent.children.push(task);
    } else {
      roots.push({ ...task, children: [] });
    }
  }

  return roots;
}

type ChecklistSiblingIdentity = Pick<
  ChecklistTask,
  "id" | "project_id" | "phase_id" | "parent_id"
>;

/**
 * Memindahkan satu task hanya di dalam kelompok sibling-nya.
 *
 * Daftar task disimpan flat walaupun UI menampilkannya sebagai tree. Helper
 * ini mengganti row sibling pada slot mereka sendiri, sehingga urutan root dan
 * setiap kumpulan subtask dapat berubah tanpa menarik child ke parent lain atau
 * mengacak kelompok yang kebetulan terselip di array hasil query.
 */
export function reorderChecklistSiblings<T extends ChecklistSiblingIdentity>(
  tasks: readonly T[],
  activeId: string,
  overId: string
): { items: T[]; taskIds: string[] } | null {
  if (activeId === overId) return null;

  const active = tasks.find((task) => task.id === activeId);
  const over = tasks.find((task) => task.id === overId);
  if (!active || !over) return null;

  const isSibling = (task: ChecklistSiblingIdentity) =>
    task.project_id === active.project_id &&
    task.phase_id === active.phase_id &&
    task.parent_id === active.parent_id;

  if (!isSibling(over)) return null;

  const siblings = tasks.filter(isSibling);
  const oldIndex = siblings.findIndex((task) => task.id === activeId);
  const newIndex = siblings.findIndex((task) => task.id === overId);
  if (oldIndex < 0 || newIndex < 0) return null;

  const moved = [...siblings];
  const [picked] = moved.splice(oldIndex, 1);
  moved.splice(newIndex, 0, picked);

  let siblingIndex = 0;
  return {
    items: tasks.map((task) => isSibling(task) ? moved[siblingIndex++] : task),
    taskIds: moved.map((task) => task.id),
  };
}

/** Local midnight today. Due dates are date-only, so the comparison is by day. */
function startOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * The built-in views, applied to already-fetched rows.
 *
 * Filtering in memory rather than in SQL is deliberate at this size: a phase
 * holds tens of tasks, not thousands, and the phase view already has every row
 * in hand from the heartbeat poll. Pushing this into the query would mean
 * refetching on every tab click and would not survive the optimistic-update
 * path. If a cross-project `/todo` page ever lands, that one queries directly.
 */
export function applyChecklistFilter<T extends FilterableTask>(
  tasks: T[],
  filter: ChecklistFilter,
  currentUserId: string | null,
  now: Date = new Date()
): T[] {
  if (filter === "all") return tasks;

  const today = startOfToday(now);
  const tomorrow = new Date(today.getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);

  return tasks.filter((task) => {
    switch (filter) {
      case "today": {
        if (!task.due_at) return false;
        const due = new Date(task.due_at);
        return due < tomorrow;
      }
      case "overdue": {
        // Completed tasks are never overdue — a done task with a past date is
        // not a problem, and listing it would make the tab permanently red.
        if (task.is_checked || !task.due_at) return false;
        return new Date(task.due_at) < today;
      }
      case "p1":
        return task.priority === 1 && !task.is_checked;
      case "mine":
        return currentUserId !== null && task.assigned_to?.id === currentUserId;
      default:
        return true;
    }
  });
}

/**
 * Counts per tab, computed from the same array the tabs will filter.
 *
 * Kept next to `applyChecklistFilter` so a new filter cannot be added to one
 * without the other noticing.
 */
export function countChecklistFilters<T extends FilterableTask>(
  tasks: T[],
  currentUserId: string | null,
  now: Date = new Date()
): Record<ChecklistFilter, number> {
  return {
    all: tasks.length,
    today: applyChecklistFilter(tasks, "today", currentUserId, now).length,
    overdue: applyChecklistFilter(tasks, "overdue", currentUserId, now).length,
    p1: applyChecklistFilter(tasks, "p1", currentUserId, now).length,
    mine: applyChecklistFilter(tasks, "mine", currentUserId, now).length,
  };
}
