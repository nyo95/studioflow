import "server-only";

/**
 * BQ — pemuat breakdown.
 *
 * Tugasnya SATU: mengubah baris database jadi masukan untuk `lib/calc.ts`,
 * lalu menyerahkan hasilnya apa adanya. Tidak ada aritmatika di berkas ini —
 * kalau ada angka yang dijumlahkan di sini, ia jadi sumber kebenaran kedua
 * yang bisa selisih dari mesin hitung, dan selisih semacam itu selalu
 * ditemukan belakangan, di kertas penawaran.
 *
 * Di sinilah `Decimal` Prisma berhenti. Semua yang menyeberang ke komponen
 * klien sudah berupa `number` / `string` (lihat `types/breakdown.ts`).
 */

import { prisma } from "@/core/platform/db";
import { Prisma } from "@/generated/prisma";
import {
  buildPurchaseSummary,
  computeObject,
  computeProject,
  type MaterialLineInput,
  type ObjectInput,
  type ServiceLineInput,
} from "../lib/calc";
import { decToNumber, decToNumberStrict } from "./master-data-service";
import type {
  BqMaterialLineRecord,
  BqObjectView,
  BqProjectSummary,
  BqProjectView,
  BqServiceLineRecord,
} from "../types/breakdown";

const OBJECT_INCLUDE = {
  sub_objects: {
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }] as const,
    include: {
      material_lines: { orderBy: [{ sort_order: "asc" }, { created_at: "asc" }] as const },
      service_lines: { orderBy: [{ sort_order: "asc" }, { created_at: "asc" }] as const },
    },
  },
} satisfies Prisma.BqObjectInclude;

type ObjectRow = Prisma.BqObjectGetPayload<{ include: typeof OBJECT_INCLUDE }>;
type MaterialRow = ObjectRow["sub_objects"][number]["material_lines"][number];
type ServiceRow = ObjectRow["sub_objects"][number]["service_lines"][number];

// ---------------------------------------------------------------------------
// DB -> masukan mesin hitung
// ---------------------------------------------------------------------------

/**
 * Perhatikan bahwa TIDAK ADA satu pun nilai di sini yang dibaca dari master
 * data. Seluruhnya kolom `snapshot_*` milik baris itu sendiri.
 *
 * Itu bukan optimasi query, itu PRD §5.4: sistem tidak membaca ulang master
 * saat menampilkan breakdown. Satu join "kecil" ke `SkuPrice` di fungsi ini
 * akan membuat setiap object diam-diam mengikuti harga hari ini — persis
 * silent update yang dilarang.
 */
function toMaterialInput(row: MaterialRow): MaterialLineInput {
  return {
    id: row.id,
    skuId: row.sku_id,
    name: row.snapshot_name,
    usageUnit: row.snapshot_usage_unit ?? null,
    purchaseUnit: row.snapshot_purchase_unit ?? null,
    conversion: row.snapshot_conversion ? decToNumberStrict(row.snapshot_conversion) : null,
    pricePerPurchaseUnit: decToNumberStrict(row.snapshot_price),
    qtyPerSub: decToNumberStrict(row.qty_per_sub),
    wasteOverridePct: decToNumber(row.waste_override_pct),
    materialDefaultWastePct: decToNumber(row.snapshot_material_default_waste_pct),
    categoryDefaultWastePct: decToNumber(row.snapshot_category_default_waste_pct),
    minimumOrder: decToNumber(row.snapshot_minimum_order),
    roundingIncrement: decToNumberStrict(row.snapshot_rounding_increment),
  };
}

function toServiceInput(row: ServiceRow): ServiceLineInput {
  return {
    id: row.id,
    workPriceId: row.work_price_id,
    name: row.snapshot_name,
    rateUnit: row.snapshot_rate_unit,
    pricePerRateUnit: decToNumberStrict(row.snapshot_price),
    qtyPerSub: decToNumberStrict(row.qty_per_sub),
  };
}

export function toObjectInput(row: ObjectRow): ObjectInput {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    qty: decToNumberStrict(row.qty),
    unit: row.unit,
    markupPct: decToNumberStrict(row.markup_pct),
    wasteOverridePct: decToNumber(row.waste_override_pct),
    subObjects: row.sub_objects.map((sub) => ({
      id: sub.id,
      name: sub.name,
      qty: decToNumberStrict(sub.qty),
      materials: sub.material_lines.map(toMaterialInput),
      services: sub.service_lines.map(toServiceInput),
    })),
  };
}

// ---------------------------------------------------------------------------
// DB -> bentuk yang dibaca form
// ---------------------------------------------------------------------------

