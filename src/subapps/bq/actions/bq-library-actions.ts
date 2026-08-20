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
import { loadMaterialCandidate, loadServiceCandidate } from "../services/master-data-service";

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
            source: line.source,
            sku_id: line.sku_id,
            recipe_name: line.source === "PROJECT_LOCAL" ? line.snapshot_name : null,
            recipe_code: line.source === "PROJECT_LOCAL" ? line.snapshot_code : null,
            recipe_brand_name: line.source === "PROJECT_LOCAL" ? line.snapshot_brand_name : null,
            recipe_supplier_name: line.source === "PROJECT_LOCAL" ? line.snapshot_supplier_name : null,
            recipe_usage_unit: line.source === "PROJECT_LOCAL" ? line.snapshot_usage_unit : null,
            recipe_purchase_unit: line.source === "PROJECT_LOCAL" ? line.snapshot_purchase_unit : null,
            recipe_conversion: line.source === "PROJECT_LOCAL" ? line.snapshot_conversion : null,
            recipe_price: line.source === "PROJECT_LOCAL" ? line.snapshot_price : null,
            recipe_currency: line.source === "PROJECT_LOCAL" ? line.snapshot_currency : null,
            recipe_default_waste_pct: line.source === "PROJECT_LOCAL" ? line.snapshot_material_default_waste_pct : null,
            recipe_minimum_order: line.source === "PROJECT_LOCAL" ? line.snapshot_minimum_order : null,
            recipe_rounding_increment: line.source === "PROJECT_LOCAL" ? line.snapshot_rounding_increment : null,
            qty_per_sub: line.qty_per_sub,
            waste_override_pct: line.waste_override_pct,
            notes: line.notes,
            sort_order: line.sort_order,
          },
        });
      }

      for (const line of sub.service_lines) {
        await tx.bqLibraryServiceLine.create({
          data: {
            sub_object_of_object_id: libSub.id,
            source: line.source,
            work_price_id: line.work_price_id,
            recipe_name: line.source === "PROJECT_LOCAL" ? line.snapshot_name : null,
            recipe_code: line.source === "PROJECT_LOCAL" ? line.snapshot_code : null,
            recipe_vendor_name: line.source === "PROJECT_LOCAL" ? line.snapshot_vendor_name : null,
            recipe_rate_unit: line.source === "PROJECT_LOCAL" ? line.snapshot_rate_unit : null,
            recipe_price: line.source === "PROJECT_LOCAL" ? line.snapshot_price : null,
            recipe_currency: line.source === "PROJECT_LOCAL" ? line.snapshot_currency : null,
            recipe_scope_note: line.source === "PROJECT_LOCAL" ? line.snapshot_scope_note : null,
            recipe_has_material: line.source === "PROJECT_LOCAL" ? line.snapshot_has_material : null,
            qty_per_sub: line.qty_per_sub,
            notes: line.notes,
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
          source: line.source,
          sku_id: line.sku_id,
          recipe_name: line.source === "PROJECT_LOCAL" ? line.snapshot_name : null,
          recipe_code: line.source === "PROJECT_LOCAL" ? line.snapshot_code : null,
          recipe_brand_name: line.source === "PROJECT_LOCAL" ? line.snapshot_brand_name : null,
          recipe_supplier_name: line.source === "PROJECT_LOCAL" ? line.snapshot_supplier_name : null,
          recipe_usage_unit: line.source === "PROJECT_LOCAL" ? line.snapshot_usage_unit : null,
          recipe_purchase_unit: line.source === "PROJECT_LOCAL" ? line.snapshot_purchase_unit : null,
          recipe_conversion: line.source === "PROJECT_LOCAL" ? line.snapshot_conversion : null,
          recipe_price: line.source === "PROJECT_LOCAL" ? line.snapshot_price : null,
          recipe_currency: line.source === "PROJECT_LOCAL" ? line.snapshot_currency : null,
          recipe_default_waste_pct: line.source === "PROJECT_LOCAL" ? line.snapshot_material_default_waste_pct : null,
          recipe_minimum_order: line.source === "PROJECT_LOCAL" ? line.snapshot_minimum_order : null,
          recipe_rounding_increment: line.source === "PROJECT_LOCAL" ? line.snapshot_rounding_increment : null,
          qty_per_sub: line.qty_per_sub,
          waste_override_pct: line.waste_override_pct,
          notes: line.notes,
          sort_order: line.sort_order,
        },
      });
    }

    for (const line of sub.service_lines) {
      await tx.bqLibraryServiceLine.create({
        data: {
          sub_object_id: libSub.id,
          source: line.source,
          work_price_id: line.work_price_id,
          recipe_name: line.source === "PROJECT_LOCAL" ? line.snapshot_name : null,
          recipe_code: line.source === "PROJECT_LOCAL" ? line.snapshot_code : null,
          recipe_vendor_name: line.source === "PROJECT_LOCAL" ? line.snapshot_vendor_name : null,
          recipe_rate_unit: line.source === "PROJECT_LOCAL" ? line.snapshot_rate_unit : null,
          recipe_price: line.source === "PROJECT_LOCAL" ? line.snapshot_price : null,
          recipe_currency: line.source === "PROJECT_LOCAL" ? line.snapshot_currency : null,
          recipe_scope_note: line.source === "PROJECT_LOCAL" ? line.snapshot_scope_note : null,
          recipe_has_material: line.source === "PROJECT_LOCAL" ? line.snapshot_has_material : null,
          qty_per_sub: line.qty_per_sub,
          notes: line.notes,
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
      if (m.source === "PROJECT_LOCAL") {
        if (!m.recipe_name || m.recipe_price === null || !m.recipe_usage_unit) {
          throw new ActionError("This local material recipe is incomplete.", "INVALID_LIBRARY");
        }
        const siblings = await tx.bqMaterialLine.findMany({ where: { sub_object_id: input.targetSubObjectId }, select: { sort_order: true } });
        await tx.bqMaterialLine.create({
          data: {
            sub_object_id: input.targetSubObjectId,
            source: "PROJECT_LOCAL",
            sku_id: null,
            sku_price_id: null,
            supplier_party_id: null,
            qty_per_sub: m.qty_per_sub,
            waste_override_pct: m.waste_override_pct,
            snapshot_name: m.recipe_name,
            snapshot_code: m.recipe_code,
            snapshot_brand_name: m.recipe_brand_name,
            snapshot_supplier_name: m.recipe_supplier_name,
            snapshot_usage_unit: m.recipe_usage_unit,
            snapshot_purchase_unit: m.recipe_purchase_unit,
            snapshot_conversion: m.recipe_conversion,
            snapshot_price: m.recipe_price,
            snapshot_currency: m.recipe_currency ?? "IDR",
            snapshot_material_default_waste_pct: m.recipe_default_waste_pct,
            snapshot_category_default_waste_pct: null,
            snapshot_minimum_order: m.recipe_minimum_order,
            snapshot_rounding_increment: m.recipe_rounding_increment ?? 1,
            snapshot_taken_at: new Date(),
            sort_order: siblings.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1,
            notes: m.notes,
            updated_by_name: ctx.user.name ?? null,
          },
        });
        continue;
      }
      if (!m.sku_id) throw new ActionError("This Master Data recipe has no SKU reference.", "INVALID_LIBRARY");
      const candidate = await loadMaterialCandidate(m.sku_id, tx);
      if (!candidate?.readiness.ok || !candidate.price) {
        throw new ActionError("This Master Data material is no longer ready for BQ.", "INVALID_LIBRARY");
      }
      const profile = candidate.profile;
      const price = candidate.price;

      const siblings = await tx.bqMaterialLine.findMany({
        where: { sub_object_id: input.targetSubObjectId },
        select: { sort_order: true },
      });
      const nextSort = siblings.reduce((max, s) => Math.max(max, s.sort_order), -1) + 1;

      await tx.bqMaterialLine.create({
        data: {
          sub_object_id: input.targetSubObjectId,
          sku_id: candidate.skuId,
          sku_price_id: price.skuPriceId,
          supplier_party_id: price.supplierPartyId,
          qty_per_sub: m.qty_per_sub,
          waste_override_pct: m.waste_override_pct,
          snapshot_name: candidate.name,
          snapshot_code: candidate.code,
          snapshot_brand_name: candidate.brandName,
          snapshot_category_path: candidate.categoryPath,
          snapshot_supplier_name: price.supplierName,
          snapshot_usage_unit: profile?.usageUnit ?? null,
          snapshot_purchase_unit: profile?.purchaseUnit ?? null,
          snapshot_conversion: profile?.conversion ?? null,
          snapshot_price: price.price,
          snapshot_currency: price.currency,
          snapshot_material_default_waste_pct: profile?.defaultWastePct ?? null,
          snapshot_category_default_waste_pct: null,
          snapshot_minimum_order: profile?.minimumOrder ?? null,
          snapshot_rounding_increment: profile?.roundingIncrement ?? 1,
          snapshot_price_valid_from: new Date(price.validFrom),
          snapshot_taken_at: new Date(),
          sort_order: nextSort,
          notes: null,
          updated_by_name: ctx.user.name ?? null,
        },
      });
    }

    // Pour service lines
    for (const s of libSub.services) {
      if (s.source === "PROJECT_LOCAL") {
        if (!s.recipe_name || !s.recipe_rate_unit || s.recipe_price === null) {
          throw new ActionError("This local service recipe is incomplete.", "INVALID_LIBRARY");
        }
        const siblings = await tx.bqServiceLine.findMany({ where: { sub_object_id: input.targetSubObjectId }, select: { sort_order: true } });
        await tx.bqServiceLine.create({
          data: {
            sub_object_id: input.targetSubObjectId,
            source: "PROJECT_LOCAL",
            work_price_id: null,
            vendor_party_id: null,
            qty_per_sub: s.qty_per_sub,
            snapshot_name: s.recipe_name,
            snapshot_code: s.recipe_code,
            snapshot_vendor_name: s.recipe_vendor_name,
            snapshot_rate_unit: s.recipe_rate_unit,
            snapshot_price: s.recipe_price,
            snapshot_currency: s.recipe_currency ?? "IDR",
            snapshot_scope_note: s.recipe_scope_note,
            snapshot_has_material: s.recipe_has_material ?? false,
            snapshot_taken_at: new Date(),
            sort_order: siblings.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1,
            notes: s.notes,
            updated_by_name: ctx.user.name ?? null,
          },
        });
        continue;
      }
      if (!s.work_price_id) throw new ActionError("This Master Data recipe has no service reference.", "INVALID_LIBRARY");
      const candidate = await loadServiceCandidate(s.work_price_id, tx);
      if (!candidate) throw new ActionError("This Master Data service is no longer active.", "INVALID_LIBRARY");

      const siblings = await tx.bqServiceLine.findMany({
        where: { sub_object_id: input.targetSubObjectId },
        select: { sort_order: true },
      });
      const nextSort = siblings.reduce((max, sl) => Math.max(max, sl.sort_order), -1) + 1;

      await tx.bqServiceLine.create({
        data: {
          sub_object_id: input.targetSubObjectId,
          work_price_id: candidate.workPriceId,
          qty_per_sub: s.qty_per_sub,
          snapshot_name: candidate.name,
          snapshot_code: candidate.code,
          snapshot_category_path: candidate.categoryPath,
          snapshot_vendor_name: candidate.vendorName,
          snapshot_rate_unit: candidate.rateUnit,
          snapshot_price: candidate.price,
          snapshot_currency: candidate.currency,
          snapshot_scope_note: candidate.scopeNote,
          snapshot_has_material: candidate.hasMaterial,
          snapshot_price_valid_from: new Date(candidate.validFrom),
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
      if (m.source === "PROJECT_LOCAL") {
        if (!m.recipe_name || m.recipe_price === null || !m.recipe_usage_unit) {
          throw new ActionError("This local material recipe is incomplete.", "INVALID_LIBRARY");
        }
        const siblings = await tx.bqMaterialLine.findMany({ where: { sub_object_id: input.targetSubObjectId }, select: { sort_order: true } });
        await tx.bqMaterialLine.create({
          data: {
            sub_object_id: input.targetSubObjectId,
            source: "PROJECT_LOCAL",
            sku_id: null,
            sku_price_id: null,
            supplier_party_id: null,
            qty_per_sub: m.qty_per_sub,
            waste_override_pct: m.waste_override_pct,
            snapshot_name: m.recipe_name,
            snapshot_code: m.recipe_code,
            snapshot_brand_name: m.recipe_brand_name,
            snapshot_supplier_name: m.recipe_supplier_name,
            snapshot_usage_unit: m.recipe_usage_unit,
            snapshot_purchase_unit: m.recipe_purchase_unit,
            snapshot_conversion: m.recipe_conversion,
            snapshot_price: m.recipe_price,
            snapshot_currency: m.recipe_currency ?? "IDR",
            snapshot_material_default_waste_pct: m.recipe_default_waste_pct,
            snapshot_category_default_waste_pct: null,
            snapshot_minimum_order: m.recipe_minimum_order,
            snapshot_rounding_increment: m.recipe_rounding_increment ?? 1,
            snapshot_taken_at: new Date(),
            sort_order: siblings.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1,
            notes: m.notes,
            updated_by_name: ctx.user.name ?? null,
          },
        });
        continue;
      }
      if (!m.sku_id) throw new ActionError("This Master Data recipe has no SKU reference.", "INVALID_LIBRARY");
      const candidate = await loadMaterialCandidate(m.sku_id, tx);
      if (!candidate?.readiness.ok || !candidate.price) {
        throw new ActionError("This Master Data material is no longer ready for BQ.", "INVALID_LIBRARY");
      }
      const profile = candidate.profile;
      const price = candidate.price;

      const siblings = await tx.bqMaterialLine.findMany({
        where: { sub_object_id: input.targetSubObjectId },
        select: { sort_order: true },
      });
      const nextSort = siblings.reduce((max, s) => Math.max(max, s.sort_order), -1) + 1;

      await tx.bqMaterialLine.create({
        data: {
          sub_object_id: input.targetSubObjectId,
          sku_id: candidate.skuId,
          sku_price_id: price.skuPriceId,
          supplier_party_id: price.supplierPartyId,
          qty_per_sub: m.qty_per_sub,
          waste_override_pct: m.waste_override_pct,
          snapshot_name: candidate.name,
          snapshot_code: candidate.code,
          snapshot_brand_name: candidate.brandName,
          snapshot_category_path: candidate.categoryPath,
          snapshot_supplier_name: price.supplierName,
          snapshot_usage_unit: profile?.usageUnit ?? null,
          snapshot_purchase_unit: profile?.purchaseUnit ?? null,
          snapshot_conversion: profile?.conversion ?? null,
          snapshot_price: price.price,
          snapshot_currency: price.currency,
          snapshot_material_default_waste_pct: profile?.defaultWastePct ?? null,
          snapshot_category_default_waste_pct: null,
          snapshot_minimum_order: profile?.minimumOrder ?? null,
          snapshot_rounding_increment: profile?.roundingIncrement ?? 1,
          snapshot_price_valid_from: new Date(price.validFrom),
          snapshot_taken_at: new Date(),
          sort_order: nextSort,
          notes: null,
          updated_by_name: ctx.user.name ?? null,
        },
      });
    }

    // Pour service lines
    for (const s of libSub.services) {
      if (s.source === "PROJECT_LOCAL") {
        if (!s.recipe_name || !s.recipe_rate_unit || s.recipe_price === null) {
          throw new ActionError("This local service recipe is incomplete.", "INVALID_LIBRARY");
        }
        const siblings = await tx.bqServiceLine.findMany({ where: { sub_object_id: input.targetSubObjectId }, select: { sort_order: true } });
        await tx.bqServiceLine.create({
          data: {
            sub_object_id: input.targetSubObjectId,
            source: "PROJECT_LOCAL",
            work_price_id: null,
            vendor_party_id: null,
            qty_per_sub: s.qty_per_sub,
            snapshot_name: s.recipe_name,
            snapshot_code: s.recipe_code,
            snapshot_vendor_name: s.recipe_vendor_name,
            snapshot_rate_unit: s.recipe_rate_unit,
            snapshot_price: s.recipe_price,
            snapshot_currency: s.recipe_currency ?? "IDR",
            snapshot_scope_note: s.recipe_scope_note,
            snapshot_has_material: s.recipe_has_material ?? false,
            snapshot_taken_at: new Date(),
            sort_order: siblings.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1,
            notes: s.notes,
            updated_by_name: ctx.user.name ?? null,
          },
        });
        continue;
      }
      if (!s.work_price_id) throw new ActionError("This Master Data recipe has no service reference.", "INVALID_LIBRARY");
      const candidate = await loadServiceCandidate(s.work_price_id, tx);
      if (!candidate) throw new ActionError("This Master Data service is no longer active.", "INVALID_LIBRARY");

      const siblings = await tx.bqServiceLine.findMany({
        where: { sub_object_id: input.targetSubObjectId },
        select: { sort_order: true },
      });
      const nextSort = siblings.reduce((max, sl) => Math.max(max, sl.sort_order), -1) + 1;

      await tx.bqServiceLine.create({
        data: {
          sub_object_id: input.targetSubObjectId,
          work_price_id: candidate.workPriceId,
          qty_per_sub: s.qty_per_sub,
          snapshot_name: candidate.name,
          snapshot_code: candidate.code,
          snapshot_category_path: candidate.categoryPath,
          snapshot_vendor_name: candidate.vendorName,
          snapshot_rate_unit: candidate.rateUnit,
          snapshot_price: candidate.price,
          snapshot_currency: candidate.currency,
          snapshot_scope_note: candidate.scopeNote,
          snapshot_has_material: candidate.hasMaterial,
          snapshot_price_valid_from: new Date(candidate.validFrom),
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
