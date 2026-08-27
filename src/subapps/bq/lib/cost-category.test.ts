import test from "node:test";
import assert from "node:assert/strict";

import { costCategoryLabel } from "./cost-category";

test("pure labor keeps the default UPAH label quiet", () => {
  assert.equal(costCategoryLabel("UPAH", "UPAH", false), null);
});

test("a service that includes material is reported separately from pure labor", () => {
  assert.equal(costCategoryLabel("UPAH", "UPAH", true), "Material + Upah");
});

test("non-default cost categories keep their existing labels", () => {
  assert.equal(costCategoryLabel("ALAT", "UPAH", false), "Alat");
});