function toMaterialRecord(row: MaterialRow): BqMaterialLineRecord {
  return {
    id: row.id,
    subObjectId: row.sub_object_id,
    skuId: row.sku_id,
    skuPriceId: row.sku_price_id,
    supplierPartyId: row.supplier_party_id,
    source: row.source,
    qtyPerSub: decToNumberStrict(row.qty_per_sub),
    wasteOverridePct: decToNumber(row.waste_override_pct),
    name: row.snapshot_name,
    code: row.snapshot_code,
    brandName: row.snapshot_brand_name,
    categoryPath: row.snapshot_category_path,
    supplierName: row.snapshot_supplier_name,
    usageUnit: row.snapshot_usage_unit ?? null,
    purchaseUnit: row.snapshot_purchase_unit ?? null,
    conversion: row.snapshot_conversion ? decToNumberStrict(row.snapshot_conversion) : null,
    price: decToNumberStrict(row.snapshot_price),
    currency: row.snapshot_currency,
    materialDefaultWastePct: decToNumber(row.snapshot_material_default_waste_pct),
    categoryDefaultWastePct: decToNumber(row.snapshot_category_default_waste_pct),
    minimumOrder: decToNumber(row.snapshot_minimum_order),
    roundingIncrement: decToNumberStrict(row.snapshot_rounding_increment),
    priceValidFrom: row.snapshot_price_valid_from?.toISOString() ?? null,
    snapshotTakenAt: row.snapshot_taken_at.toISOString(),
    isManualOverride: row.is_manual_override,
    overrideNote: row.override_note,
    sortOrder: row.sort_order,
    notes: row.notes,
  };
}

function toServiceRecord(row: ServiceRow): BqServiceLineRecord {
  return {
    id: row.id,
    subObjectId: row.sub_object_id,
    workPriceId: row.work_price_id,
    vendorPartyId: row.vendor_party_id,
    source: row.source,
    qtyPerSub: decToNumberStrict(row.qty_per_sub),
    name: row.snapshot_name,
    code: row.snapshot_code,
    categoryPath: row.snapshot_category_path,
    vendorName: row.snapshot_vendor_name,
    rateUnit: row.snapshot_rate_unit,
    price: decToNumberStrict(row.snapshot_price),
    currency: row.snapshot_currency,
    scopeNote: row.snapshot_scope_note,
    hasMaterial: row.snapshot_has_material,
    priceValidFrom: row.snapshot_price_valid_from?.toISOString() ?? null,
    snapshotTakenAt: row.snapshot_taken_at.toISOString(),
    isManualOverride: row.is_manual_override,
    overrideNote: row.override_note,
    sortOrder: row.sort_order,
    notes: row.notes,
  };
}

function toObjectView(row: ObjectRow): BqObjectView {
  return {
    computed: computeObject(toObjectInput(row)),
    wasteOverridePct: decToNumber(row.waste_override_pct),
    lockedAt: row.locked_at?.toISOString() ?? null,
    lockedByName: row.locked_by_name,
    notes: row.notes,
    sortOrder: row.sort_order,
    subObjects: row.sub_objects.map((sub) => ({
      id: sub.id,
      name: sub.name,
      qty: decToNumberStrict(sub.qty),
      sortOrder: sub.sort_order,
      notes: sub.notes,
      librarySubObjectId: sub.library_sub_object_id,
      materials: sub.material_lines.map(toMaterialRecord),
      services: sub.service_lines.map(toServiceRecord),
    })),
  };
}

// ---------------------------------------------------------------------------
// Pemuat
// ---------------------------------------------------------------------------

export async function listProjects(): Promise<BqProjectSummary[]> {
  const rows = await prisma.bqProject.findMany({
    where: { deleted_at: null },
    orderBy: [{ updated_at: "desc" }, { created_at: "desc" }],
    include: { _count: { select: { objects: true } } },
  });

  return rows.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    status: p.status,
    notes: p.notes,
    objectCount: p._count.objects,
    createdAt: p.created_at.toISOString(),
    updatedAt: p.updated_at?.toISOString() ?? null,
    createdByName: p.created_by_name,
  }));
}

/**
 * Satu project, lengkap: object terhitung, total, dan purchase summary.
 *
 * Purchase summary dibangun dari `ObjectInput[]` yang SAMA dengan yang dipakai
 * menghitung rate, bukan dari query agregasi terpisah. Kalau keduanya dipisah,
 * suatu hari salah satunya akan memfilter object `ringkas` dan yang lain
 * tidak, dan yang ketahuan duluan adalah daftar belanjanya — setelah dipakai
 * belanja.
 */
export async function loadProjectView(projectId: string): Promise<BqProjectView | null> {
  const project = await prisma.bqProject.findFirst({
    where: { id: projectId, deleted_at: null },
    include: {
      _count: { select: { objects: true } },
      objects: {
        where: { deleted_at: null },
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
        include: OBJECT_INCLUDE,
      },
    },
  });
  if (!project) return null;

  const inputs = project.objects.map(toObjectInput);

  return {
    project: {
      id: project.id,
      code: project.code,
      name: project.name,
      status: project.status,
      notes: project.notes,
      objectCount: project._count.objects,
      createdAt: project.created_at.toISOString(),
      updatedAt: project.updated_at?.toISOString() ?? null,
      createdByName: project.created_by_name,
    },
    objects: project.objects.map(toObjectView),
    totals: computeProject(inputs),
    purchase: buildPurchaseSummary(inputs),
  };
}

/** Dipakai server action sesudah menulis, untuk mengembalikan angka baru tanpa
 *  memuat ulang seluruh halaman. */
export async function loadObjectView(objectId: string): Promise<BqObjectView | null> {
  const row = await prisma.bqObject.findFirst({
    where: { id: objectId, deleted_at: null },
    include: OBJECT_INCLUDE,
  });
  return row ? toObjectView(row) : null;
}
