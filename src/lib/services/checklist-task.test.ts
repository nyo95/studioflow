/**
 * Tests for the pure half of the task layer (roadmap §C).
 *
 * Run with:
 *   npx tsc src/lib/services/checklist-task.ts --outDir tmp/test-out \
 *     --module esnext --target es2022 --moduleResolution bundler --skipLibCheck
 *   node --test tmp/test-out/…
 *
 * or through whatever runner picks up `*.test.ts` alongside
 * `src/lib/activity-copy.test.ts`. Everything imported here is type-only at
 * runtime, so no database or Prisma client is involved.
 *
 * These cover the cases that were decided rather than obvious — a completed
 * task not counting as overdue, an orphaned subtask staying reachable, and
 * "Ditugaskan ke saya" matching nothing when nobody is logged in. Each of those
 * is a place where the plausible implementation is the wrong one.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  CHECKLIST_TASK_ORDER_BY,
  CHECKLIST_TASK_SELECT,
  applyChecklistFilter,
  buildChecklistTree,
  countChecklistFilters,
  reorderChecklistSiblings,
} from "./checklist-task";
import type { ChecklistTask } from "@/types/checklist";

function task(over: Partial<ChecklistTask> = {}): ChecklistTask {
  return {
    id: "x",
    label: "l",
    is_checked: false,
    project_id: "p",
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

/** Fixed local clock: 10 Aug 2026, 14:00. */
const NOW = new Date(2026, 7, 10, 14, 0, 0);
const at = (y: number, m: number, d: number) => new Date(y, m, d).toISOString();

test("tree: children nest under their parent and keep input order", () => {
  const tree = buildChecklistTree([
    task({ id: "a" }),
    task({ id: "b" }),
    task({ id: "a1", parent_id: "a" }),
    task({ id: "a2", parent_id: "a" }),
  ]);

  assert.deepEqual(tree.map((n) => n.id), ["a", "b"]);
  assert.deepEqual(tree[0].children.map((n) => n.id), ["a1", "a2"]);
  assert.equal(tree[1].children.length, 0);
});

test("tree: a subtask whose parent was filtered out is promoted, not dropped", () => {
  const tree = buildChecklistTree([task({ id: "c1", parent_id: "missing" })]);

  assert.equal(tree.length, 1, "hiding it would make the task unreachable");
  assert.equal(tree[0].id, "c1");
});

test("reorder: roots move without disturbing interleaved subtasks", () => {
  const rows = [
    task({ id: "a" }),
    task({ id: "a1", parent_id: "a" }),
    task({ id: "b" }),
    task({ id: "b1", parent_id: "b" }),
    task({ id: "c" }),
  ];

  const result = reorderChecklistSiblings(rows, "a", "c");

  assert.deepEqual(result?.taskIds, ["b", "c", "a"]);
  assert.deepEqual(result?.items.map((row) => row.id), ["b", "a1", "c", "b1", "a"]);
});

test("reorder: subtasks move only inside their own parent", () => {
  const rows = [
    task({ id: "a" }),
    task({ id: "a1", parent_id: "a" }),
    task({ id: "b1", parent_id: "b" }),
    task({ id: "a2", parent_id: "a" }),
  ];

  const result = reorderChecklistSiblings(rows, "a2", "a1");

  assert.deepEqual(result?.taskIds, ["a2", "a1"]);
  assert.deepEqual(result?.items.map((row) => row.id), ["a", "a2", "b1", "a1"]);
});

test("reorder: dropping across a parent boundary is refused", () => {
  const rows = [
    task({ id: "a" }),
    task({ id: "a1", parent_id: "a" }),
    task({ id: "b1", parent_id: "b" }),
  ];

  assert.equal(reorderChecklistSiblings(rows, "a1", "b1"), null);
  assert.equal(reorderChecklistSiblings(rows, "a", "a1"), null);
});

test("filter today: includes overdue and today, excludes tomorrow and undated", () => {
  const got = applyChecklistFilter(
    [
      task({ id: "past", due_at: at(2026, 7, 1) }),
      task({ id: "today", due_at: at(2026, 7, 10) }),
      task({ id: "tomorrow", due_at: at(2026, 7, 11) }),
      task({ id: "undated" }),
    ],
    "today",
    null,
    NOW
  ).map((t) => t.id);

  assert.deepEqual(got, ["past", "today"]);
});

test("filter overdue: a completed task with a past date is not overdue", () => {
  const got = applyChecklistFilter(
    [
      task({ id: "open", due_at: at(2026, 7, 1) }),
      task({ id: "done", due_at: at(2026, 7, 1), is_checked: true }),
      task({ id: "today", due_at: at(2026, 7, 10) }),
    ],
    "overdue",
    null,
    NOW
  ).map((t) => t.id);

  assert.deepEqual(got, ["open"], "otherwise the tab stays permanently red");
});

test("filter p1: only open P1 tasks", () => {
  const got = applyChecklistFilter(
    [
      task({ id: "open", priority: 1 }),
      task({ id: "done", priority: 1, is_checked: true }),
      task({ id: "p2", priority: 2 }),
    ],
    "p1",
    null,
    NOW
  ).map((t) => t.id);

  assert.deepEqual(got, ["open"]);
});

test("filter mine: with no current user it matches nothing, not everything", () => {
  const rows = [
    task({ id: "mine", assigned_to: { id: "u1", name: "A" } }),
    task({ id: "theirs", assigned_to: { id: "u2", name: "B" } }),
    task({ id: "unassigned" }),
  ];

  assert.deepEqual(applyChecklistFilter(rows, "mine", "u1", NOW).map((t) => t.id), ["mine"]);
  assert.deepEqual(applyChecklistFilter(rows, "mine", null, NOW), []);
});

test("filter all returns the same array it was given", () => {
  const rows = [task({ id: "a" }), task({ id: "b" })];
  assert.equal(applyChecklistFilter(rows, "all", null, NOW), rows);
});

test("tab counts agree with the filters they label", () => {
  const counts = countChecklistFilters(
    [
      task({ id: "1", priority: 1 }),
      task({ id: "2", due_at: at(2026, 7, 1) }),
      task({ id: "3", assigned_to: { id: "u1", name: "A" } }),
    ],
    "u1",
    NOW
  );

  assert.equal(counts.all, 3);
  assert.equal(counts.p1, 1);
  assert.equal(counts.overdue, 1);
  assert.equal(counts.today, 1);
  assert.equal(counts.mine, 1);
});

test("ordering rule is sort_order, then created_at, then id", () => {
  assert.deepEqual(CHECKLIST_TASK_ORDER_BY, [
    { sort_order: "asc" },
    { created_at: "asc" },
    { id: "asc" },
  ]);
});

test("select carries every scalar the DTO promises", () => {
  const required = [
    "id",
    "label",
    "is_checked",
    "project_id",
    "phase_id",
    "parent_id",
    "sort_order",
    "priority",
    "due_at",
    "template_id",
    "created_at",
  ] as const;

  for (const field of required) {
    assert.equal(CHECKLIST_TASK_SELECT[field], true, `missing from select: ${field}`);
  }

  assert.ok(CHECKLIST_TASK_SELECT.assigned_to);
  assert.ok(CHECKLIST_TASK_SELECT.labels);
  assert.ok(CHECKLIST_TASK_SELECT._count);
});
