"use server";

/**
 * BQ Library — server actions for save-to-library and load-from-library.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { ActionError } from "@/lib/error-types";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import { Prisma, type BqLineSource, type Role } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { loadMaterialCandidate, loadServiceCandidate } from "../services/master-data-service";

function assertBqEditPerm(role: Role): void {
  if (!hasPermission(role, PERMISSION.BQ_BREAKDOWN_EDIT)) {
    throw new ActionError("You do not have permission to modify BQ breakdowns.", "UNAUTHORIZED_ACTION");
  }
}

function resolveLibraryMaterialPrice(
  candidate: Awaited<ReturnType<typeof loadMaterialCandidate>>,
  args: { skuPriceId?: string | null; supplierPartyId?: string | null }
) {
  if (!candidate?.readiness.ok) {
    throw new ActionError("This Master Data material is no longer ready for BQ.", "INVALID_LIBRARY");
  }

  if (args.skuPriceId) {
    const byId = candidate.priceOptions.find((option) => option.skuPriceId === args.skuPriceId);
    if (byId) return byId;
  }

  if (args.supplierPartyId !== undefined && args.supplierPartyId !== null) {
    const bySupplier = candidate.priceOptions.find(
      (option) => option.supplierPartyId === args.supplierPartyId
    );
    if (bySupplier) return bySupplier;
  }

  if (candidate.priceOptions.length === 1) {
    return candidate.priceOptions[0];
  }

  throw new ActionError(
    "This library recipe no longer identifies one supplier price unambiguously. Re-save it from a current BQ line.",
    "INVALID_LIBRARY"
  );
}

// ---------------------------------------------------------------------------
// Save to library — from object
/**
 * Pemetaan baris project -> baris resep library.
 *
 * Diangkat jadi fungsi 2026-08-27 karena pemetaan yang sama kini dipakai DUA
 * kali: baris yang menempel langsung di Works (bentuk yang berlaku) dan baris
 * di dalam sub-object (jalur warisan). Menyalinnya dua kali berarti dua daftar
 * ~15 field yang harus ikut berubah bersamaan setiap kali skema snapshot
 * bergeser — dan yang satu pasti tertinggal.
 *
 * Field `recipe_*` hanya diisi untuk baris `PROJECT_LOCAL`: baris yang menunjuk
 * master data cukup membawa id-nya, karena harga dibekukan ulang saat resep
 * dituang ke project (PRD-BQ §5.1).
 */
function materialRecipeData(line: {
  source: BqLineSource;
  sku_id: string | null;
  sku_price_id: string | null;
  supplier_party_id: string | null;
  snapshot_name: string;
  snapshot_code: string | null;
  snapshot_brand_name: string | null;
  snapshot_supplier_name: string | null;
  snapshot_usage_unit: string | null;
  snapshot_purchase_unit: string | null;
  snapshot_conversion: Prisma.Decimal | null;
  snapshot_price: Prisma.Decimal;
  snapshot_currency: string;
  snapshot_material_default_waste_pct: Prisma.Decimal | null;
  snapshot_minimum_order: Prisma.Decimal | null;
  snapshot_rounding_increment: Prisma.Decimal;
  qty_per_sub: Prisma.Decimal;
  waste_override_pct: Prisma.Decimal | null;
  notes: string | null;
  sort_order: number;
}) {
  const local = line.source === "PROJECT_LOCAL";
  return {
    source: line.source,
    sku_id: line.sku_id,
    sku_price_id: line.sku_price_id,
    supplier_party_id: line.supplier_party_id,
    recipe_name: local ? line.snapshot_name : null,
    recipe_code: local ? line.snapshot_code : null,
    recipe_brand_name: local ? line.snapshot_brand_name : null,
    recipe_supplier_name: local ? line.snapshot_supplier_name : null,
    recipe_usage_unit: local ? line.snapshot_usage_unit : null,
    recipe_purchase_unit: local ? line.snapshot_purchase_unit : null,
    recipe_conversion: local ? line.snapshot_conversion : null,
    recipe_price: local ? line.snapshot_price : null,
    recipe_currency: local ? line.snapshot_currency : null,
    recipe_default_waste_pct: local ? line.snapshot_material_default_waste_pct : null,
    recipe_minimum_order: local ? line.snapshot_minimum_order : null,
    recipe_rounding_increment: local ? line.snapshot_rounding_increment : null,
    qty_per_sub: line.qty_per_sub,
    waste_override_pct: line.waste_override_pct,
    notes: line.notes,
    sort_order: line.sort_order,
  };
}

