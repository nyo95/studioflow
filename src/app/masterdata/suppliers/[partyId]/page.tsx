import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/core/rbac/guards";
import { PERMISSION } from "@/core/rbac/constants";
import { landingRouteFor } from "@/core/rbac/app-access";
import { unwrapActionResult } from "@/lib/result";
import { prisma } from "@/core/platform/db";
import { SupplierDetailClient } from "@/subapps/master-data/components/SupplierDetailClient";
import { getPartyContactsAction } from "@/subapps/master-data/actions/party-actions";
import { getPartyBrandsAction } from "@/subapps/master-data/actions/masterdata-actions";

export const dynamic = "force-dynamic";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ partyId: string }>;
}) {
  const { role } = await getSession();
  if (!hasPermission(role, PERMISSION.MASTERDATA_VIEW)) {
    redirect(landingRouteFor(role));
  }

  const { partyId } = await params;

  const party = await prisma.party.findUnique({
    where: { id: partyId, deleted_at: null },
    include: {
      roles: { select: { role: true } },
      contacts: { where: { brand_id: null } },
    },
  });

  if (!party) {
    redirect("/masterdata/suppliers");
  }

  const [brands, contacts] = await Promise.all([
    getPartyBrandsAction({ partyId }).then(unwrapActionResult),
    getPartyContactsAction({ partyId }).then(unwrapActionResult),
  ]);

  const partyData = {
    id: party.id,
    name: party.name,
    legal_name: party.legal_name,
    address: party.address,
    notes: party.notes,
    is_active: party.is_active,
    roles: party.roles.map((r) => r.role),
  };

  return (
    <SupplierDetailClient
      party={partyData}
      brands={brands}
      contacts={contacts}
      canManage={hasPermission(role, PERMISSION.MASTERDATA_VENDOR_MANAGE)}
      canViewPrices={hasPermission(role, PERMISSION.MASTERDATA_PRICE_VIEW)}
    />
  );
}
