/**
 * MASTER DATA — Settings page (server).
 *
 * Akses: MASTERDATA_SKU_MANAGE (ADMIN, DEVELOPER, STAFF).
 * ESTIMATOR tidak dapat masuk ke /masterdata sama sekali (APP_ACCESS matrix),
 * jadi gate ini hanya defence-in-depth untuk role yang tidak terduga.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/core/rbac/guards";
import { PERMISSION } from "@/core/rbac/constants";
import { MasterDataSettingsClient } from "@/subapps/master-data/components/MasterDataSettingsClient";

export const dynamic = "force-dynamic";

export default async function MasterDataSettingsPage() {
  const { role } = await getSession();

  if (!hasPermission(role, PERMISSION.MASTERDATA_SKU_MANAGE)) {
    redirect("/masterdata/materials");
  }

  return <MasterDataSettingsClient />;
}
