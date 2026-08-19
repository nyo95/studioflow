/**
 * Task shapes shared by every reader of `ProjectChecklist`.
 *
 * These live in one place on purpose. Before roadmap §C the phase view and the
 * project overview each selected and sorted checklist rows their own way, and
 * neither produced insertion order — the phase view sorted by UUID, the
 * overview re-sorted alphabetically in the browser. Anything that reads tasks
 * should go through `checklist-task.ts` and land on these types.
 *
 * Dates are `string`, not `Date`: the phase view receives this shape as JSON
 * from the heartbeat endpoint, so a `Date` here would be a lie on the client.
 * Conversion happens once, at the mapper.
 */

export const CHECKLIST_PRIORITIES = [1, 2, 3, 4] as const;
export type ChecklistPriority = (typeof CHECKLIST_PRIORITIES)[number];

export interface ChecklistLabelRef {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistUserRef {
  id: string;
  name: string;
}

export interface ChecklistTask {
  id: string;
  label: string;
  is_checked: boolean;
  project_id: string;
  phase_id: string | null;
  parent_id: string | null;
  sort_order: number;
  priority: number;
  /** ISO 8601. Date-only by construction — nothing writes a time component. */
  due_at: string | null;
  assigned_to: ChecklistUserRef | null;
  /** Non-null means the row came from a template and can be regenerated. */
  template_id: string | null;
  created_at: string;
  labels: ChecklistLabelRef[];
  comment_count: number;
  /** ISO 8601, or null if never checked / unchecked after the field was added. */
  checked_at: string | null;
}

/** A root task with its subtasks attached. What the list actually renders. */
export interface ChecklistTaskNode extends ChecklistTask {
  children: ChecklistTask[];
}

/**
 * The minimum a row needs to be filterable.
 *
 * Declared structurally rather than as `ChecklistTask` so the same filter code
 * serves the unified Today feed, whose rows come from `Activity` as well.
 * Two implementations of "what counts as overdue" would drift, and the one in
 * the less-used surface would drift silently.
 */
export interface FilterableTask {
  is_checked: boolean;
  due_at: string | null;
  priority: number;
  assigned_to: { id: string } | null;
}

/**
 * The four built-in views.
 *
 * Written as code rather than stored as rows: saved filters only start earning
 * their keep once someone has enough tasks to have a repeated personal slice,
 * and until then a filter editor is a screen to maintain with nothing in it.
 * Adding `ChecklistFilterView` later is purely additive — see roadmap §C2.
 */
export const CHECKLIST_FILTERS = ["all", "today", "overdue", "p1", "mine"] as const;
export type ChecklistFilter = (typeof CHECKLIST_FILTERS)[number];

export function isChecklistFilter(value: string): value is ChecklistFilter {
  return (CHECKLIST_FILTERS as readonly string[]).includes(value);
}

/** Structured persisted form of a Tasks filter. Never store a text DSL here. */
export interface ChecklistFilterQuery {
  status: "OPEN" | "COMPLETED";
  priority: "P1" | null;
  assignee: "ME" | null;
  due: "TODAY_OR_EARLIER" | "OVERDUE" | null;
}

export interface ChecklistFilterViewData {
  id: string;
  name: string;
  query: ChecklistFilterQuery;
}
