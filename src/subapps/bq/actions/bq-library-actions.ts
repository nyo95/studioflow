"use server";

/**
 * BQ Library — server actions for save-to-library and load-from-library.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { ActionError } from "@/lib/error-types";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import type { Role } from "@/generated/prisma";

function assertBqEditPerm(role: Role): void {
  if (!hasPermission(role, PERMISSION.BQ_BREAKDOWN_EDIT)) {
    throw new ActionError("You do not have permission to modify BQ breakdowns.", "UNAUTHORIZED_ACTION");
  }
}

// ---------------------------------------------------------------------------
// Save to library — from object
// ---------------------------------------------------------------------------

export const saveObjectToLibraryAction = createAction(
  async ({ input, ctx, tx }) => {
    assertBqEditPerm(ctx.role);

    // Load the full object with all sub-objects and lines
    const object = await tx.bqObject.findFirst({
      where: { id: input.objectId, deleted_at: null },
      include: {
        sub_objects: {
          orderBy: [{ sort_order: "asc" }],
          include: {
            material_lines: { orderBy: [{ sort_order: "asc" }] },
            service_lines: { orderBy: [{ sort_order: "asc" }] },
          },
        },
      },
    });
    if (!object) throw new ActionError("Object not found.", "NOT_FOUND");

    // Validate: no material lines with null sku_id
    for (const sub of object.sub_objects) {
      for (const line of sub.material_lines) {
        if (!line.sku_id) {
          throw new ActionError(
            `Line "${line.snapshot_name}" cannot be saved to library: SKU no longer exists in Master Data.`,
            "INVALID_LINE"
          );
        }
      }
    }

    // Create library object
    const libObject = await tx.bqLibraryObject.create({
      data: {
        code: object.code,
        name: input.name || object.name,
        unit: object.unit,
        markup_pct: object.markup_pct,
        notes: object.notes,
        created_by_name: ctx.user.name ?? "Unknown",
      },
    });

    // Copy sub-objects and their lines
    for (const sub of object.sub_objects) {
      const libSub = await tx.bqLibrarySubObjectOfObject.create({
        data: {
          library_object_id: libObject.id,
          name: sub.name,
          qty: sub.qty,
          notes: sub.notes,
          sort_order: sub.sort_order,
        },
      });

      for (const line of sub.material_lines) {
        await tx.bqLibraryMaterialLine.create({
          data: {
            sub_object_of_object_id: libSub.id,
            sku_id: line.sku_id!,
            qty_per_sub: line.qty_per_sub,
            waste_override_pct: line.waste_override_pct,
            sort_order: line.sort_order,
          },
        });
      }

      for (const line of sub.service_lines) {
        await tx.bqLibraryServiceLine.create({
          data: {
            sub_object_of_object_id: libSub.id,
            work_price_id: line.work_price_id!,
            qty_per_sub: line.qty_per_sub,
            sort_order: line.sort_order,
          },
        });
      }
    }

    revalidatePath("/bq/library");
    return { id: libObject.id };
  },
  {
    schema: z.object({
      objectId: z.string().min(1),
      name: z.string().min(1, "Name is required."),
    }),
  }
);

// ---------------------------------------------------------------------------
// Save to library — from standalone sub-object
// ---------------------------------------------------------------------------

export const saveSubObjectToLibraryAction = createAction(
  async ({ input, ctx, tx }) => {
    assertBqEditPerm(ctx.role);

    const sub = await tx.bqSubObject.findFirst({
      where: { id: input.subObjectId },
      include: {
        material_lines: { orderBy: [{ sort_order: "asc" }] },
        service_lines: { orderBy: [{ sort_order: "asc" }] },
      },
    });
    if (!sub) throw new ActionError("Sub-object not found.", "NOT_FOUND");

    for (const line of sub.material_lines) {
      if (!line.sku_id) {
        throw new ActionError(
          `Line "${line.snapshot_name}" cannot be saved to library: SKU no longer exists.`,
          "INVALID_LINE"
        );
      }
    }

    const libSub = await tx.bqLibrarySubObject.create({
      data: {
        name: input.name || sub.name,
        qty: sub.qty,
        notes: sub.notes,
        created_by_name: ctx.user.name ?? "Unknown",
      },
    });

    for (const line of sub.material_lines) {
      await tx.bqLibraryMaterialLine.create({
        data: {
          sub_object_id: libSub.id,
          sku_id: line.sku_id!,
          qty_per_sub: line.qty_per_sub,
          waste_override_pct: line.waste_override_pct,
          sort_order: line.sort_order,
        },
      });
    }

    for (const line of sub.service_lines) {
      await tx.bqLibraryServiceLine.create({
        data: {
          sub_object_id: libSub.id,
          work_price_id: line.work_price_id!,
          qty_per_sub: line.qty_per_sub,
          sort_order: line.sort_order,
        },
      });
    }

    revalidatePath("/bq/library");
    return { id: libSub.id };
  },
  {
    schema: z.object({
      subObjectId: z.string().min(1),
      name: z.string().min(1, "Name is required."),
    }),
  }
);

// ---------------------------------------------------------------------------
// Load from library — into existing sub-object
// ---------------------------------------------------------------------------

export const loadFromLibraryObjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertBqEditPerm(ctx.role);

    const libObject = await tx.bqLibraryObject.findFirst({
      where: { id: input.libraryObjectId, deleted_at: null },
      include: {
        sub_objects: {
          orderBy: [{ sort_order: "asc" }],
          include: {
            materials: { orderBy: [{ sort_order: "asc" }] },
            services: { orderBy: [{ sort_order: "asc" }] },
          },
        },
      },
    });
    if (!libObject) throw new ActionError("Library object not found.", "NOT_FOUND");

    const targetSub = await tx.bqSubObject.findFirst({
      where: { id: input.targetSubObjectId },
    });
    if (!targetSub) throw new ActionError("Target sub-object not found.", "NOT_FOUND");

    // Pour from first sub-object of library
    const libSub = libObject.sub_objects[0];
    if (!libSub) throw new ActionError("Library object has no sub-objects.", "INVALID_LIBRARY");

    // Pour material lines
    for (const m of libSub.materials) {
      const sku = await tx.sku.findFirst({
        where: { id: m.sku_id, deleted_at: null },
        select: { id: true },
      });
      if (!sku) continue; // Skip lines with deleted SKUs

      // Find current price for snapshot
      const price = await tx.skuPrice.findFirst({
        where: { sku_id: m.sku_id, is_current: true },
        orderBy: [{ valid_from: "desc" }],
        select: {
          id: true, unit: true, price_net: true, currency: true,
          valid_from: true, supplier_party_id: true,
          supplier: { select: { name: true } },
        },
      });

      // Read costing from Sku directly (P1)
      const skuData = await tx.sku.findFirst({
        where: { id: m.sku_id, deleted_at: null },
        select: {
          name: true, code: true, base_unit: true,
          brand: { select: { name: true } },
          categories: {
            where: { is_primary: true },
            select: { category: { select: { path: true } } },
            take: 1,
          },
          usage_unit: true, purchase_unit: true, conversion: true,
          default_waste_pct: true, minimum_order: true, rounding_increment: true,
        },
      });
      if (!skuData) continue;

      const siblings = await tx.bqMaterialLine.findMany({
        where: { sub_object_id: input.targetSubObjectId },
        select: { sort_order: true },
      });
      const nextSort = siblings.reduce((max, s) => Math.max(max, s.sort_order), -1) + 1;

      await tx.bqMaterialLine.create({
        data: {
          sub_object_id: input.targetSubObjectId,
          sku_id: m.sku_id,
          sku_price_id: price?.id ?? null,
          supplier_party_id: price?.supplier_party_id ?? null,
          qty_per_sub: m.qty_per_sub,
          waste_override_pct: m.waste_override_pct,
          snapshot_name: skuData.name,
          snapshot_code: skuData.code,
          snapshot_brand_name: skuData.brand?.name ?? null,
          snapshot_category_path: skuData.categories[0]?.category.path ?? null,
          snapshot_supplier_name: price?.supplier?.name ?? null,
          snapshot_usage_unit: skuData.usage_unit ?? skuData.base_unit,
          snapshot_purchase_unit: skuData.purchase_unit ?? "",
          snapshot_conversion: skuData.conversion ?? 1,
          snapshot_price: price?.price_net ?? 0,
          snapshot_currency: price?.currency ?? "IDR",
          snapshot_material_default_waste_pct: skuData.default_waste_pct,
          snapshot_category_default_waste_pct: null,
          snapshot_minimum_order: skuData.minimum_order,
          snapshot_rounding_increment: skuData.rounding_increment ?? 1,
          snapshot_price_valid_from: price?.valid_from ?? null,
          snapshot_taken_at: new Date(),
          sort_order: nextSort,
          notes: null,
          updated_by_name: ctx.user.name ?? null,
        },
      });
    }

    // Pour service lines
    for (const s of libSub.services) {
      const wp = await tx.workPrice.findFirst({
        where: { id: s.work_price_id, deleted_at: null, is_active: true },
        select: {
          id: true, code: true, name: true, unit: true, price: true, currency: true,
          scope_note: true, kind: true, valid_from: true,
          vendor: { select: { name: true } },
          category: { select: { path: true } },
        },
      });
      if (!wp) continue;

      const siblings = await tx.bqServiceLine.findMany({
        where: { sub_object_id: input.targetSubObjectId },
        select: { sort_order: true },
      });
      const nextSort = siblings.reduce((max, sl) => Math.max(max, sl.sort_order), -1) + 1;

      await tx.bqServiceLine.create({
        data: {
          sub_object_id: input.targetSubObjectId,
          work_price_id: s.work_price_id,
          qty_per_sub: s.qty_per_sub,
          snapshot_name: wp.name,
          snapshot_code: wp.code,
          snapshot_category_path: wp.category?.path ?? null,
          snapshot_vendor_name: wp.vendor?.name ?? null,
          snapshot_rate_unit: wp.unit,
          snapshot_price: wp.price,
          snapshot_currency: wp.currency,
          snapshot_scope_note: wp.scope_note,
          snapshot_has_material: wp.kind === "MATERIAL_LABOR",
          snapshot_price_valid_from: wp.valid_from,
          snapshot_taken_at: new Date(),
          sort_order: nextSort,
          notes: null,
          updated_by_name: ctx.user.name ?? null,
        },
      });
    }

    revalidatePath("/bq");
    return { ok: true };
  },
  {
    schema: z.object({
      libraryObjectId: z.string().min(1),
      targetSubObjectId: z.string().min(1),
    }),
  }
);

// ---------------------------------------------------------------------------
// Load from standalone library sub-object
// ---------------------------------------------------------------------------

export const loadFromLibrarySubObjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertBqEditPerm(ctx.role);

    const libSub = await tx.bqLibrarySubObject.findFirst({
      where: { id: input.librarySubObjectId, deleted_at: null },
      include: {
        materials: { orderBy: [{ sort_order: "asc" }] },
        services: { orderBy: [{ sort_order: "asc" }] },
      },
    });
    if (!libSub) throw new ActionError("Library sub-object not found.", "NOT_FOUND");

    const targetSub = await tx.bqSubObject.findFirst({
      where: { id: input.targetSubObjectId },
    });
    if (!targetSub) throw new ActionError("Target sub-object not found.", "NOT_FOUND");

    // Pour material lines
    for (const m of libSub.materials) {
      const sku = await tx.sku.findFirst({
        where: { id: m.sku_id, deleted_at: null },
        select: { id: true },
      });
      if (!sku) continue;

      const price = await tx.skuPrice.findFirst({
        where: { sku_id: m.sku_id, is_current: true },
        orderBy: [{ valid_from: "desc" }],
        select: {
          id: true, unit: true, price_net: true, currency: true,
          valid_from: true, supplier_party_id: true,
          supplier: { select: { name: true } },
        },
      });

      const skuData = await tx.sku.findFirst({
        where: { id: m.sku_id, deleted_at: null },
        select: {
          name: true, code: true, base_unit: true,
          brand: { select: { name: true } },
          categories: {
            where: { is_primary: true },
            select: { category: { select: { path: true } } },
            take: 1,
          },
          usage_unit: true, purchase_unit: true, conversion: true,
          default_waste_pct: true, minimum_order: true, rounding_increment: true,
        },
      });
      if (!skuData) continue;

      const siblings = await tx.bqMaterialLine.findMany({
        where: { sub_object_id: input.targetSubObjectId },
        select: { sort_order: true },
      });
      const nextSort = siblings.reduce((max, s) => Math.max(max, s.sort_order), -1) + 1;

      await tx.bqMaterialLine.create({
        data: {
          sub_object_id: input.targetSubObjectId,
          sku_id: m.sku_id,
          sku_price_id: price?.id ?? null,
          supplier_party_id: price?.supplier_party_id ?? null,
          qty_per_sub: m.qty_per_sub,
          waste_override_pct: m.waste_override_pct,
          snapshot_name: skuData.name,
          snapshot_code: skuData.code,
          snapshot_brand_name: skuData.brand?.name ?? null,
          snapshot_category_path: skuData.categories[0]?.category.path ?? null,
          snapshot_supplier_name: price?.supplier?.name ?? null,
          snapshot_usage_unit: skuData.usage_unit ?? skuData.base_unit,
          snapshot_purchase_unit: skuData.purchase_unit ?? "",
          snapshot_conversion: skuData.conversion ?? 1,
          snapshot_price: price?.price_net ?? 0,
          snapshot_currency: price?.currency ?? "IDR",
          snapshot_material_default_waste_pct: skuData.default_waste_pct,
          snapshot_category_default_waste_pct: null,
          snapshot_minimum_order: skuData.minimum_order,
          snapshot_rounding_increment: skuData.rounding_increment ?? 1,
          snapshot_price_valid_from: price?.valid_from ?? null,
          snapshot_taken_at: new Date(),
          sort_order: nextSort,
          notes: null,
          updated_by_name: ctx.user.name ?? null,
        },
      });
    }

    // Pour service lines
    for (const s of libSub.services) {
      const wp = await tx.workPrice.findFirst({
        where: { id: s.work_price_id, deleted_at: null, is_active: true },
        select: {
          id: true, code: true, name: true, unit: true, price: true, currency: true,
          scope_note: true, kind: true, valid_from: true,
          vendor: { select: { name: true } },
          category: { select: { path: true } },
        },
      });
      if (!wp) continue;

      const siblings = await tx.bqServiceLine.findMany({
        where: { sub_object_id: input.targetSubObjectId },
        select: { sort_order: true },
      });
      const nextSort = siblings.reduce((max, sl) => Math.max(max, sl.sort_order), -1) + 1;

      await tx.bqServiceLine.create({
        data: {
          sub_object_id: input.targetSubObjectId,
          work_price_id: s.work_price_id,
          qty_per_sub: s.qty_per_sub,
          snapshot_name: wp.name,
          snapshot_code: wp.code,
          snapshot_category_path: wp.category?.path ?? null,
          snapshot_vendor_name: wp.vendor?.name ?? null,
          snapshot_rate_unit: wp.unit,
          snapshot_price: wp.price,
          snapshot_currency: wp.currency,
          snapshot_scope_note: wp.scope_note,
          snapshot_has_material: wp.kind === "MATERIAL_LABOR",
          snapshot_price_valid_from: wp.valid_from,
          snapshot_taken_at: new Date(),
          sort_order: nextSort,
          notes: null,
          updated_by_name: ctx.user.name ?? null,
        },
      });
    }

    // Link target sub-object to this library template (R2: instance ⧉)
    await tx.bqSubObject.update({
      where: { id: input.targetSubObjectId },
      data: {
        library_sub_object_id: input.librarySubObjectId,
        updated_by_name: ctx.user.name ?? null,
      },
    });

    revalidatePath("/bq");
    return { ok: true };
  },
  {
    schema: z.object({
      librarySubObjectId: z.string().min(1),
      targetSubObjectId: z.string().min(1),
    }),
  }
);

// ---------------------------------------------------------------------------
// Save standalone sub-object to library AND link it (R3: ⧉ source)
// ---------------------------------------------------------------------------

/**
 * Simpan sub-object ke library DAN langsung jadikan sub-object ini instance
 * (⧉) dari template yang baru dibuat. Berbeda dari `saveSubObjectToLibraryAction`
 * (yang hanya menyimpan tanpa link), aksi ini dipakai dari tombol "+⧉" pada
 * sub-object ◇ yang sudah punya isi.
 *
 * Sub-object sumber tidak kehilangan barisnya — ia tetap memilikinya (copy-on-write
 * sudah diterapkan saat link pertama kali dibuat). Yang berubah hanya
 * `library_sub_object_id` di baris sub-object itu sendiri.
 */
