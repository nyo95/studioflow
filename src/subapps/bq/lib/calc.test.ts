import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPurchaseSummary,
  computeObject,
  computeProject,
  resolveWaste,
  type MaterialLineInput,
  type ObjectInput,
  type ServiceLineInput,
  type SubObjectInput,
} from "./calc";

/**
 * Acceptance test PRD BQ Bab 10. Angka contoh Bab 7 dikunci apa adanya:
 * README BQ menulis *"Setiap perubahan pada mesin hitung wajib mereproduksi
 * angka ini. Kalau meleset, mesin hitungnya yang salah, bukan angkanya."*
 *
 * Berkas ini sengaja tidak mengimpor apa pun selain `./calc` — `npm test`
 * hanya mengompilasi berkas yang tidak menjangkau Prisma (lihat
 * `scripts/run-tests.mjs`), dan itulah yang menjamin mesin hitung tidak
 * diam-diam membaca ulang master data.
 */

// ---------------------------------------------------------------------------
// Master dummy Bab 7
// ---------------------------------------------------------------------------

const PLY = { skuId: "PLY-18", name: "Plywood 18mm", usageUnit: "sqm", purchaseUnit: "lembar", conversion: 2.9768, price: 285_000, waste: 0.1 };
const HPL = { skuId: "HPL-014", name: "HPL Taco TH-014 AA", usageUnit: "sqm", purchaseUnit: "lembar", conversion: 2.9768, price: 210_000, waste: 0.08 };
const EDG = { skuId: "EDG-PVC", name: "Edging PVC 2mm", usageUnit: "m'", purchaseUnit: "roll", conversion: 50, price: 95_000, waste: 0.05 };
const ENG = { skuId: "HDW-ENG", name: "Engsel Soft Close", usageUnit: "pcs", purchaseUnit: "pcs", conversion: 1, price: 38_000, waste: 0 };
const SS = { skuId: "SS-HL", name: "Stainless Hairline 1.2mm", usageUnit: "sqm", purchaseUnit: "lembar", conversion: 2.9719, price: 1_450_000, waste: 0.12 };

test("project-local material and service lines calculate without Master Data ids", () => {
  const local: ObjectInput = {
    id: "local-object",
    name: "Custom fixture",
    code: null,
    qty: 2,
    unit: "unit",
    markupPct: 0.2,
    wasteOverridePct: null,
    subObjects: [{
      id: "local-sub",
      name: "Custom breakdown",
      qty: 1,
      materials: [{
        id: "local-material",
        skuId: null,
        name: "Custom marble",
        usageUnit: "sqm",
        purchaseUnit: "sqm",
        conversion: 1,
        pricePerPurchaseUnit: 1_250_000,
        qtyPerSub: 1,
        wasteOverridePct: 0.15,
        materialDefaultWastePct: null,
        categoryDefaultWastePct: null,
        minimumOrder: null,
        roundingIncrement: 1,
      }],
      services: [{
        id: "local-service",
        workPriceId: null,
        name: "Custom install",
        rateUnit: "sqm",
        pricePerRateUnit: 125_000,
        qtyPerSub: 1,
      }],
    }],
  };

  const result = computeObject(local);
  assert.equal(result.baseCostPerUnit, 1_562_500);
  assert.equal(result.ratePerUnit, 1_875_000);
  assert.equal(result.total, 3_750_000);
});

let seq = 0;
function mat(
  m: typeof PLY,
  qtyPerSub: number,
  overrides: Partial<MaterialLineInput> = {}
): MaterialLineInput {
  return {
    id: `m${++seq}`,
    skuId: m.skuId,
    name: m.name,
    usageUnit: m.usageUnit,
    purchaseUnit: m.purchaseUnit,
    conversion: m.conversion,
    pricePerPurchaseUnit: m.price,
    qtyPerSub,
    wasteOverridePct: null,
    materialDefaultWastePct: m.waste,
    categoryDefaultWastePct: null,
    minimumOrder: null,
    roundingIncrement: 1,
    ...overrides,
  };
}

function svc(name: string, rateUnit: string, price: number, qtyPerSub: number): ServiceLineInput {
  return {
    id: `s${++seq}`,
    workPriceId: name,
    name,
    rateUnit,
    pricePerRateUnit: price,
    qtyPerSub,
  };
}

