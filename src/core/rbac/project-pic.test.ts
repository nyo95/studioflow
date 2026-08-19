/**
 * Tests for PIC eligibility.
 *
 * The interesting half is not "DIC may be a designer" — it is the two escape
 * hatches, because both exist to stop a silent data change and both look like
 * they could be deleted as dead weight.
 *
 * Note on the 2026-08-10 change: ADMIN and DEVELOPER became eligible designers.
 * Several cases below previously used ADMIN as their "ineligible role" example
 * and would now pass for the wrong reason — they were moved to STAFF and
 * ESTIMATOR, which remain ineligible for both seats. A test that still passes
 * after the rule it guards has been inverted is worse than no test.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  DESIGNER_ROLES,
  DRAFTER_ROLES,
  eligibleDesigners,
  eligibleDrafters,
  isPicAssignable,
} from "./project-pic";
import type { Role } from "@/generated/prisma";

const users: Array<{ id: string; role: Role }> = [
  { id: "dic", role: "DIC" },
  { id: "dric", role: "DRIC" },
  { id: "staff", role: "STAFF" },
  { id: "admin", role: "ADMIN" },
  { id: "dev", role: "DEVELOPER" },
  { id: "estimator", role: "ESTIMATOR" },
];

test("designer seat offers DIC plus admin-level roles", () => {
  // Owner request 2026-08-10. Order follows the input array, not the constant.
  assert.deepEqual(eligibleDesigners(users).map((u) => u.id), ["dic", "admin", "dev"]);
});

test("designer seat still excludes STAFF and ESTIMATOR", () => {
  // The narrow half of the 2026-08-10 change: admin-level roles came back,
  // STAFF did not. STAFF was never a designer role — it was collateral from the
  // same over-broad list that caused the original bug.
  const ids = eligibleDesigners(users).map((u) => u.id);
  assert.equal(ids.includes("staff"), false);
  assert.equal(ids.includes("estimator"), false);
});

test("drafter seat offers DRIC only", () => {
  // The reported bug: STAFF was listed as a candidate drafter. The designer
  // seat widening did not touch this one.
  assert.deepEqual(eligibleDrafters(users).map((u) => u.id), ["dric"]);
});

test("the current holder is kept even when their role no longer qualifies", () => {
  // Without this the picker is an uncontrolled <select> whose defaultValue
  // matches no option, so the browser shows the first one — and a save that
  // never touched the field reassigns the project.
  const designers = eligibleDesigners(users, "staff");
  assert.deepEqual(designers.map((u) => u.id), ["dic", "staff", "admin", "dev"]);

  const drafters = eligibleDrafters(users, "staff");
  assert.deepEqual(drafters.map((u) => u.id), ["dric", "staff"]);
});

test("keeping the holder does not duplicate an already-eligible one", () => {
  assert.deepEqual(eligibleDesigners(users, "dic").map((u) => u.id), ["dic", "admin", "dev"]);
  assert.deepEqual(eligibleDesigners(users, "admin").map((u) => u.id), ["dic", "admin", "dev"]);
});

test("no current holder means no exception", () => {
  assert.deepEqual(eligibleDesigners(users, null).map((u) => u.id), ["dic", "admin", "dev"]);
  assert.deepEqual(eligibleDesigners(users, undefined).map((u) => u.id), ["dic", "admin", "dev"]);
});

test("assignment: an eligible role is accepted", () => {
  assert.equal(
    isPicAssignable({ role: "DIC" }, DESIGNER_ROLES, { currentId: "old", nextId: "new" }),
    true
  );
  assert.equal(
    isPicAssignable({ role: "ADMIN" }, DESIGNER_ROLES, { currentId: "old", nextId: "new" }),
    true,
    "2026-08-10: admin-level roles may hold the designer seat"
  );
  assert.equal(
    isPicAssignable({ role: "DEVELOPER" }, DESIGNER_ROLES, { currentId: "old", nextId: "new" }),
    true
  );
});

test("assignment: an ineligible role is refused", () => {
  assert.equal(
    isPicAssignable({ role: "STAFF" }, DRAFTER_ROLES, { currentId: "old", nextId: "new" }),
    false
  );
  assert.equal(
    isPicAssignable({ role: "STAFF" }, DESIGNER_ROLES, { currentId: "old", nextId: "new" }),
    false,
    "widening the designer seat to admin-level roles did not widen it to STAFF"
  );
  assert.equal(
    isPicAssignable({ role: "ADMIN" }, DRAFTER_ROLES, { currentId: "old", nextId: "new" }),
    false,
    "admin-level roles were added to the designer seat only — the drafter seat is DRIC"
  );
});

test("assignment: unchanged is always allowed, whatever the role", () => {
  // A project assigned before the roles were tightened must stay saveable.
  // Without this, editing an unrelated field on it would fail and the only way
  // out would be reassigning a project nobody asked to reassign.
  //
  // STAFF, not ADMIN: ADMIN is eligible for the designer seat since 2026-08-10,
  // so it would pass on the eligibility branch and prove nothing about the
  // unchanged short-circuit.
  assert.equal(
    isPicAssignable({ role: "STAFF" }, DESIGNER_ROLES, { currentId: "same", nextId: "same" }),
    true
  );
  assert.equal(
    isPicAssignable(null, DESIGNER_ROLES, { currentId: "same", nextId: "same" }),
    true,
    "unchanged short-circuits before the candidate is even needed"
  );
});

test("assignment: a missing candidate is refused when the value changes", () => {
  assert.equal(
    isPicAssignable(null, DESIGNER_ROLES, { currentId: "old", nextId: "new" }),
    false
  );
});
