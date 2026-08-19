/**
 * Builds the Today feed by projecting two tables onto one shape.
 *
 * Read-only. Each row keeps its own write path — `toggleActivityStatus` for
 * `Activity`, `toggleChecklist` for `ProjectChecklist` — dispatched on
 * `UnifiedTask.source`. Nothing here merges the tables themselves; see
 * `@/types/task-feed` for why that stayed a view-level decision.
 */

import type { ChecklistTask } from "@/types/checklist";
import type { TaskFeedGroup, UnifiedTask } from "@/types/task-feed";

/** `DESIGN_3D` → `DESIGN 3D`. */
export function formatPhaseLabel(name: string): string {
  return name.replace(/_/g, " ");
}

interface ActivityRowInput {
  id: string;
  content: string;
  status: string;
  mode: string;
  due_at: Date | null;
  assigned_to: { id: string; name: string } | null;
}

interface ProjectContext {
  projectId: string;
  projectName: string;
  projectIsUrgent: boolean;
}

/**
 * Projects an `Activity` row.
 *
 * Priority stays 4: the source has no priority, and filling it from the
 * project's urgency would put data in the row that the row does not have — the
 * P1 tab would then answer a different question than its label.
 *
 * `due_at` is real as of 2026-08-10. Before that column existed, half the work
 * on this screen could never appear on a date-based view.
 */
export function fromActivity(
  row: ActivityRowInput,
  ctx: ProjectContext & { phaseLabel: string | null }
): UnifiedTask {
  return {
    key: `activity:${row.id}`,
    id: row.id,
    source: "activity",
    label: row.content,
    is_checked: row.status === "COMPLETED",
    project_id: ctx.projectId,
    project_name: ctx.projectName,
    phase_label: ctx.phaseLabel,
    priority: 4,
    due_at: row.due_at ? row.due_at.toISOString() : null,
    assigned_to: row.assigned_to,
    labels: [],
    comment_count: 0,
    mode: row.mode === "FEEDBACK" ? "FEEDBACK" : "TODO",
    template_id: null,
    children: [],
    project_is_urgent: ctx.projectIsUrgent,
  };
}

/** Projects a `ProjectChecklist` row. Every field maps directly. */
export function fromChecklistTask(
  task: ChecklistTask,
  ctx: ProjectContext & { phaseLabel: string | null }
): UnifiedTask {
  return {
    key: `checklist:${task.id}`,
    id: task.id,
    source: "checklist",
    label: task.label,
    is_checked: task.is_checked,
    project_id: ctx.projectId,
    project_name: ctx.projectName,
    phase_label: ctx.phaseLabel,
    priority: task.priority,
    due_at: task.due_at,
    assigned_to: task.assigned_to,
    labels: task.labels,
    comment_count: task.comment_count,
    mode: null,
    template_id: task.template_id,
    children: [],
    project_is_urgent: ctx.projectIsUrgent,
  };
}

/**
 * Nests checklist subtasks under their parents, leaving activities untouched.
 *
 * A subtask whose parent is absent from the input is promoted to the top level
 * rather than dropped — same rule as `buildChecklistTree`, same reason: hiding
 * it would make the task unreachable from this screen.
 */
export function nestChecklistSubtasks(
  tasks: UnifiedTask[],
  parentIdOf: Map<string, string | null>
): UnifiedTask[] {
  const byId = new Map<string, UnifiedTask>();
  const roots: UnifiedTask[] = [];

  for (const task of tasks) {
    if (task.source !== "checklist" || parentIdOf.get(task.id) == null) {
      byId.set(task.id, task);
      roots.push(task);
    }
  }

  for (const task of tasks) {
    if (task.source !== "checklist") continue;
    const parentId = parentIdOf.get(task.id);
    if (parentId == null) continue;

    const parent = byId.get(parentId);
    if (parent) parent.children.push(task);
    else roots.push(task);
  }

  return roots;
}

/**
 * Orders rows within a project group.
 *
 * Overdue and dated work first, because that is the question the screen is
 * meant to answer; then priority; then everything without either, in the order
 * it arrived. Completed rows sink to the bottom of their group so ticking
 * something does not make it jump out from under the cursor.
 */
export function sortFeedTasks(tasks: UnifiedTask[]): UnifiedTask[] {
  return [...tasks].sort((a, b) => {
    if (a.is_checked !== b.is_checked) return a.is_checked ? 1 : -1;

    const aDue = a.due_at ? new Date(a.due_at).getTime() : null;
    const bDue = b.due_at ? new Date(b.due_at).getTime() : null;
    if (aDue !== null && bDue !== null && aDue !== bDue) return aDue - bDue;
    if (aDue !== null && bDue === null) return -1;
    if (aDue === null && bDue !== null) return 1;

    if (a.priority !== b.priority) return a.priority - b.priority;
    return 0;
  });
}

