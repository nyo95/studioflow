/**
 * MASTER DATA — Pricing
 *
 * Three tabs, two v2 tables behind them:
 *   1. Material prices        → SkuPrice  (one current row per SKU × supplier)
 *   2. Material + labour      → WorkPrice (kind = MATERIAL_LABOR)
 *   3. Labour only            → WorkPrice (kind = LABOR_ONLY)
 *
 * Gated on MASTERDATA_PRICE_VIEW. Mutations further gated on MASTERDATA_VENDOR_MANAGE.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/core/rbac/guards";
import { PERMISSION } from "@/core/rbac/constants";
import { landingRouteFor } from "@/core/rbac/app-access";
import { unwrapActionResult } from "@/lib/result";
import {
  getMaterialLaborPricesAction,
  getMaterialPricesAction,
  getMaterialPriceUnitsAction,
  getServicePricesAction,
  getServiceVendorsAction,
  getSupplierOptionsAction,
} from "@/subapps/master-data/actions/pricing-actions";
import { getVendorsAction } from "@/subapps/master-data/actions/catalog-query-actions";
import { getSampleSkuOptionsAction } from "@/subapps/master-data/actions/sample-actions";
import { PricingClient } from "@/subapps/master-data/components/PricingClient";

export const dynamic = "force-dynamic";

export default async function MasterDataPricesPage() {
  const { role, user } = await getSession();

  if (!hasPermission(role, PERMISSION.MASTERDATA_PRICE_VIEW)) {
    redirect(landingRouteFor(role));
  }

  const canManage = hasPermission(role, PERMISSION.MASTERDATA_VENDOR_MANAGE);

  const [materialPrices, materialPriceUnits, materialLaborPrices, servicePrices, serviceVendors, brands, skuOptions, suppliers] =
    await Promise.all([
      getMaterialPricesAction({}).then(unwrapActionResult),
      getMaterialPriceUnitsAction(undefined).then(unwrapActionResult),
      getMaterialLaborPricesAction(undefined).then(unwrapActionResult),
      getServicePricesAction(undefined).then(unwrapActionResult),
      getServiceVendorsAction(undefined).then(unwrapActionResult),
      getVendorsAction(undefined).then(unwrapActionResult),
      getSampleSkuOptionsAction(undefined).then(unwrapActionResult),
      getSupplierOptionsAction(undefined).then(unwrapActionResult),
    ]);

  return (
    <PricingClient
      materialPrices={materialPrices}
      materialPriceUnits={materialPriceUnits}
      materialLaborPrices={materialLaborPrices}
      servicePrices={servicePrices}
      serviceVendors={serviceVendors}
      brands={brands.map((b) => ({ id: b.id, brand_name: b.name }))}
      skuOptions={skuOptions}
      suppliers={suppliers}
      canManage={canManage}
      userName={user?.name ?? role}
    />
  );
}
