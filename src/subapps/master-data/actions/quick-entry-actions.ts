"use server";

/**
 * MASTER DATA — QUICK ENTRY
 * ============================================================================
 * Sheet2, twice: *"semua halaman punya fitur quick entry -> munculkan dialog
 * box aja utk tiap crud nya"* and *"semua halaman punya fitur searchableedit ->
 * kalau data ga lengkap munculin quick entry"*.
 *
 * ----------------------------------------------------------------------------
 * WHAT THIS IS FOR
 * ----------------------------------------------------------------------------
 * You are entering a price and the vendor is not in the list. The full Party
 * form asks for legal name, address, contacts, links, and categories — none of
 * which you have to hand, and none of which the price you are entering needs.
 * Being made to fill it in is how a name ends up typed into the notes field
 * instead, and the relation Sheet2 asked for quietly stops existing.
 *
 * So these actions write the SMALLEST ROW THAT IS STILL TRUE: a name, and the
 * one classification the calling screen genuinely knows. The row is real and
 * relational from the moment it exists; it is merely incomplete, and the
 * Supplier page is where it gets completed.
 *
 * ----------------------------------------------------------------------------
 * WHAT THEY DELIBERATELY DO NOT DO
 * ----------------------------------------------------------------------------
 * They do not guess. A quick-created Party gets exactly the roles the caller
 * passed, and a caller that knows nothing passes none — same rule as
 * `scripts/backfill-party-roles.mjs`, which reports unknowns rather than
 * inventing them, and the same rule as `productParentFor()`, which leaves a tag
 * at the root rather than filing it under a plausible parent. A guess made here
 * is indistinguishable from a fact later.
 *
 * They also do not silently reuse. Creating a name that already exists returns
 * the EXISTING row rather than a duplicate or an error — the user asked for
 * "this vendor", and an error at this point loses the price they were halfway
 * through typing. `reused: true` comes back so the UI can say so.
 */

import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { PERMISSION } from "@/core/rbac/constants";
import { hasPermission } from "@/core/rbac/guards";
import { ActionError } from "@/lib/error-types";
import type { PartyRoleKind } from "@/generated/prisma";
import { recordAudit } from "../services/audit-service";
import { slugify } from "../lib/slug";
import { ensureUniqueSlug } from "../services/slug-service";
import { createSkuCore } from "../services/sku-core-service";

const PARTY_ROLE_VALUES = [
  "MANUFACTURER",
  "DISTRIBUTOR",
  "SUPPLIER",
  "RETAIL",
  "SUBCON",
  "SERVICE_VENDOR",
] as const;

/** What every quick-create hands back: enough to select it, and whether it is new. */
export type QuickEntryResult = {
  id: string;
  name: string;
  /** True when an existing row matched by name and was returned instead. */
  reused: boolean;
};

// ===========================================================================
// Party
// ===========================================================================

const QuickPartySchema = z.object({
  name: z.string().min(1, "Name is required"),
  /**
   * The roles the CALLING SCREEN knows to be true — not a default.
   *
   * The pricing pages know a supplier picked there supplies something, and the
   * work-price pages know a vendor picked there provides a service. A screen
   * that knows neither sends `[]`, and the party shows up on the Supplier page
   * with no category, which is an honest description of what we know.
   */
  roles: z.array(z.enum(PARTY_ROLE_VALUES)).default([]),
});

export const quickCreatePartyAction = createAction<
  { name: string; roles: PartyRoleKind[] },
  QuickEntryResult
