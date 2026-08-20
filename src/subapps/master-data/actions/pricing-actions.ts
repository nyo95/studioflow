"use server";

/**
 * MASTER DATA — Pricing CRUD actions.
 *
 * Master Data v2 (2026-08-10) merged four v1 models into two:
 *   - ServicePrice + MaterialLaborPrice -> WorkPrice (distinguished by
 *     `kind` — MATERIAL_LABOR or LABOR_ONLY — not by table).
 *   - MaterialPrice -> SkuPrice (per-SKU price HISTORY; sku_id is now
 *     REQUIRED, so a price can no longer exist ahead of a registered SKU).
 *   - ServiceVendor -> Party (no dedicated vendor table anymore).
 *
 * All mutations require MASTERDATA_VENDOR_MANAGE. Price reads require
 * MASTERDATA_PRICE_VIEW; supporting supplier/vendor reads use the narrower
 * permission documented on each action.
 */

import { z } from "zod";
import { Prisma } from "@/generated/prisma";
import { prisma } from "@/core/platform/db";
import type { PrismaTransaction } from "@/types/common";
import { createAction } from "@/lib/action-wrapper";
import { PERMISSION } from "@/core/rbac/constants";
import { hasPermission } from "@/core/rbac/guards";
import { ActionError } from "@/lib/error-types";
import type {
  MaterialLaborPriceData,
  MaterialLaborPriceInput,
  MaterialPriceData,
  MaterialPriceInput,
  MaterialPricePageData,
  MaterialPriceQuery,
  SkuPricingViewerData,
  SkuPricingViewerPrice,
  ServicePriceData,
  ServicePriceInput,
  ServiceVendorData,
  ServiceVendorInput,
} from "../types/pricing";
import {
  closeCurrentSkuPrice,
  isOfferChange,
  recordSkuPrice,
  SKU_PRICE_INCLUDE,
} from "../services/sku-price-service";
import {
  checkWorkPrice,
  WORK_PRICE_ISSUE_MESSAGE,
} from "../services/sku-price-rules";
import {
  assertPriceSourceParty,
  PRICE_SOURCE_ROLES,
  WORK_VENDOR_ROLES,
} from "../services/party-role-service";
import { resolveCategoryPath } from "../services/category-tree-service";
import { recordAudit, diffFields } from "../services/audit-service";
import { assertPartyDeletable } from "../services/party-delete-service";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ServiceVendorInputSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  legal_name: z.string().default(""),
  trade: z.string().default(""),
  phone_number: z.string().default(""),
  email: z.string().default(""),
  address: z.string().default(""),
  notes: z.string().default(""),
});

/**
 * Excel Table 3 and Table 4 have identical columns, so both forms share this
 * shape. What differs is `kind`, which the action sets — not the form.
 *
 * `code` is SERVER-GENERATED (B-Q2: "BQ code - remove" from Sheet2). It is
 * omitted from the input schema; the create action generates it.
 */
const WorkPriceFields = {
  name: z.string().min(1, "Name is required"),
  /** Excel "Vendor Category" — the parent. Empty = category sits at the root. */
  vendor_category: z.string().default(""),
  /** Excel "Category" — the leaf. */
  category: z.string().min(1, "Category is required"),
  unit: z.string().min(1, "Unit is required"),
  /**
   * Harga WAJIB, divalidasi di pintu masuk — bukan `Number(v)` polos.
   *
   * Sampai 2026-08-18 baris ini berbunyi
   * `z.union([z.number(), z.string()]).transform((v) => Number(v))`, tanpa
   * `.refine()`. `Number("")` adalah `0`, jadi mengosongkan field harga
   * menyimpan tarif NOL, dan `Number("abc")` adalah `NaN`, yang diteruskan ke
   * Prisma sebagai error mentah. Aturannya sekarang satu, murni, dan bisa
   * dites — lihat `checkWorkPrice` di services/sku-price-rules.ts.
   */
  price: z
    .union([z.number(), z.string()])
    .transform((v, ctx) => {
      const checked = checkWorkPrice(v);
      if (!checked.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: WORK_PRICE_ISSUE_MESSAGE[checked.issue],
        });
        return z.NEVER;
      }
      return checked.value;
    }),
  /** Excel "Specification 1" / "Specification 2". */
  specification_1: z.string().default(""),
  specification_2: z.string().default(""),
  /** Excel "Dimensions" — one free-text string, as the workbook has it. */
  dimensions: z.string().default(""),
  scope_note: z.string().default(""),
  notes: z.string().default(""),
  service_vendor_id: z.string().nullable().default(null),
};

const ServicePriceInputSchema = z.object(WorkPriceFields);

const MaterialPriceInputSchema = z.object({
  // Brand is optional here for the same reason it is optional on `Sku` (Q7):
  // a price for generic stock has no brand to name.
  brand_id: z.string().default(""),
  sku_id: z.string().nullable().default(null),
  supplier_party_id: z.string().nullable().default(null),
  item_description: z.string().default(""),
  unit: z.string().default(""),
  // Satu harga sejak 2026-08-14 — pasangan before/after discount dihapus.
  price: z.union([z.number(), z.string(), z.null()]).transform(
    (v) => (v === null || v === "" ? null : Number(v))
  ).nullable(),
  valid_from: z.string().nullable().default(null),
  notes: z.string().default(""),
  usage_unit: z.string().default(""),
  conversion: z.union([z.number(), z.string(), z.null()]).transform(
    (v) => (v === null || v === "" ? null : Number(v))
  ).nullable().default(null),
  /** Dimensi tampilan dari kalkulator (e.g. "1200 × 2400 mm"). */
  dim_display: z.string().nullable().default(null),
  /** Nama kategori produk (PRODUCT kind) yang dipilih untuk SKU ini. */
  category_names: z.array(z.string()).default([]),
});

const MaterialLaborPriceInputSchema = z.object(WorkPriceFields);

const IdSchema = z.object({ id: z.string().min(1) });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const db = prisma;

/**
 * Form fields arrive as `number | string | null` — a `<input type="number">`
 * still hands back a string. Blank means absent, not zero: `Number("")` is 0,
 * and that single coercion is how a blank price field becomes a real price of
 * nothing further downstream.
 */
