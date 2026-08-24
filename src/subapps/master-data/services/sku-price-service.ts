import "server-only";

import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { diffFields, recordAudit } from "./audit-service";
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
 * PRD Architecture Cleanup v2 §15–§18 flattened `SkuPrice` into CURRENT STATE:
 * one row per (SKU × supplier), history in generic AuditLog, no close-old /
 * create-new lifecycle. This file is therefore the only place allowed to
 * create OR update that current row.
 */

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
  notes?: string | null;
  updated_by_name?: string | null;
};

function assertPriceSane(price: number) {
  if (price < 0) {
    throw new ActionError("Harga tidak boleh negatif.", "VALIDATION_FAILED");
  }
}

/**
 * Creates or updates the current price for one (SKU, supplier) pair.
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

  const effectiveUnit = resolveEffectivePriceUnit(input.unit, sku?.purchase_unit ?? null);
  const effectiveCurrency = input.currency?.trim() || "IDR";
  const effectiveNotes = input.notes?.trim() || null;
  const effectiveUpdatedByName = input.updated_by_name?.trim() || null;

  const existing = await tx.skuPrice.findFirst({
    where: {
      sku_id: input.sku_id,
      supplier_party_id: input.supplier_party_id,
    },
  });

  if (existing) {
    const row = await tx.skuPrice.update({
      where: { id: existing.id },
      data: {
        price_net: price,
        unit: effectiveUnit,
        currency: effectiveCurrency,
        notes: effectiveNotes,
        updated_by_name: effectiveUpdatedByName,
        updated_by_id: actor?.id ?? null,
      },
      include: SKU_PRICE_INCLUDE,
    });

    if (actor) {
      const changes = diffFields(
        {
          price_net: existing.price_net,
          unit: existing.unit,
          currency: existing.currency,
          notes: existing.notes,
          updated_by_name: existing.updated_by_name,
          updated_by_id: existing.updated_by_id,
        },
        {
          price_net: row.price_net,
          unit: row.unit,
          currency: row.currency,
          notes: row.notes,
          updated_by_name: row.updated_by_name,
          updated_by_id: row.updated_by_id,
        },
        ["price_net", "unit", "currency", "notes", "updated_by_name", "updated_by_id"]
      );
      if (Object.keys(changes).length > 0) {
        await recordAudit(tx, {
          entity: "SkuPrice",
          entity_id: row.id,
          action: "UPDATE",
          actor: { id: actor.id ?? null, name: actor.name },
          changes,
        });
      }
    }

    return row;
  }

  const row = await tx.skuPrice.create({
    data: {
      sku_id: input.sku_id,
      supplier_party_id: input.supplier_party_id,
      price_net: price,
      unit: effectiveUnit,
      currency: effectiveCurrency,
      notes: effectiveNotes,
      updated_by_name: effectiveUpdatedByName,
      updated_by_id: actor?.id ?? null,
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
