import "server-only";

import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { PRICE_SOURCE_ROLES } from "./party-role-rules";

export { PRICE_SOURCE_ROLES, WORK_VENDOR_ROLES } from "./party-role-rules";

/**
 * MASTER DATA — who may be named as the source of a price.
 *
 * ============================================================================
 * WHY THIS IS NOT SIMPLY "role = SUPPLIER"
 * ============================================================================
 * That was the first answer, and Excel contradicts it in its own examples.
 * `design database masterdata.xlsx` Table 1 gives two rows for
 * "Supplier's Company":
 *
 *   Ace Hardware   -> Company Categories: Retail
 *   Informa        -> Company Categories: Retail
 *
 * and Table 2's "Supplied by" column then points back at exactly those two.
 * So the places you actually buy from are filed under RETAIL, not SUPPLIER.
 * Filtering the picker to SUPPLIER hid both of the workbook's own examples —
 * and, since nothing had ever written a `PartyRole` row at all, hid everyone
 * else too.
 *
 * The rule is therefore "any party that sells things", which is every role
 * except none-at-all. A party with no category is not rejected because it is
 * the wrong kind of company; it is rejected because nobody has said what kind
 * of company it is, and guessing is what this whole module exists to avoid.
 */

/**
 * Validates a price-source party id and returns it, or null for "no supplier".
 *
 * Empty string and null both mean the manufacturer's own list price. Forms
 * send `""` for an untouched select and `null` for a cleared one, and treating
 * those differently would create two kinds of nothing.
 */
export async function assertPriceSourceParty(
  tx: PrismaTransaction,
  supplierPartyId: string | null | undefined
): Promise<string | null> {
  const id = supplierPartyId?.trim();
  if (!id) return null;

  const party = await tx.party.findUnique({
    where: { id },
    select: { id: true, name: true, deleted_at: true, roles: { select: { role: true } } },
  });
  if (!party || party.deleted_at) {
    throw new ActionError("Supplier not found.", "NOT_FOUND");
  }
  if (party.roles.length === 0) {
    throw new ActionError(
      `${party.name} has no category yet. Open it on the Suppliers page and tick what it is — supplier, retail store, manufacturer, and so on.`,
      "VALIDATION_FAILED"
    );
  }
  if (!party.roles.some((r) => PRICE_SOURCE_ROLES.includes(r.role))) {
    throw new ActionError(
      `${party.name} is not categorised as somewhere goods are bought from.`,
      "VALIDATION_FAILED"
    );
  }
  return party.id;
}
