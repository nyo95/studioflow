import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { findNextFreeIncrement } from "./template-slot-guard";

const slot = (increment: number, isTemplateReserved = false) => ({ increment, isTemplateReserved });

describe("findNextFreeIncrement", () => {
  it("slot kosong → wantedIncrement + 1", () => {
    assert.equal(findNextFreeIncrement(3, []), 4);
  });

  it("menggunakan slot di atas max(occupied, wanted)", () => {
    const result = findNextFreeIncrement(3, [slot(3, true), slot(4), slot(5)]);
    assert.equal(result, 6);
  });

  it("loncat slot yang dipakai", () => {
    const result = findNextFreeIncrement(1, [slot(1, true), slot(2), slot(3)]);
    assert.equal(result, 4);
  });

  it("wanted lebih kecil dari max occupied → mulai dari max+1", () => {
    const result = findNextFreeIncrement(1, [slot(5, true)]);
    assert.equal(result, 6);
  });
});