function toNumberOrNull(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Pertahanan lapis kedua di jalur tulis.
 *
 * Zod sudah menolak harga kosong / bukan angka / negatif di pintu masuk, jadi
 * ini seharusnya tidak pernah menyala. Ia tetap ada karena `WorkPriceFields`
 * dipakai oleh empat aksi dan tidak ada yang menjamin aksi kelima nanti akan
 * memasang skema yang sama — dan yang dijaga di sini adalah kolom yang dibaca
 * `v_bq_work_rate`. Satu jalur tulis yang lupa memvalidasi cukup untuk membuat
 * satu baris dokumen komersial berbunyi Rp 0.
 */
function assertWorkPrice(value: number | string | null | undefined): number {
  const checked = checkWorkPrice(value);
  if (!checked.ok) {
    throw new ActionError(WORK_PRICE_ISSUE_MESSAGE[checked.issue], "VALIDATION_FAILED");
  }
  return checked.value;
}

import { slugify } from "../lib/slug";
import { ensureUniqueSlug } from "../services/slug-service";

/**
 * Generate a unique WorkPrice.code. Format: `WP-YYYY-NNNN` where NNNN is a
 * zero-padded sequential number within the year. Retries on collision inside
 * the same transaction.
 *
 * Old codes (manually entered) are never touched — this only runs for new
 * records. The `@unique` constraint on `code` is the final guard.
 */
async function generateWorkPriceCode(tx: PrismaTransaction): Promise<string> {
  // M9 (2026-08-18): the retry loop below reads the highest existing code,
  // computes the next one, then checks it's free — three separate
  // round-trips. Two `createServicePriceAction`/`createMaterialLaborPriceAction`
  // calls landing in the same window can both read the same "highest so
  // far", both compute the same next `seq`, and race to insert it. `code`
  // is `@unique` so this never corrupted data — one insert won, the other's
  // transaction failed on a raw Postgres error (the exact case M6 now maps
  // to a real message) — but the customer-facing effect was still a create
  // that should have succeeded failing under ordinary concurrent use.
  //
  // `pg_advisory_xact_lock` serializes callers instead of racing them: the
  // second transaction blocks here until the first commits or rolls back,
  // by which point the code it just wrote is visible to the `findFirst`
  // below. It is scoped to THIS transaction (`_xact_`, not the session
  // variant) — Postgres releases it automatically on commit or rollback, so
  // there is no unlock call to forget and no way for a crash to leak it.
  // One fixed key is enough; code generation is not a hot path and every
  // year's codes share the same `WorkPrice` table, so locking per-year would
  // only add complexity for a race that does not exist across years.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('work_price_code'))`;

  const year = new Date().getFullYear();
  const prefix = `WP-${year}-`;
  // Find the highest existing code with this year's prefix
  const latest = await tx.workPrice.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  let seq = 1;
  if (latest) {
    const num = parseInt(latest.code.slice(prefix.length), 10);
    if (Number.isFinite(num)) seq = num + 1;
  }
  // Try up to 10 times to handle collisions (extremely unlikely)
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = `${prefix}${String(seq).padStart(4, "0")}`;
    const exists = await tx.workPrice.findUnique({ where: { code } });
    if (!exists) return code;
    seq++;
  }
  // Final fallback — should never reach here
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

const WORK_PRICE_INCLUDE = {
  vendor: { select: { id: true, name: true } },
  category: { select: { name: true, parent: { select: { name: true } } } },
} as const;

async function refetchWorkPrice(tx: PrismaTransaction, id: string) {
  return tx.workPrice.findUniqueOrThrow({ where: { id }, include: WORK_PRICE_INCLUDE });
}

/**
 * Excel "Specification 1" / "Specification 2" -> the `spec` JSON column.
 *
 * Excel itself says *"bisa disimpan dalam json apabila ada lebih dari 2
 * keterangan"* (X22), so JSON is what the workbook asked for. Empty fields are
 * omitted rather than stored as `""` — a key that exists with an empty value
 * reads as "we know it is blank", which is a different claim from "not
 * recorded".
 */
function buildWorkSpec(input: { specification_1?: string; specification_2?: string }) {
  const spec: Record<string, string> = {};
  const s1 = input.specification_1?.trim();
  const s2 = input.specification_2?.trim();
  if (s1) spec.specification_1 = s1;
  if (s2) spec.specification_2 = s2;
  return Object.keys(spec).length > 0 ? spec : Prisma.JsonNull;
}

function readWorkSpec(spec: unknown): { specification_1: string; specification_2: string } {
  const obj = (spec ?? {}) as Record<string, unknown>;
  return {
    specification_1: typeof obj.specification_1 === "string" ? obj.specification_1 : "",
    specification_2: typeof obj.specification_2 === "string" ? obj.specification_2 : "",
  };
}

function mapServiceVendor(p: {
  id: string;
  name: string;
  legal_name: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date | null;
  deleted_at: Date | null;
  _count?: { work_prices: number };
}): ServiceVendorData {
  return {
    id: p.id,
    name: p.name,
    legal_name: p.legal_name,
    // Master Data v2's Party has no `trade`/`phone_number`/`email` columns —
    // trade never existed on Party, and contact channels live on
    // PartyContact. Accepted on input for form compatibility, not persisted.
    trade: null,
    phone_number: null,
    email: null,
    address: p.address,
    notes: p.notes,
    is_active: p.is_active,
    created_at: p.created_at,
    updated_at: p.updated_at,
    deleted_at: p.deleted_at,
    _count: p._count ? { service_prices: p._count.work_prices } : undefined,
  };
}

/**
 * A row as loaded with `WORK_PRICE_INCLUDE`. Both Excel tables map from the
 * same shape now — `kind` is what tells them apart, so the mappers differ only
 * in which DTO they fill.
 */
type WorkPriceRow = {
  id: string; code: string; name: string; unit: string;
  price: unknown; spec: unknown; dim_display: string | null;
  scope_note: string | null; notes: string | null;
  vendor_party_id: string | null; updated_by_name: string | null;
  is_active: boolean; created_at: Date; updated_at: Date | null;
  category: { name: string; parent: { name: string } | null };
  vendor: { id: string; name: string } | null;
};

function mapWorkPriceCommon(p: WorkPriceRow) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    // Excel's two category columns, handed back separately so the form can
    // show two levels rather than one flattened string.
    category: p.category.name,
    vendor_category: p.category.parent?.name ?? "",
    unit: p.unit,
    // `WorkPrice.price` is non-nullable (schema.prisma) — the `?? 0` branch
    // never ran. Kept as `null` type would fight the column type; per §13
    // this is simply dead code, not a null-safety gap.
    price: Number(p.price),
    ...readWorkSpec(p.spec),
    dimensions: p.dim_display ?? "",
    scope_note: p.scope_note,
    notes: p.notes,
    service_vendor_id: p.vendor_party_id,
    service_vendor: p.vendor ? { id: p.vendor.id, name: p.vendor.name } : null,
    updated_by_name: p.updated_by_name,
    is_active: p.is_active,
    created_at: p.created_at,
    updated_at: p.updated_at,
  };
}

