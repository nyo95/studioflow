"use server";

/**
 * MASTER DATA — physical sample library.
 *
 * The office shelf, as data: which rack, which box, is it here or lent out.
 *
 * A Sample carries only `sku_id`. Brand, category and price all join
 * through the Sku, so none of them are stored twice.
 *
 * Rack and box are free text, normalised on write (see `normaliseLocation`).
 *
 * Reads require MASTERDATA_VIEW. Writes require LIBRARY_MANAGE_SAMPLES.
 */

import { z } from "zod";
import { SampleAction, SampleStatus } from "@/generated/prisma";
import { trimOrNull } from "@/core/utilities/normalize";
import { createAction } from "@/lib/action-wrapper";
import { PERMISSION } from "@/core/rbac/constants";
import { hasPermission } from "@/core/rbac/guards";
import { ActionError } from "@/lib/error-types";
import { recordAudit } from "../services/audit-service";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_LIBRARY } from "@/lib/revalidation-tags";
import { normaliseLocation } from "../lib/sample-location";
import { CatalogSampleService } from "../services/catalog-sample-service";
import type { PrismaTransaction } from "@/types/common";
import { sampleStatusNeedsHolder } from "../types/sample";
import type {
  SampleData,
  SampleInput,
  SampleLibrarySummary,
  SampleStatusInput,
  SampleStatusValue,
} from "../types/sample";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const SampleInputSchema = z.object({
  skuId: z.string().min(1, "Select a material"),
  rackNumber: z.string().min(1, "Rack number is required"),
  boxNumber: z.string().min(1, "Box number is required"),
  locationNote: z.string().default(""),
  quantity: z.coerce.number().int().min(1, "Jumlah minimal 1").default(1),
  notes: z.string().default(""),
});

const SampleStatusInputSchema = z.object({
  sampleId: z.string().min(1),
  status: z.enum(["AVAILABLE", "BORROWED", "SENT_TO_CLIENT", "LOST", "DISCARDED"]),
  borrowerName: z.string().default(""),
  notes: z.string().default(""),
});

