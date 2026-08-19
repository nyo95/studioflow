/**
 * §7 TEARDOWN — /extensions/library is retired.
 *
 * The per-SKU catalog surface has been replaced by two purpose-built
 * surfaces that do not overlap:
 *
 *   /library        — Brand-First Library (§6.14). Designers search a
 *                     material term and get the brands that sell it. Read-only.
 *
 *   /masterdata     — Staff/Curator manage SKUs, samples, brands, and vendors.
 *
 * Redirecting here rather than 404 so that any bookmarks or older shared
 * links do something useful. STAFF lands on /masterdata which is their
 * home; DIC/DRIC land on /library via their normal routing.
 */
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { APP, canEnterApp } from "@/core/rbac/app-access";

export default async function RetiredLibraryPage() {
  const { role } = await getSession();
  // Staff/Curator → masterdata home. Everyone else → brand-first library.
  if (canEnterApp(role, APP.MASTERDATA)) {
    redirect("/masterdata");
  }
  redirect("/library");
}
