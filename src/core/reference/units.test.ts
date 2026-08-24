import test from "node:test";
import assert from "node:assert/strict";
import {
  isKnownUnit,
  normalizeUnit,
  resolveUnit,
  unitDimension,
} from "./units";

test("aliases normalize to one canonical symbol", () => {
  for (const input of ["sheet", "Sheet", "lembar", "sht", "SHEET"]) {
    assert.equal(normalizeUnit(input), "SHEET");
  }
  for (const input of ["sqm", "m2", "M²", "sq m", "meter persegi"]) {
    assert.equal(normalizeUnit(input), "M2");
  }
  assert.equal(normalizeUnit("jam"), "HOUR");
  assert.equal(normalizeUnit("hari"), "DAY");
});

test("unknown units pass through uppercased, not nulled", () => {
  assert.equal(normalizeUnit("botol"), "BOTOL");
  assert.equal(normalizeUnit("  Botol  "), "BOTOL");
});

test("null / empty / whitespace return null", () => {
  assert.equal(normalizeUnit(null), null);
  assert.equal(normalizeUnit(""), null);
  assert.equal(normalizeUnit("   "), null);
});

test("isKnownUnit distinguishes dictionary units from free text", () => {
  assert.equal(isKnownUnit("Lembar"), true);
  assert.equal(isKnownUnit("botol"), false);
  assert.equal(isKnownUnit(null), false);
});

test("resolveUnit exposes label and dimension", () => {
  const sheet = resolveUnit("lembar");
  assert.ok(sheet);
  assert.equal(sheet.symbol, "SHEET");
  assert.equal(sheet.dimension, "COUNT");

  const sqm = resolveUnit("SQM");
  assert.ok(sqm);
  assert.equal(sqm.dimension, "AREA");
});

test("unitDimension returns dimension or null", () => {
  assert.equal(unitDimension("M3"), "VOLUME");
  assert.equal(unitDimension("kubik"), null);
});
