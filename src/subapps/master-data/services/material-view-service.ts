import "server-only";

/**
 * Staff-facing read model over canonical master_data.Sku.
 *
 * Master Data v2 (2026-08-10): pricing is no longer split across
 * MaterialPrice (brand/SKU-level) + Sku inline columns — both collapsed
 * into `SkuPrice`, the one place a SKU's current price lives.
 *
 * ---------------------------------------------------------------------------
 * 2026-08-11 — DELEGATES INSTEAD OF DUPLICATING
 * ---------------------------------------------------------------------------
 * This file used to run `prisma.sku.findMany()` with NO `take`/`skip` and then
 * filter and sort the whole table in JavaScript. `LibraryService.getAllProducts`
 * already did all of that in SQL — `where`, `orderBy`, `skip`, `take`, and a
 * parallel `count` — against an identical `include`. Two implementations of one
 * query, and the worse one was the one this page used.
 *
 * It now delegates. What that fixed, in order of how badly it bit:
 *
 *   1. Every row used to carry `material` — the full Prisma object (Sku + brand
 *      + scoped_contacts + links + owner + samples + media + prices +
 *      categories). It was read in exactly ONE place: to populate the edit
 *      dialog when a row is clicked. So 199 of 200 rows shipped their entire
 *      object graph to the browser for nothing. `MaterialRow` no longer has it;
 *      the dialog calls `getSkuDetailAction(id)` when it opens.
 *
 *   2. Filtering and sorting now happen in Postgres, so the server no longer
 *      loads the whole catalogue into memory to render 50 rows.
 *
 *   3. Because the fat object is gone, so is the `Decimal` serialisation
 *      problem it caused — `MaterialRow` is now entirely scalars, and the
 *      JSON round-trip that used to paper over it has been deleted.
 *
 * WHAT DID NOT MOVE TO SQL, and why:
 *   - `search` no longer matches colour / motif / finishing. Those live inside
 *     the `Sku.spec` JSON column, and a case-insensitive partial match across
 *     JSON paths is not something Prisma expresses portably. SQL search covers
 *     product name, brand name, SKU code, and category name. Restoring the rest
 *     needs those fields promoted to real columns — see roadmap.
 *   - `sort: "category"` is gone. Ordering by "the first of a SKU's many
 *     categories" has no SQL expression without a denormalised column on Sku.
 */

import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/core/platform/db";
import type { ProductCatalogWithRelations, SkuWithRelations } from "@/extensions/library/types";
import { attachDerivedCatalogFields } from "@/extensions/library/types";
import { isBrandComplete } from "@/subapps/master-data/lib/brand-view-rules";
import { isSkuDataComplete } from "@/subapps/master-data/lib/sku-directory-rules";

export type MaterialSampleState =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "BORROWED"
  | "SENT_TO_CLIENT";

export type MaterialPriceSource = "SKU_PRICE" | "NONE";

/**
 * One table row. Deliberately ALL SCALARS — no Prisma objects, no Decimal, no
 * relations. Anything the edit dialog needs beyond this is fetched by id when
 * the dialog opens. Adding a relation field back here re-creates both the
 * payload problem and the Decimal serialisation crash.
 */
export type MaterialRow = {
  priceSource: MaterialPriceSource;
  id: string;
  vendorId: string;
  vendorName: string;
  vendorLegalName: string | null;
  brand: string;
  categoryTags: string[];
  productName: string;
  sku: string;
  color: string | null;
  motif: string | null;
  finishing: string | null;
  dimensions: string | null;
  /**
   * Satu harga yang berlaku. Menggantikan pasangan
   * priceBeforeDiscount / priceAfterDiscount per 2026-08-14.
   */
  price: number | null;
  priceUnit: string | null;
  /** NULL = manufacturer list price rather than a shop's offer. */
  priceSupplierId: string | null;
  priceSupplierName: string | null;
  /** How many suppliers currently quote this SKU. The prices above are the
   *  cheapest of them. 0 or 1 means there is nothing to compare. */
  priceOfferCount: number;
  hasCurrentPrice: boolean;
  baseUnit: string;
  dataComplete: boolean;
  bqReady: boolean;
  status: string;
  sampleCount: number;
  sampleState: MaterialSampleState;
  referenceUrl: string | null;
  folderUrl: string | null;
  updatedAt: string | null;
  createdAt: string;
};

