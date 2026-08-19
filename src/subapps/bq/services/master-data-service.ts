import "server-only";

/**
 * BQ -> MASTER DATA — satu-satunya pintu baca.
 *
 * ============================================================================
 * ARAH KETERGANTUNGAN
 * ============================================================================
 * BQ membaca `master_data`; `master_data` tidak tahu BQ ada. Itu arah yang
 * sah — yang dilarang `AGENTS.md` §8 adalah `master_data` bergantung ke
 * `studioflow`. Jangan pernah menulis ke tabel `master_data` dari berkas mana
 * pun di `src/subapps/bq/`: bahan atau jasa yang belum ada di master diminta
 * ke staff lewat Master Data, bukan dibuat diam-diam oleh BQ (keputusan owner
 * 2026-08-19: *"sifat master data = SSOT"*).
 *
 * ============================================================================
 * KENAPA TIDAK MEMBACA `v_bq_material_rate` / `v_bq_work_rate`
 * ============================================================================
 * Kedua view itu memang kontrak baca BQ dan tetap benar. Tapi ia tidak tahu
 * apa pun tentang `bq.BqMaterialProfile` — konversi, waste default, minimum
 * order, rounding — yang justru menentukan apakah sebuah SKU bisa dipakai BQ
 * sama sekali. Membacanya lewat view berarti dua query dan satu join manual
 * di JavaScript untuk hasil yang sama, ditambah `$queryRaw` yang tidak
 * mengikuti perubahan skema.
 *
 * Yang DIWARISI dari view itu dan ditegakkan di sini adalah aturannya, bukan
 * SQL-nya:
 *   - hanya `SkuPrice.is_current`;
 *   - SKU `deleted_at IS NULL` dan `status <> 'DISCONTINUED'`;
 *   - `bq_ready` = harga ADA dan satuan COCOK (AGENTS.md §3.6);
 *   - `WorkPrice` hanya yang `is_current AND is_active AND deleted_at IS NULL`.
 *
 * ============================================================================
 * GATE MASUK PICKER (keputusan owner 2026-08-19)
 * ============================================================================
 * Gate-nya adalah: SKU punya ≥1 harga berlaku (`NO_PRICE`). Costing fields
 * (`purchase_unit`, `conversion`) TIDAK memblokir — SKU CRUD hanya bisa
 * ditrigger dari layar Price sehingga keduanya dijamin terisi sebelum harga
 * pertama tercatat. `NO_PROFILE` dihapus dari kode karena tidak mungkin
 * terjadi dalam alur normal.
 *
 * Kalau satu SKU punya beberapa supplier (beberapa baris `SkuPrice` berlaku),
 * picker menampilkan harga preferred supplier atau terbaru — estimator memilih
 * supplier di luar picker (nego, PO) bukan di BQ.
 *
 * ============================================================================
 * KOSONG BUKAN NOL
 * ============================================================================
 * AGENTS.md §3.2. Berkas ini tidak pernah menulis `?? 0` pada harga, konversi,
 * atau waste. Harga yang hilang membuat sebuah SKU **tidak siap dipakai**, dan
 * itu dilaporkan sebagai `readiness.reason`, bukan disulap jadi tarif nol yang
 * kemudian jadi satu baris di dokumen komersial.
 */

import { prisma } from "@/core/platform/db";
import { Prisma } from "@/generated/prisma";
import { BQ_PICKER_PAGE_SIZE } from "../lib/constants";
import type {
  BqMaterialCandidate,
  BqMaterialReadiness,
  BqServiceCandidate,
} from "../types/breakdown";

/** `Decimal | null` -> `number | null`, tanpa memaksa nol. */
export function decToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value.toNumber();
}

/** `Decimal` wajib -> `number`. Dipakai hanya untuk kolom `NOT NULL`. */
export function decToNumberStrict(value: Prisma.Decimal): number {
  return value.toNumber();
}

// ---------------------------------------------------------------------------
// Bahan
// ---------------------------------------------------------------------------

