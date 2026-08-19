import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isBrandLandingView,
  toBrandSort,
  isBrandComplete,
} from "./brand-view-rules";

describe("isBrandLandingView", () => {
  it("is the default state of the page — no filters means brand grain", () => {
    assert.equal(isBrandLandingView({}), true);
  });

  it("treats absent, null, and ALL price as the same non-filter", () => {
    assert.equal(isBrandLandingView({ price: null }), true);
    assert.equal(isBrandLandingView({ price: "" }), true);
    assert.equal(isBrandLandingView({ price: "ALL" }), true);
  });

  /**
   * The regression this module exists for. A search term used to flip the page
   * to SKU grain, so the brand table's own search box threw the user out of the
   * brand table — and `getBrandView`'s search branch could never run.
   */
  it("does NOT break out of brand grain on search", () => {
    assert.equal(isBrandLandingView({ search: "kayu" }), true);
    assert.equal(isBrandLandingView({ search: "  " }), true);
  });

  it("breaks out for the three SKU-grain filters", () => {
    assert.equal(isBrandLandingView({ vendorId: "brand-1" }), false);
    assert.equal(isBrandLandingView({ category: "Lantai" }), false);
    assert.equal(isBrandLandingView({ price: "READY" }), false);
    assert.equal(isBrandLandingView({ price: "INCOMPLETE" }), false);
  });

  it("still breaks out when a SKU-grain filter is combined with a search", () => {
    assert.equal(isBrandLandingView({ search: "kayu", category: "Lantai" }), false);
  });
});

describe("toBrandSort", () => {
  it("defaults to name for absent, unknown, and brand-grain-meaningless tokens", () => {
    assert.equal(toBrandSort(undefined), "name");
    assert.equal(toBrandSort(null), "name");
    assert.equal(toBrandSort(""), "name");
    assert.equal(toBrandSort("brand"), "name");
    // "vendor" = brand owner. No brand-grain analogue; must not silently
    // reinterpret as something else.
    assert.equal(toBrandSort("vendor"), "name");
    assert.equal(toBrandSort("nonsense"), "name");
  });

  it("reads `sku` as 'by number of SKUs' at brand grain", () => {
    assert.equal(toBrandSort("sku"), "sku_count");
  });

  it("passes `newest` through", () => {
    assert.equal(toBrandSort("newest"), "newest");
  });
});

describe("isBrandComplete", () => {
  it("requires BOTH a category and a supplier", () => {
    assert.equal(isBrandComplete({ categoryCount: 1, supplierCount: 1 }), true);
    assert.equal(isBrandComplete({ categoryCount: 0, supplierCount: 1 }), false);
    assert.equal(isBrandComplete({ categoryCount: 1, supplierCount: 0 }), false);
    assert.equal(isBrandComplete({ categoryCount: 0, supplierCount: 0 }), false);
  });

  /**
   * Guards the chip arithmetic: the header shows `incomplete = all - complete`,
   * which is only a complement if this predicate is total over the counts.
   */
  it("is a strict complement — no third state", () => {
    for (const categoryCount of [0, 1, 7]) {
      for (const supplierCount of [0, 1, 7]) {
        const complete = isBrandComplete({ categoryCount, supplierCount });
        assert.equal(typeof complete, "boolean");
        assert.equal(complete, categoryCount > 0 && supplierCount > 0);
      }
    }
  });
});
