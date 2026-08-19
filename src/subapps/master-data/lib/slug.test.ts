import test from "node:test";
import assert from "node:assert/strict";

import { slugify } from "./slug";
import { categorySlug } from "../services/category-tree-rules";

// ---------------------------------------------------------------------------
// Regression tests for the canonical slug generator.
//
// Before 2026-08-12 there were seven implementations — three with NFKD and four
// without. The NFKD variants all agreed; the non-NFKD variants silently dropped
// accented characters ("café" → "caf" instead of "cafe"). This test file locks
// the canonical behaviour so it cannot drift again.
// ---------------------------------------------------------------------------

test("diakritik yang decompose NFKD: é, ö, ü, å → e, o, u, a", () => {
  // Characters whose NFKD decomposition produces a base letter + combining mark
  // (U+0300–U+036F) are stripped correctly.
  assert.equal(slugify("PT Café Créme"), "pt-cafe-creme");
  assert.equal(slugify("Ångström Malmö"), "angstrom-malmo");
  assert.equal(slugify("Müller Överström"), "muller-overstrom");
});

test("diakritik yang TIDAK decompose NFKD: ø, æ → jadi separator", () => {
  // ø (U+00F8) and æ (U+00E6) do NOT decompose under NFKD — they stay as
  // single code points outside [a-z0-9], so they become hyphens. This is
  // documented known behaviour, not a bug: these characters are rare in
  // Indonesian/Master Data context.
  assert.equal(slugify("Høst & Vinter"), "h-st-vinter");
  assert.equal(slugify("Ærlig"), "rlig");
});

test("uppercase → lowercase", () => {
  assert.equal(slugify("TACO HPL"), "taco-hpl");
  assert.equal(slugify("BRAND NAME"), "brand-name");
});

test("whitespace berlebih di-trim", () => {
  assert.equal(slugify("  TACO   HPL  "), "taco-hpl");
  assert.equal(slugify("TACO\tHPL\nSheet"), "taco-hpl-sheet");
  assert.equal(slugify("\r\n  hello  \r\n"), "hello");
});

test("tanda baca jadi hyphen", () => {
  assert.equal(slugify("TH 231 AC - ANDESH WALNUT"), "th-231-ac-andesh-walnut");
  assert.equal(slugify("A---B__C!!!D"), "a-b-c-d");
});

test("hyphen di ujung dibuang", () => {
  assert.equal(slugify("--TACO--"), "taco");
  assert.equal(slugify("- hello -"), "hello");
});

test("alfanumerik terjaga", () => {
  assert.equal(slugify("plywood 9mm"), "plywood-9mm");
  assert.equal(slugify("Item #42 (large)"), "item-42-large");
});

test("string habis terserialisasi → string kosong (bukan error)", () => {
  assert.equal(slugify("!!!"), "");
  assert.equal(slugify("   "), "");
  assert.equal(slugify(""), "");
});

test("non-Latin: karakter CJK/hiragana dibuang, angka tetap ada", () => {
  // Didokumentasikan sebagai perilaku yang diketahui, bukan kecelakaan.
  assert.equal(slugify("合板 9mm"), "9mm");
  assert.equal(slugify("かな 123"), "123");
});

test("idempoten: slugify(slugify(x)) === slugify(x)", () => {
  const cases = [
    "PT Café Créme",
    "Ångström Malmö",
    "TACO HPL",
    "  TACO   HPL  ",
    "TH 231 AC - ANDESH WALNUT",
    "A---B__C!!!D",
    "--TACO--",
    "plywood 9mm",
    "!!!",
    "   ",
    "",
    "合板 9mm",
    "Müller Överström",
    "Høst & Vinter",
  ];
  for (const input of cases) {
    assert.equal(slugify(slugify(input)), slugify(input), `idempotent for: ${JSON.stringify(input)}`);
  }
});

test("kesetaraan kanonik: slugify ≡ categorySlug", () => {
  // categorySlug is now an alias for slugify — they are literally the same
  // function. This test locks that equivalence.
  assert.equal(slugify, categorySlug, "categorySlug must be the same function reference as slugify");

  const cases = [
    "PT Café Créme",
    "Ångström Malmö",
    "TACO HPL",
    "MEP / Lighting",
    "Bahan Baku",
    "Kaca & Cermin",
    "  Kaca & Cermin  ",
    "Müller Överström",
    "Høst & Vinter",
    "TH 231 AC - ANDESH WALNUT",
    "plywood 9mm",
  ];
  for (const input of cases) {
    assert.equal(slugify(input), categorySlug(input), `equiv for: ${JSON.stringify(input)}`);
  }
});

test("tabrakan slug: dua nama berbeda bisa menghasilkan slug yang sama (by design)", () => {
  // "Andesh Walnut" dan "ANDESH  WALNUT!" → keduanya "andesh-walnut"
  // Ini bukan bug generator — tabrakan adalah sinyal, bukan kesalahan.
  assert.equal(slugify("Andesh Walnut"), "andesh-walnut");
  assert.equal(slugify("ANDESH  WALNUT!"), "andesh-walnut");
  assert.equal(slugify("Andesh Walnut"), slugify("ANDESH  WALNUT!"));
});