function serviceRecipeData(line: {
  source: BqLineSource;
  work_price_id: string | null;
  snapshot_name: string;
  snapshot_code: string | null;
  snapshot_vendor_name: string | null;
  snapshot_rate_unit: string;
  snapshot_price: Prisma.Decimal;
  snapshot_currency: string;
  snapshot_scope_note: string | null;
  snapshot_has_material: boolean;
  qty_per_sub: Prisma.Decimal;
  notes: string | null;
  sort_order: number;
}) {
  const local = line.source === "PROJECT_LOCAL";
  return {
    source: line.source,
    work_price_id: line.work_price_id,
    recipe_name: local ? line.snapshot_name : null,
    recipe_code: local ? line.snapshot_code : null,
    recipe_vendor_name: local ? line.snapshot_vendor_name : null,
    recipe_rate_unit: local ? line.snapshot_rate_unit : null,
    recipe_price: local ? line.snapshot_price : null,
    recipe_currency: local ? line.snapshot_currency : null,
    recipe_scope_note: local ? line.snapshot_scope_note : null,
    recipe_has_material: local ? line.snapshot_has_material : null,
    qty_per_sub: line.qty_per_sub,
    notes: line.notes,
    sort_order: line.sort_order,
  };
}

// ---------------------------------------------------------------------------

