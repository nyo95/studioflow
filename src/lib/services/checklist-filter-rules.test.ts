import assert from "node:assert/strict";
import test from "node:test";
import {
  fromChecklistFilterQuery,
  toChecklistFilterQuery,
} from "./checklist-filter-rules";

test("saved checklist filters round-trip every built-in view", () => {
  for (const filter of ["all", "today", "overdue", "p1", "mine"] as const) {
    const query = toChecklistFilterQuery(filter, false);
    assert.deepEqual(fromChecklistFilterQuery(query), {
      filter,
      showCompleted: false,
    });
  }
});

test("completed status survives the structured representation", () => {
  const query = toChecklistFilterQuery("mine", true);
  assert.equal(query.status, "COMPLETED");
  assert.deepEqual(fromChecklistFilterQuery(query), {
    filter: "mine",
    showCompleted: true,
  });
});
