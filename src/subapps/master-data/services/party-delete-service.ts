import "server-only";

import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";

/**
 * MASTER DATA — the one guard both Party-delete screens go through.
 *
 * ============================================================================
 * H3 (roadmap Gelombang 4, 2026-08-18)
 * ============================================================================
 * `deleteCompanyAction` (Suppliers page) and `deleteServiceVendorAction`
 * (Pricing page) both soft-delete the same `Party` row, and each already had
 * A guard — just not the SAME one. `deleteCompanyAction` checked
 * `owned_brands`; `deleteServiceVendorAction` checked `work_prices`. Neither
 * checked what the other did, and neither checked `SkuPrice.supplier_party_id`
 * or `BrandSupplier` at all. Because every one of these relations is
 * `onDelete: SetNull` (never `Restrict`), a delete that got past the
 * incomplete guard did not crash — it succeeded, and left the pointing row
 * quietly aimed at nothing. `getBrandSkusAction` including `supplier` without
 * a `deleted_at` filter is how that surfaced: the SKU table kept showing a
 * "deleted" supplier's name while its own picker had already stopped
 * offering it.
 *
 * `assertPartyDeletable` is every reference either screen needs, checked
 * once: `Brand.owner_party_id`, `WorkPrice.vendor_party_id`,
 * `SkuPrice.supplier_party_id`, `BrandSupplier.party_id`. Both delete actions
 * call this and nothing else — no more "which screen forgot which table".
 */
export async function assertPartyDeletable(
  tx: PrismaTransaction,
  partyId: string
): Promise<{ id: string; name: string }> {
  const party = await tx.party.findUnique({
    where: { id: partyId },
    select: { id: true, name: true, deleted_at: true },
  });
  if (!party || party.deleted_at) {
    throw new ActionError("Party not found", "NOT_FOUND");
  }

  const [ownedBrands, workPrices, skuPrices, brandSupplier] = await Promise.all([
    tx.brand.count({ where: { owner_party_id: partyId, deleted_at: null } }),
    tx.workPrice.count({ where: { vendor_party_id: partyId, deleted_at: null } }),
    tx.skuPrice.count({ where: { supplier_party_id: partyId } }),
    tx.brandSupplier.count({ where: { party_id: partyId } }),
  ]);

  const blockers = [
    ownedBrands > 0 && `${ownedBrands} brand${ownedBrands === 1 ? "" : "s"} owned`,
    workPrices > 0 && `${workPrices} work price${workPrices === 1 ? "" : "s"}`,
    skuPrices > 0 && `${skuPrices} material price${skuPrices === 1 ? "" : "s"} quoted`,
    brandSupplier > 0 && `${brandSupplier} brand-supplier link${brandSupplier === 1 ? "" : "s"}`,
  ].filter((x): x is string => Boolean(x));

  if (blockers.length > 0) {
    throw new ActionError(
      `${party.name} is still referenced by: ${blockers.join(", ")}. Move or remove those first.`,
      "CONFLICT"
    );
  }

  return { id: party.id, name: party.name };
}
