/**
 * MASTER DATA — root redirect.
 *
 * /masterdata is no longer a dashboard page (2026-08-11).
 * The nav was simplified to 3 entries: Prices, Supplier, Sample.
 * Prices (/masterdata/materials) is the landing destination.
 *
 * The old Overview content (SampleRequestPanel + aggregate stats) was removed
 * from the nav at the same time. If a dedicated landing/summary page is needed
 * again in the future, create it at /masterdata/overview, not here.
 */

import { redirect } from "next/navigation";

export default function MasterDataRootPage() {
  redirect("/masterdata/materials");
}
