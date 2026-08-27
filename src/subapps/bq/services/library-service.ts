import "server-only";

/**
 * BQ Library — CRUD for resep (L1 dan L2) yang bisa dipanggil ulang.
 *
 * Library menyimpan RESEP, bukan snapshot. Tidak ada kolom snapshot_*.
 * Saat resep dipanggil ke project, snapshot dibekukan dari master data SAAT ITU.
 */

import { prisma } from "@/core/platform/db";
import { decToNumber, decToNumberStrict } from "./master-data-service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BqLibraryObjectRow = {
  id: string;
  code: string | null;
  name: string;
  unit: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  subObjectCount: number;
  materialLineCount: number;
  serviceLineCount: number;
};

export type BqLibrarySubObjectRow = {
  id: string;
  name: string;
  qty: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string | null;
  materialLineCount: number;
  serviceLineCount: number;
};

export type BqLibraryObjectDetail = BqLibraryObjectRow & {
  subObjects: BqLibrarySubObjectOfObjectDetail[];
};

export type BqLibrarySubObjectOfObjectDetail = {
  id: string;
  name: string;
  qty: number;
  notes: string | null;
  sortOrder: number;
  materials: BqLibraryMaterialLineDetail[];
  services: BqLibraryServiceLineDetail[];
};

export type BqLibrarySubObjectDetail = BqLibrarySubObjectRow & {
  materials: BqLibraryMaterialLineDetail[];
  services: BqLibraryServiceLineDetail[];
};

export type BqLibraryMaterialLineDetail = {
  id: string;
  skuId: string | null;
  source: "MASTER_DATA" | "PROJECT_LOCAL";
  skuName: string | null;
  skuCode: string | null;
  brandName: string | null;
  qtyPerSub: number;
  wasteOverridePct: number | null;
  sortOrder: number;
};

export type BqLibraryServiceLineDetail = {
  id: string;
  workPriceId: string | null;
  source: "MASTER_DATA" | "PROJECT_LOCAL";
  workPriceName: string | null;
  workPriceCode: string | null;
  vendorName: string | null;
  qtyPerSub: number;
  sortOrder: number;
};

// ---------------------------------------------------------------------------
// L1 Library
// ---------------------------------------------------------------------------

export async function listLibraryObjects(
  query: string,
  options: { limit?: number } = {}
): Promise<BqLibraryObjectRow[]> {
  const limit = Math.min(options.limit ?? 50, 100);
  const trimmed = query.trim();

  const rows = await prisma.bqLibraryObject.findMany({
    where: {
      deleted_at: null,
      ...(trimmed
        ? { name: { contains: trimmed, mode: "insensitive" } }
        : {}),
    },
    include: {
      sub_objects: {
        select: {
          materials: { select: { id: true } },
          services: { select: { id: true } },
        },
      },
    },
    orderBy: [{ name: "asc" }],
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    unit: r.unit,
    notes: r.notes,
    createdBy: r.created_by_name,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at?.toISOString() ?? null,
    subObjectCount: r.sub_objects.length,
    materialLineCount: r.sub_objects.reduce((sum, so) => sum + so.materials.length, 0),
    serviceLineCount: r.sub_objects.reduce((sum, so) => sum + so.services.length, 0),
  }));
}

export async function getLibraryObjectDetail(
  id: string
): Promise<BqLibraryObjectDetail | null> {
  const row = await prisma.bqLibraryObject.findFirst({
    where: { id, deleted_at: null },
    include: {
      sub_objects: {
        orderBy: [{ sort_order: "asc" }],
        include: {
          materials: {
            orderBy: [{ sort_order: "asc" }],
            include: {
              // We'll resolve SKU names in a separate step
            },
          },
          services: {
            orderBy: [{ sort_order: "asc" }],
          },
        },
      },
    },
  });

  if (!row) return null;

  // Resolve SKU names for material lines
  const skuIds = row.sub_objects.flatMap((so) =>
    so.materials.map((m) => m.sku_id).filter((id): id is string => id !== null)
  );
  const skus = skuIds.length > 0
    ? await prisma.sku.findMany({
        where: { id: { in: [...new Set(skuIds)] }, deleted_at: null },
        select: { id: true, name: true, code: true, brand: { select: { name: true } } },
      })
    : [];
  const skuMap = new Map(skus.map((s) => [s.id, s]));

  // Resolve WorkPrice names for service lines
  const wpIds = row.sub_objects.flatMap((so) =>
    so.services.map((s) => s.work_price_id).filter((id): id is string => id !== null)
  );
  const workPrices = wpIds.length > 0
    ? await prisma.workPrice.findMany({
        where: { id: { in: [...new Set(wpIds)] }, deleted_at: null },
        select: { id: true, name: true, code: true, vendor: { select: { name: true } } },
      })
    : [];
  const wpMap = new Map(workPrices.map((w) => [w.id, w]));

  return {
    ...baseObjectRow(row),
    subObjectCount: row.sub_objects.length,
    materialLineCount: row.sub_objects.reduce((sum, so) => sum + so.materials.length, 0),
    serviceLineCount: row.sub_objects.reduce((sum, so) => sum + so.services.length, 0),
    subObjects: row.sub_objects.map((so) => ({
      id: so.id,
      name: so.name,
      qty: decToNumberStrict(so.qty),
      notes: so.notes,
      sortOrder: so.sort_order,
      materials: so.materials.map((m) => {
        const sku = m.sku_id ? skuMap.get(m.sku_id) : undefined;
        return {
          id: m.id,
          skuId: m.sku_id,
          source: m.source,
          skuName: sku?.name ?? m.recipe_name ?? null,
          skuCode: sku?.code ?? null,
          brandName: sku?.brand?.name ?? null,
          qtyPerSub: decToNumberStrict(m.qty_per_sub),
          wasteOverridePct: decToNumber(m.waste_override_pct),
          sortOrder: m.sort_order,
        };
      }),
      services: so.services.map((s) => {
        const wp = s.work_price_id ? wpMap.get(s.work_price_id) : undefined;
        return {
          id: s.id,
          workPriceId: s.work_price_id,
          source: s.source,
          workPriceName: wp?.name ?? s.recipe_name ?? null,
          workPriceCode: wp?.code ?? null,
          vendorName: wp?.vendor?.name ?? null,
          qtyPerSub: decToNumberStrict(s.qty_per_sub),
          sortOrder: s.sort_order,
        };
      }),
    })),
  };
}