>(
  // B6 (2026-08-18): dulu ada `db.$transaction(...)` di sini di dalam
  // handler yang sudah berjalan di dalam transaksi `createAction` (default
  // `useTransaction: true`). `db` adalah klien Prisma GLOBAL, bukan `tx`
  // yang diberikan — jadi itu membuka transaksi kedua yang tidak terkait,
  // bukan nested transaction yang aman. Perbaikannya: pakai `tx` yang sudah
  // disediakan, satu transaksi saja.
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const name = input.name.trim();
    if (!name) throw new ActionError("Name is required", "VALIDATION_FAILED");

    // `findFirst` + `deleted_at: null`, bukan `findUnique({ name })`.
    //
    // Dua alasan, keduanya ditemukan audit 2026-08-18. Pertama, `name` tidak
    // lagi `@unique` — keunikannya kini dijaga index PARSIAL
    // `Party_name_live_uniq` (migrasi 20260818120000), yang hanya berlaku
    // untuk baris hidup. Kedua, dan ini yang benar-benar menggigit: bentuk
    // lama menemukan baris yang SUDAH DIHAPUS, gagal di syarat
    // `!existing.deleted_at`, lalu jatuh ke `create` — yang langsung menabrak
    // index unik tanpa syarat. Pengguna melihat pesan Prisma mentah di tengah
    // mengetik harga, dan nama supplier yang pernah dihapus tidak pernah bisa
    // dipakai lagi.
    //
    // Sekarang baris terhapus tidak terlihat di sini DAN tidak menghalangi di
    // database, jadi jalur `create` di bawah benar-benar bisa dilalui.
    const existing = await tx.party.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, deleted_at: null },
      select: { id: true, name: true },
    });

    if (existing) {
      if (input.roles.length > 0) {
        const have = await tx.partyRole.findMany({
          where: { party_id: existing.id },
          select: { role: true },
        });
        const haveSet = new Set(have.map((r) => r.role));
        const missing = input.roles.filter((r) => !haveSet.has(r));
        if (missing.length > 0) {
          await tx.partyRole.createMany({
            data: missing.map((role) => ({ party_id: existing.id, role })),
            skipDuplicates: true,
          });
          await recordAudit(tx, {
            entity: "PartyRole",
            entity_id: existing.id,
            action: "CREATE",
            actor: { id: ctx.userId, name: ctx.user.name ?? "unknown" },
            changes: { roles: { from: [...haveSet], to: [...haveSet, ...missing] } },
          });
        }
      }
      return { id: existing.id, name: existing.name, reused: true };
    }

    // B3 (2026-08-18): `name` is confirmed free above (or this already
    // returned via the `reused` branch); slug can still collide with a
    // DIFFERENT name that normalises the same way.
    const slug = await ensureUniqueSlug(slugify(name), async (candidate) =>
      Boolean(
        await tx.party.findFirst({
          where: { slug: candidate, deleted_at: null },
          select: { id: true },
        })
      )
    );

    const created = await tx.party.create({
      data: {
        name,
        slug,
        type: "COMPANY",
        updated_by_name: ctx.user.name ?? null,
        roles: {
          create: [...new Set(input.roles)].map((role) => ({ role })),
        },
      },
      select: { id: true, name: true },
    });

    await recordAudit(tx, {
      entity: "Party",
      entity_id: created.id,
      action: "CREATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "unknown" },
    });

    return { id: created.id, name: created.name, reused: false };
  },
  { schema: QuickPartySchema }
);

// ===========================================================================
// Brand
// ===========================================================================

const QuickBrandSchema = z.object({
  name: z.string().min(1, "Brand name is required"),
  /** Optional owner. Excel allows a brand with no company behind it (X6). */
  owner_party_id: z.string().nullable().default(null),
});

export const quickCreateBrandAction = createAction<
  { name: string; owner_party_id: string | null },
  QuickEntryResult
