/**
 * Tests for the unified Today feed.
 *
 * The cases here are the ones where the plausible implementation is the wrong
 * one: an Activity must NOT inherit its project's urgency as a task priority,
 * a subtask whose parent got filtered out must stay reachable, and grouping
 * must not re-sort the projects the caller already ordered.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  bucketOf,
  bucketTasksByDate,
  countOpen,
  formatPhaseLabel,
  fromActivity,
  fromChecklistTask,
  groupTasksByProject,
  nestChecklistSubtasks,
  sortFeedTasks,
} from "./task-feed";
import type { ChecklistTask } from "@/types/checklist";
import type { UnifiedTask } from "@/types/task-feed";

const ctx = {
  projectId: "p1",
  projectName: "Project One",
  projectIsUrgent: false,
  phaseLabel: null,
};

function checklistTask(over: Partial<ChecklistTask> = {}): ChecklistTask {
  return {
    id: "c1",
    label: "task",
    is_checked: false,
    project_id: "p1",
    phase_id: null,
    parent_id: null,
    sort_order: 0,
    priority: 4,
    due_at: null,
    assigned_to: null,
    template_id: null,
    created_at: "2026-08-01T00:00:00.000Z",
    checked_at: null,
    labels: [],
    comment_count: 0,
    ...over,
  };
}

function unified(over: Partial<UnifiedTask> = {}): UnifiedTask {
  return {
    key: "checklist:x",
    id: "x",
    source: "checklist",
    label: "t",
    is_checked: false,
    project_id: "p1",
    project_name: "Project One",
    phase_label: null,
    priority: 4,
    due_at: null,
    assigned_to: null,
    labels: [],
    comment_count: 0,
    mode: null,
    template_id: null,
    children: [],
    project_is_urgent: false,
    ...over,
  };
}

const at = (y: number, m: number, d: number) => new Date(y, m, d).toISOString();

test("formatPhaseLabel turns the enum into something readable", () => {
  assert.equal(formatPhaseLabel("DESIGN_3D"), "DESIGN 3D");
  assert.equal(formatPhaseLabel("CD"), "CD");
});

test("activity keeps neutral priority even when its project is urgent", () => {
  const task = fromActivity(
    { id: "a1", content: "fix", status: "OPEN", mode: "TODO", due_at: null, assigned_to: null },
    { ...ctx, projectIsUrgent: true }
  );

  assert.equal(task.priority, 4, "project urgency is not task priority");
  assert.equal(task.due_at, null);
  assert.equal(task.project_is_urgent, true, "but it is still carried separately");
});

test("activity keys are distinct from checklist keys", () => {
  // Both tables mint their own UUIDs; a collision is unlikely but the whole
  // point of `key` is that identity must not depend on that being true.
  const a = fromActivity(
    { id: "same", content: "a", status: "OPEN", mode: "TODO", due_at: null, assigned_to: null },
    ctx
  );
  const c = fromChecklistTask(checklistTask({ id: "same" }), ctx);

  assert.notEqual(a.key, c.key);
  assert.equal(a.key, "activity:same");
  assert.equal(c.key, "checklist:same");
});

test("FEEDBACK survives the projection, other modes normalise to TODO", () => {
  const feedback = fromActivity(
    { id: "a", content: "c", status: "OPEN", mode: "FEEDBACK", due_at: null, assigned_to: null },
    ctx
  );
  const todo = fromActivity(
    { id: "b", content: "c", status: "OPEN", mode: "TODO", due_at: null, assigned_to: null },
    ctx
  );

  assert.equal(feedback.mode, "FEEDBACK");
  assert.equal(todo.mode, "TODO");
});

test("checklist projection carries priority, due date and template origin", () => {
  const task = fromChecklistTask(
    checklistTask({ priority: 1, due_at: at(2026, 7, 10), template_id: "tpl" }),
    { ...ctx, phaseLabel: "LAYOUT" }
  );

  assert.equal(task.priority, 1);
  assert.equal(task.due_at, at(2026, 7, 10));
  assert.equal(task.template_id, "tpl");
  assert.equal(task.phase_label, "LAYOUT");
  assert.equal(task.mode, null, "checklist rows have no activity mode");
});

test("nesting puts subtasks under their parent and leaves activities alone", () => {
  const parent = unified({ key: "checklist:a", id: "a" });
  const child = unified({ key: "checklist:a1", id: "a1" });
  const activity = unified({ key: "activity:z", id: "z", source: "activity" });

  const roots = nestChecklistSubtasks(
    [parent, child, activity],
    new Map([
      ["a", null],
      ["a1", "a"],
    ])
  );

  assert.deepEqual(roots.map((r) => r.id), ["a", "z"]);
  assert.deepEqual(roots[0].children.map((c) => c.id), ["a1"]);
  assert.equal(roots[1].children.length, 0);
});

test("a subtask whose parent is absent is promoted, not dropped", () => {
  const orphan = unified({ key: "checklist:o", id: "o" });

  const roots = nestChecklistSubtasks([orphan], new Map([["o", "missing"]]));

  assert.equal(roots.length, 1);
  assert.equal(roots[0].id, "o");
});

test("sorting: completed sink, dated beat undated, then priority", () => {
  const rows = [
    unified({ key: "1", id: "1", priority: 1 }),
    unified({ key: "2", id: "2", due_at: at(2026, 7, 20) }),
    unified({ key: "3", id: "3", due_at: at(2026, 7, 1) }),
    unified({ key: "4", id: "4", is_checked: true, due_at: at(2026, 6, 1) }),
    unified({ key: "5", id: "5", priority: 3 }),
  ];

  assert.deepEqual(
    sortFeedTasks(rows).map((t) => t.id),
    ["3", "2", "1", "5", "4"]
  );
});

test("sorting does not mutate its input", () => {
  const rows = [unified({ key: "1", id: "1", is_checked: true }), unified({ key: "2", id: "2" })];
  const before = rows.map((t) => t.id);

  sortFeedTasks(rows);

  assert.deepEqual(rows.map((t) => t.id), before);
});

const project = (id: string, name = id.toUpperCase(), is_urgent = false) => ({ id, name, is_urgent });

test("grouping preserves the caller's project order", () => {
  // The query orders urgent projects first; re-sorting here would throw that
  // away without anything saying so.
  const groups = groupTasksByProject(
    [project("b", "B"), project("a", "A")],
    [
      unified({ key: "a1", id: "a1", project_id: "a" }),
      unified({ key: "b1", id: "b1", project_id: "b" }),
    ]
  );

  assert.deepEqual(groups.map((g) => g.project_id), ["b", "a"]);
});

test("a project with no tasks is KEPT — an empty queue is an answer", () => {
  // This is the whole reason grouping takes a project list. Deriving groups
  // from tasks made a project you hold with nothing queued disappear, so an
  // empty plate looked identical to a project somebody else was holding.
  const groups = groupTasksByProject(
    [project("busy"), project("quiet")],
    [unified({ key: "t", id: "t", project_id: "busy" })]
  );

  assert.deepEqual(groups.map((g) => g.project_id), ["busy", "quiet"]);
  assert.equal(groups[1].tasks.length, 0);
});

test("a task whose project is not in the list is dropped, not invented", () => {
  const groups = groupTasksByProject(
    [project("a")],
    [unified({ key: "ghost", id: "ghost", project_id: "gone" })]
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].project_id, "a");
  assert.equal(groups[0].tasks.length, 0);
});

test("grouping carries the project's urgency, not the task's copy of it", () => {
  const groups = groupTasksByProject([project("a", "A", true)], []);
  assert.equal(groups[0].project_is_urgent, true);
  assert.deepEqual(groupTasksByProject([], []), []);
});

test("countOpen counts subtasks, which the approval gate deliberately does not", () => {
  const parent = unified({
    key: "p",
    id: "p",
    children: [
      unified({ key: "c1", id: "c1" }),
      unified({ key: "c2", id: "c2", is_checked: true }),
    ],
  });

  assert.equal(countOpen([parent]), 2, "one parent + one open child");

  const done = unified({ key: "d", id: "d", is_checked: true });
  assert.equal(countOpen([done]), 0);
});

// ---------------------------------------------------------------------------
// Date buckets
// ---------------------------------------------------------------------------

const NOW = new Date(2026, 7, 10, 14, 0, 0); // Mon 10 Aug 2026, local

test("bucketOf places each date where its heading claims", () => {
  assert.equal(bucketOf(unified({ due_at: at(2026, 7, 1) }), NOW), "overdue");
  assert.equal(bucketOf(unified({ due_at: at(2026, 7, 10) }), NOW), "today");
  assert.equal(bucketOf(unified({ due_at: at(2026, 7, 11) }), NOW), "tomorrow");
  assert.equal(bucketOf(unified({ due_at: at(2026, 7, 17) }), NOW), "this_week");
  assert.equal(bucketOf(unified({ due_at: at(2026, 7, 18) }), NOW), "later");
  assert.equal(bucketOf(unified({ due_at: null }), NOW), "undated");
});

test("a completed task with a past date is never overdue", () => {
  // Same rule as the Overdue filter: a done task with a past date is not a
  // problem, and marking it as one trains people to ignore the colour.
  const done = unified({ due_at: at(2026, 7, 1), is_checked: true });
  assert.equal(bucketOf(done, NOW), "later");
});

test('"this week" is the next seven days, not the calendar week', () => {
  // A calendar week makes Friday's answer to "what's coming" nearly empty and
  // Monday's enormous — the opposite of useful.
  assert.equal(bucketOf(unified({ due_at: at(2026, 7, 16) }), NOW), "this_week");
  assert.equal(bucketOf(unified({ due_at: at(2026, 7, 17) }), NOW), "this_week", "day 7 is in");
  assert.equal(bucketOf(unified({ due_at: at(2026, 7, 18) }), NOW), "later", "day 8 is out");
});

test("buckets come back in reading order, and empty ones are dropped", () => {
  const groups = bucketTasksByDate(
    [
      unified({ key: "l", id: "l", due_at: at(2026, 8, 1) }),
      unified({ key: "o", id: "o", due_at: at(2026, 7, 1) }),
      unified({ key: "t", id: "t", due_at: at(2026, 7, 10) }),
    ],
    NOW
  );

  assert.deepEqual(groups.map((g) => g.bucket), ["overdue", "today", "later"]);
});

test("subtasks are lifted into their own bucket, not left under a parent", () => {
  // On a date view a subtask carries its own date. Keeping it nested under a
  // parent that sits in a different bucket would file the row on the wrong day.
  const parent = unified({
    key: "p",
    id: "p",
    due_at: at(2026, 8, 1),
    children: [unified({ key: "c", id: "c", due_at: at(2026, 7, 10) })],
  });

  const groups = bucketTasksByDate([parent], NOW);

  assert.deepEqual(groups.map((g) => g.bucket), ["today", "later"]);
  assert.equal(groups[0].tasks[0].id, "c");
  assert.equal(groups[1].tasks[0].id, "p");
});

test("an activity's due date survives the projection", () => {
  const task = fromActivity(
    { id: "a", content: "c", status: "OPEN", mode: "TODO", due_at: new Date(2026, 7, 10), assigned_to: null },
    ctx
  );

  assert.equal(bucketOf(task, NOW), "today");
});
