/**
 * MASTER DATA — Supplier.
 *
 * Single unified view: Company sebagai section header, Brand di bawahnya.
 * Tab Brand | Perusahaan dihapus 2026-08-06 — satu hierarki tidak perlu dua tab.
 */

import { getSession } from "@/lib/auth";
import { hasPermission } from "@/core/rbac/guards";
import { PERMISSION } from "@/core/rbac/constants";
import { unwrapActionResult } from "@/lib/result";
import { getCompaniesAction } from "@/subapps/master-data/actions/party-actions";
import { SupplierClient } from "@/subapps/master-data/components/SupplierClient";

export const dynamic = "force-dynamic";

export default async function MasterDataSuppliersPage() {
  const { role } = await getSession();

  const companies = unwrapActionResult(await getCompaniesAction(undefined));

  return (
    <SupplierClient
      companies={companies}
      canManageCompanies={hasPermission(role, PERMISSION.MASTERDATA_VENDOR_MANAGE)}
      canViewPrices={hasPermission(role, PERMISSION.MASTERDATA_PRICE_VIEW)}
    />
  );
}