function sub(name: string, qty: number, materials: MaterialLineInput[], services: ServiceLineInput[]): SubObjectInput {
  return { id: `sub-${name}`, name, qty, materials, services };
}

/** Counter Cabinet CC-1 — PRD Bab 7. `ambalanQty` diparameterkan supaya AT-02
 *  bisa memakai object yang sama persis, cuma dengan pengali L2 berbeda. */
function counterCabinet(ambalanQty = 3): ObjectInput {
  seq = 0;
  return {
    id: "obj-cc1",
    name: "Counter Cabinet CC-1",
    code: "CC-1",
    qty: 1,
    unit: "unit",
    markupPct: 0.2,
    wasteOverridePct: null,
    subObjects: [
      sub(
        "Body Kabinet",
        1,
        [mat(PLY, 4.2), mat(HPL, 5.0), mat(EDG, 12.0)],
        [svc("Jasa Potong & Rakit Kabinet", "ls", 850_000, 1), svc("Jasa Pasang HPL", "sqm", 65_000, 5.0)]
      ),
      sub(
        "Ambalan",
        ambalanQty,
        [mat(PLY, 0.5), mat(EDG, 2.4)],
        [svc("Jasa Pasang HPL", "sqm", 65_000, 0.5), svc("Jasa Pasang Ambalan", "pcs", 45_000, 1)]
      ),
      sub(
        "Pintu Kabinet",
        2,
        [mat(PLY, 0.8), mat(HPL, 0.9), mat(ENG, 2.0)],
        [svc("Jasa Pasang HPL", "sqm", 65_000, 0.9), svc("Jasa Pasang Pintu & Engsel", "pcs", 75_000, 1)]
      ),
      sub("Top Table Stainless", 1, [mat(SS, 1.8)], [svc("Jasa Fabrikasi Stainless", "sqm", 320_000, 1.8)]),
    ],
  };
}

/** Bab 7 mencetak rupiah utuh; mesin hitung menyimpan penuh. Bandingkan
 *  setelah dibulatkan, bukan dengan toleransi mengambang — toleransi
 *  menyembunyikan tepat jenis kesalahan yang test ini cari. */
function rupiah(value: number): number {
  return Math.round(value);
}

// ---------------------------------------------------------------------------
// AT-01 — angka acuan
// ---------------------------------------------------------------------------

test("AT-01: contoh Bab 7 menghasilkan rate Rp5.653.559 dan biaya pokok Rp4.711.299", () => {
  const r = computeObject(counterCabinet());

  assert.equal(rupiah(r.baseCostPerUnit), 4_711_299);
  assert.equal(rupiah(r.markupAmountPerUnit), 942_260);
  assert.equal(rupiah(r.ratePerUnit), 5_653_559);
  assert.equal(rupiah(r.total), 5_653_559);
});

test("AT-01b: subtotal tiap L2 cocok dengan Bab 7", () => {
  const r = computeObject(counterCabinet());
  const byName = Object.fromEntries(r.subObjects.map((s) => [s.name, rupiah(s.subtotal)]));

  assert.equal(byName["Body Kabinet"], 2_022_207);
  assert.equal(byName["Ambalan"], 404_836);
  assert.equal(byName["Pintu Kabinet"], 724_644);
  assert.equal(byName["Top Table Stainless"], 1_559_613);
});

test("L1 tertutup tetap tahu isinya — AT-11", () => {
  const r = computeObject(counterCabinet());
  assert.equal(r.subObjectCount, 4);
  // 5 + 4 + 5 + 2 — Body, Ambalan, Pintu, Top Table.
  assert.equal(r.lineCount, 16);
});

// ---------------------------------------------------------------------------
// AT-02 — pengali L2
// ---------------------------------------------------------------------------