export const saveObjectToLibraryAction = createAction(
  async ({ input, ctx, tx }) => {
    assertBqEditPerm(ctx.role);

    // Load the full object with all sub-objects and lines
    const object = await tx.bqObject.findFirst({
      where: { id: input.objectId, deleted_at: null },
      include: {
        // Baris yang menempel LANGSUNG di Works — bentuk yang berlaku sejak
        // `BqSubObject` dipensiunkan. Sebelum 2026-08-27 dua baris ini tidak
        // ada, sehingga resep tersimpan sebagai cangkang kosong tanpa satu pun
        // peringatan: seluruh isi Works modern diabaikan diam-diam.
        material_lines: { orderBy: [{ sort_order: "asc" }] },
        service_lines: { orderBy: [{ sort_order: "asc" }] },
        // Jalur warisan — resep lama yang isinya lewat sub-object.
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
    if (
      object.material_lines.length === 0 &&
      object.service_lines.length === 0 &&
      object.sub_objects.length === 0
    ) {
      throw new ActionError(
        "This work item has no lines yet — there is nothing to save as a recipe.",
        "VALIDATION_ERROR",
      );
    }

    // Create library object
    const libObject = await tx.bqLibraryObject.create({
      data: {
        code: object.code,
        name: input.name || object.name,
        unit: object.unit,
        notes: object.notes,
        created_by_name: ctx.user.name ?? "Unknown",
      },
    });

    // Baris langsung dulu — inilah isi resep pada bentuk yang berlaku.
    for (const line of object.material_lines) {
      await tx.bqLibraryMaterialLine.create({
        data: { ...materialRecipeData(line), library_object_id: libObject.id },
      });
    }
    for (const line of object.service_lines) {
      await tx.bqLibraryServiceLine.create({
        data: { ...serviceRecipeData(line), library_object_id: libObject.id },
      });
    }

    // Jalur warisan: sub-object beserta barisnya.
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
          data: { ...materialRecipeData(line), sub_object_of_object_id: libSub.id },
        });
      }

      for (const line of sub.service_lines) {
        await tx.bqLibraryServiceLine.create({
          data: { ...serviceRecipeData(line), sub_object_of_object_id: libSub.id },
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
          sku_price_id: line.sku_price_id,
          supplier_party_id: line.supplier_party_id,
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

/**
 * Menuang SATU baris resep bahan ke sebuah Works.
 *
 * Diangkat jadi fungsi 2026-08-27. Sebelumnya logika ini disalin empat kali —
 * dua cabang (PROJECT_LOCAL vs MASTER_DATA) × dua aksi tuang — dan setiap
 * penambahan kolom snapshot harus menyentuh keempatnya. Menargetkan Works,
 * bukan sub-object, karena `BqSubObject` sudah dipensiunkan (PRD-BQ §2.2).
 *
 * `qtyMultiplier` dipakai saat meratakan resep WARISAN: baris yang dulu duduk
 * di dalam sub-object membawa pengali sub-object itu, dan meratakannya tanpa
 * mengalikan qty akan diam-diam mengecilkan biaya.
 */
async function pourMaterialRecipeLine(
  tx: PrismaTransaction,
  m: {
    source: BqLineSource;
    sku_id: string | null;
    sku_price_id: string | null;
    supplier_party_id: string | null;
    recipe_name: string | null;
    recipe_code: string | null;
    recipe_brand_name: string | null;
    recipe_supplier_name: string | null;
    recipe_usage_unit: string | null;
    recipe_purchase_unit: string | null;
    recipe_conversion: Prisma.Decimal | null;
    recipe_price: Prisma.Decimal | null;
    recipe_currency: string | null;
    recipe_default_waste_pct: Prisma.Decimal | null;
    recipe_minimum_order: Prisma.Decimal | null;
    recipe_rounding_increment: Prisma.Decimal | null;
    qty_per_sub: Prisma.Decimal;
    waste_override_pct: Prisma.Decimal | null;
    notes: string | null;
  },
  objectId: string,
  qtyMultiplier: Prisma.Decimal,
  author: string | null,
) {
  const siblings = await tx.bqMaterialLine.findMany({
    where: { object_id: objectId },
    select: { sort_order: true },
  });
  const sortOrder =
    siblings.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
  const qty = m.qty_per_sub.mul(qtyMultiplier);

  if (m.source === "PROJECT_LOCAL") {
    if (!m.recipe_name || m.recipe_price === null) {
      throw new ActionError(
        "This local material recipe is incomplete.",
        "INVALID_LIBRARY",
      );
    }
    await tx.bqMaterialLine.create({
      data: {
        object_id: objectId,
        source: "PROJECT_LOCAL",
        qty_per_sub: qty,
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
        snapshot_minimum_order: m.recipe_minimum_order,
        snapshot_rounding_increment: m.recipe_rounding_increment ?? 1,
        snapshot_taken_at: new Date(),
        sort_order: sortOrder,
        notes: m.notes,
        updated_by_name: author,
      },
    });
    return;
  }

  if (!m.sku_id) {
    throw new ActionError(
      "This Master Data recipe has no SKU reference.",
      "INVALID_LIBRARY",
    );
  }
  const candidate = await loadMaterialCandidate(m.sku_id, tx);
  if (!candidate) {
    throw new ActionError(
      "This Master Data material no longer exists.",
      "INVALID_LIBRARY",
    );
  }
  // Harga dibekukan ULANG di sini, dari master data saat ini — library cuma
  // menunjuk (PRD-BQ §5.1).
  const price = resolveLibraryMaterialPrice(candidate, {
    skuPriceId: m.sku_price_id,
    supplierPartyId: m.supplier_party_id,
  });

  await tx.bqMaterialLine.create({
    data: {
      object_id: objectId,
      sku_id: candidate.skuId,
      sku_price_id: price.skuPriceId,
      supplier_party_id: price.supplierPartyId,
      qty_per_sub: qty,
      waste_override_pct: m.waste_override_pct,
      snapshot_name: candidate.name,
      snapshot_code: candidate.code,
      snapshot_brand_name: candidate.brandName,
      snapshot_category_path: candidate.categoryPath,
      snapshot_supplier_name: price.supplierName,
      snapshot_usage_unit: price.unit,
      snapshot_purchase_unit: price.unit,
      snapshot_price: price.price,
      snapshot_currency: price.currency,
      snapshot_rounding_increment: 1,
      snapshot_taken_at: new Date(),
      sort_order: sortOrder,
      updated_by_name: author,
    },
  });
}

/** Kembaran `pourMaterialRecipeLine` untuk baris jasa. */
async function pourServiceRecipeLine(
  tx: PrismaTransaction,
  s: {
    source: BqLineSource;
    work_price_id: string | null;
    recipe_name: string | null;
    recipe_code: string | null;
    recipe_vendor_name: string | null;
    recipe_rate_unit: string | null;
    recipe_price: Prisma.Decimal | null;
    recipe_currency: string | null;
    recipe_scope_note: string | null;
    recipe_has_material: boolean | null;
    qty_per_sub: Prisma.Decimal;
    notes: string | null;
  },
  objectId: string,
  qtyMultiplier: Prisma.Decimal,
  author: string | null,
) {
  const siblings = await tx.bqServiceLine.findMany({
    where: { object_id: objectId },
    select: { sort_order: true },
  });
  const sortOrder =
    siblings.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1;
  const qty = s.qty_per_sub.mul(qtyMultiplier);

  if (s.source === "PROJECT_LOCAL") {
    if (!s.recipe_name || !s.recipe_rate_unit || s.recipe_price === null) {
      throw new ActionError(
        "This local service recipe is incomplete.",
        "INVALID_LIBRARY",
      );
    }
    await tx.bqServiceLine.create({
      data: {
        object_id: objectId,
        source: "PROJECT_LOCAL",
        qty_per_sub: qty,
        snapshot_name: s.recipe_name,
        snapshot_code: s.recipe_code,
        snapshot_vendor_name: s.recipe_vendor_name,
        snapshot_rate_unit: s.recipe_rate_unit,
        snapshot_price: s.recipe_price,
        snapshot_currency: s.recipe_currency ?? "IDR",
        snapshot_scope_note: s.recipe_scope_note,
        snapshot_has_material: s.recipe_has_material ?? false,
        snapshot_taken_at: new Date(),
        sort_order: sortOrder,
        notes: s.notes,
        updated_by_name: author,
      },
    });
    return;
  }

  if (!s.work_price_id) {
    throw new ActionError(
      "This Master Data recipe has no service reference.",
      "INVALID_LIBRARY",
    );
  }
  const candidate = await loadServiceCandidate(s.work_price_id, tx);
  if (!candidate) {
    throw new ActionError(
      "This Master Data service is no longer active.",
      "INVALID_LIBRARY",
    );
  }

  await tx.bqServiceLine.create({
    data: {
      object_id: objectId,
      work_price_id: candidate.workPriceId,
      qty_per_sub: qty,
      snapshot_name: candidate.name,
      snapshot_code: candidate.code,
      snapshot_category_path: candidate.categoryPath,
      snapshot_vendor_name: candidate.vendorName,
      snapshot_rate_unit: candidate.rateUnit,
      snapshot_price: candidate.price,
      snapshot_currency: candidate.currency,
      snapshot_scope_note: candidate.scopeNote,
      snapshot_has_material: candidate.hasMaterial,
      snapshot_taken_at: new Date(),
      sort_order: sortOrder,
      updated_by_name: author,
    },
  });
}

/**
 * Menuang seluruh isi resep Works ke sebuah Works di project.
 *
 * Dua sumber baris digabung:
 *   - baris LANGSUNG milik resep — bentuk yang berlaku
 *   - baris di dalam sub-object — resep warisan, DIRATAKAN dengan mengalikan
 *     qty-nya dengan pengali sub-object itu
 *
 * Meratakan warisan disengaja: `BqSubObject` sudah dipensiunkan, jadi menuang
 * resep lama ke dalam bentuk lama akan menghidupkannya kembali.
 */
async function pourLibraryObject(
  tx: PrismaTransaction,
  libraryObjectId: string,
  targetObjectId: string,
  author: string | null,
) {
  const lib = await tx.bqLibraryObject.findFirst({
    where: { id: libraryObjectId, deleted_at: null },
    include: {
      materials: { orderBy: [{ sort_order: "asc" }] },
      services: { orderBy: [{ sort_order: "asc" }] },
      sub_objects: {
        orderBy: [{ sort_order: "asc" }],
        include: {
          materials: { orderBy: [{ sort_order: "asc" }] },
          services: { orderBy: [{ sort_order: "asc" }] },
        },
      },
    },
  });
  if (!lib) throw new ActionError("Library recipe not found.", "NOT_FOUND");

  const one = new Prisma.Decimal(1);
  for (const m of lib.materials) {
    await pourMaterialRecipeLine(tx, m, targetObjectId, one, author);
  }
  for (const s of lib.services) {
    await pourServiceRecipeLine(tx, s, targetObjectId, one, author);
  }
  for (const sub of lib.sub_objects) {
    for (const m of sub.materials) {
      await pourMaterialRecipeLine(tx, m, targetObjectId, sub.qty, author);
    }
    for (const s of sub.services) {
      await pourServiceRecipeLine(tx, s, targetObjectId, sub.qty, author);
    }
  }
  return lib;
}

/** Menuang resep Library ke Works yang SUDAH ADA. */
export const loadFromLibraryObjectAction = createAction(
  async ({ input, ctx, tx }) => {
    assertBqEditPerm(ctx.role);

    const target = await tx.bqObject.findFirst({
      where: { id: input.targetObjectId, deleted_at: null },
      select: { id: true },
    });
    if (!target) throw new ActionError("Target work item not found.", "NOT_FOUND");

    await pourLibraryObject(tx, input.libraryObjectId, target.id, ctx.user.name ?? null);

    revalidatePath("/bq");
    return { ok: true };
  },
  {
    schema: z.object({
      libraryObjectId: z.string().min(1),
      targetObjectId: z.string().min(1),
    }),
  }
);

/**
 * Membuat Works BARU di sebuah Section dari resep Library.
 *
 * Jalur yang dipakai `CreatableSearch` saat menambah pekerjaan: satu pilihan,
 * satu Works lengkap dengan barisnya. Nama dan satuan ikut dari resep, jadi
 * estimator tidak perlu mengetik ulang apa yang sudah tersimpan.
 */
export const createBqObjectFromLibraryAction = createAction(
  async ({ input, ctx, tx }) => {
    assertBqEditPerm(ctx.role);

    const lib = await tx.bqLibraryObject.findFirst({
      where: { id: input.libraryObjectId, deleted_at: null },
      select: { id: true, name: true, unit: true, code: true, notes: true },
    });
    if (!lib) throw new ActionError("Library recipe not found.", "NOT_FOUND");

    const siblings = await tx.bqObject.findMany({
      where: { project_id: input.projectId, deleted_at: null },
      select: { sort_order: true },
    });

    const object = await tx.bqObject.create({
      data: {
        project_id: input.projectId,
        section_id: input.sectionId ?? null,
        name: input.name?.trim() || lib.name,
        code: lib.code,
        unit: lib.unit,
        qty: 1,
        notes: lib.notes,
        sort_order:
          siblings.reduce((max, row) => Math.max(max, row.sort_order), -1) + 1,
        updated_by_name: ctx.user.name ?? null,
      },
    });

    await pourLibraryObject(tx, lib.id, object.id, ctx.user.name ?? null);

    revalidatePath("/bq");
    return { id: object.id };
  },
  {
    schema: z.object({
      projectId: z.string().min(1),
      sectionId: z.string().min(1).optional(),
      libraryObjectId: z.string().min(1),
      name: z.string().optional(),
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
      if (!candidate) throw new ActionError("This Master Data material no longer exists.", "INVALID_LIBRARY");
      const price = resolveLibraryMaterialPrice(candidate, {
        skuPriceId: m.sku_price_id,
        supplierPartyId: m.supplier_party_id,
      });

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
          snapshot_usage_unit: price.unit,
          snapshot_purchase_unit: price.unit,
          snapshot_conversion: null,
          snapshot_price: price.price,
          snapshot_currency: price.currency,
          snapshot_material_default_waste_pct: null,
          snapshot_category_default_waste_pct: null,
          snapshot_minimum_order: null,
          snapshot_rounding_increment: 1,
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
          sku_price_id: line.sku_price_id,
          supplier_party_id: line.supplier_party_id,
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
