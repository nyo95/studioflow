import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPurchaseConversion,
  calculateArea,
  calculateVolume,
  convertMeasurement,
  normalizeMeasurement,
} from "./measurement";

test("length converts mm ↔ cm ↔ m", () => {
  assert.equal(convertMeasurement(1200, "mm", "m"), 1.2);
  assert.equal(convertMeasurement(2.4, "m", "cm"), 240);
  assert.equal(convertMeasurement(50, "cm", "mm"), 500);
});

test("same unit is identity even when unknown to tables", () => {
  assert.equal(convertMeasurement(7, "ft", "ft"), 7);
});

test("cross-dimension conversion throws", () => {
  assert.throws(() => convertMeasurement(1, "m", "m2"), /DIMENSION_MISMATCH/);
  assert.throws(() => convertMeasurement(1, "m2", "m3"), /DIMENSION_MISMATCH/);
});

test("unsupported unit names throw, never silently coerce", () => {
  assert.throws(() => convertMeasurement(1, "ft", "m"), /UNSUPPORTED_UNIT/i);
});

test("calculateArea returns square meters from any length unit", () => {
  assert.equal(calculateArea(1200, 2400, "MM"), 2.88);
  assert.equal(calculateArea(120, 240, "CM"), 2.88);
  assert.equal(calculateArea(1.2, 2.4, "M"), 2.88);
});

test("calculateVolume returns cubic meters", () => {
  assert.equal(calculateVolume(1000, 1000, 1000, "MM"), 1);
});

test("normalizeMeasurement trims float noise", () => {
  assert.equal(normalizeMeasurement(0.1 + 0.2), 0.3);
  assert.equal(normalizeMeasurement(2.8800000000000003), 2.88);
});

test("purchase conversion divides usage qty by usage-per-purchase factor", () => {
  const result = applyPurchaseConversion(8.03, 2.88);
  assert.ok(Math.abs(result - 8.03 / 2.88) < 1e-12);
  assert.equal(applyPurchaseConversion(5.76, 2.88), 2);
});

test("zero or negative conversion throws instead of || 1", () => {
  assert.throws(() => applyPurchaseConversion(1, 0), /CONVERSION_NOT_POSITIVE/);
  assert.throws(() => applyPurchaseConversion(1, -2), /CONVERSION_NOT_POSITIVE/);
});
