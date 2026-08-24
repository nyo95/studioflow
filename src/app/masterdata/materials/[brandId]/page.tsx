import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/core/rbac/guards";
import { PERMISSION } from "@/core/rbac/constants";
import { landingRouteFor } from "@/core/rbac/app-access";
import { unwrapActionResult } from "@/lib/result";
import { getBrandDetailAction } from "@/subapps/master-data/actions/masterdata-actions";
import { BrandDetailClient } from "@/subapps/master-data/components/BrandDetailClient";
import { getCompaniesAction } from "@/subapps/master-data/actions/party-actions";
import {
  getMyLibraryAccessAction,
  getProductMetadataAction,
  getVendorsAction,
} from "@/subapps/master-data/actions/catalog-query-actions";
import { getSupplierOptionsAction } from "@/subapps/master-data/actions/pricing-actions";

export const dynamic = "force-dynamic";

export default async function BrandDetailPage({
  params,
}: {
  params: Promise<{ brandId: string }>;
}) {
  const { role } = await getSession();
  if (!hasPermission(role, PERMISSION.MASTERDATA_VIEW)) {
    redirect(landingRouteFor(role));
  }

  const { brandId } = await params;
  /**
   * Empat fetch terakhir hanya memberi makan `MasterDataProductDialog`, yang
   * sejak 2026-08-14 dibuka dari tab SKUs halaman ini (menggantikan drawer
   * read-only). Sengaja dimuat di server bersama yang lain, bukan lewat
   * request kedua saat dialog dibuka: daftar brand dan metadata kategori tidak
   * berubah selama halaman terbuka, dan menundanya hanya memindahkan jeda ke
   * momen orang sedang menunggu form.
   */
  const [brand, companies, access, vendors, metadata, suppliers] = await Promise.all([
    getBrandDetailAction({ brandId }).then(unwrapActionResult),
    getCompaniesAction(undefined).then(unwrapActionResult),
    getMyLibraryAccessAction(undefined).then(unwrapActionResult),
    getVendorsAction(undefined).then(unwrapActionResult),
    getProductMetadataAction(undefined).then(unwrapActionResult),
    getSupplierOptionsAction(undefined).then(unwrapActionResult),
  ]);

  if (!brand) {
    redirect("/masterdata/materials");
  }

  return (
    <BrandDetailClient
      brand={brand}
      companies={companies}
      canManage={hasPermission(role, PERMISSION.MASTERDATA_VENDOR_MANAGE)}
      access={access}
      vendors={vendors}
      suppliers={suppliers}
      categories={metadata.subCategories}
      finishings={metadata.finishings}
      tags={metadata.tags}
    />
  );
}
