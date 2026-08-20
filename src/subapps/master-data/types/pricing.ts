// ---------------------------------------------------------------------------
// Master Data — pricing domain types.
//
// Two v2 tables behind three screens:
//   SkuPrice   → material prices (Excel Table 2), one current row per
//                (SKU × supplier), with history
//   WorkPrice  → Excel Table 3 (material + labour) and Table 4 (labour only),
//                told apart by `kind` rather than by which column is filled
// ---------------------------------------------------------------------------

// ---- Party acting as a service vendor --------------------------------------

export type ServiceVendorData = {
  id: string;
  name: string;
  legal_name: string | null;
  trade: string | null;
  phone_number: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  _count?: { service_prices: number };
};

export type ServiceVendorInput = {
  name: string;
  legal_name: string;
  trade: string;
  phone_number: string;
  email: string;
  address: string;
  notes: string;
};

// ---- WorkPrice (Excel Table 3 and Table 4) ---------------------------------

/**
 * Excel Table 3 and Table 4 have **identical columns** and one `Price` each, so
 * both screens share this shape. What separates them is `WorkPrice.kind`, set
 * by the server rather than the form.
 *
 * They stayed as two named aliases below rather than collapsing into one type,
 * because the two tabs are two things to whoever maintains them even though
 * they are one row shape to the database.
 */
export type WorkPriceData = {
  id: string;
  code: string;
  name: string;
  /** Excel "Category" — the leaf of the category tree. */
  category: string;
  /** Excel "Vendor Category" — the parent. "" when the leaf has none. */
  vendor_category: string;
  unit: string;
  /** ONE price, as Excel has it. Replaced material_price + labor_price (E8). */
  price: number;
  specification_1: string;
  specification_2: string;
  /** Excel "Dimensions" — one free-text string, as the workbook writes it. */
  dimensions: string;
  scope_note: string | null;
  notes: string | null;
  service_vendor_id: string | null;
  service_vendor?: { id: string; name: string } | null;
  updated_by_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
};

export type WorkPriceInput = {
  name: string;
  vendor_category: string;
  category: string;
  unit: string;
  price: number | string;
  specification_1: string;
  specification_2: string;
  dimensions: string;
  scope_note: string;
  notes: string;
  service_vendor_id: string | null;
};

/** Excel Table 4 — labour only. `WorkPrice.kind = LABOR_ONLY`. */
export type ServicePriceData = WorkPriceData;
export type ServicePriceInput = WorkPriceInput;

/** Excel Table 3 — material + labour. `WorkPrice.kind = MATERIAL_LABOR`. */
export type MaterialLaborPriceData = WorkPriceData;
export type MaterialLaborPriceInput = WorkPriceInput;

// ---- SkuPrice (Excel Table 2) ----------------------------------------------

export type MaterialPriceData = {
  id: string;
  brand_id: string;
  brand?: { id: string; brand_name: string } | null;
  sku_id: string | null;
  sku?: { id: string; catalog_sku: string; catalog_product_name: string } | null;
  item_description: string;
  unit: string | null;
  /**
   * Satu harga yang berlaku. Menggantikan pasangan
   * `price_before_discount` / `price_after_discount` per 2026-08-14 — lihat
   * migrasi `20260814100000_skuprice_single_price`.
   */
  price: number | null;
  /**
   * Who is quoting. NULL is meaningful, not missing: it is the manufacturer's
   * own list price rather than a shop's offer. `SkuPrice_current_uniq` encodes
   * the same distinction with its COALESCE sentinel.
   */
  supplier_party_id: string | null;
  supplier?: { id: string; name: string } | null;
  source_link_id: string | null;
  valid_from: Date | null;
  /** Set when the offer was superseded or closed. NULL = still in force. */
  valid_to: Date | null;
  is_current: boolean;
  notes: string | null;
  updated_by_name: string | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  /** Costing profile dari SKU yang terhubung. Null bila belum diisi. */
  sku_usage_unit: string | null;
  sku_conversion: number | null;
  /** Dimensi tampilan (e.g. "1200 × 2400 mm"). Null bila belum diisi. */
  sku_dim_display: string | null;
  /** Kategori produk (PRODUCT kind) yang sudah terpasang pada SKU. */
  sku_categories: string[];
};

/** Halaman harga material yang dibatasi di server agar direktori tidak
 * memindahkan seluruh riwayat harga aktif ke browser sekaligus. */
export type MaterialPricePageData = {
  rows: MaterialPriceData[];
  /** Jumlah hasil setelah search diterapkan; dipakai pagination. */
  total: number;
  /** Jumlah seluruh harga dalam scope (global atau satu supplier). */
  allTotal: number;
  page: number;
  pageSize: number;
};

export type MaterialPriceQuery = {
  search?: string;
  page?: number;
  pageSize?: number;
  /** Dipakai tab Prices pada detail Supplier; NULL tetap berarti semua pihak. */
  supplierId?: string;
};

export type MaterialPriceInput = {
  brand_id: string;
  sku_id: string | null;
  /** NULL / "" = manufacturer list price rather than a shop's offer. */
  supplier_party_id: string | null;
  item_description: string;
  unit: string;
  /** Satu harga. String karena `<input type="number">` mengembalikan string. */
  price: number | string | null;
  valid_from: string | null;
  notes: string;
  /** Satuan pakai di BQ (sqm, m', pcs). Disimpan ke Sku.usage_unit. */
  usage_unit: string;
  /** Berapa usage_unit dalam 1 purchase unit. Disimpan ke Sku.conversion. */
  conversion: number | string | null;
  /** Dimensi tampilan yang dihitung dari kalkulator dimensi. Disimpan ke Sku.dim_display. */
  dim_display: string | null;
  /** Nama kategori produk yang dipilih. Disimpan ke SkuCategory + propagasi ke BrandCategory. */
  category_names: string[];
};

/** One row in the SKU pricing viewer. Current and retired offers share it. */
export type SkuPricingViewerPrice = {
  id: string;
  supplierId: string | null;
  supplierName: string;
  price: number;
  unit: string;
  currency: string;
  validFrom: Date;
  validTo: Date | null;
  isCurrent: boolean;
  notes: string | null;
  updatedByName: string | null;
};

/** Read-only SKU identity, specification, live offers, and full price history. */
export type SkuPricingViewerData = {
  id: string;
  code: string | null;
  name: string;
  brand: { id: string; name: string } | null;
  categories: string[];
  specifications: Array<{ label: string; value: string }>;
  dimension: string | null;
  baseUnit: string;
  status: string;
  currentPrices: SkuPricingViewerPrice[];
  priceHistory: SkuPricingViewerPrice[];
};