test("AT-02: ambalan 3 → 5 menaikkan seluruh angka di atasnya tanpa input ulang", () => {
  const before = computeObject(counterCabinet(3));
  const after = computeObject(counterCabinet(5));

  const ambalanBefore = before.subObjects.find((s) => s.name === "Ambalan")!;
  const ambalanAfter = after.subObjects.find((s) => s.name === "Ambalan")!;

  // Sub-object itu sendiri naik tepat 5/3 — bukti pengali L2 dipakai, bukan
  // angka yang dihitung ulang di kepala estimator.
  assert.ok(Math.abs(ambalanAfter.subtotal / ambalanBefore.subtotal - 5 / 3) < 1e-12);

  // Selisihnya merambat ke atas persis sebesar selisih sub-object-nya.
  const delta = ambalanAfter.subtotal - ambalanBefore.subtotal;
  assert.ok(Math.abs(after.baseCostPerUnit - (before.baseCostPerUnit + delta)) < 1e-6);
  assert.ok(after.ratePerUnit > before.ratePerUnit);

  // Sub-object lain tidak ikut bergerak.
  const bodyBefore = before.subObjects.find((s) => s.name === "Body Kabinet")!;
  const bodyAfter = after.subObjects.find((s) => s.name === "Body Kabinet")!;
  assert.equal(bodyAfter.subtotal, bodyBefore.subtotal);
});

test("AT-02b: purchase summary ikut berubah saat pengali L2 berubah", () => {
  const before = buildPurchaseSummary([counterCabinet(3)]);
  const after = buildPurchaseSummary([counterCabinet(5)]);

  const plyBefore = before.rows.find((r) => r.skuId === "PLY-18")!;
  const plyAfter = after.rows.find((r) => r.skuId === "PLY-18")!;

  assert.ok(plyAfter.projectGross > plyBefore.projectGross);
});

// ---------------------------------------------------------------------------
// AT-03 / AT-04 — presedensi waste
// ---------------------------------------------------------------------------

test("AT-03: default bahan menang atas default kategori", () => {
  const r = resolveWaste(
    { wasteOverridePct: null, materialDefaultWastePct: 0.1, categoryDefaultWastePct: 0.05 },
    null
  );
  assert.equal(r.pct, 0.1);
  assert.equal(r.source, "MATERIAL_DEFAULT");
});

test("AT-04: nol eksplisit di baris menang atas default bahan — 0 bukan kosong", () => {
  const r = resolveWaste(
    { wasteOverridePct: 0, materialDefaultWastePct: 0.1, categoryDefaultWastePct: 0.05 },
    null
  );
  assert.equal(r.pct, 0);
  assert.equal(r.source, "LINE_OVERRIDE");
});

test("presedensi lengkap: baris > object > bahan > kategori > 0", () => {
  const full = { wasteOverridePct: 0.2, materialDefaultWastePct: 0.1, categoryDefaultWastePct: 0.05 };
  assert.equal(resolveWaste(full, 0.15).source, "LINE_OVERRIDE");
  assert.equal(resolveWaste({ ...full, wasteOverridePct: null }, 0.15).source, "OBJECT_OVERRIDE");
  assert.equal(resolveWaste({ ...full, wasteOverridePct: null }, null).source, "MATERIAL_DEFAULT");
  assert.equal(
    resolveWaste({ wasteOverridePct: null, materialDefaultWastePct: null, categoryDefaultWastePct: 0.05 }, null).source,
    "CATEGORY_DEFAULT"
  );
  assert.equal(
    resolveWaste({ wasteOverridePct: null, materialDefaultWastePct: null, categoryDefaultWastePct: null }, null).source,
    "ZERO_FALLBACK"
  );
});

test("override object nol eksplisit juga menang atas default bahan", () => {
  const r = resolveWaste(
    { wasteOverridePct: null, materialDefaultWastePct: 0.1, categoryDefaultWastePct: null },
    0
  );
  assert.equal(r.pct, 0);
  assert.equal(r.source, "OBJECT_OVERRIDE");
});

// ---------------------------------------------------------------------------
// AT-06 / AT-12 — purchase summary
// ---------------------------------------------------------------------------

test("AT-06: agregasi dulu, baru dibulatkan — plywood 8,03 sqm jadi 3 lembar", () => {
  const summary = buildPurchaseSummary([counterCabinet()]);
  const ply = summary.rows.find((r) => r.skuId === "PLY-18")!;

  assert.equal(Number(ply.projectGross.toFixed(4)), 8.03);
  assert.equal(Number(ply.purchaseRaw.toFixed(4)), 2.6975);
  assert.equal(ply.purchaseQty, 3);
  assert.equal(ply.purchaseCost, 855_000);

  // Pembulatan per baris akan menghasilkan 1+1+1 = 3 di sini secara kebetulan,
  // jadi buktinya diambil dari `purchaseRaw`: ia < 3, yang berarti tiga
  // pemakaian plywood memang dijumlahkan lebih dulu.
  assert.ok(ply.purchaseRaw < 3);
});