function mapWorkPriceAsService(p: WorkPriceRow): ServicePriceData {
  return mapWorkPriceCommon(p);
}

function mapWorkPriceAsMaterialLabor(p: WorkPriceRow): MaterialLaborPriceData {
  return mapWorkPriceCommon(p);
}

function mapMaterialPrice(p: {
  id: string; sku_id: string; unit: string; price_net: unknown;
  supplier_party_id: string | null; valid_from: Date; valid_to: Date | null; is_current: boolean;
  notes: string | null; updated_by_name: string | null;
  created_at: Date; updated_at: Date | null;
  sku: {
    id: string; code: string | null; name: string; brand_id: string | null;
    brand: { id: string; name: string } | null;
    base_unit: string;
    usage_unit: string | null; purchase_unit: string | null; conversion: unknown;
    dim_display: string | null;
    categories: { category: { name: string } }[];
  } | null;
  supplier: { id: string; name: string } | null;
}): MaterialPriceData {
  return {
    id: p.id,
    brand_id: p.sku?.brand_id ?? "",
    brand: p.sku?.brand ? { id: p.sku.brand.id, brand_name: p.sku.brand.name } : null,
    sku_id: p.sku_id,
    sku: p.sku ? { id: p.sku.id, catalog_sku: p.sku.code ?? "", catalog_product_name: p.sku.name } : null,
    item_description: p.sku?.name ?? "",
    unit: p.unit,
    price: p.price_net != null ? Number(p.price_net) : null,
    supplier_party_id: p.supplier_party_id,
    supplier: p.supplier ? { id: p.supplier.id, name: p.supplier.name } : null,
    source_link_id: null,
    valid_from: p.valid_from,
    valid_to: p.valid_to,
    is_current: p.is_current,
    notes: p.notes,
    updated_by_name: p.updated_by_name,
    created_at: p.created_at,
    updated_at: p.updated_at,
    // SkuPrice has no soft-delete column — it is a history row, not a
    // record that gets "undeleted". Always null; kept for type compat.
    deleted_at: null,
    sku_usage_unit: p.sku?.usage_unit ?? null,
    sku_conversion: p.sku?.conversion != null ? Number(p.sku.conversion) : null,
    sku_dim_display: p.sku?.dim_display ?? null,
    sku_categories: p.sku?.categories.map((c) => c.category.name) ?? [],
  };
}


// ---------------------------------------------------------------------------
// "ServiceVendor" actions — backed by Party
// ---------------------------------------------------------------------------

export const getServiceVendorsAction = createAction<undefined, ServiceVendorData[]>(
  async ({ ctx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const rows = await db.party.findMany({
      // Sampai 2026-08-18 tidak ada filter role di sini sama sekali — picker
      // Vendor menawarkan setiap Party, termasuk pemilik merek dan retail.
      // `WORK_VENDOR_ROLES` sama persis dengan yang dipakai
      // `quickCreateWorkVendorAction`, jadi vendor yang baru dibuat lewat
      // quick-entry tetap muncul di sini.
      where: {
        deleted_at: null,
        is_active: true,
        roles: { some: { role: { in: WORK_VENDOR_ROLES } } },
      },
      include: { _count: { select: { work_prices: true } } },
      orderBy: { name: "asc" },
    });
    return rows.map(mapServiceVendor);
  },
  { useTransaction: false }
);

export const createServiceVendorAction = createAction<ServiceVendorInput, ServiceVendorData>(
  // `tx`, bukan `db`. `createAction` sudah membuka transaksi (useTransaction
  // default true); menulis lewat klien global di dalamnya berarti baris party
  // dan baris auditnya commit terpisah dari transaksi yang membungkusnya —
  // persis yang dilarang komentar di kepala `recordAudit`: "audit yang selamat
  // dari rollback adalah kebohongan". Diperbaiki 2026-08-18 bersama B2.
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    // Aturan yang sama dengan `party-actions.findLivePartyByName` dan dengan
    // index `Party_name_live_uniq`: abaikan huruf besar-kecil, abaikan baris
    // yang sudah dihapus. Sebelum 2026-08-18 baris ini `findUnique({ name })`
    // yang ikut menghitung baris terhapus, sementara `update` di bawah tidak —
    // dua jawaban berbeda untuk satu pertanyaan.
    const existing = await tx.party.findFirst({
      where: { name: { equals: input.name.trim(), mode: "insensitive" }, deleted_at: null },
      select: { id: true, name: true },
    });
    if (existing) {
      throw new ActionError(`Name "${existing.name}" is already used by another party.`, "CONFLICT");
    }

    // B3 (2026-08-18): name collision is checked above; slug collision is a
    // separate question ("CV Abc" vs "CV. Abc" — different names, same slug).
    const slug = await ensureUniqueSlug(slugify(input.name.trim()), async (candidate) =>
      Boolean(
        await tx.party.findFirst({
          where: { slug: candidate, deleted_at: null },
          select: { id: true },
        })
      )
    );

    const vendor = await tx.party.create({
      data: {
        name: input.name.trim(),
        slug,
        legal_name: input.legal_name?.trim() || null,
        address: input.address?.trim() || null,
        notes: input.notes?.trim() || null,
        roles: { create: [{ role: "SERVICE_VENDOR" }] },
      },
      include: { _count: { select: { work_prices: true } } },
    });
    await recordAudit(tx, {
      entity: "Party",
      entity_id: vendor.id,
      action: "CREATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "" },
    });
    return mapServiceVendor(vendor);
  },
  { schema: ServiceVendorInputSchema }
);