>(
  // B6 (2026-08-18): lihat catatan di quickCreatePartyAction — `tx` dari
  // `createAction` dipakai langsung, tidak lagi buka `db.$transaction` kedua.
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const name = input.name.trim();
    if (!name) throw new ActionError("Brand name is required", "VALIDATION_FAILED");

    // `findFirst` + `deleted_at: null`, bukan `findUnique({ name })`.
    //
    // Dua alasan, keduanya ditemukan audit 2026-08-18. Pertama, `name` tidak
    // lagi `@unique` — keunikannya kini dijaga index PARSIAL
    // `Brand_name_live_uniq` (migrasi 20260818120000), yang hanya berlaku
    // untuk baris hidup. Kedua, dan ini yang benar-benar menggigit: bentuk
    // lama menemukan baris yang SUDAH DIHAPUS, gagal di syarat
    // `!existing.deleted_at`, lalu jatuh ke `create` — yang langsung menabrak
    // index unik tanpa syarat. Pengguna melihat pesan Prisma mentah di tengah
    // mengetik harga, dan nama supplier yang pernah dihapus tidak pernah bisa
    // dipakai lagi.
    //
    // Sekarang baris terhapus tidak terlihat di sini DAN tidak menghalangi di
    // database, jadi jalur `create` di bawah benar-benar bisa dilalui.
    const existing = await tx.brand.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, deleted_at: null },
      select: { id: true, name: true },
    });

    if (existing) {
      return { id: existing.id, name: existing.name, reused: true };
    }

    if (input.owner_party_id) {
      const owner = await tx.party.findUnique({
        where: { id: input.owner_party_id },
        select: { id: true, deleted_at: true },
      });
      if (!owner || owner.deleted_at) {
        throw new ActionError("That company no longer exists", "NOT_FOUND");
      }
    }

    // B3 (2026-08-18): same reasoning as `quickCreatePartyAction` — name is
    // free, slug might not be.
    const brandSlug = await ensureUniqueSlug(slugify(name), async (candidate) =>
      Boolean(
        await tx.brand.findFirst({
          where: { slug: candidate, deleted_at: null },
          select: { id: true },
        })
      )
    );

    const created = await tx.brand.create({
      data: {
        name,
        slug: brandSlug,
        owner_party_id: input.owner_party_id,
        updated_by_name: ctx.user.name ?? null,
      },
      select: { id: true, name: true },
    });

    await recordAudit(tx, {
      entity: "Brand",
      entity_id: created.id,
      action: "CREATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "unknown" },
    });

    return { id: created.id, name: created.name, reused: false };
  },
  { schema: QuickBrandSchema }
);

// ===========================================================================
// Work vendor
// ===========================================================================

/**
 * A "work vendor" is not a separate model — v2 merged ServiceVendor into Party
 * (X6). This exists as its own action only so the calling screen does not have
 * to know which roles a work vendor implies; that mapping belongs on the server
 * with the rest of the rules, not restated in every form that needs it.
 *
 * SUBCON and SERVICE_VENDOR both, because Sheet2 lists both as suppliers of
 * "material & upah" and a picker filtered to one would hide half the list —
 * exactly the failure the SUPPLIER-only filter caused on the pricing pages.
 */
const QuickWorkVendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
});

export const quickCreateWorkVendorAction = createAction<
  { name: string },
  QuickEntryResult
>(
  // B6 (2026-08-18): lihat catatan di quickCreatePartyAction — `tx` dari
  // `createAction` dipakai langsung, tidak lagi buka `db.$transaction` kedua.
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VENDOR_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const name = input.name.trim();
    if (!name) throw new ActionError("Vendor name is required", "VALIDATION_FAILED");

    // `findFirst` + `deleted_at: null`, bukan `findUnique({ name })`.
    //
    // Dua alasan, keduanya ditemukan audit 2026-08-18. Pertama, `name` tidak
    // lagi `@unique` — keunikannya kini dijaga index PARSIAL
    // `Party_name_live_uniq` (migrasi 20260818120000), yang hanya berlaku
    // untuk baris hidup. Kedua, dan ini yang benar-benar menggigit: bentuk
    // lama menemukan baris yang SUDAH DIHAPUS, gagal di syarat
    // `!existing.deleted_at`, lalu jatuh ke `create` — yang langsung menabrak
    // index unik tanpa syarat. Pengguna melihat pesan Prisma mentah di tengah
    // mengetik harga, dan nama supplier yang pernah dihapus tidak pernah bisa
    // dipakai lagi.
    //
    // Sekarang baris terhapus tidak terlihat di sini DAN tidak menghalangi di
    // database, jadi jalur `create` di bawah benar-benar bisa dilalui.
    const existing = await tx.party.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, deleted_at: null },
      select: { id: true, name: true },
    });

    if (existing) {
      const have = await tx.partyRole.findMany({
        where: { party_id: existing.id },
        select: { role: true },
      });
      const haveSet = new Set(have.map((r) => r.role));
      if (!haveSet.has("SERVICE_VENDOR")) {
        await tx.partyRole.create({
          data: { party_id: existing.id, role: "SERVICE_VENDOR" },
        });
        await recordAudit(tx, {
          entity: "PartyRole",
          entity_id: existing.id,
          action: "CREATE",
          actor: { id: ctx.userId, name: ctx.user.name ?? "unknown" },
          changes: { role: { from: null, to: "SERVICE_VENDOR" } },
        });
      }
      return { id: existing.id, name: existing.name, reused: true };
    }

    // B3 (2026-08-18): same reasoning as `quickCreatePartyAction`.
    const slug = await ensureUniqueSlug(slugify(name), async (candidate) =>
      Boolean(
        await tx.party.findFirst({
          where: { slug: candidate, deleted_at: null },
          select: { id: true },
        })
      )
    );

    const created = await tx.party.create({
      data: {
        name,
        slug,
        type: "COMPANY",
        updated_by_name: ctx.user.name ?? null,
        roles: { create: [{ role: "SERVICE_VENDOR" }] },
      },
      select: { id: true, name: true },
    });

    await recordAudit(tx, {
      entity: "Party",
      entity_id: created.id,
      action: "CREATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "unknown" },
    });

    return { id: created.id, name: created.name, reused: false };
  },
  { schema: QuickWorkVendorSchema }
);