test("Bab 7: seluruh baris purchase summary tereproduksi", () => {
  const summary = buildPurchaseSummary([counterCabinet()]);
  const by = Object.fromEntries(summary.rows.map((r) => [r.skuId, r]));

  assert.equal(by["PLY-18"].purchaseQty, 3);
  assert.equal(by["HPL-014"].purchaseQty, 3);
  assert.equal(by["EDG-PVC"].purchaseQty, 1);
  assert.equal(by["HDW-ENG"].purchaseQty, 4);
  assert.equal(by["SS-HL"].purchaseQty, 1);

  assert.equal(Number(by["HPL-014"].projectGross.toFixed(4)), 7.344);
  assert.equal(Number(by["EDG-PVC"].projectGross.toFixed(4)), 20.16);
  assert.equal(Number(by["HDW-ENG"].projectGross.toFixed(4)), 4);
  assert.equal(Number(by["SS-HL"].projectGross.toFixed(4)), 2.016);

  assert.equal(rupiah(summary.totalPurchaseCost), 3_182_000);
  assert.equal(rupiah(summary.totalBqCost), 2_460_799);
  assert.equal(rupiah(summary.packagingVariance), 721_201);
});

test("AT-12: packaging variance tidak menyentuh rate object", () => {
  const obj = counterCabinet();
  const rateAlone = computeObject(obj).ratePerUnit;

  const summary = buildPurchaseSummary([obj]);
  assert.ok(summary.packagingVariance > 0);

  // Rate dihitung ulang setelah purchase summary dibangun — tidak ada jalur
  // di mana variance bisa merembes balik ke object.
  assert.equal(computeObject(obj).ratePerUnit, rateAlone);
});

test("dua object berbagi bahan: gross diagregasi lintas object sebelum dibulatkan", () => {
  const a = counterCabinet();
  const b = { ...counterCabinet(), id: "obj-cc2", name: "Counter Cabinet CC-2" };

  const single = buildPurchaseSummary([a]);
  const pair = buildPurchaseSummary([a, b]);

  const plySingle = single.rows.find((r) => r.skuId === "PLY-18")!;
  const plyPair = pair.rows.find((r) => r.skuId === "PLY-18")!;

  assert.ok(Math.abs(plyPair.projectGross - plySingle.projectGross * 2) < 1e-9);
  // 2 x 2,6975 = 5,395 lembar → 6, bukan 3+3 yang kebetulan sama. Yang
  // penting: satu pembulatan, bukan dua.
  assert.equal(plyPair.purchaseQty, 6);

  // Dan variance-nya menyusut relatif terhadap belanjanya — persis alasan
  // PRD mengagregasi sebelum membulatkan.
  assert.ok(
    pair.packagingVariance / pair.totalPurchaseCost <
      single.packagingVariance / single.totalPurchaseCost
  );
});

test("L1.qty ikut mengalikan kebutuhan pembelian", () => {
  const obj = counterCabinet();
  obj.qty = 2;

  const summary = buildPurchaseSummary([obj]);
  const ply = summary.rows.find((r) => r.skuId === "PLY-18")!;
  assert.equal(Number(ply.projectGross.toFixed(4)), 16.06);
});

test("minimum order jadi lantai, rounding increment jadi kelipatan", () => {
  const obj: ObjectInput = {
    id: "o",
    name: "Test",
    code: null,
    qty: 1,
    unit: "unit",
    markupPct: 0,
    wasteOverridePct: null,
    subObjects: [
      sub(
        "S",
        1,
        [
          mat(PLY, 0.1, { skuId: "MIN", minimumOrder: 5, roundingIncrement: 1 }),
          mat(EDG, 60, { skuId: "INC", minimumOrder: null, roundingIncrement: 2 }),
        ],
        []
      ),
    ],
  };

  const summary = buildPurchaseSummary([obj]);
  const min = summary.rows.find((r) => r.skuId === "MIN")!;
  const inc = summary.rows.find((r) => r.skuId === "INC")!;

  assert.ok(min.purchaseRaw < 1);
  assert.equal(min.purchaseQty, 5, "minimum order harus jadi lantai");

  // 60 m' + 5% = 63 → 63/50 = 1,26 roll → ceil ke kelipatan 2 = 2.
  assert.equal(inc.purchaseQty, 2, "rounding increment harus jadi kelipatan");
});