export const updateServiceVendorAction = createAction<
  { id: string; data: ServiceVendorInput },
  ServiceVendorData
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const existing = await tx.party.findUnique({ where: { id: input.id } });
    if (!existing || existing.deleted_at) throw new ActionError("Vendor not found", "NOT_FOUND");

    const conflict = await tx.party.findFirst({
      where: {
        name: { equals: input.data.name.trim(), mode: "insensitive" },
        id: { not: input.id },
        deleted_at: null,
      },
      select: { id: true, name: true },
    });
    if (conflict) {
      throw new ActionError(`Name "${conflict.name}" is already used by another party.`, "CONFLICT");
    }

    // B3 (2026-08-18): own id excluded, or saving without changing the name
    // would collide with the row's own current slug.
    const slug = await ensureUniqueSlug(slugify(input.data.name.trim()), async (candidate) =>
      Boolean(
        await tx.party.findFirst({
          where: { slug: candidate, deleted_at: null, id: { not: input.id } },
          select: { id: true },
        })
      )
    );

    const vendor = await tx.party.update({
      where: { id: input.id },
      data: {
        name: input.data.name.trim(),
        slug,
        legal_name: input.data.legal_name?.trim() || null,
        address: input.data.address?.trim() || null,
        notes: input.data.notes?.trim() || null,
        updated_at: new Date(),
      },
      include: { _count: { select: { work_prices: true } } },
    });
    const changes = diffFields(
      { name: existing.name, legal_name: existing.legal_name, address: existing.address, notes: existing.notes },
      { name: vendor.name, legal_name: vendor.legal_name, address: vendor.address, notes: vendor.notes },
      ["name", "legal_name", "address", "notes"],
    );
    if (Object.keys(changes).length > 0) {
      await recordAudit(tx, {
        entity: "Party",
        entity_id: vendor.id,
        action: "UPDATE",
        actor: { id: ctx.userId, name: ctx.user.name ?? "" },
        changes,
      });
    }
    return mapServiceVendor(vendor);
  },
  { schema: z.object({ id: z.string(), data: ServiceVendorInputSchema }) }
);

export const deleteServiceVendorAction = createAction<{ id: string }, { id: string }>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    // H3 (2026-08-18): was a WorkPrice-only check — see `assertPartyDeletable`'s
    // doc comment. Same guard `deleteCompanyAction` (Suppliers page) now
    // calls, so this and that agree on what "still referenced" means.
    await assertPartyDeletable(tx, input.id);
    await tx.party.update({ where: { id: input.id }, data: { deleted_at: new Date() } });
    await recordAudit(tx, {
      entity: "Party",
      entity_id: input.id,
      action: "DELETE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "" },
    });
    return { id: input.id };
  },
  { schema: IdSchema }
);

// ---------------------------------------------------------------------------
// Labour prices (Excel Table 4) — WorkPrice with kind = LABOR_ONLY
// ---------------------------------------------------------------------------

export const getServicePricesAction = createAction<undefined, ServicePriceData[]>(
  async ({ ctx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const rows = await db.workPrice.findMany({
      // Was `material_price: null`. The table a row belongs to is now stated by
      // `kind` rather than inferred from which money column happens to be
      // filled — see migration 20260811120000 and E8.
      where: { deleted_at: null, kind: "LABOR_ONLY" },
      include: WORK_PRICE_INCLUDE,
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });
    return rows.map(mapWorkPriceAsService);
  },
  { useTransaction: false }
);

export const createServicePriceAction = createAction<ServicePriceInput, ServicePriceData>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const code = await generateWorkPriceCode(tx);
    const category = await resolveCategoryPath(tx, "WORK", input.vendor_category, input.category, { id: ctx.userId, name: ctx.user.name ?? "" });
    const row = await tx.workPrice.create({
      data: {
        code,
        name: input.name.trim(),
        category_id: category.id,
        unit: input.unit.trim(),
        price: assertWorkPrice(input.price),
        kind: "LABOR_ONLY",
        spec: buildWorkSpec(input),
        dim_display: input.dimensions?.trim() || null,
        scope_note: input.scope_note?.trim() || null,
        notes: input.notes?.trim() || null,
        vendor_party_id: input.service_vendor_id || null,
        updated_by_name: ctx.user.name ?? null,
      },
      include: WORK_PRICE_INCLUDE,
    });
    await recordAudit(tx, {
      entity: "WorkPrice",
      entity_id: row.id,
      action: "CREATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "" },
    });
    return mapWorkPriceAsService(await refetchWorkPrice(tx, row.id));
  },
  { schema: ServicePriceInputSchema }
);

