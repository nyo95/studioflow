import test from "node:test";
import assert from "node:assert/strict";

import {
  rollupSectionSubtotals,
  type SectionRollupNode,
} from "./section-rollup";

/** Urutan sengaja induk-dulu — meniru `sort_order` dari database. */
const WALL_WORKS: SectionRollupNode[] = [
  { id: "B", parentId: null },        // L0 Section   — INTERIOR WORKS
  { id: "III", parentId: "B" },       // L1 Sub Sec   — Wall Works
  { id: "shopfront", parentId: "III" }, // L2 Sub Sec — Shopfront Area
  { id: "store", parentId: "III" },     // L2 Sub Sec — Store Area
];

test("L2 menaikkan angkanya sampai ke L0 — regresi bug loop datar", () => {
  // Seluruh Works duduk di dalam L2. Inilah bentuk yang membuat versi lama
  // menghasilkan SUBTOTAL B = 0.
  const direct = new Map([
    ["shopfront", 100],
    ["store", 40],
  ]);

  const result = rollupSectionSubtotals(WALL_WORKS, direct);

  assert.equal(result.get("shopfront"), 100);
  assert.equal(result.get("store"), 40);
  assert.equal(result.get("III"), 140);
  assert.equal(result.get("B"), 140); // <- 0 pada implementasi lama
});

test("hasilnya tidak bergantung urutan masukan", () => {
  const direct = new Map([["shopfront", 100], ["store", 40]]);

  const parentFirst = rollupSectionSubtotals(WALL_WORKS, direct);
  const childFirst = rollupSectionSubtotals([...WALL_WORKS].reverse(), direct);

  for (const id of ["B", "III", "shopfront", "store"]) {
    assert.equal(childFirst.get(id), parentFirst.get(id), `beda di ${id}`);
  }
});

test("Works yang menempel di beberapa lapis sekaligus dijumlahkan semua", () => {
  // Sebuah Sub Section boleh punya Works langsung DAN Sub Section anak —
  // "Wall Works" bisa memuat pekerjaan umum plus pengelompokan per area.
  const direct = new Map([
    ["B", 7],          // Works langsung di Section, tanpa Sub Section
    ["III", 3],
    ["shopfront", 100],
    ["store", 40],
  ]);

  const result = rollupSectionSubtotals(WALL_WORKS, direct);

  assert.equal(result.get("III"), 143);
  assert.equal(result.get("B"), 150);
});

test("Section tanpa Sub Section memakai totalnya sendiri (PRELIMINARIES)", () => {
  const sections: SectionRollupNode[] = [{ id: "A", parentId: null }];
  const result = rollupSectionSubtotals(sections, new Map([["A", 250]]));

  assert.equal(result.get("A"), 250);
});

test("pengelompok kosong bernilai nol, bukan undefined", () => {
  const result = rollupSectionSubtotals(WALL_WORKS, new Map());

  for (const id of ["B", "III", "shopfront", "store"]) {
    assert.equal(result.get(id), 0, `${id} harus 0`);
  }
});

test("empat lapis pun tetap benar — batas kedalaman ditegakkan di server, bukan di sini", () => {
  const deep: SectionRollupNode[] = [
    { id: "l0", parentId: null },
    { id: "l1", parentId: "l0" },
    { id: "l2", parentId: "l1" },
    { id: "l3", parentId: "l2" },
  ];

  const result = rollupSectionSubtotals(deep, new Map([["l3", 90]]));

  assert.equal(result.get("l3"), 90);
  assert.equal(result.get("l2"), 90);
  assert.equal(result.get("l1"), 90);
  assert.equal(result.get("l0"), 90);
});

test("induk yang hilang membuat anaknya jadi akar, angkanya tidak menguap", () => {
  // Induk di-soft-delete, anaknya belum. Subtotalnya tetap dihitung; ia cuma
  // tidak punya ke mana naik.
  const orphan: SectionRollupNode[] = [{ id: "anak", parentId: "sudah-dihapus" }];
  const result = rollupSectionSubtotals(orphan, new Map([["anak", 55]]));

  assert.equal(result.get("anak"), 55);
  assert.equal(result.has("sudah-dihapus"), false);
});

test("data berputar dihitung nol, tidak menggantung", () => {
  // Tidak seharusnya bisa terjadi — tapi jalur BACA tidak boleh mati karena
  // satu baris cacat.
  const cyclic: SectionRollupNode[] = [
    { id: "x", parentId: "y" },
    { id: "y", parentId: "x" },
  ];

  const result = rollupSectionSubtotals(cyclic, new Map([["x", 10], ["y", 20]]));

  assert.equal(typeof result.get("x"), "number");
  assert.equal(typeof result.get("y"), "number");
});
