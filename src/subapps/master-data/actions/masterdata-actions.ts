"use server";

/**
 * MASTER DATA — read-only server actions.
 *
 * ============================================================================
 * WHY THIS FILE EXISTS
 * ============================================================================
 * The staff-facing 12-column maintenance view has an `Update` column that must
 * answer "who changed this row in the database, and when". `getProductsAction`
 * returns `ProductCatalogWithRelations`, which includes only `vendor` (with
 * contacts) and `samples` — there is no audit data and no actor name in
 * it. So the column could not be built from the existing action set.
 *
 * Rather than widen `getProductsAction` (used by the Library UI, the schedule
 * bridge and SketchUp — changing its payload risks all three), this adds a
 * separate, bounded, read-only lookup.
 *
 * ============================================================================
 * FIXED 2026-08-18 (audit H1) — was reading the wrong table
 * ============================================================================
 * `getProductsLastChangeAction` used to read `studioflow.AuditLog`, chosen
 * because that table WAS where product-catalog audit rows lived — before the
 * v2 rebaseline (2026-08-10) moved every Master Data write to its own table,
 * `master_data.MasterDataAudit`, via `recordAudit()`. `AuditLog` stopped
 * receiving new Master Data rows that day, so this lookup has returned empty
 * for anything changed since — silently, because the function turned out to
 * have no caller in the UI yet either.
 *
 * `AuditLog`'s old polymorphic-casing problem (`entity_type` written as
 * "Sku"/"ProductCatalog"/"VENDOR" inconsistently by different call sites) does
 * NOT apply to `MasterDataAudit`: every writer goes through `recordAudit()`,
 * which types `entity` as the single `MasterDataEntity` union, so "Sku" is the
 * only spelling that has ever been written. One value, no drift to guard.
 *
 * ============================================================================
 * WHAT THIS DELIBERATELY DOES NOT DO
 * ============================================================================
 * - No fabrication. A product with no audit row returns null, and the UI must
 *   render a dash. Never "System", never the import date dressed up as an
 *   update date, never a synthesised actor.
 * - No mutation of any kind.
 * - No unbounded scan: callers pass the ids of the page they are rendering.
 */

import { prisma } from "@/core/platform/db";
import { createAction } from "@/lib/action-wrapper";
import { ActionError } from "@/lib/error-types";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import type { Role } from "@/generated/prisma";
import { getSkusForBrand, type MaterialRow } from "../services/material-view-service";
import { softDeleteSku } from "../services/sku-delete-service";
import { z } from "zod";

/**
 * DIHAPUS 2026-08-18 (audit H1) — konstanta `AUDIT_ENTITY` dan pembacaan
 * `studioflow.AuditLog`.
 *
 * Baris di atasnya sudah benar SAAT DITULIS: `library-service.ts` memang
 * pernah menulis provenance Master Data ke `AuditLog` dengan `entity_type`
 * yang tidak konsisten. Yang berubah adalah rebaseline v2 (2026-08-10):
 * sejak itu SEMUA tulisan ke tabel `master_data` lewat `recordAudit()` →
 * `master_data.MasterDataAudit`, tabel yang berbeda sama sekali. `AuditLog`
 * (schema `studioflow`) berhenti menerima baris Master Data yang baru, jadi
 * lookup di bawah ini selalu kembali kosong untuk apa pun yang berubah
 * setelah 10 Agustus — dan fungsi ini ternyata TIDAK DIPANGGIL dari mana pun
 * di UI, jadi kekosongannya belum pernah terlihat siapa pun.
 *
 * Diperbaiki bersama fungsinya di bawah, bukan dihapus sepenuhnya: komentar
 * kepala berkas ini menjanjikan kolom "Update" pada suatu tampilan staf, dan
 * kalau tampilan itu dibangun kembali, ia seharusnya membaca tabel yang benar
 * dari awal.
 */

/** Hard cap so a caller cannot turn this into a table scan. */
const MAX_IDS_PER_CALL = 200;

export type LastChange = {
  /** Real User.name of the actor. Null when no audit row exists. */
  actorName: string | null;
  /** ISO timestamp of the audit row. Null when no audit row exists. */
  at: string | null;
  /** The audit action, e.g. CATALOG_UPDATE. Lets the UI distinguish
   *  "created" from "edited" instead of labelling everything "updated". */
  action: string | null;
};