export const updateServicePriceAction = createAction<
  { id: string; data: ServicePriceInput },
  ServicePriceData
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    // H8 (2026-08-18): was `findUnique({ where: { id } })` — no `kind` or
    // `deleted_at` filter, so this could look up a `MATERIAL_LABOR` row (the
    // OTHER work-price screen's rows) or, once H7 soft-deletes instead of
    // hard-deletes, one that's already been deleted. Both now 404 instead of
    // silently editing a row this screen has no business touching.
    const existing = await tx.workPrice.findFirst({ where: { id: input.id, kind: "LABOR_ONLY", deleted_at: null } });
    if (!existing) throw new ActionError("Price not found", "NOT_FOUND");

    const category = await resolveCategoryPath(tx, "WORK", input.data.vendor_category, input.data.category, { id: ctx.userId, name: ctx.user.name ?? "" });
    await tx.workPrice.update({
      where: { id: input.id },
      data: {
        code: existing.code,
        name: input.data.name.trim(),
        category_id: category.id,
        unit: input.data.unit.trim(),
        price: assertWorkPrice(input.data.price),
        spec: buildWorkSpec(input.data),
        dim_display: input.data.dimensions?.trim() || null,
        scope_note: input.data.scope_note?.trim() || null,
        notes: input.data.notes?.trim() || null,
        vendor_party_id: input.data.service_vendor_id || null,
        updated_by_name: ctx.user.name ?? null,
        updated_at: new Date(),
      },
    });
    const updated = await tx.workPrice.findUnique({ where: { id: input.id } });
    const changes = diffFields(
      { code: existing.code, name: existing.name, unit: existing.unit, price: existing.price, notes: existing.notes },
      { code: updated!.code, name: updated!.name, unit: updated!.unit, price: updated!.price, notes: updated!.notes },
      ["code", "name", "unit", "price", "notes"],
    );
    if (Object.keys(changes).length > 0) {
      await recordAudit(tx, {
        entity: "WorkPrice",
        entity_id: input.id,
        action: "UPDATE",
        actor: { id: ctx.userId, name: ctx.user.name ?? "" },
        changes,
      });
    }
    return mapWorkPriceAsService(await refetchWorkPrice(tx, input.id));
  },
  { schema: z.object({ id: z.string(), data: ServicePriceInputSchema }) }
);

export const deleteServicePriceAction = createAction<{ id: string }, { id: string }>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    // Soft-delete keeps the current rate recoverable and auditable.
    const existing = await tx.workPrice.findFirst({ where: { id: input.id, kind: "LABOR_ONLY", deleted_at: null } });
    if (!existing) throw new ActionError("Price not found", "NOT_FOUND");
    await tx.workPrice.update({ where: { id: input.id }, data: { deleted_at: new Date(), updated_by_name: ctx.user.name ?? null } });
    await recordAudit(tx, {
      entity: "WorkPrice",
      entity_id: input.id,
      action: "DELETE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "" },
    });
    return { id: input.id };
  }
);
// MaterialPrice actions (Material Prices) — backed by SkuPrice
// ---------------------------------------------------------------------------

const MaterialPriceQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  supplierId: z.string().uuid().optional(),
});

