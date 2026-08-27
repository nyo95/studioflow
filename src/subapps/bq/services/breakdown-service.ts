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
  computeObject,
  computeProject,
  type MaterialLineInput,
  type ObjectInput,
  type ServiceLineInput,
} from "../lib/calc";
import { rollupSectionSubtotals } from "../lib/section-rollup";
import { decToNumber, decToNumberStrict } from "./master-data-service";
import type {
  BqMaterialLineRecord,
  BqObjectView,
  BqProjectSummary,
  BqProjectView,
  BqServiceLineRecord,
} from "../types/breakdown";

const OBJECT_INCLUDE = {
  // Baris yang menempel langsung di L1 (item sederhana) …
  material_lines: { orderBy: [{ sort_order: "asc" }, { created_at: "asc" }] as const },
  service_lines: { orderBy: [{ sort_order: "asc" }, { created_at: "asc" }] as const },
  // … dan baris yang lewat L2 (item komposit).
  sub_objects: {
    orderBy: [{ sort_order: "asc" }, { created_at: "asc" }] as const,
    include: {
      material_lines: { orderBy: [{ sort_order: "asc" }, { created_at: "asc" }] as const },
      service_lines: { orderBy: [{ sort_order: "asc" }, { created_at: "asc" }] as const },
    },
  },
} satisfies Prisma.BqObjectInclude;

type ObjectRow = Prisma.BqObjectGetPayload<{ include: typeof OBJECT_INCLUDE }>;
type MaterialRow = ObjectRow["material_lines"][number];
type ServiceRow = ObjectRow["service_lines"][number];

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
    wasteOverridePct: decToNumber(row.waste_override_pct),
    materials: row.material_lines.map(toMaterialInput),
    services: row.service_lines.map(toServiceInput),
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
    objectId: row.object_id,
    subObjectId: row.sub_object_id,
    costCategory: row.cost_category,
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
    objectId: row.object_id,
    subObjectId: row.sub_object_id,
    costCategory: row.cost_category,
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
    sectionId: row.section_id,
    materials: row.material_lines.map(toMaterialRecord),
    services: row.service_lines.map(toServiceRecord),
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
 * Satu project, lengkap: object terhitung dan total.
 *
 * Viewer kerja estimator sengaja tidak lagi membangun purchase summary
 * otomatis. Perhitungan inti BQ sekarang cukup koefisien x harga snapshot.
 */
export async function loadProjectView(projectId: string): Promise<BqProjectView | null> {
  const project = await prisma.bqProject.findFirst({
    where: { id: projectId, deleted_at: null },
    include: {
      _count: { select: { objects: true } },
      sections: {
        where: { deleted_at: null },
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
      },
      objects: {
        where: { deleted_at: null },
        orderBy: [{ sort_order: "asc" }, { created_at: "asc" }],
        include: OBJECT_INCLUDE,
      },
    },
  });
  if (!project) return null;

  const inputs = project.objects.map(toObjectInput);
  const objectViews = project.objects.map(toObjectView);

  // Subtotal dijumlahkan DI SINI, dari hasil `computeObject` yang sama yang
  // dipakai grand total. Menjumlahkannya lagi di klien akan melahirkan sumber
  // kebenaran kedua, dan selisihnya baru ketahuan di kertas penawaran.
  //
  // Yang dijumlahkan di sini HANYA yang menempel langsung; kenaikannya ke
  // induk dikerjakan `rollupSectionSubtotals` di bawah.
  const direct = new Map<string, { sum: number; count: number }>();
  for (const view of objectViews) {
    if (!view.sectionId) continue;
    const bucket = direct.get(view.sectionId) ?? { sum: 0, count: 0 };
    bucket.sum += view.computed.total;
    bucket.count += 1;
    direct.set(view.sectionId, bucket);
  }

  // Kenaikan ke induk dilakukan POST-ORDER, di `lib/section-rollup.ts`.
  // Loop datar yang dipakai sebelumnya hanya benar pada pohon dua lapis: induk
  // sudah lewat sebelum anaknya menerima sumbangan cucunya, sehingga
  // "SUBTOTAL B" jadi nol pada Section yang seluruh Works-nya duduk di dalam
  // L2 Sub Section (mis. "Wall Works -> Shopfront Area"). Alasan lengkapnya
  // ada di kepala berkas itu; jangan kembalikan ke loop datar.
  const rollup = rollupSectionSubtotals(
    project.sections.map((s) => ({ id: s.id, parentId: s.parent_id })),
    new Map(Array.from(direct, ([id, bucket]) => [id, bucket.sum])),
  );

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
    sections: project.sections.map((s) => ({
      id: s.id,
      parentId: s.parent_id,
      code: s.code,
      name: s.name,
      sortOrder: s.sort_order,
      notes: s.notes,
      subtotal: rollup.get(s.id) ?? 0,
      objectCount: direct.get(s.id)?.count ?? 0,
    })),
    objects: objectViews,
    totals: computeProject(inputs),
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
