import test from "node:test";
import assert from "node:assert/strict";
import { formatMoney, parseMoney, resolveCurrency, roundMoney } from "./money";

test("IDR formats with zero decimals and Rp symbol", () => {
  assert.equal(formatMoney(370000, "IDR"), "Rp370.000");
});

test("SGD and USD format with two decimals", () => {
  assert.equal(formatMoney(1234.5, "SGD"), "S$1,234.50");
  assert.equal(formatMoney(1234.5, "USD"), "$1,234.50");
});

test("unknown currency throws", () => {
  assert.throws(() => resolveCurrency("EUR"), /UNKNOWN_CURRENCY/);
});

test("roundMoney respects currency decimal places", () => {
  assert.equal(roundMoney(1234.5678, "IDR"), 1235);
  assert.equal(roundMoney(1234.5678, "USD"), 1234.57);
});

test("parseMoney reads plain digits", () => {
  assert.equal(parseMoney("370000", "IDR"), 370000);
});

test("parseMoney reads Indonesian grouping with Rp prefix", () => {
  assert.equal(parseMoney("Rp370.000", "IDR"), 370000);
  assert.equal(parseMoney("Rp 1.250.000", "IDR"), 1250000);
});

test("parseMoney treats trailing ,xx as decimals (rounded to IDR dp)", () => {
  assert.equal(parseMoney("1.234,56", "IDR"), 1235);
});

test("parseMoney treats dot-decimal only in the dot-decimal shape", () => {
  assert.equal(parseMoney("1234.5", "IDR"), 12345);
  assert.equal(parseMoney("12.5", "IDR"), 13);
});

test("parseMoney handles SGD-style input", () => {
  assert.equal(parseMoney("S$1,234.56", "SGD"), 1234.56);
  assert.equal(parseMoney("1,234.56 SGD", "SGD"), 1234.56);
});

test("parseMoney returns null for empty or non-numeric input", () => {
  assert.equal(parseMoney("", "IDR"), null);
  assert.equal(parseMoney("   ", "IDR"), null);
  assert.equal(parseMoney("nego", "IDR"), null);
});