// ---------------------------------------------------------------------------
// Batas dan kegagalan yang harus keras
// ---------------------------------------------------------------------------

test("konversi nol dilempar, bukan diam-diam diganti 1", () => {
  const obj: ObjectInput = {
    id: "o",
    name: "Broken",
    code: null,
    qty: 1,
    unit: "unit",
    markupPct: 0,
    wasteOverridePct: null,
    subObjects: [sub("S", 1, [mat(PLY, 1, { conversion: 0 })], [])],
  };

  assert.throws(() => computeObject(obj), /conversion must be greater than zero/);
});

test("baris tanpa skuId tetap masuk rate tapi dilaporkan tidak teragregasi", () => {
  const obj: ObjectInput = {
    id: "o",
    name: "Orphan",
    code: null,
    qty: 1,
    unit: "unit",
    markupPct: 0,
    wasteOverridePct: null,
    subObjects: [sub("S", 1, [mat(PLY, 1, { skuId: null })], [])],
  };

  assert.ok(computeObject(obj).baseCostPerUnit > 0);

  const summary = buildPurchaseSummary([obj]);
  assert.equal(summary.rows.length, 0);
  assert.equal(summary.unlinkedLineCount, 1);
});

test("baris ber-SKU sama dari penawaran supplier berbeda tidak dijumlahkan jadi satu", () => {
  const obj: ObjectInput = {
    id: "o",
    name: "Two suppliers",
    code: null,
    qty: 1,
    unit: "unit",
    markupPct: 0,
    wasteOverridePct: null,
    subObjects: [
      sub(
        "S",
        1,
        [mat(PLY, 1), mat(PLY, 1, { pricePerPurchaseUnit: 310_000 })],
        []
      ),
    ],
  };

  const summary = buildPurchaseSummary([obj]);
  assert.equal(summary.rows.length, 2, "harga berbeda = pembelian berbeda");
});

test("project kosong menghasilkan nol, bukan NaN", () => {
  const totals = computeProject([]);
  assert.equal(totals.grandTotal, 0);
  assert.equal(totals.baseCost, 0);
  assert.equal(totals.markupAmount, 0);

  const summary = buildPurchaseSummary([]);
  assert.equal(summary.packagingVariance, 0);
  assert.equal(summary.rows.length, 0);
});

test("grand total project = Σ total object", () => {
  const totals = computeProject([counterCabinet(), { ...counterCabinet(), id: "o2", qty: 2 }]);
  assert.equal(rupiah(totals.grandTotal), rupiah(5_653_559 + 5_653_559 * 2));
  assert.equal(rupiah(totals.baseCost), rupiah(4_711_299 + 4_711_299 * 2));
});

// ---------------------------------------------------------------------------
// CoW-01..06 — copy-on-write: harga baris setelah override
// ---------------------------------------------------------------------------

/** Sub-object helper: 1 baris bahan dengan harga snapshot default. */
function simpleObj(priceSnapshot: number): ObjectInput {
  seq = 0;
  return {
    id: "o-cow",
    name: "CoW Object",
    code: null,
    qty: 1,
    unit: "unit",
    markupPct: 0,
    wasteOverridePct: null,
    subObjects: [
      sub("S", 1, [mat(PLY, 1, { pricePerPurchaseUnit: priceSnapshot })], []),
    ],
  };
}

test("CoW-01: snapshot harga awal dipakai dalam kalkulasi", () => {
  const r = computeObject(simpleObj(285_000));
  // cost = 1 sqm * (1 + 0.1 waste) * (285000 / 2.9768) ≈ 105.407
  assert.ok(r.baseCostPerUnit > 0);
  const pricePerUsage = 285_000 / 2.9768;
  const expected = 1 * (1 + 0.1) * pricePerUsage;
  assert.ok(Math.abs(r.baseCostPerUnit - expected) < 1e-4);
});

test("CoW-02: harga yang di-override menghasilkan kalkulasi berbeda", () => {
  const base = computeObject(simpleObj(285_000));
  const overridden = computeObject(simpleObj(310_000));
  assert.ok(overridden.baseCostPerUnit > base.baseCostPerUnit);
});

