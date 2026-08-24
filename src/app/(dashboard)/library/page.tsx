import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/core/rbac/guards";
import { PERMISSION } from "@/core/rbac/constants";
import { DashboardTemplate, PageHeader } from "@/ui_engine";
import { BrandLibraryExplorer } from "@/extensions/library/components/BrandLibraryExplorer";

/**
 * §6.14 Brand-First Library route. Additive alongside /extensions/library
 * (unchanged) — see PLAN-LIBRARY-BRAND-FIRST.md §9 step 4. Gated on the same
 * LIBRARY_VIEW permission DIC/DRIC already hold; no new permission needed
 * for a read-only surface.
 */
export default async function LibraryBrandPage() {
  const { role } = await getSession();
  if (!hasPermission(role, PERMISSION.LIBRARY_VIEW)) notFound();

  return (
    <DashboardTemplate
      header={
        <PageHeader
          title="Library"
          description='Search a material category — "terrazzo", say — then browse the brands that supply it.'
        />
      }
      content={<BrandLibraryExplorer />}
    />
  );
}
