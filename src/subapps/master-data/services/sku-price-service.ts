import "server-only";

import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { recordAudit } from "./audit-service";
import { checkPriceUnit, resolveEffectivePriceUnit, resolvePrice } from "./sku-price-rules";

// The pricing JUDGEMENTS live in `./sku-price-rules`, which imports nothing —
// that is what lets `npm test` reach them (roadmap §Perkakas: test files may
// only import modules that never touch Prisma or `server-only`). This file
// keeps the part that talks to the database.
export {
  checkPriceUnit,
  resolveEffectivePriceUnit,
  resolvePrice,
  hasPriceContent,
  isOfferChange,
} from "./sku-price-rules";

/**
 * MASTER DATA — the single write path for `SkuPrice`.
 *
 * ============================================================================
 * WHY THIS FILE EXISTS
 * ============================================================================
 * Before this, four places created SkuPrice rows and no two of them agreed:
 *
 *   library-service.createProduct   inline `prices: { create: [...] }`,
 *                                   no demotion of the previous current row
 *   library-service.updateProduct   demoted EVERY current row for the SKU
 *   pricing-actions.createMaterialPrice
 *   pricing-actions.upsertSkuMaterialPrice
 *                                   demoted only rows with supplier IS NULL
 *
 * Three of them defaulted `price_net` to `0` when the field was blank, which
 * is how a material ends up advertising a real price of nothing. Two of them
 * never set `valid_to`, so a superseded row still claimed to be in force. None
 * of them ever wrote `supplier_party_id`, which made the entire reason
 * `Sku` and `SkuPrice` were split — comparing offers between shops —
 * unreachable from the UI.
 *
 * ============================================================================
 * THE INVARIANT THIS FILE EXISTS TO PROTECT
 * ============================================================================
 * `03_invariants.sql` §1 creates:
 *
 *   CREATE UNIQUE INDEX "SkuPrice_current_uniq"
 *     ON master_data."SkuPrice" (
 *       sku_id,
 *       (COALESCE(supplier_party_id, '00000000-0000-0000-0000-000000000000'))
 *     )
 *     WHERE is_current;
 *
 * Read it carefully, because the COALESCE is the part that bites: in Postgres
 * NULL <> NULL, so without it two supplier-less current rows would both be
 * allowed. With it, "no supplier" behaves as one specific supplier — the
 * manufacturer's own list price.
 *
 * The practical consequence for every caller: **demotion must be scoped to the
 * same supplier**. Demoting all current rows for a SKU (as updateProduct used
 * to) silently retires every other shop's offer the moment one shop's price is
 * edited. Demoting only `supplier_party_id: null` rows (as the pricing actions
 * used to) leaves the index to reject the insert instead — a 500, not a bug
 * report.
 */

/** Sentinel used by `SkuPrice_current_uniq`'s COALESCE. Not a real Party. */
export const NO_SUPPLIER_SENTINEL = "00000000-0000-0000-0000-000000000000";

export type SkuPriceWriteInput = {
  sku_id: string;
  /** NULL = the manufacturer's own list price rather than a shop's offer. */
  supplier_party_id: string | null;
  /**
   * The one price actually payable. Required — see `resolvePrice`. A price row
   * that cannot say what the thing costs is not a price row.
   *
   * Sepasang `price_list` / `price_net` dihapus 2026-08-14. Pemeriksaan
   * "net > list, dua fieldnya tertukar" ikut hilang bersamanya — tidak ada
   * lagi dua field yang bisa tertukar.
   */
  price: number | null;
  /**
   * Wajib sama dengan `purchase_unit` SKU (keputusan U2, R4). Kosong berarti
   * mewarisi `purchase_unit`; berbeda berarti ditolak. Pemanggil yang mengubah
   * satuan memperbarui `Sku.purchase_unit` lebih dulu di transaksi yang sama.
   */
  unit: string | null;
  currency?: string;
  valid_from?: Date | null;
  notes?: string | null;
  updated_by_name?: string | null;
};

function assertPriceSane(price: number) {
  if (price < 0) {
    throw new ActionError("Harga tidak boleh negatif.", "VALIDATION_FAILED");
  }
}

/**
 * Retires the current offer for one (SKU, supplier) pair.
 *
 * Scoped to the supplier on purpose — see the invariant note at the top.
 * `valid_to` is stamped in the same statement: a row that is no longer current
 * but still has an open validity window is a row that two different readers
 * will disagree about.
 */