const IdSchema = z.object({ sampleId: z.string().min(1) });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SAMPLE_INCLUDE = {
  sku: {
    include: {
      brand: {
        select: {
          id: true,
          name: true,
          owner: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const;

/**
 * DIHAPUS 2026-08-18 — `toLegacySampleStatus` / `toV2SampleStatus`.
 *
 * Keduanya adalah kompensasi untuk satu hal: enum di `schema.prisma` tertinggal
 * dari enum di database (migrasi 20260812120000 menambah SENT_TO_CLIENT, berkas
 * schema-nya tidak ikut). Selama itu, pemetaan "apa pun selain AVAILABLE adalah
 * BORROWED" membuat SENT_TO_CLIENT tak pernah tersimpan DAN membuat LOST /
 * DISCARDED terbaca "Dipinjam".
 *
 * Sekarang schema sudah sama dengan database, jadi tidak ada yang perlu
 * dipetakan: `SampleStatus` dan `SampleStatusValue` punya lima nilai yang sama
 * persis, dan status ditampilkan apa adanya. Jangan menambahkan pemetaan baru
 * di sini — kalau UI butuh nilai yang database tidak punya, yang salah adalah
 * salah satu dari keduanya, bukan kekurangan fungsi penerjemah.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapSample(s: any): SampleData {
  const sku = s.sku ?? {};
  const brand = sku.brand ?? null;
  const spec = (sku.spec ?? {}) as Record<string, unknown>;
  return {
    id: s.id,

    rackNumber: s.rack_number,
    boxNumber: s.box_number,
    locationNote: s.location_note,
    quantity: s.quantity,

    status: s.status as SampleStatusValue,
    borrowerName: s.borrower_name,
    borrowedAt: s.borrowed_at,

    notes: s.notes,

    skuId: s.sku_id,
    skuCode: sku.code ?? "—",
    skuProductName: sku.name ?? "—",
    skuColor: typeof spec.color === "string" ? spec.color : null,
    skuMotif: typeof spec.motif === "string" ? spec.motif : null,
    skuFinishing: typeof spec.finishing === "string" ? spec.finishing : null,

    brandId: brand?.id ?? null,
    brandName: brand?.name ?? null,
    companyName: brand?.owner?.name ?? null,

    createdAt: s.created_at,
    updatedAt: s.updated_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Movement logging is kept even though the UI does not surface a history
 * screen: the rows cost nothing to write and are impossible to reconstruct
 * later. If a history view is ever wanted, the data will already be there.
 */
async function logMovement(
  tx: PrismaTransaction,
  args: {
    sampleId: string;
    action: SampleAction;
    userId: string;
    notes?: string | null;
    takenBy?: string;
  }
) {
  return CatalogSampleService.logSampleAction(tx, {
    sample_id: args.sampleId,
    action: args.action,
    userId: args.userId,
    notes: args.notes ?? null,
    taken_by: args.takenBy,
  });
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * The whole shelf, ordered by physical position so the list reads like a walk
 * along the rack rather than an arbitrary database order.
 */
export const getSamplesAction = createAction<undefined, SampleData[]>(
  async ({ ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const rows = await tx.sample.findMany({
      where: { deleted_at: null },
      include: SAMPLE_INCLUDE,
      orderBy: [
        { rack_number: "asc" },
        { box_number: "asc" },
      ],
    });
    return rows.map(mapSample);
  },
  { useTransaction: false }
);

/** Counts for the header strip. Derived, never stored. */
export const getSampleSummaryAction = createAction<undefined, SampleLibrarySummary>(
  async ({ ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const rows = await tx.sample.findMany({
      where: { deleted_at: null },
      select: { status: true, rack_number: true },
    });
    // Dihitung per nilai, bukan sebagai "sisanya". `borrowed` dulu berbunyi
    // `status !== "AVAILABLE"`, yang menyerap SENT_TO_CLIENT, LOST dan
    // DISCARDED ke dalam satu angka bernama "Dipinjam" — angka yang lebih
    // besar dari kenyataan pada satu-satunya tempat staf mengeceknya.
    const count = (s: SampleStatus) => rows.filter((r) => r.status === s).length;
    return {
      total: rows.length,
      available: count(SampleStatus.AVAILABLE),
      borrowed: count(SampleStatus.BORROWED),
      sentToClient: count(SampleStatus.SENT_TO_CLIENT),
      offShelf: count(SampleStatus.LOST) + count(SampleStatus.DISCARDED),
      rackCount: new Set(rows.map((r) => r.rack_number)).size,
    };
  },
  { useTransaction: false }
);

/**
 * Materials that can receive a new sample — the picker source for the add form.
 * Returns identity only; the form has no use for prices or samples.
 */
export const getSampleSkuOptionsAction = createAction<
  undefined,
  { id: string; sku: string; productName: string; brandId: string | null; brandName: string | null }[]
>(
  async ({ ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.MASTERDATA_VIEW)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    const rows = await tx.sku.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        code: true,
        name: true,
        brand: { select: { id: true, name: true } },
      },
      orderBy: [{ name: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      sku: r.code ?? "",
      productName: r.name,
      brandId: r.brand?.id ?? null,
      brandName: r.brand?.name ?? null,
    }));
  },
  { useTransaction: false }
);

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Racks a sample that did not come through a request — a vendor dropping off a
 * sample book, or backfilling the shelf that already exists.
 */
export const createSampleAction = createAction<SampleInput, SampleData>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_SAMPLES)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const sku = await tx.sku.findUnique({ where: { id: input.skuId } });
    if (!sku || sku.deleted_at) {
      throw new ActionError("Material not found", "NOT_FOUND");
    }

    const created = await tx.sample.create({
      data: {
        sku_id: input.skuId,
        rack_number: normaliseLocation(input.rackNumber),
        box_number: normaliseLocation(input.boxNumber),
        location_note: trimOrNull(input.locationNote),
        quantity: Number(input.quantity) || 1,
        notes: trimOrNull(input.notes),
        status: SampleStatus.AVAILABLE,
      },
      include: SAMPLE_INCLUDE,
    });

    await logMovement(tx, {
      sampleId: created.id,
      action: SampleAction.IN,
      userId: ctx.userId,
      notes: `Masuk rak ${created.rack_number} box ${created.box_number}`,
    });

    await recordAudit(tx, {
      entity: "Sample",
      entity_id: created.id,
      action: "CREATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "" },
      changes: { sku_id: input.skuId, rack: created.rack_number, box: created.box_number },
    });

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return mapSample(created);
  },
  { schema: SampleInputSchema }
);

/**
 * Edits the shelf address, quantity or notes.
 */
export const updateSampleAction = createAction<
  { sampleId: string; data: Omit<SampleInput, "skuId"> },
  SampleData
>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_SAMPLES)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const existing = await tx.sample.findUnique({ where: { id: input.sampleId } });
    if (!existing || existing.deleted_at) {
      throw new ActionError("Sample not found", "NOT_FOUND");
    }

    const rack = normaliseLocation(input.data.rackNumber);
    const box = normaliseLocation(input.data.boxNumber);
    const moved =
      rack !== existing.rack_number || box !== existing.box_number;

    const updated = await tx.sample.update({
      where: { id: input.sampleId },
      data: {
        rack_number: rack,
        box_number: box,
        location_note: trimOrNull(input.data.locationNote),
        quantity: Number(input.data.quantity) || 1,
        notes: trimOrNull(input.data.notes),
      },
      include: SAMPLE_INCLUDE,
    });

    if (moved) {
      await logMovement(tx, {
        sampleId: input.sampleId,
        action: SampleAction.ADJUST,
        userId: ctx.userId,
        notes: `Pindah dari rak ${existing.rack_number} box ${existing.box_number} ke rak ${rack} box ${box}`,
      });
    }

    await recordAudit(tx, {
      entity: "Sample",
      entity_id: input.sampleId,
      action: "UPDATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "" },
      changes: { moved, rack, box },
    });

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return mapSample(updated);
  },
  {
    schema: z.object({
      sampleId: z.string().min(1),
      data: SampleInputSchema.omit({ skuId: true }),
    }),
  }
);