export const saveSubObjectToLibraryAndLinkAction = createAction(
  async ({ input, ctx, tx }) => {
    assertBqEditPerm(ctx.role);

    const sub = await tx.bqSubObject.findFirst({
      where: { id: input.subObjectId },
      include: {
        material_lines: { orderBy: [{ sort_order: "asc" }] },
        service_lines: { orderBy: [{ sort_order: "asc" }] },
      },
    });
    if (!sub) throw new ActionError("Sub-object not found.", "NOT_FOUND");

    // Validate: no detached material lines (sku_id must not be null)
    for (const line of sub.material_lines) {
      if (!line.sku_id) {
        throw new ActionError(
          `Line "${line.snapshot_name}" cannot be saved to library: SKU no longer exists.`,
          "INVALID_LINE"
        );
      }
    }

    // Create the library sub-object
    const libSub = await tx.bqLibrarySubObject.create({
      data: {
        name: input.name || sub.name,
        qty: sub.qty,
        notes: sub.notes,
        created_by_name: ctx.user.name ?? "Unknown",
      },
    });

    // Copy current lines into library
    for (const line of sub.material_lines) {
      await tx.bqLibraryMaterialLine.create({
        data: {
          sub_object_id: libSub.id,
          sku_id: line.sku_id!,
          qty_per_sub: line.qty_per_sub,
          waste_override_pct: line.waste_override_pct,
          sort_order: line.sort_order,
        },
      });
    }

    for (const line of sub.service_lines) {
      await tx.bqLibraryServiceLine.create({
        data: {
          sub_object_id: libSub.id,
          work_price_id: line.work_price_id!,
          qty_per_sub: line.qty_per_sub,
          sort_order: line.sort_order,
        },
      });
    }

    // Link the source sub-object to this template (becomes first instance ⧉)
    await tx.bqSubObject.update({
      where: { id: input.subObjectId },
      data: {
        library_sub_object_id: libSub.id,
        updated_by_name: ctx.user.name ?? null,
      },
    });

    revalidatePath("/bq/library");
    revalidatePath("/bq");
    return { id: libSub.id };
  },
  {
    schema: z.object({
      subObjectId: z.string().min(1),
      name: z.string().min(1, "Name is required."),
    }),
  }
);

