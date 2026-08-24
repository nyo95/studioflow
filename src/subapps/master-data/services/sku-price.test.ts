import test from "node:test";
import assert from "node:assert/strict";

import {
  checkPriceUnit,
  checkWorkPrice,
  hasPriceContent,
  isOfferChange,
  resolveEffectivePriceUnit,
  resolvePrice,
} from "./sku-price-rules";
import { canBePriceSource } from "./party-role-rules";
import {
  buildCategoryPath,
  categorySlug,
  dropAncestorTags,
  productParentFor,
  splitCategoryInput,
  PRODUCT_LEVEL1,
  WORK_LEVEL1,
} from "./category-tree-rules";

/**
 * These cover the rules that used to be wrong in four different places at once,
 * and that no type check can see: what a blank price means, when an edit is a
 * new offer, and when a row is worth writing at all.
 *
 * Only the pure helpers are exercised — `recordSkuPrice` and
 * `closeCurrentSkuPrice` touch Prisma, and `npm test` deliberately cannot
 * import anything that does (see roadmap §Perkakas). The database side is
 * covered by the `SkuPrice_current_uniq` index itself, which is the stronger
 * guarantee of the two.
 *
 * 2026-08-14: pasangan price_list / price_net menjadi satu kolom `price`, jadi
 * test "net jatuh ke list" hilang bersama aturannya. Yang TIDAK boleh hilang
 * adalah dua hal di bawah — nol yang disengaja tetap harga, dan kosong tetap
 * bukan nol.
 */

test("an explicit zero is a real price and must survive", () => {
  // The bug this guards: `price_net: data.catalog_price ?? 0` — which turned a
  // blank field into a real, wrong price of nothing that v_bq_material_rate
  // would then report as bq_ready. The inverse must also hold: a zero someone
  // typed on purpose is a free-of-charge item and must not be erased.
  assert.equal(resolvePrice(150_000), 150_000);
  assert.equal(resolvePrice(0), 0);
});

test("no price at all stays null instead of becoming a number", () => {
  assert.equal(resolvePrice(null), null);
  assert.equal(resolvePrice(undefined as unknown as null), null);
  assert.equal(resolvePrice(Number.NaN), null);
});

test("a row is only worth writing when it can say what the item costs", () => {
  assert.equal(hasPriceContent({ price: null }), false);
  assert.equal(hasPriceContent({ price: 90_000 }), true);
  assert.equal(
    hasPriceContent({ price: 0 }),
    true,
    "zero entered on purpose is a price — free-of-charge items exist"
  );
});

test("changing an amount, unit or supplier is a new offer", () => {
  const before = {
    price_net: 120_000,
    unit: "m2",
    supplier_party_id: null as string | null,
  };

  assert.equal(
    isOfferChange(before, { price: 100_000, unit: "m2", supplier_party_id: null }),
    true,
    "price changed"
  );
  assert.equal(
    isOfferChange(before, { price: 120_000, unit: "pcs", supplier_party_id: null }),
    true,
    "unit changed — the same number means something else per unit"
  );
  assert.equal(
    isOfferChange(before, { price: 120_000, unit: "m2", supplier_party_id: "party-1" }),
    true,
    "moved to a different supplier"
  );
});

test("changing nothing but the note is not a new offer", () => {
  const before = {
    price_net: 120_000,
    unit: "m2",
    supplier_party_id: null as string | null,
  };
  assert.equal(
    isOfferChange(before, { price: 120_000, unit: "m2", supplier_party_id: null }),
    false
  );
});

test("clearing the price is a change, and the action refuses to write it", () => {
  // Dengan satu kolom harga, mengosongkan field BUKAN lagi "tidak ada
  // perubahan" (dulu net kosong jatuh ke list). Ini perubahan — dan
  // `recordSkuPrice` mengembalikan null untuknya, sehingga action melempar
  // pesan "hapus harganya saja" alih-alih diam-diam menulis nol.
  const before = {
    price_net: 150_000,
    unit: "m2",
    supplier_party_id: null as string | null,
  };
  assert.equal(
    isOfferChange(before, { price: null, unit: "m2", supplier_party_id: null }),
    true
  );
  assert.equal(hasPriceContent({ price: null }), false);
});

test("Prisma Decimal values compare by value, not by reference", () => {
  // `before` comes straight off a Prisma row, where decimals are objects.
  // Comparing them with `!==` against a plain number is always true, which
  // would make every save look like a price change.
  const decimalLike = { toString: () => "120000", valueOf: () => 120000 };
  const before = {
    price_net: decimalLike as unknown,
    unit: "m2",
    supplier_party_id: null as string | null,
  };
  assert.equal(
    isOfferChange(before, { price: 120_000, unit: "m2", supplier_party_id: null }),
    false
  );
});

// ---------------------------------------------------------------------------
// Who may be named as the source of a price
// ---------------------------------------------------------------------------