function assertMasterDataPermission(role: Role, permission: PERMISSION) {
  if (!hasPermission(role, permission)) {
    throw new ActionError(`Unauthorized: missing ${permission}`, "UNAUTHORIZED_ACTION");
  }
}

/**
 * Latest audit entry per product id.
 *
 * Returns a plain object keyed by product id. Ids with no audit row are simply
 * absent from the result — the caller must treat "absent" as unknown, not as
 * "never changed".
 *
 * One query, not N. Ordered newest-first and reduced in JS, because Prisma's
 * groupBy cannot return a non-aggregated sibling column (the actor name) in the
 * same pass, and a correlated subquery here would need raw SQL for no benefit.
 */
export const getProductsLastChangeAction = createAction<
  { productIds: string[] },
  Record<string, LastChange>
>(
  async ({ input, ctx }) => {
    assertMasterDataPermission(ctx.role, PERMISSION.MASTERDATA_VIEW);

    const ids = [...new Set(input.productIds ?? [])].filter(Boolean);
    if (ids.length === 0) return {};
    if (ids.length > MAX_IDS_PER_CALL) {
      throw new ActionError(
        `Too many ids (${ids.length}); max ${MAX_IDS_PER_CALL}. Paginate the caller.`,
        "VALIDATION_FAILED"
      );
    }

    // `master_data.MasterDataAudit`, bukan `studioflow.AuditLog` — lihat catatan
    // di kepala berkas ini. `actor_name` sudah string biasa di tabel ini
    // (kontrak Master Data §6: master_data tidak boleh menyeberang ke
    // studioflow, jadi tidak ada relasi `user` untuk di-join).
    const rows = await prisma.masterDataAudit.findMany({
      where: {
        entity: "Sku",
        entity_id: { in: ids },
      },
      orderBy: { created_at: "desc" },
      select: {
        entity_id: true,
        action: true,
        created_at: true,
        actor_name: true,
      },
    });

    const result: Record<string, LastChange> = {};
    for (const row of rows) {
      // First hit wins because rows are already sorted newest-first.
      if (result[row.entity_id]) continue;
      result[row.entity_id] = {
        actorName: row.actor_name || null,
        at: row.created_at.toISOString(),
        action: row.action,
      };
    }

    return result;
  },
  // Read-only: no transaction needed, and preflight already ran for the page.
  { useTransaction: false }
);

/**
 * All active SKUs for a single brand, returned as scalar MaterialRow objects.
 * Powers the expandable brand table (Phase 2.2) — fetched lazily when a
 * brand row is clicked, not shipped with every page load.
 */
export const getSkusForBrandAction = createAction<
  { brandId: string },
  { rows: MaterialRow[]; truncated: boolean }
>(
  async ({ input, ctx }) => {
    assertMasterDataPermission(ctx.role, PERMISSION.MASTERDATA_VIEW);
    if (!input.brandId) {
      throw new ActionError("brandId is required", "VALIDATION_FAILED");
    }
    return getSkusForBrand(input.brandId);
  },
  { useTransaction: false }
);

export const deleteSkuAction = createAction<
  { id: string },
  { id: string; deletedAt: string }
>(
  async ({ input, ctx, tx }) => {
    assertMasterDataPermission(ctx.role, PERMISSION.MASTERDATA_SKU_MANAGE);
    return softDeleteSku(tx, input.id, {
      id: ctx.userId,
      name: ctx.user.name ?? ctx.role,
    });
  },
  { schema: z.object({ id: z.string().min(1, "SKU id is required") }) }
);

// ===========================================================================
// Brand Detail actions (Phase 3)
// ===========================================================================

import { recordAudit } from "../services/audit-service";

export type BrandDetail = {
  id: string;
  name: string;
  slug: string;
  notes: string | null;
  owner: { id: string; name: string } | null;
  categories: { name: string }[];
  skuCount: number;
  supplierCount: number;
  priceCount: number;
};

