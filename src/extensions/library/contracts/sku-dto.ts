/**
 * Hand-written DTO contracts for the StudioFlow ↔ master_data boundary.
 *
 * M4 step 2 — replaces `Prisma.SkuGetPayload<>` and `Prisma.SampleGetPayload<>`
 * in `extensions/library/types.ts`. Once this file is the source of truth:
 *   • StudioFlow compiles without knowing the master_data schema's column list.
 *   • Adding or renaming a column in master_data is a local edit here, not a
 *     cascading tsc failure across the whole StudioFlow build.
 *
 * DTO shape rules:
 *   • Scalar types use plain TypeScript primitives.
 *   • `Decimal` DB columns use `Decimal` from `@prisma/client/runtime/library`.
 *     This is the Prisma runtime type (decimal.js-compatible) — NOT from the
 *     generated schema, so it's safe to import here.
 *   • Enum DB columns use the actual Prisma enum types (SkuStatus, SkuKind…)
 *     imported from `@/generated/prisma`. Enums don't change with column lists.
 *   • When the Prisma query uses `select: { field: true }` the DTO only includes
 *     those selected fields — not the full model shape.
 *   • When the Prisma query uses `where: { ... }` on a relation, the array type
 *     is unchanged — where filters runtime values, not the TypeScript type.
 */

import type { SampleStatus, SkuStatus, SkuKind, LinkKind } from "@/generated/prisma";
// ↑ Enums only — NOT the `Prisma` namespace (no Prisma.GetPayload here).
// Enum imports are safe: they don't tie us to the column list, only to the
// enum values which change far less often than column shapes.

// `Decimal` and `JsonValue` come from the Prisma RUNTIME LIBRARY, not the
// generated schema. The subpath `@prisma/client/runtime/client` is declared in
// the package's exports map (see package.json:"./runtime/client").
// These types don't change when master_data columns change.
import type { Decimal, JsonValue } from "@prisma/client/runtime/client";

// ---------------------------------------------------------------------------
// Sub-shapes
// ---------------------------------------------------------------------------

type PartyContactShape = {
  id: string;
  party_id: string;
  person_name: string;
  job_title: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
  brand_id: string | null;
};

type BrandLinkShape = {
  id: string;
  brand_id: string;
  kind: LinkKind;
  url: string;
  archive_url: string | null;
  label: string | null;
  sort_order: number;
};

type BrandShape = {
  id: string;
  name: string;
  slug: string;
  owner_party_id: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  updated_by_name: string | null;
  scoped_contacts: PartyContactShape[];
  links: BrandLinkShape[];
  /** Only `legal_name` and `address` are SELECTed in SKU_FULL_INCLUDE. */
  owner: { legal_name: string | null; address: string | null } | null;
};

type SampleShape = {
  id: string;
  sku_id: string;
  rack_number: string;
  box_number: string;
  location_note: string | null;
  quantity: number;
  status: SampleStatus;
  borrower_name: string | null;
  borrowed_at: Date | null;
  due_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
};

type SkuMediaShape = {
  id: string;
  sku_id: string;
  kind: string; // MediaKind enum
  url: string;
  label: string | null;
  sort_order: number;
  created_at: Date;
};

type SkuPriceShape = {
  id: string;
  sku_id: string;
  supplier_party_id: string | null;
  // NOTE: `Decimal` here is the DB-layer type. Before these fields cross the
  // server→client boundary they are `.toString()`-ed in `attachDerivedCatalogFields`.
  // Consumers that receive a `ProductCatalogWithRelations` will have strings at
  // runtime even though TypeScript says Decimal. Call `Number(price_net)` or
  // `price_net.toString()` — both work on both types.
  price_net: Decimal;
  currency: string;
  unit: string;
  qty: Decimal | null;
  valid_from: Date;
  valid_to: Date | null;
  is_current: boolean;
  source_link_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date | null;
  updated_by_name: string | null;
  /** Only `id` and `name` are SELECTed in SKU_FULL_INCLUDE. */
  supplier: { id: string; name: string } | null;
};

type CategoryShape = {
  id: string;
  name: string;
  slug: string;
  kind: string; // CategoryKind enum
  parent_id: string | null;
  path: string | null;
  sort_order: number;
  is_active: boolean;
};

type SkuCategoryShape = {
  id: string;
  sku_id: string;
  category_id: string;
  is_primary: boolean;
  sort_order: number;
  created_at: Date;
  category: CategoryShape;
};

// ---------------------------------------------------------------------------
// Primary contracts
// ---------------------------------------------------------------------------

/**
 * Shape returned by `LibraryService.getProductById` and used throughout the
 * Library UI. Matches the Prisma include defined in `SKU_FULL_INCLUDE`.
 *
 * Replaces: `Prisma.SkuGetPayload<{ include: typeof SKU_FULL_INCLUDE }>`.
 */
export type SkuDto = {
  id: string;
  code: string | null;
  name: string;
  slug: string;
  brand_id: string | null;
  kind: SkuKind;
  status: SkuStatus;
  /** Prisma.JsonValue: string | number | boolean | object | null.
   *  Must match exactly so assignability checks at call sites pass. */
  spec: JsonValue;
  dim_length: Decimal | null;
  dim_width: Decimal | null;
  dim_height: Decimal | null;
  dim_unit: string | null;
  dim_display: string | null;
  base_unit: string;
  // BQ costing fields (pindahan dari BqMaterialProfile, 2026-08-19)
  usage_unit: string | null;
  purchase_unit: string | null;
  conversion: Decimal | null;
  default_waste_pct: Decimal | null;
  minimum_order: Decimal | null;
  rounding_increment: Decimal | null;
  preferred_supplier_party_id: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  updated_by_name: string | null;
  brand: BrandShape | null;
  samples: SampleShape[];
  media: SkuMediaShape[];
  prices: SkuPriceShape[];
  categories: SkuCategoryShape[];
};

/**
 * Shape returned by the Samples page queries.
 *
 * Replaces: `Prisma.SampleGetPayload<{
 *   include: { sku: { include: { brand: { include: { scoped_contacts: true } } } } };
 * }>`.
 */
export type SampleRowDto = {
  id: string;
  sku_id: string;
  rack_number: string;
  box_number: string;
  location_note: string | null;
  quantity: number;
  status: SampleStatus;
  borrower_name: string | null;
  borrowed_at: Date | null;
  due_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  sku: {
    id: string;
    code: string | null;
    name: string;
    slug: string;
    brand_id: string | null;
    kind: SkuKind;
    status: SkuStatus;
    spec: JsonValue;
    dim_length: Decimal | null;
    dim_width: Decimal | null;
    dim_height: Decimal | null;
    dim_unit: string | null;
    dim_display: string | null;
    base_unit: string;
    usage_unit: string | null;
    purchase_unit: string | null;
    conversion: Decimal | null;
    default_waste_pct: Decimal | null;
    minimum_order: Decimal | null;
    rounding_increment: Decimal | null;
    preferred_supplier_party_id: string | null;
    notes: string | null;
    created_at: Date;
    updated_at: Date | null;
    deleted_at: Date | null;
    updated_by_name: string | null;
    brand: (Omit<BrandShape, "scoped_contacts" | "links" | "owner"> & {
      scoped_contacts: PartyContactShape[];
    }) | null;
  };
};
