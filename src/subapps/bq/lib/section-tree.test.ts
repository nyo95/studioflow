import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_SECTION_DEPTH,
  buildSectionTree,
  countWorksDeep,
  letterForIndex,
  romanForIndex,
  sectionCodeForDepth,
  type SectionLike,
} from "./section-tree";

// ---------------------------------------------------------------------------
// Penomoran
// ---------------------------------------------------------------------------

test("kode mengikuti kedalaman — A/B/C, I/II/III, 1/2/3", () => {
  assert.equal(sectionCodeForDepth(0, 0), "A");
  assert.equal(sectionCodeForDepth(0, 2), "C");
  assert.equal(sectionCodeForDepth(1, 0), "I");
  assert.equal(sectionCodeForDepth(1, 2), "III");
  assert.equal(sectionCodeForDepth(2, 0), "1");
  assert.equal(sectionCodeForDepth(2, 3), "4"); // Full Slab di Wall Works
});

test("huruf berlanjut ke AA setelah Z", () => {
  assert.equal(letterForIndex(25), "Z");
  assert.equal(letterForIndex(26), "AA");
});

test("romawi cocok dengan dokumen kantor sampai VII", () => {
  const got = [0, 1, 2, 3, 4, 5, 6].map(romanForIndex);
  assert.deepEqual(got, ["I", "II", "III", "IV", "V", "VI", "VII"]);
});

test("batas kedalaman tiga lapis", () => {
  assert.equal(MAX_SECTION_DEPTH, 3);
});

// ---------------------------------------------------------------------------
// Pohon
// ---------------------------------------------------------------------------

/** Bentuk "B INTERIOR WORKS → III Wall Works → Shopfront/Store Area". */
const WALL: SectionLike[] = [
  { id: "B", parentId: null },
  { id: "III", parentId: "B" },
  { id: "shopfront", parentId: "III" },
  { id: "store", parentId: "III" },
];

test("tiga lapis tersusun benar", () => {
  const roots = buildSectionTree(WALL, new Map<string, string[]>());

  assert.equal(roots.length, 1);
  assert.equal(roots[0]?.section.id, "B");
  assert.equal(roots[0]?.children.length, 1);

  const wallWorks = roots[0]?.children[0];
  assert.equal(wallWorks?.section.id, "III");
  assert.deepEqual(
    wallWorks?.children.map((c) => c.section.id),
    ["shopfront", "store"],
  );
});

test("Works dihitung menembus seluruh cabang", () => {
  const objects = new Map<string, string[]>([
    ["shopfront", ["w1", "w2", "w3", "w4"]],
    ["store", ["w5"]],
    ["III", ["w6"]], // Works langsung di L1, berdampingan dengan L2
  ]);

  const roots = buildSectionTree(WALL, objects);

  assert.equal(countWorksDeep(roots[0]!), 6);
  assert.equal(countWorksDeep(roots[0]!.children[0]!), 6);
  assert.equal(roots[0]!.children[0]!.objects.length, 1); // yang LANGSUNG saja
});

test("Section tanpa Sub Section tetap membawa Works-nya (PRELIMINARIES)", () => {
  const roots = buildSectionTree(
    [{ id: "A", parentId: null }],
    new Map([["A", ["m1", "m2"]]]),
  );

  assert.equal(roots.length, 1);
  assert.equal(roots[0]?.children.length, 0);
  assert.equal(countWorksDeep(roots[0]!), 2);
});

test("urutan masukan dipertahankan, anak-dulu pun tetap benar", () => {
  const reversed = buildSectionTree([...WALL].reverse(), new Map<string, string[]>());

  assert.equal(reversed.length, 1);
  assert.equal(reversed[0]?.section.id, "B");
  assert.deepEqual(
    reversed[0]?.children[0]?.children.map((c) => c.section.id),
    ["store", "shopfront"], // ikut urutan masukan, bukan diurutkan ulang
  );
});

test("induk yang hilang naik jadi akar, tidak menghilang dari layar", () => {
  const roots = buildSectionTree(
    [{ id: "yatim", parentId: "sudah-dihapus" }],
    new Map([["yatim", ["w1"]]]),
  );

  assert.equal(roots.length, 1);
  assert.equal(roots[0]?.section.id, "yatim");
});

test("induk yang menunjuk dirinya sendiri jadi akar", () => {
  const roots = buildSectionTree([{ id: "x", parentId: "x" }], new Map<string, string[]>());

  assert.equal(roots.length, 1);
  assert.equal(roots[0]?.section.id, "x");
});

test("data berputar tetap tampil — yang tidak tampil tidak bisa diperbaiki", () => {
  const cyclic: SectionLike[] = [
    { id: "x", parentId: "y" },
    { id: "y", parentId: "x" },
  ];

  const roots = buildSectionTree(cyclic, new Map<string, string[]>());

  const seen = new Set<string>();
  const walk = (n: { section: SectionLike; children: unknown[] }) => {
    if (seen.has(n.section.id)) return;
    seen.add(n.section.id);
    (n.children as { section: SectionLike; children: unknown[] }[]).forEach(walk);
  };
  roots.forEach(walk);

  assert.equal(seen.size, 2, "kedua node harus terjangkau");
});

test("data lebih dalam dari batas tetap dibangun — batas milik jalur tulis", () => {
  const deep: SectionLike[] = [
    { id: "l0", parentId: null },
    { id: "l1", parentId: "l0" },
    { id: "l2", parentId: "l1" },
    { id: "l3", parentId: "l2" },
  ];

  const roots = buildSectionTree(deep, new Map([["l3", ["w"]]]));

  assert.equal(countWorksDeep(roots[0]!), 1);
  assert.equal(roots[0]?.children[0]?.children[0]?.children[0]?.section.id, "l3");
});