export type BrandSkuRow = {
  id: string;
  sku: string;
  product_name: string;
  dimension_w: number | null;
  dimension_h: number | null;
  unit: string;
  /**
   * Harga yang berlaku dan siapa yang menawarkannya (2026-08-14).
   *
   * Ditambahkan ketika tab SKUs di halaman detail brand menjadi SATU-SATUNYA
   * jalur ke SKU sebuah brand — sebelumnya ada dua, dan yang satunya
   * menampilkan harga. Menyatukan keduanya tanpa membawa kolom ini berarti
   * mengganti jalur yang informatif dengan yang tidak.
   *
   * NULL = belum ada harga berlaku, bukan gratis.
   */
  price: number | null;
  price_unit: string | null;
  /** Termurah di antara `suppliers` — dipertahankan untuk kompatibilitas. */
  supplier_name: string | null;
  /**
   * SEMUA supplier dengan harga berlaku untuk SKU ini, termurah dulu
   * (2026-08-18, owner feedback item 1).
   *
   * Sebelumnya kolom Supplier hanya membawa `supplier_name` — satu nama, dari
   * `prices` yang di-`take: 1` di query. Itu SENGAJA memilih penawaran
   * termurah untuk kolom Harga, tapi diam-diam menyembunyikan setiap supplier
   * lain yang juga menawarkan SKU yang sama: brand dengan dua harga berlaku
   * (lihat `priceCount` di atas) hanya pernah menampilkan satu nama supplier,
   * dan tidak ada cara di tabel ini untuk tahu ada penawaran lain.
   */
  suppliers: { name: string; price: number }[];
};

export type BrandSupplierRow = {
  partyId: string;
  partyName: string;
  roles: string[];
  priceCount: number;
};

export const getBrandDetailAction = createAction<
  { brandId: string },
  BrandDetail | null
>(
  async ({ input, ctx }) => {
    assertMasterDataPermission(ctx.role, PERMISSION.MASTERDATA_VIEW);
    const brand = await prisma.brand.findUnique({
      where: { id: input.brandId, deleted_at: null },
      include: {
        owner: { select: { id: true, name: true } },
        categories: { include: { category: { select: { name: true } } } },
        _count: {
          select: {
            skus: { where: { deleted_at: null } },
            suppliers: { where: { party: { deleted_at: null } } },
          },
        },
      },
    });
    if (!brand) return null;

    const priceCount = await prisma.skuPrice.count({
      where: {
        is_current: true,
        sku: { brand_id: input.brandId, deleted_at: null },
      },
    });

    return {
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      notes: brand.notes ?? null,
      owner: brand.owner ? { id: brand.owner.id, name: brand.owner.name } : null,
      categories: brand.categories.map((bc) => ({ name: bc.category.name })),
      skuCount: brand._count.skus,
      supplierCount: brand._count.suppliers,
      priceCount,
    };
  },
  { useTransaction: false }
);

export const getBrandSkusAction = createAction<
  { brandId: string; search?: string; page?: number },
  { rows: BrandSkuRow[]; total: number }