export type MaterialFilters = {
  search?: string;
  vendorId?: string;
  category?: string;
  price?: "ALL" | "READY" | "INCOMPLETE";
  pricePresence?: "ALL" | "WITH" | "WITHOUT";
  completeness?: "ALL" | "COMPLETE" | "INCOMPLETE";
  sort?: "brand" | "vendor" | "sku" | "newest";
  page?: number;
  pageSize?: number;
};

export type MaterialViewResult = {
  rows: MaterialRow[];
  totals: {
    all: number;
    bqReady: number;
    incompletePrice: number;
  };
  categories: string[];
  /** Rows matching the current filters — NOT the number returned in `rows`. */
  total: number;
  page: number;
  pageSize: number;
};

/** Rows per page. 50 is about what fits a scroll without the list becoming unscannable. */
export const MATERIAL_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Brand-grain view (Phase 2.1–2.4)
// ---------------------------------------------------------------------------

/** One table row = one Brand. Aggregates are SQL, completeness is derived. */
export type BrandRow = {
  id: string;
  name: string;
  legalName: string | null;
  categoryTags: string[];
  tags: string[];
  skuCount: number;
  supplierCount: number;
  /** Derived: true when the brand has at least one category AND at least one supplier. */
  isComplete: boolean;
};

export type BrandFilters = {
  search?: string;
  sort?: "name" | "sku_count" | "newest";
  page?: number;
  pageSize?: number;
};

export type BrandViewResult = {
  rows: BrandRow[];
  total: number;
  page: number;
  pageSize: number;
  totals: { all: number; complete: number; incomplete: number };
};

export const BRAND_PAGE_SIZE = 50;

/**
 * Status rak sebuah material, diturunkan dari sample yang MASIH ADA.
 *
 * Sampai 2026-08-18 baris terakhirnya berbunyi `samples.length > 0`, yang
 * berarti sample HILANG dan DIBUANG ikut membuat material terbaca "tersedia" —
 * seorang desainer diberi tahu ada contoh fisik untuk benda yang rak-nya sudah
 * kosong. Kontrak Master Data §5 menuntut kebalikannya: "tidak tersedia"
 * diturunkan dari nol sample HIDUP.
 *
 * LOST dan DISCARDED karenanya tidak dihitung sama sekali. SENT_TO_CLIENT
 * dihitung sebagai keluar (bukan tersedia) — benda itu ada, tetapi tidak di
 * kantor, dan bagi orang yang mencarinya di rak keduanya sama saja.
 */
function sampleState(
  samples: ProductCatalogWithRelations["samples"]
): MaterialSampleState {
  const live = samples.filter(
    (sample) => sample.status !== "LOST" && sample.status !== "DISCARDED"
  );
  if (live.some((sample) => sample.status === "SENT_TO_CLIENT")) {
    return "SENT_TO_CLIENT";
  }
  if (live.some((sample) => sample.status === "BORROWED")) {
    return "BORROWED";
  }
  return live.length > 0 ? "AVAILABLE" : "UNAVAILABLE";
}

/** Jumlah keping yang benar-benar masih ada. Sama alasannya dengan `sampleState`. */
function liveSampleCount(
  samples: ProductCatalogWithRelations["samples"]
): number {
  return samples
    .filter((s) => s.status !== "LOST" && s.status !== "DISCARDED")
    .reduce((total, sample) => total + sample.quantity, 0);
}

function dimensions(
  row: Pick<
    ProductCatalogWithRelations,
    | "catalog_dimension_p"
    | "catalog_dimension_l"
    | "catalog_dimension_t"
    | "catalog_dimension_unit"
  >
) {
  const values = [
    row.catalog_dimension_p,
    row.catalog_dimension_l,
    row.catalog_dimension_t,
  ].filter((value): value is string => Boolean(value));
  if (values.length === 0) return null;
  return `${values.join(" × ")}${row.catalog_dimension_unit ? ` ${row.catalog_dimension_unit}` : ""}`;
}

