import "server-only";

/**
 * BQ — deteksi pergerakan master data terhadap snapshot.
 *
 * ============================================================================
 * INI SATU-SATUNYA TEMPAT BQ MEMBACA ULANG MASTER DATA UNTUK BARIS YANG SUDAH ADA
 * ============================================================================
 * Dan ia hanya MELAPORKAN. Tidak ada jalur di berkas ini yang menulis ke
 * `bq.BqMaterialLine` atau `bq.BqServiceLine` — penerapannya adalah aksi
 * terpisah yang dipanggil tombol, per baris (`refreshMaterialLineSnapshotAction`).
 *
 * PRD §5.4: *"perubahan hanya diterapkan setelah konfirmasi, dan boleh
 * diterapkan sebagian."* Pemisahan lapor/terap inilah yang memenuhi kalimat
 * itu tanpa logika tambahan.
 *
 * Object yang sudah DIKUNCI dilewati seluruhnya — bukan disaring di UI, tapi
 * tidak pernah diperiksa sama sekali. PRD §5.4: *"Object yang sudah dikunci
 * tidak menerima refresh apa pun, banner pun tidak muncul."*
 *
 * P2-D4: Drift disederhanakan. Per baris cukup `hasDrift: boolean`, per object
 * cukup jumlah baris yang drift. Detail "apa yang berubah" tidak dikirim ke
 * klien.
 */

import { prisma } from "@/core/platform/db";
import { Prisma } from "@/generated/prisma";
import { BQ_DRIFT_EPSILON } from "../lib/constants";
import type { BqDriftReport, BqLineDrift, BqObjectDrift } from "../types/breakdown";

type ObjectWithLines = Prisma.BqObjectGetPayload<{
  include: {
    sub_objects: {
      include: { material_lines: true; service_lines: true };
    };
  };
}>;

function differs(snapshot: number, current: number): boolean {
  const scale = Math.max(Math.abs(snapshot), Math.abs(current));
  if (scale === 0) return false;
  return Math.abs(snapshot - current) / scale > BQ_DRIFT_EPSILON;
}

function hasMaterialDrift(line: { sku_id: string | null; is_manual_override: boolean; snapshot_price: Prisma.Decimal; snapshot_conversion: Prisma.Decimal | null; snapshot_purchase_unit: string | null; supplier_party_id: string | null }, sku: { purchase_unit: string | null; conversion: Prisma.Decimal | null; prices: { unit: string; price_net: Prisma.Decimal; supplier_party_id: string | null }[] } | undefined): boolean {
  if (!sku) return true;
  if (!sku.purchase_unit || !sku.conversion) return true;
  const current = sku.prices.find((p) => p.supplier_party_id === line.supplier_party_id) ?? sku.prices[0] ?? null;
  if (!current) return true;
  if (current.unit !== line.snapshot_purchase_unit) return true;
  if (differs(line.snapshot_conversion?.toNumber() ?? 1, sku.conversion.toNumber())) return true;
  if (differs(line.snapshot_price.toNumber(), current.price_net.toNumber())) return true;
  return false;
}

function hasServiceDrift(line: { work_price_id: string | null; is_manual_override: boolean; snapshot_price: Prisma.Decimal; snapshot_rate_unit: string }, wp: { price: Prisma.Decimal; unit: string } | undefined): boolean {
  if (!wp) return true;
  if (wp.unit !== line.snapshot_rate_unit) return true;
  if (differs(line.snapshot_price.toNumber(), wp.price.toNumber())) return true;
  return false;
}

export async function buildDriftReport(objects: ObjectWithLines[]): Promise<BqDriftReport> {
  const live = objects.filter((o) => o.locked_at === null);
  const skippedLockedObjectCount = objects.length - live.length;

  const skuIds = new Set<string>();
  const workPriceIds = new Set<string>();
  for (const obj of live) {
    for (const sub of obj.sub_objects) {
      for (const line of sub.material_lines) if (line.sku_id) skuIds.add(line.sku_id);
      for (const line of sub.service_lines) if (line.work_price_id) workPriceIds.add(line.work_price_id);
    }
  }

  if (skuIds.size === 0 && workPriceIds.size === 0) {
    return { objects: [], skippedLockedObjectCount };
  }

  const [skus, workPrices] = await Promise.all([
    skuIds.size
      ? prisma.sku.findMany({
          where: { id: { in: [...skuIds] }, deleted_at: null },
          select: {
            id: true,
            purchase_unit: true,
            conversion: true,
            prices: {
              where: { is_current: true },
              orderBy: [{ valid_from: "desc" }],
              select: { id: true, unit: true, price_net: true, supplier_party_id: true },
            },
          },
        })
      : Promise.resolve([]),
    workPriceIds.size
      ? prisma.workPrice.findMany({
          where: { id: { in: [...workPriceIds] }, deleted_at: null, is_active: true },
          select: { id: true, price: true, unit: true },
        })
      : Promise.resolve([]),
  ]);

  const skuById = new Map(skus.map((s) => [s.id, s]));
  const workPriceById = new Map(workPrices.map((w) => [w.id, w]));

  const resultObjects: BqObjectDrift[] = [];

  for (const obj of live) {
    const driftedLines: BqLineDrift[] = [];

    for (const sub of obj.sub_objects) {
      for (const line of sub.material_lines) {
        if (line.is_manual_override || !line.sku_id) continue;
        if (hasMaterialDrift(line, skuById.get(line.sku_id))) {
          driftedLines.push({ lineId: line.id, lineKind: "MATERIAL" });
        }
      }
      for (const line of sub.service_lines) {
        if (line.is_manual_override || !line.work_price_id) continue;
        if (hasServiceDrift(line, workPriceById.get(line.work_price_id))) {
          driftedLines.push({ lineId: line.id, lineKind: "SERVICE" });
        }
      }
    }

    if (driftedLines.length > 0) {
      resultObjects.push({ objectId: obj.id, objectName: obj.name, driftedLines });
    }
  }

  return { objects: resultObjects, skippedLockedObjectCount };
}