>(
  async ({ input, ctx }) => {
    assertMasterDataPermission(ctx.role, PERMISSION.MASTERDATA_VIEW);
    const page = Math.max(1, input.page ?? 1);
    const pageSize = 20;
    const where = {
      brand_id: input.brandId,
      deleted_at: null,
      ...(input.search
        ? {
            OR: [
              { code: { contains: input.search, mode: "insensitive" as const } },
              { name: { contains: input.search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const [skus, total] = await Promise.all([
      prisma.sku.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          dim_width: true,
          dim_height: true,
          base_unit: true,
          // SEMUA penawaran yang masih berlaku, termurah dulu — sebelum
          // 2026-08-18 ini di-`take: 1`, yang berarti supplier kedua (dst)
          // dengan harga berlaku untuk SKU yang sama tidak pernah terlihat di
          // tabel ini. Harga di kolom Harga tetap yang termurah (index 0);
          // yang berubah adalah kolom Supplier sekarang bisa menyebut semua.
          prices: {
            where: { is_current: true },
            orderBy: [{ price_net: "asc" as const }, { valid_from: "desc" as const }],
            select: {
              price_net: true,
              unit: true,
              supplier: { select: { name: true } },
            },
          },
        },
        orderBy: { code: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.sku.count({ where }),
    ]);

    return {
      rows: skus.map((s) => {
        const current = s.prices[0];
        const suppliers = s.prices.map((p) => ({
          name: p.supplier?.name ?? "Manufacturer price",
          price: Number(p.price_net),
        }));
        return {
          id: s.id,
          sku: s.code ?? "",
          product_name: s.name,
          dimension_w: s.dim_width ? Number(s.dim_width) : null,
          dimension_h: s.dim_height ? Number(s.dim_height) : null,
          unit: s.base_unit,
          price: current ? Number(current.price_net) : null,
          price_unit: current?.unit ?? null,
          supplier_name: current?.supplier?.name ?? null,
          suppliers,
        };
      }),
      total,
    };
  },
  { useTransaction: false }
);

export const getBrandSuppliersAction = createAction<
  { brandId: string },
  BrandSupplierRow[]
>(
  async ({ input, ctx }) => {
    assertMasterDataPermission(ctx.role, PERMISSION.MASTERDATA_VIEW);
    const suppliers = await prisma.brandSupplier.findMany({
      where: { brand_id: input.brandId, party: { deleted_at: null } },
      include: {
        party: {
          select: {
            id: true,
            name: true,
            roles: { select: { role: true } },
          },
        },
      },
    });

    const partyIds = suppliers.map((s) => s.party_id);
    const priceCounts = partyIds.length > 0
      ? await prisma.skuPrice.groupBy({
          by: ["supplier_party_id"],
          where: {
            supplier_party_id: { in: partyIds },
            is_current: true,
            sku: { brand_id: input.brandId, deleted_at: null },
          },
          _count: { id: true },
        })
      : [];
    const priceCountMap = Object.fromEntries(
      priceCounts.map((pc) => [pc.supplier_party_id, pc._count.id])
    );

    return suppliers.map((s) => ({
      partyId: s.party.id,
      partyName: s.party.name,
      roles: s.party.roles.map((r) => r.role),
      priceCount: priceCountMap[s.party.id] ?? 0,
    }));
  },
  { useTransaction: false }
);

export const assignSupplierToBrandAction = createAction<
  { brandId: string; partyId: string },
  { success: true }
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    await tx.brandSupplier.upsert({
      where: { brand_id_party_id: { brand_id: input.brandId, party_id: input.partyId } },
      create: { brand_id: input.brandId, party_id: input.partyId },
      update: {},
    });
    await recordAudit(tx, {
      entity: "BrandSupplier",
      entity_id: `${input.brandId}:${input.partyId}`,
      action: "CREATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "unknown" },
    });
    return { success: true };
  }
);

export const unassignSupplierFromBrandAction = createAction<
  { brandId: string; partyId: string },
  { success: true }
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    await tx.brandSupplier.delete({
      where: { brand_id_party_id: { brand_id: input.brandId, party_id: input.partyId } },
    });
    await recordAudit(tx, {
      entity: "BrandSupplier",
      entity_id: `${input.brandId}:${input.partyId}`,
      action: "DELETE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "unknown" },
    });
    return { success: true };
  }
);

export type PartyBrandRow = {
  brandId: string;
  brandName: string;
  skuCount: number;
  priceCount: number;
};

export const getPartyBrandsAction = createAction<
  { partyId: string },
  PartyBrandRow[]
>(
  async ({ input, ctx }) => {
    assertMasterDataPermission(ctx.role, PERMISSION.MASTERDATA_VIEW);
    const rows = await prisma.brandSupplier.findMany({
      where: { party_id: input.partyId, brand: { deleted_at: null } },
      include: {
        brand: {
          select: {
            id: true,
            name: true,
            _count: { select: { skus: { where: { deleted_at: null } } } },
          },
        },
      },
    });

    const brandIds = rows.map((r) => r.brand_id);
    const priceCounts = brandIds.length > 0
      ? await prisma.skuPrice.groupBy({
          by: ["sku_id"],
          where: {
            supplier_party_id: input.partyId,
            is_current: true,
            sku: { brand_id: { in: brandIds }, deleted_at: null },
          },
          _count: { id: true },
        })
      : [];

    // M4: only load the SKUs that appear in priceCounts, not every SKU for
    // all brands — avoids a full table scan when a supplier covers many brands.
    const skuBrandMap: Record<string, string> = {};
    const priceSkuIds = priceCounts.map((pc) => pc.sku_id);
    if (priceSkuIds.length > 0) {
      const skus = await prisma.sku.findMany({
        where: { id: { in: priceSkuIds }, deleted_at: null },
        select: { id: true, brand_id: true },
      });
      for (const s of skus) {
        if (s.brand_id) skuBrandMap[s.id] = s.brand_id;
      }
    }

    const brandPriceCount: Record<string, number> = {};
    for (const pc of priceCounts) {
      const brandId = skuBrandMap[pc.sku_id];
      if (brandId) {
        brandPriceCount[brandId] = (brandPriceCount[brandId] ?? 0) + pc._count.id;
      }
    }

    return rows.map((r) => ({
      brandId: r.brand.id,
      brandName: r.brand.name,
      skuCount: r.brand._count.skus,
      priceCount: brandPriceCount[r.brand.id] ?? 0,
    }));
  },
  { useTransaction: false }
);