/** `MaterialFilters.sort` -> the vocabulary `getAllProducts` understands. */
function toLibrarySort(
  sort: MaterialFilters["sort"]
): "sku" | "newest" | "name" | "brand" {
  if (sort === "sku") return "sku";
  if (sort === "newest") return "newest";
  // "vendor" means brand-owner in this UI; `brand` is the closest SQL ordering,
  // and the two agree for every seeded row.
  if (sort === "vendor") return "brand";
  return "brand";
}

function toRow(material: ProductCatalogWithRelations): MaterialRow {
  const price = material.catalog_price;
  const priceUnit = material.catalog_price_unit;
  // "BQ ready" means BQ can price a line from this row. A net price and a
  // unit are what it needs; the list price is context for the discount, not
  // an input. Requiring it here marked rows incomplete whenever a supplier
  // quoted one number, which is most of them.
  //
  // Must stay in step with the `price` filter in `getAllProducts` — that one
  // is the SQL half of this same rule.
  const complete = price !== null && Boolean(priceUnit);

  return {
    priceSource: complete ? "SKU_PRICE" : "NONE",
    id: material.id,
    vendorId: material.brand_id ?? "",
    vendorName: material.brand?.name ?? "(no brand)",
    vendorLegalName: material.brand?.owner?.legal_name ?? null,
    brand: material.catalog_brand,
    categoryTags: material.catalog_tags,
    productName: material.catalog_product_name,
    sku: material.catalog_sku,
    color: material.catalog_color,
    motif: material.catalog_motif,
    finishing: material.catalog_finishing,
    dimensions: dimensions(material),
    price,
    priceUnit,
    priceSupplierId: material.catalog_price_supplier_id,
    priceSupplierName: material.catalog_price_supplier_name,
    priceOfferCount: material.catalog_price_offer_count,
    hasCurrentPrice: material.prices.length > 0,
    baseUnit: material.base_unit,
    dataComplete: isSkuDataComplete({
      productName: material.catalog_product_name,
      baseUnit: material.base_unit,
      categoryCount: material.catalog_tags.length,
    }),
    bqReady: complete,
    status: material.catalog_status,
    sampleCount: liveSampleCount(material.samples),
    sampleState: sampleState(material.samples),
    referenceUrl: material.catalog_reference_url,
    folderUrl: material.catalog_folder_url,
    updatedAt: material.updated_at?.toISOString() ?? null,
    createdAt: material.created_at.toISOString(),
  };
}