test("Excel's own price sources are Retail, not Supplier", () => {
  // `design database masterdata.xlsx` Table 1 gives Ace Hardware and Informa
  // as the examples of "Supplier's Company", both categorised Retail, and
  // Table 2's "Supplied by" points back at them. A picker filtered to
  // role=SUPPLIER hid both of the workbook's own examples.
  assert.equal(canBePriceSource(["RETAIL"]), true);
  assert.equal(canBePriceSource(["SUPPLIER"]), true);
  assert.equal(canBePriceSource(["MANUFACTURER"]), true);
  assert.equal(canBePriceSource(["SUBCON"]), true, "supply-and-install quotes cover material too");
});

test("a party with no category at all is not a price source", () => {
  // Not a judgement about the company — nobody has said what it is yet, and
  // guessing is the thing this rule exists to avoid.
  assert.equal(canBePriceSource([]), false);
});

// ---------------------------------------------------------------------------
// Category tree (E3) — Excel writes the two levels in opposite order per table
// ---------------------------------------------------------------------------

test("path carries the ancestry so a subtree is one LIKE, not a recursive CTE", () => {
  assert.equal(buildCategoryPath(null, "Bahan Baku"), "bahan-baku");
  assert.equal(buildCategoryPath("bahan-baku", "Plywood"), "bahan-baku/plywood");
  assert.equal(buildCategoryPath("mep", "Lighting"), "mep/lighting");
});

test("a leaf may share its parent's name", () => {
  // Excel Table 2 row 1 fills Material and Category both with "HPL". That reads
  // like a contradiction and is not — "HPL" the material group contains "HPL"
  // the product category. The path keeps them distinguishable.
  assert.equal(buildCategoryPath("hpl", "HPL"), "hpl/hpl");
});

test("category slugs survive punctuation and accents identically to library-service", () => {
  // MUST match `slugifyTag` in library-service.ts. A one-character difference
  // creates a duplicate category instead of finding the existing one, and both
  // writes succeed — so nothing complains.
  assert.equal(categorySlug("Bahan Baku"), "bahan-baku");
  assert.equal(categorySlug("MEP / Lighting"), "mep-lighting");
  assert.equal(categorySlug("  Kaca & Cermin  "), "kaca-cermin");
});

test("a two-level string splits into parent and child", () => {
  assert.deepEqual(splitCategoryInput("MEP > Lighting"), { parent: "MEP", child: "Lighting" });
  assert.deepEqual(splitCategoryInput("Lighting"), { parent: null, child: "Lighting" });
  assert.deepEqual(
    splitCategoryInput("A > B > C"),
    { parent: "B", child: "C" },
    "a stray third level must not silently swallow the middle one"
  );
});

// ---------------------------------------------------------------------------
// The top level of the tree — keputusan owner 2026-08-11
// ---------------------------------------------------------------------------

test("a known leaf is filed under its level-1, an unknown one stays at the root", () => {
  assert.equal(productParentFor("HPL"), "Finishing");
  assert.equal(productParentFor("Plywood"), "Bahan Baku");
  assert.equal(productParentFor("Engsel"), "Hardware");
  // Not guessed. A tag nobody has mapped is filed at the top level rather than
  // invented into a group — the same refusal as the Party backfill.
  assert.equal(productParentFor("Barang Aneh"), null);
});

test("a level-1 name is never filed under itself", () => {
  // Without this, "Finishing" resolves to parent "Finishing" and the tree grows
  // a cycle the first time someone types the group name as a tag.
  for (const level1 of PRODUCT_LEVEL1) {
    assert.equal(productParentFor(level1), null, `${level1} must stay at the root`);
  }
});

test("an ancestor typed alongside its own leaf is dropped", () => {
  // "HPL, Finishing" means one thing. Storing both rebuilds Excel's two columns
  // inside the row we just merged them out of.
  assert.deepEqual(dropAncestorTags(["HPL", "Finishing"]), ["HPL"]);
  assert.deepEqual(dropAncestorTags(["Finishing", "HPL"]), ["HPL"]);
  // Two unrelated leaves are both real classifications, not a duplicate.
  assert.deepEqual(dropAncestorTags(["HPL", "Plywood"]), ["HPL", "Plywood"]);
  // A group on its own is still a usable answer — better than no category.
  assert.deepEqual(dropAncestorTags(["Finishing"]), ["Finishing"]);
});

test("level-1 lists are unique after slugging, or the picker offers one node twice", () => {
  for (const list of [PRODUCT_LEVEL1, WORK_LEVEL1]) {
    const slugs = list.map(categorySlug);
    assert.equal(new Set(slugs).size, slugs.length);
  }
});