/**
 * Groups rows under a caller-supplied list of projects.
 *
 * **Projects with no tasks are kept.** That is the whole point of taking the
 * project list as an argument rather than deriving it from the tasks: Today's
 * View answers "what is on my plate", and a project you hold with nothing
 * queued is an answer — it says the queue is empty, which is different from the
 * project not existing. Deriving groups from tasks made those projects vanish,
 * so an empty plate looked identical to a plate someone else was holding.
 *
 * The project list also decides group order, so the caller's `ORDER BY` (urgent
 * first) survives. Re-sorting here would silently override it.
 *
 * A task whose project is absent from the list is dropped. The caller fetched
 * both from the same query, so that only happens if the two drift apart — and
 * rendering a group the caller did not ask for would hide that.
 */
export function groupTasksByProject(
  projects: Array<{ id: string; name: string; is_urgent: boolean }>,
  tasks: UnifiedTask[]
): TaskFeedGroup[] {
  const groups = new Map<string, TaskFeedGroup>();

  for (const project of projects) {
    groups.set(project.id, {
      project_id: project.id,
      project_name: project.name,
      project_is_urgent: project.is_urgent,
      tasks: [],
    });
  }

  for (const task of tasks) {
    groups.get(task.project_id)?.tasks.push(task);
  }

  for (const group of groups.values()) {
    group.tasks = sortFeedTasks(group.tasks);
  }

  return [...groups.values()];
}

/**
 * Counts a task and its subtasks as open work.
 *
 * Subtasks are counted here but not by the phase approval gate, and that is
 * deliberate: approval asks "is this phase finished", while this screen asks
 * "how much is left to do". A parent with four open subtasks is one blocker
 * and four pieces of work.
 */
export function countOpen(tasks: UnifiedTask[]): number {
  let total = 0;
  for (const task of tasks) {
    if (!task.is_checked) total += 1;
    total += task.children.filter((child) => !child.is_checked).length;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Date buckets — the Upcoming view
// ---------------------------------------------------------------------------

/**
 * The buckets, in the order they are shown.
 *
 * `overdue` first because it is the only one that is a problem rather than a
 * plan. `undated` last, and included on purpose: a task nobody dated is still
 * work, and a date view that silently omits it teaches people the view is
 * incomplete — which is exactly what makes a planning screen untrustworthy.
 */
export const DATE_BUCKETS = ["overdue", "today", "tomorrow", "this_week", "later", "undated"] as const;
export type DateBucket = (typeof DATE_BUCKETS)[number];

export interface DateBucketGroup {
  bucket: DateBucket;
  tasks: UnifiedTask[];
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Which bucket a task belongs in.
 *
 * A completed task is never `overdue` — a done task with a past date is not a
 * problem, and colouring it as one trains people to ignore the colour. It falls
 * into the bucket its date names instead.
 *
 * "This week" means the next seven days, not the calendar week. A calendar week
 * makes Friday's answer to "what's coming up" nearly empty and Monday's
 * enormous, which is the opposite of useful.
 */
export function bucketOf(task: UnifiedTask, now: Date = new Date()): DateBucket {
  if (!task.due_at) return "undated";

  const due = startOfDay(new Date(task.due_at));
  const today = startOfDay(now);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return task.is_checked ? "later" : "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "this_week";
  return "later";
}

/**
 * Splits tasks into date buckets, dropping the ones left empty.
 *
 * Subtasks are lifted to the top level here rather than nested under their
 * parents. On a date view they have their own dates and belong in their own
 * buckets — keeping them under a parent that sits in a different bucket would
 * put the same row in the wrong day.
 */
export function bucketTasksByDate(
  tasks: UnifiedTask[],
  now: Date = new Date()
): DateBucketGroup[] {
  const flat = tasks.flatMap((task) => [task, ...task.children]);
  const byBucket = new Map<DateBucket, UnifiedTask[]>();

  for (const task of flat) {
    const bucket = bucketOf(task, now);
    const list = byBucket.get(bucket);
    if (list) list.push(task);
    else byBucket.set(bucket, [task]);
  }

  return DATE_BUCKETS.map((bucket) => ({
    bucket,
    tasks: sortFeedTasks(byBucket.get(bucket) ?? []),
  })).filter((group) => group.tasks.length > 0);
}
