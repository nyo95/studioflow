/**
 * Pure rules for the Materials brand-grain view (Phase 2.1–2.4).
 *
 * These live apart from `material-view-service.ts` for one reason: that file
 * imports `server-only` and Prisma, so nothing in it can be tested. Everything
 * here is a pure function over plain values, so `scripts/run-tests.mjs` can
 * reach it. Anything decided in more than one place belongs here.
 *
 * The rule that forced this module into existence is `isBrandLandingView`. It
 * was written twice — once in `app/masterdata/materials/page.tsx` to pick the
 * query, once in `MasterDataMaterialsClient.tsx` to pick the table — and the
 * two copies have to agree or the page renders a table it has no rows for.
 * Two copies of one decision is one copy too many.
 */

/** The URL-level filter state the Materials page reads. */
export type MaterialsUrlFilters = {
  vendorId?: string | null;
  category?: string | null;
  price?: string | null;
  search?: string | null;
};

/**
 * True when the page should render one row per Brand rather than one row per
 * SKU.
 *
 * `search` is deliberately absent. The landing's search narrows the BRAND list
 * — see `getBrandView`, which matches brand name, owner, category, and carried
 * SKU codes, and still returns Brand rows. Treating a search term as a breakout
 * meant the first keystroke swapped the grain out from under the user, and left
 * the search branch inside `getBrandView` unreachable.
 *
 * The three that DO break out are questions with no answer at brand grain:
 * a specific brand (`vendorId`), a category, or a price-completeness state.
 */
export function isBrandLandingView(filters: MaterialsUrlFilters): boolean {
  const price = filters.price;
  return (
    !filters.vendorId &&
    !filters.category &&
    (!price || price === "ALL")
  );
}

/** Sort tokens the brand-grain query understands. */
export type BrandSort = "name" | "sku_count" | "newest";

/**
 * Maps the shared `sort` URL token onto the brand-grain vocabulary.
 *
 * The URL carries one `sort` param across both grains, so the same token has to
 * mean something at each. `sku` means "by SKU" in the SKU table and "by number
 * of SKUs" here; `vendor` (brand owner) has no brand-grain analogue and falls
 * back to name rather than silently ordering by something else.
 */
export function toBrandSort(sort: string | null | undefined): BrandSort {
  if (sort === "newest") return "newest";
  if (sort === "sku") return "sku_count";
  return "name";
}

/**
 * Completeness per §5.1 — derived, never a stored column.
 *
 * A brand is complete when it is classified (at least one category) and
 * sourceable (at least one supplier). Both counts must already exclude
 * soft-deleted records; this function cannot tell the difference, and
 * `getBrandView` filters them in SQL for exactly that reason.
 */
export function isBrandComplete(counts: {
  categoryCount: number;
  supplierCount: number;
}): boolean {
  return counts.categoryCount > 0 && counts.supplierCount > 0;
}