const SKU_SELECT = {
  id: true,
  code: true,
  name: true,
  base_unit: true,
  // BQ costing fields — sekarang duduk langsung di Sku (P1, 2026-08-19)
  usage_unit: true,
  purchase_unit: true,
  conversion: true,
  default_waste_pct: true,
  minimum_order: true,
  rounding_increment: true,
  preferred_supplier_party_id: true,
  brand: { select: { name: true } },
  categories: {
    where: { is_primary: true },
    select: { category: { select: { id: true, name: true, path: true, kind: true } } },
    take: 1,
  },
  prices: {
    where: { is_current: true },
    orderBy: [{ valid_from: "desc" }] as const,
    select: {
      id: true,
      unit: true,
      price_net: true,
      currency: true,
      valid_from: true,
      supplier_party_id: true,
      supplier: { select: { name: true } },
    },
  },
} satisfies Prisma.SkuSelect;

type SkuRow = Prisma.SkuGetPayload<{ select: typeof SKU_SELECT }>;

/**
 * Penawaran mana yang dipakai BQ ketika satu SKU punya beberapa harga berlaku
 * (satu per supplier — dijamin index parsial `SkuPrice_current_uniq`).
 *
 * Urutannya: supplier yang dipilih di profil BQ, kalau tidak ada baru yang
 * `valid_from` terbaru. TIDAK PERNAH "yang termurah" — memilih termurah secara
 * otomatis adalah keputusan pembelian, dan itu bukan wewenang alat estimasi.
 */
function pickPrice(sku: SkuRow) {
  const preferred = sku.preferred_supplier_party_id ?? null;
  if (preferred) {
    const match = sku.prices.find((p) => p.supplier_party_id === preferred);
    if (match) return match;
  }
  return sku.prices[0] ?? null;
}

/**
 * Kenapa sebuah SKU belum bisa dipakai di breakdown — dinyatakan, bukan
 * disembunyikan di balik satu boolean `disabled`.
 *
 * Gate satu-satunya adalah harga: SKU tanpa harga berlaku (`NO_PRICE`) tidak
 * bisa dipakai karena BQ tidak boleh mengarang harga (AGENTS.md §3.2).
 *
 * `UNIT_MISMATCH` tetap diperiksa bila `purchase_unit` terisi — bila profil
 * bilang "beli per lembar" tapi harga ditulis per "sqm", yang salah bisa
 * profilnya, bisa penawarannya, dan BQ tidak menebak yang mana.
 */
function evaluateReadiness(sku: SkuRow): BqMaterialReadiness {
  const price = pickPrice(sku);
  if (!price) {
    return {
      ok: false,
      reason: "NO_PRICE",
      detail: "No current price in Master Data. Ask Master Data staff to record one.",
    };
  }

  if (sku.purchase_unit && price.unit !== sku.purchase_unit) {
    return {
      ok: false,
      reason: "UNIT_MISMATCH",
      detail: `This SKU is set to buy per "${sku.purchase_unit}", but the current price is quoted per "${price.unit}". Fix whichever one is wrong before using it.`,
    };
  }

  return { ok: true };
}

function toCandidate(sku: SkuRow): BqMaterialCandidate {
  const price = pickPrice(sku);
  const primary = sku.categories[0]?.category ?? null;

  const hasCosting = sku.purchase_unit && sku.conversion;

  return {
    skuId: sku.id,
    code: sku.code,
    name: sku.name,
    brandName: sku.brand?.name ?? null,
    categoryPath: primary?.path ?? null,
    baseUnit: sku.base_unit,
    profile: hasCosting
      ? {
          usageUnit: sku.usage_unit ?? sku.base_unit,
          purchaseUnit: sku.purchase_unit!,
          conversion: decToNumberStrict(sku.conversion!),
          defaultWastePct: decToNumber(sku.default_waste_pct),
          minimumOrder: decToNumber(sku.minimum_order),
          roundingIncrement: sku.rounding_increment ? decToNumberStrict(sku.rounding_increment) : 1,
        }
      : null,
    price: price
      ? {
          skuPriceId: price.id,
          supplierPartyId: price.supplier_party_id,
          supplierName: price.supplier?.name ?? null,
          unit: price.unit,
          price: decToNumberStrict(price.price_net),
          currency: price.currency,
          validFrom: price.valid_from.toISOString(),
        }
      : null,
    readiness: evaluateReadiness(sku),
  };
}

/**
 * Kandidat bahan untuk picker L3.
 *
 * Mengembalikan SKU yang BELUM siap pakai juga, lengkap dengan alasannya.
 * Menyaringnya diam-diam akan membuat estimator mencari-cari bahan yang ia
 * tahu ada di Master Data dan tidak pernah tahu kenapa ia tidak muncul.
 */