export async function getMaterialView(
  filters: MaterialFilters = {}
): Promise<MaterialViewResult> {
  // LibraryService pulls in the full mutation/audit/RBAC graph. This read path
  // only needs it when the SKU-grain view is actually requested, so defer the
  // import. Besides reducing eager server-module work, this keeps the two
  // Brand-grain query functions below independently executable in the real
  // PostgreSQL integration suite.
  const { LibraryService } = await import(
    "@/extensions/library/services/library-service"
  );
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? MATERIAL_PAGE_SIZE;

  // The header chips describe the WHOLE catalogue, not the filtered view — they
  // are the denominator the filters are read against, so they must not inherit
  // `where`. Two counts, not three: INCOMPLETE is the exact complement of READY
  // (see the `price` filter in getAllProducts), so subtracting is not an
  // approximation.
  const [listed, allCount, readyCount, categoryRows] = await Promise.all([
    LibraryService.getAllProducts(prisma, {
      search: filters.search,
      vendorId: filters.vendorId,
      category: filters.category,
      price: filters.price,
      pricePresence: filters.pricePresence,
      completeness: filters.completeness,
      sort: toLibrarySort(filters.sort),
      page,
      pageSize,
    }),
    prisma.sku.count({ where: { deleted_at: null } }),
    prisma.sku.count({
      where: {
        deleted_at: null,
        prices: { some: { is_current: true, unit: { not: "" } } },
      },
    }),
    // Facet list for the category dropdown. Reads `Category` directly rather
    // than DISTINCT-ing over loaded rows — the old code could only offer
    // categories present in the page it happened to have loaded.
    // `kind: "PRODUCT"` per AGENTS.md §4 — Category is unique on (kind, slug),
    // so a name like "Finishing" exists once per kind. Without the filter a
    // WORK-kind row with the same name could slip into a material facet.
    prisma.category.findMany({
      where: { kind: "PRODUCT", skus: { some: { sku: { deleted_at: null } } } },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return {
    rows: listed.items.map(toRow),
    totals: {
      all: allCount,
      bqReady: readyCount,
      incompletePrice: allCount - readyCount,
    },
    // Deduped defensively — the `kind` filter above should already make names
    // unique, but this keeps the dropdown correct even if that invariant ever
    // slips.
    categories: Array.from(new Set(categoryRows.map((row) => row.name))),
    total: listed.total,
    page,
    pageSize,
  };
}

/**
 * Brand-grain view. One row = one Brand with SQL-aggregated SKU count,
 * supplier count, and derived completeness. Used by the Materials landing
 * page when no brand-specific filter is active (Phase 2.1–2.4).
 */
export async function getBrandView(
  filters: BrandFilters = {}
): Promise<BrandViewResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? BRAND_PAGE_SIZE;

  // Search stays at brand grain — it narrows the brand list, it does NOT drop
  // the user into the SKU table. A term can match the brand itself, its owner,
  // a PRODUCT category, a hashtag, an assigned supplier, or a SKU it carries;
  // every match resolves back to the same unit of display, a Brand row. Same vocabulary as
  // `getAllProducts`'s search so the two views agree on what "found" means.
  const where: Prisma.BrandWhereInput = { deleted_at: null };
  if (filters.search) {
    const search = filters.search.trim();
    const contains = { contains: search, mode: "insensitive" } as const;
    // Prisma's String[] filter only supports exact, case-sensitive `has`.
    // Brand hashtags are free text and the Library already treats them as a
    // case-insensitive substring, so resolve matching ids in Postgres before
    // composing the paginated Brand query. The interpolated term stays a query
    // parameter; POSITION avoids `%`/`_` acquiring wildcard meaning.
    const tagMatches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT brand."id"
      FROM "master_data"."Brand" AS brand
      WHERE brand."deleted_at" IS NULL
        AND EXISTS (
          SELECT 1
          FROM unnest(brand."tags") AS tag(value)
          WHERE POSITION(LOWER(${search}) IN LOWER(tag.value)) > 0
        )
    `;
    where.OR = [
      { name: contains },
      { owner: { deleted_at: null, OR: [{ name: contains }, { legal_name: contains }] } },
      {
        categories: {
          some: {
            category: { kind: "PRODUCT", is_active: true, name: contains },
          },
        },
      },
      {
        suppliers: {
          some: {
            party: {
              deleted_at: null,
              OR: [{ name: contains }, { legal_name: contains }],
            },
          },
        },
      },
      { skus: { some: { deleted_at: null, OR: [{ name: contains }, { code: contains }] } } },
      ...(tagMatches.length > 0
        ? [{ id: { in: tagMatches.map((brand) => brand.id) } }]
        : []),
    ];
  }

  // Prisma DOES order by relation count (`{ skus: { _count } }`). The previous
  // implementation re-sorted the already-paginated page in JS, which orders 50
  // rows that were themselves selected by name — so page 2 could hold a brand
  // with more SKUs than anything on page 1. Sorting in SQL is the only way the
  // ordering survives pagination.
  let orderBy: Prisma.BrandOrderByWithRelationInput[];
  switch (filters.sort) {
    case "sku_count":
      orderBy = [{ skus: { _count: "desc" } }, { name: "asc" }];
      break;
    case "newest":
      orderBy = [{ created_at: "desc" }, { name: "asc" }];
      break;
    default:
      orderBy = [{ name: "asc" }];
  }

  const [brands, totalCount] = await Promise.all([
    prisma.brand.findMany({
      where,
      include: {
        owner: { select: { legal_name: true } },
        categories: { select: { category: { select: { name: true } } } },
        _count: {
          select: {
            skus: { where: { deleted_at: null } },
            // Filtered like `skus` is. `BrandSupplier` has no `deleted_at` of
            // its own, but the `Party` behind it does — counting the join row
            // alone reports suppliers that were soft-deleted, and inflates
            // `isComplete` with them.
            suppliers: { where: { party: { deleted_at: null } } },
          },
        },
      },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.brand.count({ where }),
  ]);

  const rows: BrandRow[] = brands.map((brand) => {
    const categoryTags = brand.categories
      .map((bc) => bc.category.name)
      .filter(Boolean);
    return {
      id: brand.id,
      name: brand.name,
      legalName: brand.owner?.legal_name ?? null,
      categoryTags,
      tags: brand.tags,
      skuCount: brand._count.skus,
      supplierCount: brand._count.suppliers,
      // Shared with the `COMPLETE` where-clause below; if the two disagree the
      // chip count contradicts the badges it is counting.
      isComplete: isBrandComplete({
        categoryCount: categoryTags.length,
        supplierCount: brand._count.suppliers,
      }),
    };
  });

  // Totals across ALL brands (unfiltered) for the header chips.
  //
  // This used to be `findMany({ where: { deleted_at: null } })` with no `take`
  // — the entire brand table plus its categories and supplier counts, loaded on
  // every landing render, to produce one integer. That is the exact pattern the
  // header of this file says was removed from `getMaterialView`. Completeness
  // is expressible as a `where`, so it is two counts.
  const COMPLETE: Prisma.BrandWhereInput = {
    deleted_at: null,
    categories: { some: {} },
    suppliers: { some: { party: { deleted_at: null } } },
  };
  const [allBrands, completeCount] = await Promise.all([
    prisma.brand.count({ where: { deleted_at: null } }),
    prisma.brand.count({ where: COMPLETE }),
  ]);

  return {
    rows,
    total: totalCount,
    page,
    pageSize,
    totals: { all: allBrands, complete: completeCount, incomplete: allBrands - completeCount },
  };
}

/**
 * Ceiling on one expand. The include below pulls a SKU's whole object graph
 * (brand + contacts + links + owner + samples + media + prices + categories)
 * because `attachDerivedCatalogFields` needs it; without a bound, expanding a
 * brand that carries a few hundred SKUs is a few hundred of those graphs. The
 * expanded panel is a preview — "open the brand" is where the full list lives.
 */
export const EXPANDED_SKU_LIMIT = 200;

/**
 * Active SKUs for a single brand, returned as scalar MaterialRow objects and
 * capped at `EXPANDED_SKU_LIMIT`. Used by the expandable brand table (Phase
 * 2.2) — fetched lazily when a brand row is expanded, not shipped with every
 * page load. `truncated` tells the UI to say so rather than silently lie about
 * the count.
 */
export async function getSkusForBrand(
  brandId: string
): Promise<{ rows: MaterialRow[]; truncated: boolean }> {
  const items = await prisma.sku.findMany({
    where: { brand_id: brandId, deleted_at: null },
    take: EXPANDED_SKU_LIMIT + 1,
    include: {
      brand: { include: { scoped_contacts: true, links: true, owner: { select: { legal_name: true, address: true } } } },
      samples: { where: { deleted_at: null } },
      media: true,
      prices: {
        where: { is_current: true },
        orderBy: [{ price_net: "asc" }, { valid_from: "desc" }],
        include: { supplier: { select: { id: true, name: true } } },
      },
      categories: { include: { category: true } },
    },
    orderBy: { code: "asc" },
  });

  const truncated = items.length > EXPANDED_SKU_LIMIT;
  const page = truncated ? items.slice(0, EXPANDED_SKU_LIMIT) : items;
  const catalogItems = page.map((item) => attachDerivedCatalogFields(item as SkuWithRelations));
  return { rows: catalogItems.map(toRow), truncated };
}
