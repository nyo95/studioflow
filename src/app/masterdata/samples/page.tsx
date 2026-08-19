/**
 * MASTER DATA — Perpustakaan Sample.
 *
 * Replaces the earlier read-only sample register with a full CRUD surface:
 * shelf view, status changes, and manual racking for samples that did not
 * arrive through a request.
 *
 * A Sample carries only `sku_id` — brand, company and price all join through
 * that Sku, so nothing about the product is stored twice. Sample and
 * MaterialPrice are siblings off the same Sku and never reference each other,
 * which is why BQ never reads this page's data.
 */

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/core/rbac/guards";
import { PERMISSION } from "@/core/rbac/constants";
import { landingRouteFor } from "@/core/rbac/app-access";
import { unwrapActionResult } from "@/lib/result";
import {
  getSampleSkuOptionsAction,
  getSamplesAction,
} from "@/subapps/master-data/actions/sample-actions";
import { SampleLibraryClient } from "@/subapps/master-data/components/SampleLibraryClient";

export const dynamic = "force-dynamic";

export default async function MasterDataSamplesPage() {
  const { role } = await getSession();

  if (!hasPermission(role, PERMISSION.MASTERDATA_VIEW)) {
    redirect(landingRouteFor(role));
  }

  // Both are read-only actions (`useTransaction: false`), so they can run
  // concurrently without sharing a single pg transaction connection.
  // The header summary used to be fetched here too, but `SampleLibraryClient`
  // has always recomputed it client-side from `samples` (so it stays live as
  // statuses change) — the server fetch was a dead prop. Removed together
  // with the prop itself.
  const [samples, skuOptions] = await Promise.all([
    getSamplesAction(undefined).then(unwrapActionResult),
    getSampleSkuOptionsAction(undefined).then(unwrapActionResult),
  ]);

  return (
    <SampleLibraryClient
      initialSamples={samples}
      skuOptions={skuOptions}
      canManage={hasPermission(role, PERMISSION.LIBRARY_MANAGE_SAMPLES)}
    />
  );
}
