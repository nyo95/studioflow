import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBqMaterialReadiness } from "./bq-readiness";

const valid = {
  skuExists: true,
  skuDeleted: false,
  skuStatus: "ACTIVE",
  price: { unit: "sqm" },
  purchaseUnit: "sqm",
  conversion: 1,
};

test("BQ readiness accepts a usable active SKU", () => {
  assert.deepEqual(evaluateBqMaterialReadiness(valid), { ok: true });
});

test("BQ readiness only requires a price with a priced unit", () => {
  for (const input of [
    { ...valid, price: null },
    { ...valid, price: { unit: "" } },
  ]) {
    assert.equal(evaluateBqMaterialReadiness(input).ok, false);
  }

  for (const input of [
    { ...valid, purchaseUnit: null },
    { ...valid, conversion: null },
    { ...valid, conversion: 0 },
    { ...valid, price: { unit: "pcs" } },
  ]) {
    assert.equal(evaluateBqMaterialReadiness(input).ok, true);
  }
});

test("BQ readiness rejects deleted and discontinued SKUs", () => {
  assert.equal(evaluateBqMaterialReadiness({ ...valid, skuDeleted: true }).ok, false);
  assert.equal(evaluateBqMaterialReadiness({ ...valid, skuStatus: "DISCONTINUED" }).ok, false);
  assert.equal(evaluateBqMaterialReadiness({ ...valid, skuExists: false }).ok, false);
});