export async function closeCurrentSkuPrice(
  tx: PrismaTransaction,
  sku_id: string,
  supplier_party_id: string | null,
  at: Date = new Date(),
  actor?: { id?: string | null; name: string }
): Promise<number> {
  // Read the ids before the update, because `updateMany` returns a count and
  // an audit row that says "3 offers retired" without saying which ones is not
  // an audit trail. `actor` was already threaded through here and then dropped
  // on the floor — this is the write it was threaded for.
  const retiring = await tx.skuPrice.findMany({
    where: { sku_id, supplier_party_id, is_current: true },
    select: { id: true },
  });

  const { count } = await tx.skuPrice.updateMany({
    where: { sku_id, supplier_party_id, is_current: true },
    data: { is_current: false, valid_to: at },
  });

  // No rows changed => no audit. An UPDATE that updated nothing is not an event.
  if (actor && retiring.length > 0) {
    for (const { id } of retiring) {
      await recordAudit(tx, {
        entity: "SkuPrice",
        entity_id: id,
        action: "UPDATE",
        actor: { id: actor.id ?? null, name: actor.name },
        changes: { is_current: { from: true, to: false }, valid_to: { from: null, to: at } },
      });
    }
  }

  return count;
}

/**
 * Records a new current price, superseding the previous one for the same
 * (SKU, supplier) pair.
 *
 * Returns `null` when the input carries no usable price — callers treat that
 * as "the user left the price blank", not as an error. That distinction is why
 * this returns null rather than throwing: leaving price empty while editing a
 * material's spelling is normal, and must not fail the save.
 */
export async function recordSkuPrice(
  tx: PrismaTransaction,
  input: SkuPriceWriteInput,
  actor?: { id?: string | null; name: string }
) {
  const price = resolvePrice(input.price);
  if (price === null) return null;

  assertPriceSane(price);

  // Keputusan owner U2 (R4, 2026-08-24): satuan harga wajib cocok dengan
  // `purchase_unit` SKU. Diperiksa DI SINI — satu-satunya jalur tulis — bukan
  // di masing-masing action, supaya tidak ada jalur yang bisa lolos. Pemanggil
  // yang sengaja mengubah satuan (dialog Pricing) memperbarui
  // `Sku.purchase_unit` lebih dulu, sehingga pemeriksaan ini melihat nilai
  // yang baru.
  const sku = await tx.sku.findUnique({
    where: { id: input.sku_id },
    select: { purchase_unit: true },
  });
  const unitCheck = checkPriceUnit(input.unit, sku?.purchase_unit ?? null);
  if (!unitCheck.ok) {
    throw new ActionError(
      `Price unit "${unitCheck.unit}" must match the SKU's purchase unit "${unitCheck.purchaseUnit}". Fix whichever one is wrong before saving.`,
      "VALIDATION_FAILED"
    );
  }

  const now = new Date();
  const validFrom = input.valid_from ?? now;

  await closeCurrentSkuPrice(tx, input.sku_id, input.supplier_party_id, validFrom, actor);

  const row = await tx.skuPrice.create({
    data: {
      sku_id: input.sku_id,
      supplier_party_id: input.supplier_party_id,
      price_net: price,
      unit: resolveEffectivePriceUnit(input.unit, sku?.purchase_unit ?? null),
      currency: input.currency?.trim() || "IDR",
      valid_from: validFrom,
      notes: input.notes?.trim() || null,
      updated_by_name: input.updated_by_name?.trim() || null,
      updated_by_id: actor?.id ?? null,
      is_current: true,
    },
    include: SKU_PRICE_INCLUDE,
  });

  if (actor) {
    await recordAudit(tx, {
      entity: "SkuPrice",
      entity_id: row.id,
      action: "CREATE",
      actor: { id: actor.id ?? null, name: actor.name },
    });
  }

  return row;
}

export const SKU_PRICE_INCLUDE = {
  sku: {
    select: {
      id: true,
      code: true,
      name: true,
      brand_id: true,
      brand: { select: { id: true, name: true } },
      base_unit: true,
      usage_unit: true,
      purchase_unit: true,
      conversion: true,
      dim_display: true,
      categories: {
        where: { category: { kind: "PRODUCT" } },
        select: { category: { select: { name: true } } },
      },
    },
  },
  supplier: { select: { id: true, name: true } },
} as const;
