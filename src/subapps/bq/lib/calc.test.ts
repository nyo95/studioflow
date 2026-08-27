import test from "node:test";
import assert from "node:assert/strict";

import {
  computeMaterialLine,
  computeObject,
  computeProject,
  roundRupiah,
  computeServiceLine,
  type MaterialLineInput,
  type ObjectInput,
  type ServiceLineInput,
  type SubObjectInput,
} from "./calc";

function material(
  name: string,
  pricePerUnit: number,
  qtyPerSub: number,
  overrides: Partial<MaterialLineInput> = {},
): MaterialLineInput {
  return {
    id: `m-${name}`,
    skuId: null,
    name,
    usageUnit: null,
    purchaseUnit: "sheet",
    conversion: null,
    pricePerPurchaseUnit: pricePerUnit,
    qtyPerSub,
    wasteOverridePct: null,
    materialDefaultWastePct: null,
    categoryDefaultWastePct: null,
    minimumOrder: null,
    roundingIncrement: null,
    ...overrides,
  };
}

function service(
  name: string,
  pricePerUnit: number,
  qtyPerSub: number,
  unit = "ls",
): ServiceLineInput {
  return {
    id: `s-${name}`,
    workPriceId: null,
    name,
    rateUnit: unit,
    pricePerRateUnit: pricePerUnit,
    qtyPerSub,
  };
}

function subObject(
  name: string,
  qty: number,
  materials: MaterialLineInput[],
  services: ServiceLineInput[],
): SubObjectInput {
  return {
    id: `sub-${name}`,
    name,
    qty,
    materials,
    services,
  };
}

function objectFixture(overrides: Partial<ObjectInput> = {}): ObjectInput {
  return {
    id: "obj-1",
    name: "Top Table",
    code: "TT-1",
    qty: 1,
    unit: "unit",
    wasteOverridePct: null,
    // Baris langsung di L1 kosong pada fixture ini: yang diuji di sini adalah
    // jalur L2. Jalur langsung diuji terpisah di bawah.
    materials: [],
    services: [],
    subObjects: [
      subObject(
        "Top",
        1,
        [material("HPL Sheet", 150_000, 0.7)],
        [service("Install HPL", 85_000, 0.7, "sheet")],
      ),
    ],
    ...overrides,
  };
}

test("material line uses estimator coefficient directly against snapshot unit price", () => {
  const result = computeMaterialLine(
    material("HPL Sheet", 150_000, 0.7, { purchaseUnit: "sheet" }),
    1,
  );

  assert.equal(result.unit, "sheet");
  assert.equal(result.qtyPerSub, 0.7);
  assert.equal(result.qtyTotal, 0.7);
  assert.equal(result.pricePerUnit, 150_000);
  assert.equal(result.cost, 105_000);
});

test("service line also scales by sub-object multiplier only", () => {
  const result = computeServiceLine(service("Install", 90_000, 0.5, "sheet"), 3);

  assert.equal(result.qtyTotal, 1.5);
  assert.equal(result.cost, 135_000);
});

test("object rate is the sum of coefficient times price for material and service", () => {
  const result = computeObject(objectFixture());

  // 0,7 × 150.000 + 0,7 × 85.000 = 164.500
  assert.equal(result.subObjects[0]?.materialsSubtotal, 105_000);
  assert.equal(roundRupiah(result.subObjects[0]?.servicesSubtotal ?? 0), 59_500);
  assert.equal(result.ratePerUnit, 164_500);
  assert.equal(result.total, 164_500);
});

test("L2 multiplier increases only the targeted sub-object contribution", () => {
  const before = computeObject(objectFixture());
  const after = computeObject({
    ...objectFixture(),
    subObjects: [
      subObject(
        "Top",
        2,
        [material("HPL Sheet", 150_000, 0.7)],
        [service("Install HPL", 85_000, 0.7, "sheet")],
      ),
    ],
  });

  assert.equal(before.subObjects[0]?.subtotal, 164_500);
  assert.equal(after.subObjects[0]?.subtotal, 329_000);
  assert.equal(after.ratePerUnit, 329_000);
});

