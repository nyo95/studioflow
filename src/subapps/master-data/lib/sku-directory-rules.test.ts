import test from "node:test";
import assert from "node:assert/strict";
import { isSkuDataComplete } from "./sku-directory-rules";

test("SKU data is complete with a name, base unit, and product category", () => {
  assert.equal(
    isSkuDataComplete({ productName: "HPL", baseUnit: "sheet", categoryCount: 1 }),
    true
  );
});

test("missing category or base unit keeps SKU data incomplete", () => {
  assert.equal(
    isSkuDataComplete({ productName: "HPL", baseUnit: "sheet", categoryCount: 0 }),
    false
  );
  assert.equal(
    isSkuDataComplete({ productName: "HPL", baseUnit: "", categoryCount: 1 }),
    false
  );
});

test("manufacturer code and brand are not completeness requirements", () => {
  // Both are nullable canonical facts under Master Data Contract v2 §0.
  assert.equal(
    isSkuDataComplete({ productName: "Generic plywood", baseUnit: "sheet", categoryCount: 1 }),
    true
  );
});
