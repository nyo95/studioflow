import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planTemplateItemsToCreate } from "./schedule-template-item-planner";

const tpl = (id: string, cat = "ACRYLIC", section = "material") => ({ id, section, schedule_category: cat });
const entry = (id: string | null) => ({ template_item_id: id });

describe("planTemplateItemsToCreate", () => {
  it("proyek kosong → semua item dibuat", () => {
    const result = planTemplateItemsToCreate([tpl("a"), tpl("b")], []);
    assert.deepEqual(result.map(r => r.id), ["a", "b"]);
  });

  it("satu item sudah ada → hanya sisanya", () => {
    const result = planTemplateItemsToCreate(
      [tpl("a"), tpl("b"), tpl("c")],
      [entry("a")]
    );
    assert.deepEqual(result.map(r => r.id), ["b", "c"]);
  });

  it("kategori sudah terisi item non-template → item template tetap dibuat", () => {
    // entry tanpa template_item_id tidak menghalangi item baru
    const result = planTemplateItemsToCreate(
      [tpl("a", "PAINT")],
      [entry(null)] // entry non-template dari SketchUp
    );
    assert.deepEqual(result.map(r => r.id), ["a"]);
  });

  it("apply dua kali → nol tambahan (idempoten)", () => {
    const items = [tpl("a"), tpl("b")];
    const existing = [entry("a"), entry("b")];
    const result = planTemplateItemsToCreate(items, existing);
    assert.equal(result.length, 0);
  });

  it("entry null template_item_id diabaikan", () => {
    const result = planTemplateItemsToCreate([tpl("x")], [entry(null), entry(null)]);
    assert.deepEqual(result.map(r => r.id), ["x"]);
  });
});