// ---------------------------------------------------------------------------
// checkPriceUnit / resolveEffectivePriceUnit — keputusan owner U2 (R4, 2026-08-24)
// ---------------------------------------------------------------------------
//
// Satuan harga wajib = `purchase_unit` SKU saat tulis. Perbandingannya harus
// identik dengan `evaluateBqMaterialReadiness` (trim + persis): validasi tulis
// yang berbeda dari readiness berarti menyetujui baris yang BQ tolak, atau
// sebaliknya.

test("checkPriceUnit menolak satuan harga yang berbeda dari purchase unit", () => {
  const result = checkPriceUnit("pcs", "lembar");
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.issue, "PRICE_UNIT_MISMATCH");
  assert.equal(result.ok === false && result.unit, "pcs");
  assert.equal(result.ok === false && result.purchaseUnit, "lembar");
});

test("checkPriceUnit menerima satuan yang sama setelah trim", () => {
  assert.deepEqual(checkPriceUnit(" lembar ", "lembar"), { ok: true, unit: "lembar" });
  // Persis seperti readiness: perbandingan case-sensitive. "Lembar" ≠ "lembar"
  // adalah ketidakcocokan yang harus diperbaiki manusia, bukan disamarkan.
  const cased = checkPriceUnit("Lembar", "lembar");
  assert.equal(cased.ok, false);
});

test("checkPriceUnit lolos bila salah satu sisi belum ditetapkan", () => {
  // SKU tanpa costing profile belum bisa dibandingkan — readiness akan
  // melaporkan PURCHASE_UNIT_MISSING, bukan UNIT_MISMATCH. Mengisinya lewat
  // jalur harga adalah cara yang benar, bukan memblokirnya.
  assert.equal(checkPriceUnit("pcs", null).ok, true);
  assert.equal(checkPriceUnit(null, "lembar").ok, true);
  assert.equal(checkPriceUnit(null, null).ok, true);
});

test("satuan kosong mewarisi purchase unit, bukan mengarang pcs", () => {
  // Default "pcs" polos menghasilkan baris bersatuan karangan — persis data
  // yang readiness nanti tolak. Mewarisi `purchase_unit` menjaga baris baru
  // konsisten secara konstruksi.
  assert.equal(resolveEffectivePriceUnit("", "lembar"), "lembar");
  assert.equal(resolveEffectivePriceUnit("   ", "m2"), "m2");
  assert.equal(resolveEffectivePriceUnit("box", "lembar"), "box", "yang diisi eksplisit menang");
  assert.equal(resolveEffectivePriceUnit(null, null), "pcs", "fallback terakhir tetap pcs");
});

// ---------------------------------------------------------------------------
// checkWorkPrice — Excel Table 3 dan 4 (ditambahkan 2026-08-18, temuan B4)
// ---------------------------------------------------------------------------
//
// Kasus pertama di bawah adalah bug yang sebenarnya terjadi selama sembilan
// hari: `Number("")` adalah `0`, dan `WorkPrice.price` menerimanya tanpa satu
// pun pemeriksaan. Tarif nol tidak berhenti di Master Data — `v_bq_work_rate`
// membacanya dan ia menjadi satu baris di dokumen komersial.

test("checkWorkPrice menolak string kosong, bukan membacanya sebagai nol", () => {
  const result = checkWorkPrice("");
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.issue, "EMPTY");
  // Pengingat kenapa tes ini ada sama sekali:
  assert.equal(Number(""), 0);
});

test("checkWorkPrice menolak spasi kosong", () => {
  const result = checkWorkPrice("   ");
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.issue, "EMPTY");
});

test("checkWorkPrice menolak null dan undefined", () => {
  for (const value of [null, undefined]) {
    const result = checkWorkPrice(value);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.issue, "EMPTY");
  }
});

test("checkWorkPrice menolak yang bukan angka", () => {
  const result = checkWorkPrice("seratus ribu");
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.issue, "NOT_A_NUMBER");
});

test("checkWorkPrice menolak harga negatif", () => {
  const result = checkWorkPrice(-1);
  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.issue, "NEGATIVE");
});

test("checkWorkPrice menerima angka dan string berisi angka", () => {
  assert.deepEqual(checkWorkPrice(125000), { ok: true, value: 125000 });
  assert.deepEqual(checkWorkPrice("125000"), { ok: true, value: 125000 });
  assert.deepEqual(checkWorkPrice(" 125000 "), { ok: true, value: 125000 });
  assert.deepEqual(checkWorkPrice("1250.50"), { ok: true, value: 1250.5 });
});

test("checkWorkPrice menerima nol yang DIKETIK dengan sengaja", () => {
  // Nol yang ditulis orang adalah pernyataan ("gratis", "sudah termasuk"); nol
  // yang lahir dari field kosong adalah karangan. Yang ditolak hanya yang kedua
  // — itulah kenapa pemeriksaan kekosongan terjadi SEBELUM konversi angka.
  assert.deepEqual(checkWorkPrice(0), { ok: true, value: 0 });
  assert.deepEqual(checkWorkPrice("0"), { ok: true, value: 0 });
});
