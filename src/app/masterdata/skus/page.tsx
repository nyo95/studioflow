import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/core/rbac/guards";
import { PERMISSION } from "@/core/rbac/constants";
import { landingRouteFor } from "@/core/rbac/app-access";
import { getVendorsAction } from "@/subapps/master-data/actions/catalog-query-actions";
import { unwrapActionResult } from "@/lib/result";
import { getMaterialView } from "@/subapps/master-data/services/material-view-service";
import { SkuDirectoryClient } from "@/subapps/master-data/components/SkuDirectoryClient";

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function MasterDataSkuDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { role } = await getSession();
  if (
    !hasPermission(role, PERMISSION.MASTERDATA_VIEW) ||
    !hasPermission(role, PERMISSION.MASTERDATA_PRICE_VIEW)
  ) {
    redirect(landingRouteFor(role));
  }
  const canManage = hasPermission(role, PERMISSION.MASTERDATA_SKU_MANAGE);

  const params = await searchParams;
  const rawPage = Number.parseInt(first(params.page) ?? "1", 10);
  const rawPrice = first(params.price);
  const rawCompleteness = first(params.completeness);
  const rawSort = first(params.sort);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const price = rawPrice === "WITH" || rawPrice === "WITHOUT" ? rawPrice : "ALL";
  const completeness = rawCompleteness === "COMPLETE" || rawCompleteness === "INCOMPLETE"
    ? rawCompleteness
    : "ALL";
  const sort = rawSort === "sku" || rawSort === "newest" ? rawSort : "brand";
  const search = first(params.search)?.trim() || "";
  const brand = first(params.brand)?.trim() || "";
  const category = first(params.category)?.trim() || "";

  const [view, brands] = await Promise.all([
    getMaterialView({
      search: search || undefined,
      vendorId: brand || undefined,
      category: category || undefined,
      pricePresence: price,
      completeness,
      sort,
      page,
    }),
    getVendorsAction(undefined).then(unwrapActionResult),
  ]);

  return (
    <SkuDirectoryClient
      rows={view.rows}
      total={view.total}
      page={view.page}
      pageSize={view.pageSize}
      categories={view.categories}
      brands={brands.map((item) => ({ id: item.id, name: item.name }))}
      canManage={canManage}
      initialFilters={{ search, brand, category, price, completeness, sort }}
    />
  );
}