/**
 * Moves a sample between Tersedia / Dipinjam / Di klien.
 */
export const updateSampleStatusAction = createAction<SampleStatusInput, SampleData>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_SAMPLES)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }

    const existing = await tx.sample.findUnique({ where: { id: input.sampleId } });
    if (!existing || existing.deleted_at) {
      throw new ActionError("Sample not found", "NOT_FOUND");
    }

    const borrower = trimOrNull(input.borrowerName);
    // "Dipegang seseorang" bukan lagi "bukan AVAILABLE". LOST dan DISCARDED
    // juga bukan AVAILABLE, tetapi tidak ada yang memegangnya — menuntut nama
    // peminjam untuk menandai sample hilang adalah cara staf berhenti
    // menandainya sama sekali, dan rak berbohong pelan-pelan.
    const heldBySomeone = sampleStatusNeedsHolder(input.status);
    const onShelf = input.status === "AVAILABLE";

    if (heldBySomeone && !borrower) {
      throw new ActionError(
        "Nama pemegang wajib diisi — sample yang keluar tanpa nama adalah sample yang hilang.",
        "VALIDATION_FAILED"
      );
    }

    const updated = await tx.sample.update({
      where: { id: input.sampleId },
      data: {
        status: input.status as SampleStatus,
        borrower_name: heldBySomeone ? borrower : null,
        borrowed_at: heldBySomeone ? existing.borrowed_at ?? new Date() : null,
        due_at: null,
      },
      include: SAMPLE_INCLUDE,
    });

    await logMovement(tx, {
      sampleId: input.sampleId,
      // ADJUST, bukan OUT/RETURN, untuk LOST dan DISCARDED: benda itu tidak
      // keluar ke siapa pun dan tidak kembali ke rak. Menyebutnya OUT membuat
      // riwayat pergerakan mengaku ada serah-terima yang tidak pernah terjadi.
      action: heldBySomeone
        ? SampleAction.OUT
        : onShelf
          ? SampleAction.RETURN
          : SampleAction.ADJUST,
      userId: ctx.userId,
      takenBy: borrower ?? undefined,
      notes: trimOrNull(input.notes) ?? `Status: ${input.status}`,
    });

    await recordAudit(tx, {
      entity: "Sample",
      entity_id: input.sampleId,
      action: "UPDATE",
      actor: { id: ctx.userId, name: ctx.user.name ?? "" },
      changes: { from: existing.status, to: input.status, borrower },
    });

    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return mapSample(updated);
  },
  { schema: SampleStatusInputSchema }
);

/**
 * Soft-deletes a sample via the Master Data boundary so the
 * "cannot remove something that is currently lent out" rule stays canonical.
 */
export const deleteSampleAction = createAction<{ sampleId: string }, { id: string }>(
  async ({ input, ctx, tx }) => {
    if (!hasPermission(ctx.role, PERMISSION.LIBRARY_MANAGE_SAMPLES)) {
      throw new ActionError("Access denied", "FORBIDDEN");
    }
    await CatalogSampleService.deletePhysicalSample(tx, input.sampleId, ctx.userId);
    invalidateCache({ scope: REVALIDATE_LIBRARY });
    return { id: input.sampleId };
  },
  { schema: IdSchema }
);