export const getMaterialPricesAction = createAction<MaterialPriceQuery, MaterialPricePageData>(
  async ({ input, ctx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_PRICE_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const search = input.search?.trim() ?? "";
    const page = input.page ?? 1;
    const pageSize = input.pageSize ?? 50;
    const baseWhere: Prisma.SkuPriceWhereInput = {
      is_current: true,
      sku: { deleted_at: null },
      ...(input.supplierId ? { supplier_party_id: input.supplierId } : {}),
    };
    const searchPredicates: Prisma.SkuPriceWhereInput[] = [
      { sku: { name: { contains: search, mode: "insensitive" } } },
      { sku: { code: { contains: search, mode: "insensitive" } } },
      { sku: { brand: { name: { contains: search, mode: "insensitive" } } } },
    ];
    if (!input.supplierId) {
      searchPredicates.push(
        { supplier: { name: { contains: search, mode: "insensitive" } } },
        { supplier: { legal_name: { contains: search, mode: "insensitive" } } }
      );
    }
    const where: Prisma.SkuPriceWhereInput = {
      ...baseWhere,
      ...(search ? { OR: searchPredicates } : {}),
    };

    const [rows, total, scopedTotal] = await Promise.all([
      db.skuPrice.findMany({
        where,
        include: SKU_PRICE_INCLUDE,
        orderBy: [{ valid_from: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.skuPrice.count({ where }),
      search ? db.skuPrice.count({ where: baseWhere }) : Promise.resolve(null),
    ]);

    return {
      rows: rows.map(mapMaterialPrice),
      total,
      allTotal: scopedTotal ?? total,
      page,
      pageSize,
    };
  },
  { schema: MaterialPriceQuerySchema, useTransaction: false }
);

/** Saran unit tetap global walaupun tabel harga sendiri sudah dipaginasi. */
export const getMaterialPriceUnitsAction = createAction<undefined, string[]>(
  async ({ ctx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_PRICE_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const rows = await db.skuPrice.findMany({
      where: { is_current: true, sku: { deleted_at: null } },
      select: { unit: true },
      distinct: ["unit"],
      orderBy: { unit: "asc" },
    });
    return rows.map((row) => row.unit).filter(Boolean);
  },
  { useTransaction: false }
);

function specificationRows(spec: Prisma.JsonValue): Array<{ label: string; value: string }> {
  if (!spec || Array.isArray(spec) || typeof spec !== "object") return [];

  const preferredLabels: Record<string, string> = {
    color: "Color",
    motif: "Motif",
    finishing: "Finishing",
    pattern: "Pattern",
  };
  const entries = Object.entries(spec)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => ({
      key,
      label: preferredLabels[key] ?? key.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()),
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));

  return entries
    .sort((a, b) => {
      const preferred = ["color", "motif", "finishing", "pattern"];
      const aIndex = preferred.indexOf(a.key);
      const bIndex = preferred.indexOf(b.key);
      if (aIndex >= 0 || bIndex >= 0) {
        return (aIndex < 0 ? preferred.length : aIndex) -
          (bIndex < 0 ? preferred.length : bIndex);
      }
      return a.label.localeCompare(b.label, "en");
    })
    .map(({ label, value }) => ({ label, value }));
}

function mapViewerPrice(price: {
  id: string;
  supplier_party_id: string | null;
  price_net: unknown;
  unit: string;
  currency: string;
  valid_from: Date;
  valid_to: Date | null;
  is_current: boolean;
  notes: string | null;
  updated_by_name: string | null;
  supplier: { id: string; name: string } | null;
}): SkuPricingViewerPrice {
  return {
    id: price.id,
    supplierId: price.supplier_party_id,
    supplierName: price.supplier?.name ?? "Manufacturer list price",
    price: Number(price.price_net),
    unit: price.unit,
    currency: price.currency,
    validFrom: price.valid_from,
    validTo: price.valid_to,
    isCurrent: price.is_current,
    notes: price.notes,
    updatedByName: price.updated_by_name,
  };
}

/** SKU-wide viewer used by Pricing rows and the cross-brand SKU directory. */
export const getSkuPricingViewerAction = createAction<
  { skuId: string },
  SkuPricingViewerData | null
>(
  async ({ input, ctx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_PRICE_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const sku = await db.sku.findFirst({
      where: { id: input.skuId, deleted_at: null },
      select: {
        id: true,
        code: true,
        name: true,
        base_unit: true,
        status: true,
        spec: true,
        dim_display: true,
        brand: { select: { id: true, name: true } },
        categories: {
          where: { category: { kind: "PRODUCT" } },
          orderBy: [{ is_primary: "desc" }, { sort_order: "asc" }],
          select: { category: { select: { name: true } } },
        },
        prices: {
          orderBy: [{ valid_from: "desc" }, { created_at: "desc" }],
          select: {
            id: true,
            supplier_party_id: true,
            price_net: true,
            unit: true,
            currency: true,
            valid_from: true,
            valid_to: true,
            is_current: true,
            notes: true,
            updated_by_name: true,
            supplier: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!sku) return null;

    const priceHistory = sku.prices.map(mapViewerPrice);
    const currentPrices = priceHistory
      .filter((price) => price.isCurrent)
      .sort((a, b) => a.price - b.price || a.supplierName.localeCompare(b.supplierName, "en"));

    return {
      id: sku.id,
      code: sku.code,
      name: sku.name,
      brand: sku.brand,
      categories: sku.categories.map((row) => row.category.name),
      specifications: specificationRows(sku.spec),
      dimension: sku.dim_display,
      baseUnit: sku.base_unit,
      status: sku.status,
      currentPrices,
      priceHistory,
    };
  },
  { schema: z.object({ skuId: z.string().min(1) }), useTransaction: false }
);

/**
 * Returns the PRODUCT-kind categories attached to a brand.
 * Used by the pricing form to populate the category selector when a brand
 * is picked, so the user can tag the SKU with the right categories.
 */
export const getBrandProductCategoriesAction = createAction<
  { brandId: string },
  { id: string; name: string }[]
>(
  async ({ input, ctx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_PRICE_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    // No `kind` filter — older BrandCategory rows may have been created before
    // `kind = "PRODUCT"` was enforced on the Category table; filtering by kind
    // would silently hide them. All categories linked to a brand are product
    // categories in this context anyway.
    const rows = await db.brandCategory.findMany({
      where: { brand_id: input.brandId },
      select: { category: { select: { id: true, name: true } } },
      orderBy: { category: { name: "asc" } },
    });
    return rows.map((r) => ({ id: r.category.id, name: r.category.name }));
  },
  { schema: z.object({ brandId: z.string().min(1) }), useTransaction: false }
);

export const createMaterialPriceAction = createAction<MaterialPriceInput, MaterialPriceData>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    if (!input.sku_id) {
      throw new ActionError(
        "Master Data v2 requires every price to hang off a registered SKU — there are no free-floating prices any more.",
        "SKU_REQUIRED"
      );
    }
    const sku = await tx.sku.findUnique({ where: { id: input.sku_id }, select: { id: true } });
    if (!sku) throw new ActionError("SKU not found", "NOT_FOUND");

    const supplierId = await assertPriceSourceParty(tx, input.supplier_party_id);

    const row = await recordSkuPrice(tx, {
      sku_id: input.sku_id,
      supplier_party_id: supplierId,
      price: toNumberOrNull(input.price),
      unit: input.unit,
      valid_from: input.valid_from ? new Date(input.valid_from) : null,
      notes: input.notes,
      updated_by_name: ctx.user.name ?? null,
    }, { id: ctx.userId, name: ctx.user.name ?? "" });
    if (!row) {
      throw new ActionError(
        "Isi harga. Baris harga yang tidak bisa menyebutkan biaya bukanlah harga.",
        "VALIDATION_FAILED"
      );
    }

    // Simpan costing profile + dimensi + base_unit ke Sku.
    const conversionNum = toNumberOrNull(input.conversion);
    await tx.sku.update({
      where: { id: input.sku_id },
      data: {
        ...(input.unit.trim() ? { purchase_unit: input.unit.trim(), base_unit: input.unit.trim() } : {}),
        ...(input.usage_unit.trim() ? { usage_unit: input.usage_unit.trim() } : {}),
        ...(conversionNum !== null && conversionNum > 0 ? { conversion: conversionNum } : {}),
        ...(input.dim_display ? { dim_display: input.dim_display } : {}),
      },
    });

    // Upsert SkuCategory dan propagasi ke BrandCategory.
    const skuForCat = await tx.sku.findUnique({ where: { id: input.sku_id }, select: { brand_id: true } });
    const actor = { id: ctx.userId, name: ctx.user.name ?? "" };
    for (const [idx, catName] of (input.category_names ?? []).entries()) {
      const cat = await resolveCategoryPath(tx, "PRODUCT", null, catName, actor);
      await tx.skuCategory.upsert({
        where: { sku_id_category_id: { sku_id: input.sku_id, category_id: cat.id } },
        create: { sku_id: input.sku_id, category_id: cat.id, is_primary: idx === 0, sort_order: idx },
        update: {},
      });
      if (skuForCat?.brand_id) {
        await tx.brandCategory.upsert({
          where: { brand_id_category_id: { brand_id: skuForCat.brand_id, category_id: cat.id } },
          create: { brand_id: skuForCat.brand_id, category_id: cat.id },
          update: {},
        });
      }
    }

    return mapMaterialPrice(row);
  },
  { schema: MaterialPriceInputSchema }
);

/**
 * Editing a price supersedes it rather than overwriting it.
 *
 * `SkuPrice` is a history table — `valid_from` / `valid_to` / `is_current`
 * exist for no other reason. Updating the current row in place, which is what
 * this did before, rewrites what the studio quoted last month. The quote that
 * went out to a client stops being answerable, and nothing in the UI shows
 * that anything was lost.
 *
 * Annotations are the exception: changing only `notes` amends in place. A note
 * is not an offer, and spawning a history row for a corrected spelling buries
 * the real price changes among bookkeeping.
 */
export const updateMaterialPriceAction = createAction<
  { id: string; data: MaterialPriceInput; updatedByName: string },
  MaterialPriceData
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const existing = await tx.skuPrice.findUnique({ where: { id: input.id } });
    if (!existing) throw new ActionError("Price not found", "NOT_FOUND");

    const supplierId = await assertPriceSourceParty(tx, input.data.supplier_party_id);
    const actor = input.updatedByName?.trim() || ctx.user.name || null;

    const offerChanged = isOfferChange(
      {
        price_net: existing.price_net,
        unit: existing.unit,
        supplier_party_id: existing.supplier_party_id,
      },
      {
        price: toNumberOrNull(input.data.price),
        unit: input.data.unit,
        supplier_party_id: supplierId,
      }
    );

    if (!offerChanged) {
      const row = await tx.skuPrice.update({
        where: { id: input.id },
        data: {
          notes: input.data.notes?.trim() || null,
          updated_by_name: actor,
        },
        include: SKU_PRICE_INCLUDE,
      });
      const changes = diffFields(
        { notes: existing.notes },
        { notes: row.notes },
        ["notes"],
      );
      if (Object.keys(changes).length > 0) {
        await recordAudit(tx, {
          entity: "SkuPrice",
          entity_id: input.id,
          action: "UPDATE",
          actor: { id: ctx.userId, name: actor ?? "" },
          changes,
        });
      }
      return mapMaterialPrice(row);
    }

    // A superseded row must not stay current. If the edit moved the price to a
    // different supplier, the row being replaced belongs to the OLD supplier —
    // `recordSkuPrice` only closes rows for the new one, so close this one here.
    if (existing.supplier_party_id !== supplierId && existing.is_current) {
      await closeCurrentSkuPrice(tx, existing.sku_id, existing.supplier_party_id, undefined, { id: ctx.userId, name: actor ?? "" });
      await recordAudit(tx, {
        entity: "SkuPrice",
        entity_id: existing.id,
        action: "UPDATE",
        actor: { id: ctx.userId, name: actor ?? "" },
        changes: { is_current: { from: true, to: false } },
      });
    }

    const row = await recordSkuPrice(tx, {
      sku_id: existing.sku_id,
      supplier_party_id: supplierId,
      price: toNumberOrNull(input.data.price),
      unit: input.data.unit,
      valid_from: input.data.valid_from ? new Date(input.data.valid_from) : null,
      notes: input.data.notes,
      updated_by_name: actor,
    }, { id: ctx.userId, name: actor ?? "" });
    if (!row) {
      throw new ActionError(
        "Isi harga. Mengosongkan harga akan menyisakan baris yang tidak bisa menyebutkan biaya — hapus harganya saja bila memang tidak berlaku lagi.",
        "VALIDATION_FAILED"
      );
    }

    // Sama seperti create — update costing profile + dimensi + base_unit ke Sku.
    const conversionNum2 = toNumberOrNull(input.data.conversion);
    await tx.sku.update({
      where: { id: existing.sku_id },
      data: {
        ...(input.data.unit.trim() ? { purchase_unit: input.data.unit.trim(), base_unit: input.data.unit.trim() } : {}),
        ...(input.data.usage_unit.trim() ? { usage_unit: input.data.usage_unit.trim() } : {}),
        ...(conversionNum2 !== null && conversionNum2 > 0 ? { conversion: conversionNum2 } : {}),
        ...(input.data.dim_display ? { dim_display: input.data.dim_display } : {}),
      },
    });

    // Upsert SkuCategory dan propagasi ke BrandCategory.
    const skuForCat = await tx.sku.findUnique({ where: { id: existing.sku_id }, select: { brand_id: true } });
    const actor2 = { id: ctx.userId, name: ctx.user.name ?? "" };
    for (const [idx, catName] of (input.data.category_names ?? []).entries()) {
      const cat = await resolveCategoryPath(tx, "PRODUCT", null, catName, actor2);
      await tx.skuCategory.upsert({
        where: { sku_id_category_id: { sku_id: existing.sku_id, category_id: cat.id } },
        create: { sku_id: existing.sku_id, category_id: cat.id, is_primary: idx === 0, sort_order: idx },
        update: {},
      });
      if (skuForCat?.brand_id) {
        await tx.brandCategory.upsert({
          where: { brand_id_category_id: { brand_id: skuForCat.brand_id, category_id: cat.id } },
          create: { brand_id: skuForCat.brand_id, category_id: cat.id },
          update: {},
        });
      }
    }

    return mapMaterialPrice(row);
  },
  { schema: z.object({ id: z.string(), data: MaterialPriceInputSchema, updatedByName: z.string() }) }
);

/**
 * "Delete" closes the offer; it does not erase it.
 *
 * The row disappears from every list, because every list filters
 * `is_current: true` — so this looks exactly like a delete to whoever clicked
 * it. What survives is the record that this supplier once quoted this number,
 * which is the entire point of a history table and the one thing a hard
 * `DELETE` used to throw away.
 *
 * The previous offer is deliberately NOT promoted back to current. "No current
 * price" is a truthful state; silently resurrecting an older number as if it
 * were today's is not.
 */
export const deleteMaterialPriceAction = createAction<{ id: string }, { id: string }>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const existing = await tx.skuPrice.findUnique({ where: { id: input.id } });
    if (!existing) throw new ActionError("Price not found", "NOT_FOUND");

    await tx.skuPrice.update({
      where: { id: input.id },
      data: { is_current: false, valid_to: new Date(), updated_by_name: ctx.user.name ?? null },
    });
    await recordAudit(tx, {
      entity: "SkuPrice",
      entity_id: input.id,
      action: "UPDATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "" },
      changes: { is_current: { from: true, to: false } },
    });
    return { id: input.id };
  }
);

/**
 * REMOVED 2026-08-11 — `upsertSkuMaterialPriceAction`.
 *
 * It existed so `MasterDataProductDialog` could write the price in a SECOND
 * action after the material had already been saved by the first. That is a
 * torn write: when the second call failed the material was already committed
 * without its price, and the dialog said so out loud — "Material tersimpan,
 * tetapi harga gagal disimpan". An apology is not atomicity.
 *
 * Price now travels inside `ProductCatalogInput` and is written by
 * `recordSkuPrice` in the same transaction as the SKU. If the price is
 * rejected, the material is not saved either, which is the behaviour the user
 * already assumed they were getting.
 *
 * It was also the worst-behaved of the four writers: `price_net: … ?? 0`
 * invented a price of zero, and `updated_by_name: ctx.role` stored "ADMIN" in
 * a column meant for a person's name.
 */

/** Suppliers available for the price picker: Party rows carrying SUPPLIER. */
export const getSupplierOptionsAction = createAction<
  undefined,
  Array<{ id: string; name: string }>
>(
  async ({ ctx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const rows = await db.party.findMany({
      // Any party that sells things, not only role=SUPPLIER — Excel's own
      // examples of "Supplied by" (Ace Hardware, Informa) are filed under
      // Retail. See `services/party-role-rules.ts`.
      where: {
        deleted_at: null,
        is_active: true,
        roles: { some: { role: { in: PRICE_SOURCE_ROLES } } },
      },
      select: { id: true, name: true, roles: { select: { role: true } } },
      orderBy: { name: "asc" },
    });
    return rows;
  },
  { useTransaction: false }
);

// ---------------------------------------------------------------------------
// Material + labour packages (Excel Table 3) — WorkPrice, kind = MATERIAL_LABOR
// ---------------------------------------------------------------------------

export const getMaterialLaborPricesAction = createAction<undefined, MaterialLaborPriceData[]>(
  async ({ ctx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const rows = await db.workPrice.findMany({
      where: { deleted_at: null, kind: "MATERIAL_LABOR" },
      include: WORK_PRICE_INCLUDE,
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });
    return rows.map(mapWorkPriceAsMaterialLabor);
  },
  { useTransaction: false }
);

export const createMaterialLaborPriceAction = createAction<MaterialLaborPriceInput, MaterialLaborPriceData>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const code = await generateWorkPriceCode(tx);
    const category = await resolveCategoryPath(tx, "WORK", input.vendor_category, input.category, { id: ctx.userId, name: ctx.user.name ?? "" });
    const row = await tx.workPrice.create({
      data: {
        code,
        name: input.name.trim(),
        category_id: category.id,
        unit: input.unit.trim(),
        price: assertWorkPrice(input.price),
        kind: "MATERIAL_LABOR",
        spec: buildWorkSpec(input),
        dim_display: input.dimensions?.trim() || null,
        scope_note: input.scope_note?.trim() || null,
        notes: input.notes?.trim() || null,
        vendor_party_id: input.service_vendor_id || null,
        updated_by_name: ctx.user.name ?? null,
      },
      include: WORK_PRICE_INCLUDE,
    });
    await recordAudit(tx, {
      entity: "WorkPrice",
      entity_id: row.id,
      action: "CREATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "" },
    });
    return mapWorkPriceAsMaterialLabor(await refetchWorkPrice(tx, row.id));
  },
  { schema: MaterialLaborPriceInputSchema }
);

export const updateMaterialLaborPriceAction = createAction<
  { id: string; data: MaterialLaborPriceInput; updatedByName: string },
  MaterialLaborPriceData
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    // H8 (2026-08-18) — see the identical note on `updateServicePriceAction`.
    const existing = await tx.workPrice.findFirst({ where: { id: input.id, kind: "MATERIAL_LABOR", deleted_at: null } });
    if (!existing) throw new ActionError("Price not found", "NOT_FOUND");

    const category = await resolveCategoryPath(tx, "WORK", input.data.vendor_category, input.data.category, { id: ctx.userId, name: ctx.user.name ?? "" });
    await tx.workPrice.update({
      where: { id: input.id },
      data: {
        code: existing.code,
        name: input.data.name.trim(),
        category_id: category.id,
        unit: input.data.unit.trim(),
        price: assertWorkPrice(input.data.price),
        spec: buildWorkSpec(input.data),
        dim_display: input.data.dimensions?.trim() || null,
        scope_note: input.data.scope_note?.trim() || null,
        notes: input.data.notes?.trim() || null,
        vendor_party_id: input.data.service_vendor_id || null,
        updated_by_name: input.updatedByName?.trim() || ctx.user.name || null,
        updated_at: new Date(),
      },
    });
    const updated = await tx.workPrice.findUnique({ where: { id: input.id } });
    const changes = diffFields(
      { code: existing.code, name: existing.name, unit: existing.unit, price: existing.price, notes: existing.notes },
      { code: updated!.code, name: updated!.name, unit: updated!.unit, price: updated!.price, notes: updated!.notes },
      ["code", "name", "unit", "price", "notes"],
    );
    if (Object.keys(changes).length > 0) {
      await recordAudit(tx, {
        entity: "WorkPrice",
        entity_id: input.id,
        action: "UPDATE",
        actor: { id: ctx.userId, name: input.updatedByName?.trim() || (ctx.user.name ?? "") },
        changes,
      });
    }
    return mapWorkPriceAsMaterialLabor(await refetchWorkPrice(tx, input.id));
  },
  { schema: z.object({ id: z.string(), data: MaterialLaborPriceInputSchema, updatedByName: z.string() }) }
);

export const deleteMaterialLaborPriceAction = createAction<{ id: string }, { id: string }>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    // H7 (2026-08-18) — see the identical note on `deleteServicePriceAction`.
    const existing = await tx.workPrice.findFirst({ where: { id: input.id, kind: "MATERIAL_LABOR", deleted_at: null } });
    if (!existing) throw new ActionError("Price not found", "NOT_FOUND");
    await tx.workPrice.update({ where: { id: input.id }, data: { deleted_at: new Date(), updated_by_name: ctx.user.name ?? null } });
    await recordAudit(tx, {
      entity: "WorkPrice",
      entity_id: input.id,
      action: "DELETE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "" },
    });
    return { id: input.id };
  }
);