// ---------------------------------------------------------------------------
// Delete library entries (soft)
// ---------------------------------------------------------------------------

export const deleteLibraryObjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertBqEditPerm(ctx.role);

    const result = await tx.bqLibraryObject.updateMany({
      where: { id: input.id, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    if (result.count === 0) throw new ActionError("Library object not found.", "NOT_FOUND");

    revalidatePath("/bq/library");
    return { ok: true };
  },
  { schema: z.object({ id: z.string().min(1) }) }
);

export const deleteLibrarySubObjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertBqEditPerm(ctx.role);

    const result = await tx.bqLibrarySubObject.updateMany({
      where: { id: input.id, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    if (result.count === 0) throw new ActionError("Library sub-object not found.", "NOT_FOUND");

    revalidatePath("/bq/library");
    return { ok: true };
  },
  { schema: z.object({ id: z.string().min(1) }) }
);

// ---------------------------------------------------------------------------
// Search library entries (client-safe)
// ---------------------------------------------------------------------------

export const searchLibraryObjectsAction = createAction(
  async ({ input }) => {
    const { listLibraryObjects } = await import("../services/library-service");
    return listLibraryObjects(input.query);
  },
  { schema: z.object({ query: z.string().default("") }) }
);

export const searchLibrarySubObjectsAction = createAction(
  async ({ input }) => {
    const { listLibrarySubObjects } = await import("../services/library-service");
    return listLibrarySubObjects(input.query);
  },
  { schema: z.object({ query: z.string().default("") }) }
);
