/**
 * One shape for the Today feed, fed by two different tables.
 *
 * StudioFlow has two things that are both "a task", and they are not the same
 * thing (roadmap §C):
 *
 *   - `Activity` (`mode = TODO | FEEDBACK`) — a work item inside the revision
 *     loop. Carries `revision_id` and `deferred_from_version`; its life follows
 *     the revision it belongs to. No due date, no priority, no subtasks.
 *   - `ProjectChecklist` — the task list proper. Priority, due date, subtasks,
 *     labels, assignee.
 *
 * The decision recorded in the roadmap was to unify them **in the view, not in
 * the table**. That is what this type is: a read-side projection both sources
 * map onto. Nothing writes a `UnifiedTask`; each row keeps its own write path,
 * keyed by `source`.
 *
 * Fields the source cannot supply are filled with the neutral value — priority
 * 4 ("none"), `due_at: null` — never invented. An `Activity` in a project
 * marked URGENT is *not* promoted to P1: project urgency and task priority are
 * different claims, and blurring them would make the P1 filter mean "urgent
 * project OR urgent task", which is neither.
 */

import type { ChecklistLabelRef, ChecklistUserRef } from "@/types/checklist";

export type TaskSource = "activity" | "checklist";

export interface UnifiedTask {
  /** Unique across both sources — the raw row id is only unique within one. */
  key: string;
  id: string;
  source: TaskSource;

  label: string;
  is_checked: boolean;

  project_id: string;
  project_name: string;
  /** Display name of the owning phase, or null for project-level rows. */
  phase_label: string | null;

  /** Always 4 for `Activity`; that source has no priority. */
  priority: number;
  /** Always null for `Activity`; that source has no due date. */
  due_at: string | null;
  assigned_to: ChecklistUserRef | null;
  labels: ChecklistLabelRef[];
  comment_count: number;

  /** `Activity` only. FEEDBACK rows render as a message icon, not a checkbox. */
  mode: "TODO" | "FEEDBACK" | null;
  /** `ProjectChecklist` only. Non-null means the row came from a template. */
  template_id: string | null;
  /** `ProjectChecklist` only. Subtasks are nested under their parent. */
  children: UnifiedTask[];

  /** Project-level flag, kept separate from `priority` on purpose (see above). */
  project_is_urgent: boolean;
}

export interface TaskFeedGroup {
  project_id: string;
  project_name: string;
  project_is_urgent: boolean;
  tasks: UnifiedTask[];
}