export async function searchMaterialCandidates(
  query: string,
  options: { onlyReady?: boolean; limit?: number } = {}
): Promise<BqMaterialCandidate[]> {
  const limit = Math.min(options.limit ?? BQ_PICKER_PAGE_SIZE, BQ_PICKER_PAGE_SIZE);
  const trimmed = query.trim();

  const skus = await prisma.sku.findMany({
    where: {
      deleted_at: null,
      status: { not: "DISCONTINUED" },
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { code: { contains: trimmed, mode: "insensitive" } },
              { brand: { name: { contains: trimmed, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: SKU_SELECT,
    orderBy: [{ name: "asc" }],
    take: limit,
  });

  const candidates = skus.map((s) => toCandidate(s));
  return options.onlyReady ? candidates.filter((c) => c.readiness.ok) : candidates;
}

/** Satu SKU, dengan seluruh konteks yang dibutuhkan untuk membekukan snapshot. */
export async function loadMaterialCandidate(skuId: string): Promise<BqMaterialCandidate | null> {
  const sku = await prisma.sku.findFirst({
    where: { id: skuId, deleted_at: null },
    select: SKU_SELECT,
  });
  if (!sku) return null;
  return toCandidate(sku);
}

// ---------------------------------------------------------------------------
// Jasa
// ---------------------------------------------------------------------------

const WORK_PRICE_SELECT = {
  id: true,
  code: true,
  name: true,
  unit: true,
  price: true,
  currency: true,
  scope_note: true,
  kind: true,
  valid_from: true,
  vendor_party_id: true,
  vendor: { select: { name: true } },
  category: { select: { name: true, path: true } },
} satisfies Prisma.WorkPriceSelect;

type WorkPriceRow = Prisma.WorkPriceGetPayload<{ select: typeof WORK_PRICE_SELECT }>;

function toServiceCandidate(row: WorkPriceRow): BqServiceCandidate {
  return {
    workPriceId: row.id,
    code: row.code,
    name: row.name,
    categoryPath: row.category.path,
    vendorPartyId: row.vendor_party_id,
    vendorName: row.vendor?.name ?? null,
    rateUnit: row.unit,
    price: decToNumberStrict(row.price),
    currency: row.currency,
    scopeNote: row.scope_note,
    // Dinyatakan, bukan disimpulkan dari kolom mana yang terisi — AGENTS.md
    // §3.4. Menyimpulkannya adalah cacat yang migrasi 20260811120000 buang.
    hasMaterial: row.kind === "MATERIAL_LABOR",
    validFrom: row.valid_from.toISOString(),
  };
}

/**
 * Kandidat jasa untuk picker L3.
 *
 * `WorkPrice` BUKAN tabel riwayat (AGENTS.md §3.7, keputusan owner SK1): satu
 * baris per `code`, diedit di tempat. Jadi tidak ada penyaringan "ambil yang
 * terbaru" seperti pada `SkuPrice` — `is_current` di sini adalah kolom yang
 * tidak dipakai sebagai riwayat, dan tetap difilter semata-mata karena
 * `v_bq_work_rate` memfilternya.
 */
export async function searchServiceCandidates(
  query: string,
  options: { limit?: number } = {}
): Promise<BqServiceCandidate[]> {
  const limit = Math.min(options.limit ?? BQ_PICKER_PAGE_SIZE, BQ_PICKER_PAGE_SIZE);
  const trimmed = query.trim();

  const rows = await prisma.workPrice.findMany({
    where: {
      deleted_at: null,
      is_active: true,
      is_current: true,
      ...(trimmed
        ? {
            OR: [
              { name: { contains: trimmed, mode: "insensitive" } },
              { code: { contains: trimmed, mode: "insensitive" } },
              { vendor: { name: { contains: trimmed, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    select: WORK_PRICE_SELECT,
    orderBy: [{ name: "asc" }],
    take: limit,
  });

  return rows.map(toServiceCandidate);
}

export async function loadServiceCandidate(
  workPriceId: string
): Promise<BqServiceCandidate | null> {
  const row = await prisma.workPrice.findFirst({
    where: { id: workPriceId, deleted_at: null },
    select: WORK_PRICE_SELECT,
  });
  return row ? toServiceCandidate(row) : null;
}