test("CoW-03: dua object dengan snapshot berbeda tetap terisolasi", () => {
  const a = simpleObj(285_000);
  const b = { ...simpleObj(310_000), id: "o-cow-2" };
  const totals = computeProject([a, b]);

  const rA = totals.objects.find((o) => o.objectId === "o-cow")!;
  const rB = totals.objects.find((o) => o.objectId === "o-cow-2")!;
  assert.ok(rB.baseCostPerUnit > rA.baseCostPerUnit);
});

test("CoW-04: mengubah snapshot tidak memengaruhi purchase summary object lain", () => {
  const a = simpleObj(285_000);
  const bBase = simpleObj(285_000);
  bBase.id = "o-cow-b";

  const summaryBefore = buildPurchaseSummary([a, bBase]);
  const plyBefore = summaryBefore.rows.find((r) => r.skuId === "PLY-18")!;

  // Naikkan harga snapshot object B
  bBase.subObjects[0]!.materials[0]!.pricePerPurchaseUnit = 310_000;
  const summaryAfter = buildPurchaseSummary([a, bBase]);

  // Baris PLY-18 kini terpecah: dua harga berbeda → dua baris
  assert.equal(summaryAfter.rows.filter((r) => r.skuId === "PLY-18").length, 2);
  // Object A tidak terpengaruh — barisnya masih dengan harga 285.000
  const plyA = summaryAfter.rows.find(
    (r) => r.skuId === "PLY-18" && r.pricePerPurchaseUnit === 285_000
  )!;
  assert.ok(Math.abs(plyA.projectGross - plyBefore.projectGross / 2) < 1e-6);
});

test("CoW-05: waste override baris tidak mengubah baris lain di sub-object yang sama", () => {
  seq = 0;
  const obj: ObjectInput = {
    id: "o",
    name: "Multi-line",
    code: null,
    qty: 1,
    unit: "unit",
    markupPct: 0,
    wasteOverridePct: null,
    subObjects: [
      sub(
        "S",
        1,
        [
          mat(PLY, 1),                           // waste default 0.1
          mat(HPL, 1, { wasteOverridePct: 0 }),  // override ke 0
        ],
        []
      ),
    ],
  };

  const r = computeObject(obj);
  const [plyResult, hplResult] = r.subObjects[0]!.materials;
  assert.equal(plyResult!.wastePct, 0.1);   // PLY tidak kena override HPL
  assert.equal(hplResult!.wastePct, 0);     // HPL override-nya sendiri
});

test("CoW-06: AT-01 tetap Rp5.653.559 — gate angka tidak bergeser", () => {
  const r = computeObject(counterCabinet());
  assert.equal(Math.round(r.ratePerUnit), 5_653_559);
});

// ---------------------------------------------------------------------------
// OVR-01..02 — price override di material line (snapshot disalin oleh DB layer,
//              calc.ts hanya menerima nilai yang sudah disalin)
// ---------------------------------------------------------------------------

test("OVR-01: harga override (manual) tercermin dalam kalkulasi rate", () => {
  // Simulasikan override harga: snapshot_price_per_purchase_unit diganti nilai
  // manual (misalnya negosiasi harga). calc.ts tidak tahu apakah ini override
  // atau bukan — ia menerima angka apa adanya.
  const originalRate = computeObject(simpleObj(285_000)).ratePerUnit;
  const overriddenRate = computeObject(simpleObj(250_000)).ratePerUnit;

  // Harga turun → rate turun
  assert.ok(overriddenRate < originalRate);
  const ratio = overriddenRate / originalRate;
  assert.ok(Math.abs(ratio - 250_000 / 285_000) < 1e-9);
});

test("OVR-02: override harga tidak memengaruhi waste, konversi, atau qty", () => {
  const base = computeObject(simpleObj(285_000));
  const overridden = computeObject(simpleObj(200_000));

  const mBase = base.subObjects[0]!.materials[0]!;
  const mOver = overridden.subObjects[0]!.materials[0]!;

  // Semua field non-harga identik
  assert.equal(mOver.wastePct, mBase.wastePct);
  assert.equal(mOver.wasteSource, mBase.wasteSource);
  assert.equal(mOver.grossPerSub, mBase.grossPerSub);
  assert.equal(mOver.grossTotal, mBase.grossTotal);
  assert.equal(mOver.qtyPerSub, mBase.qtyPerSub);

  // Hanya harga dan cost yang berubah
  assert.ok(mOver.pricePerUsageUnit < mBase.pricePerUsageUnit);
  assert.ok(mOver.cost < mBase.cost);
});