function baseObjectRow(r: {
  id: string;
  code: string | null;
  name: string;
  unit: string;
  notes: string | null;
  created_by_name: string;
  created_at: Date;
  updated_at: Date | null;
}) {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    unit: r.unit,
    notes: r.notes,
    createdBy: r.created_by_name,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// L2 Library (standalone)
// ---------------------------------------------------------------------------

export async function listLibrarySubObjects(
  query: string,
  options: { limit?: number } = {}
): Promise<BqLibrarySubObjectRow[]> {
  const limit = Math.min(options.limit ?? 50, 100);
  const trimmed = query.trim();

  const rows = await prisma.bqLibrarySubObject.findMany({
    where: {
      deleted_at: null,
      ...(trimmed
        ? { name: { contains: trimmed, mode: "insensitive" } }
        : {}),
    },
    include: {
      materials: { select: { id: true } },
      services: { select: { id: true } },
    },
    orderBy: [{ name: "asc" }],
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    qty: decToNumberStrict(r.qty),
    notes: r.notes,
    createdBy: r.created_by_name,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at?.toISOString() ?? null,
    materialLineCount: r.materials.length,
    serviceLineCount: r.services.length,
  }));
}

export async function getLibrarySubObjectDetail(
  id: string
): Promise<BqLibrarySubObjectDetail | null> {
  const row = await prisma.bqLibrarySubObject.findFirst({
    where: { id, deleted_at: null },
    include: {
      materials: { orderBy: [{ sort_order: "asc" }] },
      services: { orderBy: [{ sort_order: "asc" }] },
    },
  });

  if (!row) return null;

  const skuIds = row.materials.map((m) => m.sku_id).filter((id): id is string => id !== null);
  const skus = skuIds.length > 0
    ? await prisma.sku.findMany({
        where: { id: { in: [...new Set(skuIds)] }, deleted_at: null },
        select: { id: true, name: true, code: true, brand: { select: { name: true } } },
      })
    : [];
  const skuMap = new Map(skus.map((s) => [s.id, s]));

  const wpIds = row.services.map((s) => s.work_price_id).filter((id): id is string => id !== null);
  const workPrices = wpIds.length > 0
    ? await prisma.workPrice.findMany({
        where: { id: { in: [...new Set(wpIds)] }, deleted_at: null },
        select: { id: true, name: true, code: true, vendor: { select: { name: true } } },
      })
    : [];
  const wpMap = new Map(workPrices.map((w) => [w.id, w]));

  return {
    id: row.id,
    name: row.name,
    qty: decToNumberStrict(row.qty),
    notes: row.notes,
    createdBy: row.created_by_name,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at?.toISOString() ?? null,
    materialLineCount: row.materials.length,
    serviceLineCount: row.services.length,
    materials: row.materials.map((m) => {
      const sku = m.sku_id ? skuMap.get(m.sku_id) : undefined;
      return {
        id: m.id,
        skuId: m.sku_id,
        source: m.source,
        skuName: sku?.name ?? m.recipe_name ?? null,
        skuCode: sku?.code ?? null,
        brandName: sku?.brand?.name ?? null,
        qtyPerSub: decToNumberStrict(m.qty_per_sub),
        wasteOverridePct: decToNumber(m.waste_override_pct),
        sortOrder: m.sort_order,
      };
    }),
    services: row.services.map((s) => {
      const wp = s.work_price_id ? wpMap.get(s.work_price_id) : undefined;
      return {
        id: s.id,
        workPriceId: s.work_price_id,
        source: s.source,
        workPriceName: wp?.name ?? s.recipe_name ?? null,
        workPriceCode: wp?.code ?? null,
        vendorName: wp?.vendor?.name ?? null,
        qtyPerSub: decToNumberStrict(s.qty_per_sub),
        sortOrder: s.sort_order,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Soft-delete
// ---------------------------------------------------------------------------

export async function softDeleteLibraryObject(id: string): Promise<boolean> {
  const result = await prisma.bqLibraryObject.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: new Date() },
  });
  return result.count > 0;
}

export async function softDeleteLibrarySubObject(id: string): Promise<boolean> {
  const result = await prisma.bqLibrarySubObject.updateMany({
    where: { id, deleted_at: null },
    data: { deleted_at: new Date() },
  });
  return result.count > 0;
}
