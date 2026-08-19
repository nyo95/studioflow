import test from "node:test";
import assert from "node:assert/strict";

import { deriveScheduleSpecFields } from "./schedule-option-writer";
import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";

// ---------------------------------------------------------------------------
// Regression tests for the reuse-pool spec index.
//
// spec_search_key is the ONLY column searchReusableSpecs filters on
// ("From a past project" dialog). Before 2026-08-12, 17 write paths wrote
// data_snapshot without re-deriving spec_*, so the column stayed NULL (or
// stuck on placeholder values) and the pool was empty for the whole office —
// see docs/ANALISA-SCHEDULE-REUSE-2026-08-12.md §2. This file locks the
// derivation so it cannot drift from the write path again.
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<ScheduleSnapshot> = {}): ScheduleSnapshot {
  return {
    snapshot_source_kind: "manual",
    snapshot_source_external_id: null,
    product_catalog_id: null,
    catalog_type: "material",
    schedule_category: "ACRYLIC",
    catalog_brand: "TACO",
    catalog_price: null,
    catalog_image_url: null,
    catalog_reference_url: null,
    catalog_contact_email: null,
    catalog_has_sample: null,
    specs: {
      catalog_structured_tags: [],
      catalog_dimensions: "",
      catalog_color: "Clear",
      catalog_finishing: "Matte",
    },
    snapshot_captured_at: "2026-08-12T00:00:00.000Z",
    ...overrides,
  };
}

test("brand+product+color+finishing → key lowercase, di-join '::'", () => {
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      catalog_product_name: "Clear Acrylic Sheet",
      catalog_brand: "TACO",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: "Clear",
        catalog_finishing: "Matte",
      },
    })
  );
  // category ("acrylic") is now the first part of the key
  assert.equal(fields.spec_search_key, "acrylic::taco::clear acrylic sheet::clear::matte");
});

test("kata kunci memang di-lowercase, bukan hanya trim", () => {
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      catalog_product_name: "Frosted Glass",
      catalog_brand: "KACA MITRA",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: "FROSTED",
        catalog_finishing: "SATIN",
      },
    })
  );
  assert.equal(fields.spec_search_key, "acrylic::kaca mitra::frosted glass::frosted::satin");
});

test("field kosong / whitespace dilewati dari key", () => {
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      catalog_product_name: "   ",
      catalog_brand: "  TACO  ",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: "",
        catalog_finishing: null,
      },
    })
  );
  // brand is non-placeholder, product is empty (placeholder) — one non-placeholder is enough
  // category prefix is included
  assert.equal(fields.spec_search_key, "acrylic::taco");
});

test("semua field kosong → spec_search_key null", () => {
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      catalog_product_name: "",
      catalog_brand: "",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: null,
        catalog_finishing: null,
      },
    })
  );
  assert.equal(fields.spec_search_key, null);
});

test("spec_product_name / spec_color / spec_finishing mengikuti snapshot", () => {
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      catalog_product_name: "  Sheet  ",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: " Clear ",
        catalog_finishing: "Matte",
      },
    })
  );
  assert.equal(fields.spec_product_name, "Sheet");
  assert.equal(fields.spec_color, "Clear");
  assert.equal(fields.spec_finishing, "Matte");
});

test("spec_brand_id hanya terisi saat snapshot membawa FK vendor", () => {
  const withVendor = deriveScheduleSpecFields(
    makeSnapshot({ catalog_vendor_id: "vendor-1" })
  );
  assert.equal(withVendor.spec_brand_id, "vendor-1");

  const withoutVendor = deriveScheduleSpecFields(makeSnapshot({}));
  assert.equal(withoutVendor.spec_brand_id, null);
});

// ---------------------------------------------------------------------------
// Fase 2 — tambahan: kategori, placeholder, dan edge cases
// ---------------------------------------------------------------------------

test("kategori masuk key sebagai part pertama", () => {
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      schedule_category: "PLYWOOD",
      catalog_brand: "Kayu Prima",
      catalog_product_name: "Multiplex 18mm",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: null,
        catalog_finishing: null,
      },
    })
  );
  assert.equal(fields.spec_search_key, "plywood::kayu prima::multiplex 18mm");
  // Verify category is truly first by checking key starts with "plywood::"
  assert.ok(fields.spec_search_key!.startsWith("plywood::"));
});

test("placeholder brand+product (N/A + UNKNOWN) → spec_search_key null", () => {
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      catalog_brand: "N/A",
      catalog_product_name: "UNKNOWN",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: "Red",
        catalog_finishing: "Gloss",
      },
    })
  );
  assert.equal(fields.spec_search_key, null);
});

test("placeholder brand+product (Manual Item + Custom) → spec_search_key null", () => {
  // Nilai yang diisi oleh addManualCatalogItemAction
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      catalog_brand: "Custom",
      catalog_product_name: "Manual Item",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: null,
        catalog_finishing: null,
      },
    })
  );
  assert.equal(fields.spec_search_key, null);
});

test("hanya brand yang placeholder → masih masuk pool (product non-placeholder)", () => {
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      catalog_brand: "N/A",
      catalog_product_name: "Kaca Tempered 12mm",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: null,
        catalog_finishing: null,
      },
    })
  );
  // Brand placeholder, product tidak — baris tetap masuk pool
  assert.notEqual(fields.spec_search_key, null);
  assert.ok(fields.spec_search_key!.includes("kaca tempered 12mm"));
});

test("hanya product yang placeholder → masih masuk pool (brand non-placeholder)", () => {
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      catalog_brand: "KACA MITRA",
      catalog_product_name: "PENDING",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: null,
        catalog_finishing: null,
      },
    })
  );
  // Product placeholder, brand tidak — baris tetap masuk pool
  assert.notEqual(fields.spec_search_key, null);
  assert.ok(fields.spec_search_key!.includes("kaca mitra"));
});

test("kategori saja tanpa brand dan product → spec_search_key null", () => {
  // Kategori saja tidak cukup untuk masuk pool
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      schedule_category: "ACRYLIC",
      catalog_brand: "",
      catalog_product_name: "",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: null,
        catalog_finishing: null,
      },
    })
  );
  assert.equal(fields.spec_search_key, null);
});

test("kategori kosong tidak masuk key, tapi key tetap terbentuk dari brand+product", () => {
  const fields = deriveScheduleSpecFields(
    makeSnapshot({
      schedule_category: "",
      catalog_brand: "TACO",
      catalog_product_name: "Acrylic Sheet",
      specs: {
        catalog_structured_tags: [],
        catalog_dimensions: "",
        catalog_color: null,
        catalog_finishing: null,
      },
    })
  );
  assert.equal(fields.spec_search_key, "taco::acrylic sheet");
});
