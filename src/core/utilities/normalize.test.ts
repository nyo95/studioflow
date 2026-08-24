import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyToNull,
  normalizeCode,
  normalizeName,
  normalizeSearchText,
  trimOrNull,
} from "./normalize";

test("trimOrNull trims and nulls empties", () => {
  assert.equal(trimOrNull("  x  "), "x");
  assert.equal(trimOrNull("   "), null);
  assert.equal(trimOrNull(null), null);
  assert.equal(trimOrNull(undefined), null);
});

test("emptyToNull passes non-empty values through unchanged", () => {
  assert.equal(emptyToNull(0), 0);
  assert.equal(emptyToNull(false), false);
  assert.equal(emptyToNull(""), null);
  assert.equal(emptyToNull("data"), "data");
});

test("normalizeName collapses internal whitespace but keeps case", () => {
  assert.equal(normalizeName("  Ace   Hardware  "), "Ace Hardware");
  assert.equal(normalizeName("Plywood 9mm"), "Plywood 9mm");
  assert.equal(normalizeName(" \t "), null);
});

test("normalizeCode optionally uppercases", () => {
  assert.equal(normalizeCode(" ab-12 "), "ab-12");
  assert.equal(normalizeCode(" ab-12 ", { uppercase: true }), "AB-12");
  assert.equal(normalizeCode(""), null);
});

test("normalizeSearchText is lowercase, NFKC, whitespace-collapsed", () => {
  assert.equal(normalizeSearchText("  Plywood   9mm "), "plywood 9mm");
  assert.equal(normalizeSearchText("Ｐｌｙwood"), "plywood");
  assert.equal(normalizeSearchText(null), "");
});