// ===========================================================================
// SKU
// ===========================================================================

const QuickSkuSchema = z.object({
  brand_id: z.string().min(1, "Brand is required"),
  sku_code: z.string().min(1, "SKU code is required"),
  product_name: z.string().optional(),
  category: z.string().optional(),
});

export const quickCreateSkuAction = createAction<
  { brand_id: string; sku_code: string; product_name?: string; category?: string },
  QuickEntryResult
>(
  // B6 (2026-08-18): lihat catatan di quickCreatePartyAction — `tx` dari
  // `createAction` dipakai langsung, tidak lagi buka `db.$transaction` kedua.
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_SKU_MANAGE)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const code = input.sku_code.trim();
    if (!code) throw new ActionError("SKU code is required", "VALIDATION_FAILED");

    const slug = slugify(code);

    const existing = await tx.sku.findUnique({
      where: { brand_id_slug: { brand_id: input.brand_id, slug } },
      select: { id: true, name: true, deleted_at: true },
    });

    if (existing && !existing.deleted_at) {
      return { id: existing.id, name: existing.name, reused: true };
    }

    const brand = await tx.brand.findUnique({
      where: { id: input.brand_id },
      select: { id: true, deleted_at: true },
    });
    if (!brand || brand.deleted_at) {
      throw new ActionError("Brand not found", "NOT_FOUND");
    }

    // `kind: "PRODUCT"` WAJIB. `Category` unik pada `(kind, slug)`, jadi
    // "Finishing" ada DUA baris — satu PRODUCT, satu WORK (keduanya ada di
    // PRODUCT_LEVEL1 dan WORK_LEVEL1). Sebelum 2026-08-18 lookup ini tidak
    // menyebut kind sama sekali, jadi `findFirst` mengambil mana pun yang
    // lebih dulu — kadang kategori tarif kerja menempel ke sebuah material.
    const categoryIds: string[] = [];
    if (input.category?.trim()) {
      const cat = await tx.category.findFirst({
        where: {
          kind: "PRODUCT",
          name: { equals: input.category.trim(), mode: "insensitive" },
        },
        select: { id: true },
      });
      if (cat) categoryIds.push(cat.id);
    }

    // B5 (2026-08-18): create + slug + audit now go through `createSkuCore`
    // (see its doc comment). This site used to write `base_unit: ""` — the
    // column is NOT NULL, so an empty string was the only way to say "no
    // unit chosen yet", and it read as a real (blank) unit everywhere else.
    // `createSkuCore` falls back to `"pcs"` like every other creation path.
    const created = await createSkuCore(
      tx,
      {
        data: {
          brand_id: input.brand_id,
          code,
          name: input.product_name?.trim() || code,
          kind: "MATERIAL",
          updated_by_name: ctx.user.name ?? null,
        },
        slugSeed: code,
        categoryIds,
      },
      { id: ctx.userId, name: ctx.user.name ?? "unknown" }
    );

    return { id: created.id, name: created.name, reused: false };
  },
  { schema: QuickSkuSchema }
);
