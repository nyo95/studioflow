import { redirect } from "next/navigation";
import { prisma } from "@/core/platform/db";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/core/rbac/guards";
import { PERMISSION } from "@/core/rbac/constants";
import { landingRouteFor } from "@/core/rbac/app-access";
import {
  getBrandCategoryCoverageAction,
  getMyLibraryAccessAction,
  getProductMetadataAction,
  getVendorsAction,
} from "@/subapps/master-data/actions/catalog-query-actions";
import { unwrapActionResult } from "@/lib/result";
import {
  getMaterialView,
  getBrandView,
  type MaterialFilters,
  type BrandFilters,
} from "@/subapps/master-data/services/material-view-service";
import {
  isBrandLandingView,
  toBrandSort,
} from "@/subapps/master-data/lib/brand-view-rules";
import { getSupplierOptionsAction } from "@/subapps/master-data/actions/pricing-actions";
import { getCompaniesAction } from "@/subapps/master-data/actions/party-actions";
import { MasterDataMaterialsClient } from "@/subapps/master-data/components/MasterDataMaterialsClient";
import defaultBrandCatalogCategories from "@/subapps/master-data/config/brand-catalog-categories.json";
import { normalizeSearchText } from "@/core/utilities/normalize";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Brand-category defaults are configured by the Master Data app. Existing
 * suggestions come only from BrandCategory rows explicitly entered in the
 * Brand form, never SKU/Product Library rows.
 */
function mergeBrandCategoryOptions(existing: string[]) {
  const options: string[] = [];
  const seen = new Set<string>();

  for (const raw of [
    ...defaultBrandCatalogCategories.brandCatalogCategories,
    ...existing,
  ]) {
    const name = raw.trim();
    const key = normalizeSearchText(name);
    if (!name || seen.has(key)) continue;
    seen.add(key);
    options.push(name);
  }

  return options;
}

export default async function MasterDataMaterialsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await getSession();
  if (!hasPermission(role, PERMISSION.MASTERDATA_VIEW)) {
    redirect(landingRouteFor(role));
  }

  const canSeePrices = hasPermission(role, PERMISSION.MASTERDATA_PRICE_VIEW);
  const params = await searchParams;
  const rawPrice = first(params.price);
  const rawSort = first(params.sort);

  const rawPage = Number.parseInt(first(params.page) ?? "1", 10);

  const vendorId = first(params.vendor)?.trim() || undefined;
  const search = first(params.search)?.trim() || undefined;
  const category = first(params.category)?.trim() || undefined;
  const price = rawPrice === "READY" || rawPrice === "INCOMPLETE" ? rawPrice : "ALL";
  const sort = rawSort === "vendor" || rawSort === "sku" || rawSort === "newest" ? rawSort : "brand";
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  // Shared with the client, which uses the same rule to pick which table to
  // render. See `brand-view-rules.ts` for why `search` is not a breakout.
  const isBrandLanding = isBrandLandingView({ vendorId, category, price });

  const filters: MaterialFilters = {
    search,
    vendorId,
    category,
    price,
    sort: sort as MaterialFilters["sort"],
    page,
  };

  const brandFilters: BrandFilters = {
    search,
    sort: toBrandSort(sort),
    page,
  };

  const [access, vendors, metadata, brandCoverage, suppliers, companies, brandCategoryRows] = await Promise.all([
    getMyLibraryAccessAction(undefined).then(unwrapActionResult),
    getVendorsAction(undefined).then(unwrapActionResult),
    getProductMetadataAction(undefined).then(unwrapActionResult),
    getBrandCategoryCoverageAction(undefined).then(unwrapActionResult),
    getSupplierOptionsAction(undefined).then(unwrapActionResult),
    getCompaniesAction(undefined).then(unwrapActionResult),
    prisma.brandCategory.findMany({
      where: {
        source: "SEED",
        brand: { deleted_at: null },
        category: { is_active: true },
      },
      select: { category: { select: { name: true } } },
      orderBy: { category: { name: "asc" } },
    }),
  ]);
  const brandCategoryOptions = mergeBrandCategoryOptions(
    brandCategoryRows.map((row) => row.category.name)
  );

  // Fetch brand-grain or SKU-grain data depending on active filters.
  const [brandViewResult, skuViewResult] = await Promise.all([
    isBrandLanding ? getBrandView(brandFilters) : Promise.resolve(null),
    !isBrandLanding ? getMaterialView(filters) : Promise.resolve(null),
  ]);

  const brandRows = brandViewResult?.rows ?? [];
  const brandTotals = brandViewResult?.totals ?? { all: 0, complete: 0, incomplete: 0 };
  const brandTotal = brandViewResult?.total ?? 0;
  const view = skuViewResult ?? {
    rows: [],
    totals: { all: 0, bqReady: 0, incompletePrice: 0 },
    categories: [],
    total: 0,
    page,
    pageSize: 50,
  };

  // Category facets for the Add/Edit dialog's suggest dropdowns.
  const [materialCategoryRows, fixtureCategoryRows] = await Promise.all([
    prisma.category.findMany({
      where: { skus: { some: { sku: { deleted_at: null, kind: "MATERIAL" } } } },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      where: { skus: { some: { sku: { deleted_at: null, kind: { not: "MATERIAL" } } } } },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const materialCategories = materialCategoryRows.map((row) => row.name);
  const fixtureCategories = fixtureCategoryRows.map((row) => row.name);

  return (
    <MasterDataMaterialsClient
      rows={view.rows}
      totals={view.totals}
      total={isBrandLanding ? brandTotal : view.total}
      page={view.page}
      // In brand landing the pager counts brands, so it must use the brand page
      // size. It was reading `view.pageSize` — the SKU fallback's hardcoded 50 —
      // which agreed with BRAND_PAGE_SIZE only by coincidence.
      pageSize={isBrandLanding ? (brandViewResult?.pageSize ?? view.pageSize) : view.pageSize}
      categories={view.categories}
      vendors={vendors}
      suppliers={suppliers}
      access={access}
      materialsCategories={materialCategories}
      fixturesCategories={fixtureCategories}
      brandCategoryOptions={brandCategoryOptions}
      finishings={metadata.finishings}
      tags={metadata.tags}
      brandCoverage={brandCoverage}
      canSeePrices={canSeePrices}
      companies={companies}
      brandRows={brandRows}
      brandTotals={brandTotals}
      brandTotal={brandTotal}
      initialFilters={{
        search: search ?? "",
        vendorId: vendorId ?? "",
        category: category ?? "",
        price: price ?? "ALL",
        sort: sort ?? "brand",
      }}
    />
  );
}