test("L1 qty only multiplies final object total, not unit rate", () => {
  const result = computeObject({ ...objectFixture(), qty: 3 });

  assert.equal(result.ratePerUnit, 164_500);
  assert.equal(result.total, 493_500);
});

test("project totals aggregate object totals without hidden purchasing logic", () => {
  const a = objectFixture();
  const b = {
    ...objectFixture(),
    id: "obj-2",
    name: "Side Panel",
    qty: 2,
    subObjects: [
      subObject(
        "Panel",
        1,
        [material("PVC Sheet", 90_000, 0.4)],
        [service("Install PVC", 40_000, 0.4, "sheet")],
      ),
    ],
  };

  const result = computeProject([a, b]);

  assert.equal(result.grandTotal, 268_500);
});

test("project-local lines without master ids still calculate normally", () => {
  const result = computeObject({
    id: "obj-local",
    name: "Custom Counter",
    code: null,
    qty: 2,
    unit: "unit",
    wasteOverridePct: null,
    materials: [],
    services: [],
    subObjects: [
      subObject(
        "Marble Top",
        1,
        [material("Custom marble slab", 1_250_000, 0.5, { purchaseUnit: "slab" })],
        [service("Install marble", 175_000, 0.5, "slab")],
      ),
    ],
  });

  assert.equal(result.ratePerUnit, 712_500);
  assert.equal(result.total, 1_425_000);
});

test("baris yang menempel langsung di L1 ikut terhitung, tanpa pengali L2", () => {
  // "Screeding Base": koefisien dinyatakan per satu unit item, tidak ada
  // sub-rakitan. Inilah bentuk mayoritas item BQ interior.
  const result = computeObject({
    id: "obj-direct",
    name: "Screeding Base H+100mm",
    code: null,
    qty: 45,
    unit: "sqm",
    wasteOverridePct: null,
    materials: [material("Semen", 65_000, 0.2)],
    services: [service("Tukang plester", 90_000, 0.15, "sqm")],
    subObjects: [],
  });

  // 65.000 x 0,2 = 13.000  +  90.000 x 0,15 = 13.500  ->  26.500 per sqm
  assert.equal(result.materialsSubtotal, 13_000);
  assert.equal(result.servicesSubtotal, 13_500);
  assert.equal(result.ratePerUnit, 26_500);
  assert.equal(result.total, 1_192_500);
  assert.equal(result.lineCount, 2);
  assert.equal(result.subObjectCount, 0);
});

test("satu item boleh memakai kedua jalur sekaligus", () => {
  // Kabinet dengan sub-rakitan, plus sekrup yang tidak masuk akal dipecah
  // ke salah satu sub-rakitannya.
  const result = computeObject({
    id: "obj-both",
    name: "Counter Cabinet",
    code: null,
    qty: 1,
    unit: "unit",
    wasteOverridePct: null,
    materials: [material("Sekrup", 100_000, 1)],
    services: [],
    subObjects: [subObject("Body", 2, [material("Plywood", 300_000, 1)], [])],
  });

  // langsung 100.000  +  L2 (300.000 x pengali 2) = 600.000  ->  700.000
  assert.equal(result.ratePerUnit, 700_000);
  assert.equal(result.lineCount, 2);
});

test("editing snapshot price changes cost without touching coefficient totals", () => {
  const base = computeObject(objectFixture());
  const overridden = computeObject({
    ...objectFixture(),
    subObjects: [
      subObject(
        "Top",
        1,
        [material("HPL Sheet", 180_000, 0.7)],
        [service("Install HPL", 85_000, 0.7, "sheet")],
      ),
    ],
  });

  assert.equal(base.subObjects[0]?.materials[0]?.qtyTotal, 0.7);
  assert.equal(overridden.subObjects[0]?.materials[0]?.qtyTotal, 0.7);
  assert.equal(roundRupiah(base.subObjects[0]?.materials[0]?.cost ?? 0), 105_000);
  assert.equal(roundRupiah(overridden.subObjects[0]?.materials[0]?.cost ?? 0), 126_000);
});
