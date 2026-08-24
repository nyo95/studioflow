import "server-only";
import { Prisma } from "@/generated/prisma";

/**
 * Excel import / export for Master Data — Sku + SkuPrice.
 *
 * Decision log (owner 2026-08-11):
 *   • Schema mirrors the current UI (not the original design database Excel),
 *     to stay consistent with what staff already sees on screen.
 *   • Round-trip: export includes `id` + `slug` for import matching.
 *   • Import behaviour: UPSERT — match by `id` if present, else by `slug`.
 *     Rows in the file that match an existing Sku update it; rows with no match
 *     create a new Sku. Nothing is deleted.
 *   • Error reporting: per-row, with the 1-based row number in the sheet.
 *     Rows that fail validation are skipped; rows that pass are written.
 *   • Scope: Sku + SkuPrice only. Brand, Party, Sample excluded from v1.
 *
 * Pattern reference: `src/lib/schedule/csv-*.ts` (zod-per-row, parse → validate
 * → write → report). Adapted here for Excel instead of CSV.
 */

import ExcelJS from "exceljs";
import { z } from "zod";
import { prisma } from "@/core/platform/db";
import { recordAudit } from "./audit-service";
import { recordSkuPrice } from "./sku-price-service";
import { checkPriceUnit, resolveEffectivePriceUnit } from "./sku-price-rules";
import { createSkuCore } from "./sku-core-service";

// ---------------------------------------------------------------------------
// Zod schemas — one per importable sheet row
// ---------------------------------------------------------------------------

export const SkuImportRowSchema = z.object({
  /** Stable identity. If present and matches an existing Sku, UPDATE. Else, INSERT. */
  id: z.string().optional().nullable(),
  slug: z.string().optional().nullable(),
  code: z.string().optional().nullable(),
  name: z.string().min(1, "name is required"),
  kind: z
    .enum(["MATERIAL", "FURNITURE", "FIXTURE", "SERVICE"])
    .default("MATERIAL"),
  status: z.enum(["DRAFT", "ACTIVE", "DISCONTINUED"]).default("DRAFT"),
  brand: z.string().optional().nullable(),
  categories: z.string().optional().nullable(), // comma-separated
  color: z.string().optional().nullable(),
  motif: z.string().optional().nullable(),
  finishing: z.string().optional().nullable(),
  dim_length: z.coerce.number().optional().nullable(),
  dim_width: z.coerce.number().optional().nullable(),
  dim_height: z.coerce.number().optional().nullable(),
  dim_unit: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const SkuPriceImportRowSchema = z.object({
  sku_id: z.string().optional().nullable(),
  sku_slug: z.string().optional().nullable(),
  supplier_name: z.string().optional().nullable(),
  // `price_list` dihapus 2026-08-14 bersama kolomnya di SkuPrice. Kolom dengan
  // judul itu di workbook lama akan diabaikan, bukan ditolak — impor tidak boleh
  // gagal hanya karena file dibuat sebelum perubahan skema.
  price_net: z.coerce.number().optional().nullable(),
  unit: z.string().min(1, "unit is required"),
  currency: z.string().default("IDR"),
});

export type SkuImportRow = z.infer<typeof SkuImportRowSchema>;
export type SkuPriceImportRow = z.infer<typeof SkuPriceImportRowSchema>;

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Build an Excel workbook with two sheets: "SKU" and "Prices".
 * Returns the workbook buffer ready to send as a download.
 */
export async function exportMasterDataExcel(): Promise<Uint8Array> {
  const skus = await prisma.sku.findMany({
    where: { deleted_at: null },
    include: {
      brand: { select: { name: true } },
      categories: { include: { category: { select: { name: true } } } },
      prices: {
        include: { supplier: { select: { name: true } } },
      },
    },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "StudioFlow Master Data";
  wb.created = new Date();

  // ─── Sheet 1: SKU ────────────────────────────────────────────────────────
  const skuSheet = wb.addWorksheet("SKU");
  skuSheet.columns = [
    { header: "id",         key: "id",         width: 38 },
    { header: "slug",       key: "slug",        width: 30 },
    { header: "code",       key: "code",        width: 20 },
    { header: "name",       key: "name",        width: 35 },
    { header: "kind",       key: "kind",        width: 14 },
    { header: "status",     key: "status",      width: 14 },
    { header: "brand",      key: "brand",       width: 25 },
    { header: "categories", key: "categories",  width: 35 },
    { header: "color",      key: "color",       width: 18 },
    { header: "motif",      key: "motif",       width: 18 },
    { header: "finishing",  key: "finishing",   width: 18 },
    { header: "dim_length", key: "dim_length",  width: 12 },
    { header: "dim_width",  key: "dim_width",   width: 12 },
    { header: "dim_height", key: "dim_height",  width: 12 },
    { header: "dim_unit",   key: "dim_unit",    width: 10 },
    { header: "notes",      key: "notes",       width: 40 },
  ];

  // Freeze header row + lock id/slug columns (convention: header in bold)
  skuSheet.getRow(1).font = { bold: true };
  skuSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  for (const sku of skus) {
    const spec = (sku.spec ?? {}) as Record<string, unknown>;
    const categories = sku.categories
      .map((c) => c.category.name)
      .join(", ");
    skuSheet.addRow({
      id: sku.id,
      slug: sku.slug,
      code: sku.code ?? "",
      name: sku.name,
      kind: sku.kind,
      status: sku.status,
      brand: sku.brand?.name ?? "",
      categories,
      color: typeof spec.color === "string" ? spec.color : "",
      motif: typeof spec.motif === "string" ? spec.motif : "",
      finishing: typeof spec.finishing === "string" ? spec.finishing : "",
      dim_length: sku.dim_length ? Number(sku.dim_length.toString()) : null,
      dim_width: sku.dim_width ? Number(sku.dim_width.toString()) : null,
      dim_height: sku.dim_height ? Number(sku.dim_height.toString()) : null,
      dim_unit: sku.dim_unit ?? "",
      notes: sku.notes ?? "",
    });
  }

  // Add note row below data
  const noteRow = skuSheet.addRow({ id: "⚠ Do not edit id / slug columns — they are used to match rows on import." });
  noteRow.getCell("id").font = { italic: true, color: { argb: "FF94A3B8" } };

  // ─── Sheet 2: Prices ─────────────────────────────────────────────────────
  const priceSheet = wb.addWorksheet("Prices");
  priceSheet.columns = [
    { header: "sku_id",        key: "sku_id",        width: 38 },
    { header: "sku_slug",      key: "sku_slug",       width: 30 },
    { header: "sku_name",      key: "sku_name",       width: 35 },
    { header: "supplier_name", key: "supplier_name",  width: 30 },
    { header: "price_net",     key: "price_net",      width: 16 },
    { header: "unit",          key: "unit",           width: 14 },
    { header: "currency",      key: "currency",       width: 10 },
  ];
  priceSheet.getRow(1).font = { bold: true };
  priceSheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  for (const sku of skus) {
    // SKUs with no prices are omitted from this sheet — a placeholder row with
    // empty unit would fail import validation. Add a price row manually when
    // you want to set the first price for a SKU.
    for (const p of sku.prices) {
      priceSheet.addRow({
        sku_id: sku.id,
        sku_slug: sku.slug,
        sku_name: sku.name,
        supplier_name: p.supplier?.name ?? "",
        price_net: Number(p.price_net.toString()),
        unit: p.unit,
        currency: p.currency,
      });
    }
  }

  const priceNote = priceSheet.addRow({
    sku_id: "⚠ Do not edit sku_id / sku_slug — used to match SKU on import. supplier_name must match an existing Party name exactly.",
  });
  priceNote.getCell("sku_id").font = { italic: true, color: { argb: "FF94A3B8" } };

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportRowResult =
  | { row: number; status: "created" | "updated" }
  | { row: number; status: "error"; message: string };

export type ImportResult = {
  skuResults: ImportRowResult[];
  priceResults: ImportRowResult[];
  summary: { created: number; updated: number; errors: number };
};

/**
 * Parse an uploaded Excel buffer and upsert SKUs + prices.
 *
 * Match order for Sku:
 *   1. By `id` column (if present and matches an existing row)
 *   2. By `slug` column (if present and matches an existing row)
 *   3. INSERT new (slug derived from name if not given)
 *
 * Match for SkuPrice: same SKU + same supplier (NULL = list price).
 * Records that already exist: update the current pair row through
 * `recordSkuPrice`; records that don't exist: create. Change history is kept
 * by the shared audit trail, not by superseded `SkuPrice` rows.
 */
export async function importMasterDataExcel(
  buffer: ArrayBuffer,
  /**
   * WAJIB sejak 2026-08-18 (audit H6). Sebelumnya fungsi ini tidak menerima
   * siapa pun sama sekali, dan setiap baris yang ditulis — Category, Sku,
   * SkuPrice — tidak tercatat di audit sama sekali. Untuk sebuah alur yang
   * bisa menulis ratusan baris sekaligus dari satu file, itu justru yang
   * PALING butuh provenance: kalau importnya keliru, tidak ada yang bisa
   * dijawab "baris mana yang datang dari import ini".
   */
  actor: { id: string | null; name: string }
): Promise<ImportResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const skuSheet = wb.getWorksheet("SKU");
  const priceSheet = wb.getWorksheet("Prices");

  const skuResults: ImportRowResult[] = [];
  const priceResults: ImportRowResult[] = [];

  // ─── Parse headers ───────────────────────────────────────────────────────
  function sheetToObjects(
    sheet: ExcelJS.Worksheet | undefined
  ): Array<Record<string, unknown>> {
    if (!sheet) return [];
    const rows = sheet.getSheetValues() as ExcelJS.CellValue[][];
    if (rows.length < 2) return [];
    const headers = (rows[1] as ExcelJS.CellValue[]).map((h) =>
      typeof h === "string" ? h.trim() : String(h ?? "")
    );
    const result: Record<string, unknown>[] = [];
    for (let i = 2; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;
      const obj: Record<string, unknown> = {};
      headers.forEach((h, j) => {
        if (h) obj[h] = row[j] ?? null;
      });
      result.push(obj);
    }
    return result;
  }

  // Helper: convert Excel number or string to number
  function toNum(v: unknown): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  }

  // ─── Import SKUs ─────────────────────────────────────────────────────────
  const skuObjects = sheetToObjects(skuSheet);
  // Pre-fetch brand map (name → id) once
  const allBrands = await prisma.brand.findMany({ select: { id: true, name: true } });
  const brandMap = new Map(allBrands.map((b) => [b.name.toLowerCase(), b.id]));

  // Pre-fetch category map (name → id), create on first use
  const allCategories = await prisma.category.findMany({ select: { id: true, name: true } });
  const categoryMap = new Map(allCategories.map((c) => [c.name.toLowerCase(), c.id]));

  const importedSkuIdMap = new Map<string, string>(); // slug → db id, for price import

  for (let i = 0; i < skuObjects.length; i++) {
    const rowNum = i + 2; // 1-based, +1 for header
    const raw = skuObjects[i];

    // Skip the note row
    const idCell = String(raw["id"] ?? "");
    if (idCell.startsWith("⚠")) continue;

    // Coerce types for zod
    const parsed = SkuImportRowSchema.safeParse({
      id: raw["id"] ?? null,
      slug: raw["slug"] ?? null,
      code: raw["code"] ?? null,
      name: raw["name"],
      kind: raw["kind"] ?? "MATERIAL",
      status: raw["status"] ?? "DRAFT",
      brand: raw["brand"] ?? null,
      categories: raw["categories"] ?? null,
      color: raw["color"] ?? null,
      motif: raw["motif"] ?? null,
      finishing: raw["finishing"] ?? null,
      dim_length: toNum(raw["dim_length"]),
      dim_width: toNum(raw["dim_width"]),
      dim_height: toNum(raw["dim_height"]),
      dim_unit: raw["dim_unit"] ?? null,
      notes: raw["notes"] ?? null,
    });

    if (!parsed.success) {
      skuResults.push({
        row: rowNum,
        status: "error",
        message: parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      });
      continue;
    }

    const data = parsed.data;

    try {
      // Resolve brand
      const brandId = data.brand
        ? (brandMap.get(data.brand.toLowerCase()) ?? null)
        : null;

      // Resolve or create categories
      const categoryNames = data.categories
        ? data.categories.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

      const categoryIds: string[] = [];
      for (const catName of categoryNames) {
        let catId = categoryMap.get(catName.toLowerCase());
        if (!catId) {
          // create category on first use
          const slug = catName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          const newCat = await prisma.category.create({
            data: {
              name: catName,
              slug,
              kind: "PRODUCT",
            },
          });
          await recordAudit(prisma, {
            entity: "Category",
            entity_id: newCat.id,
            action: "CREATE",
            actor,
            changes: { name: catName, source: "excel_import" },
          });
          catId = newCat.id;
          categoryMap.set(catName.toLowerCase(), catId);
        }
        categoryIds.push(catId);
      }

      const spec: Record<string, unknown> = {};
      if (data.color) spec.color = data.color;
      if (data.motif) spec.motif = data.motif;
      if (data.finishing) spec.finishing = data.finishing;

      // Derive slug if not provided
      const slug =
        data.slug?.trim() ||
        `${brandId ?? "generic"}-${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;

      // Find existing row
      let existingSku: { id: string } | null = null;
      if (data.id) {
        existingSku = await prisma.sku.findUnique({
          where: { id: data.id },
          select: { id: true },
        });
      }
      if (!existingSku && data.slug) {
        // Try by brand+slug unique index
        existingSku = await prisma.sku.findFirst({
          where: { slug: data.slug, brand_id: brandId },
          select: { id: true },
        });
      }

      let skuId: string;
      if (existingSku) {
        // UPDATE
        await prisma.sku.update({
          where: { id: existingSku.id },
          data: {
            code: data.code ?? undefined,
            name: data.name,
            kind: data.kind as "MATERIAL" | "FURNITURE" | "FIXTURE" | "SERVICE",
            status: data.status as "DRAFT" | "ACTIVE" | "DISCONTINUED",
            brand_id: brandId,
            spec: spec as Prisma.InputJsonValue,
            dim_length: data.dim_length ?? undefined,
            dim_width: data.dim_width ?? undefined,
            dim_height: data.dim_height ?? undefined,
            dim_unit: data.dim_unit ?? undefined,
            notes: data.notes ?? undefined,
          },
        });
        skuId = existingSku.id;
        await recordAudit(prisma, {
          entity: "Sku",
          entity_id: skuId,
          action: "UPDATE",
          actor,
          changes: { code: data.code ?? null, name: data.name, source: "excel_import", row: rowNum },
        });

        // Sync categories (add missing, leave existing)
        for (const catId of categoryIds) {
          await prisma.skuCategory.upsert({
            where: { sku_id_category_id: { sku_id: skuId, category_id: catId } },
            create: { sku_id: skuId, category_id: catId, is_primary: categoryIds[0] === catId },
            update: {},
          });
        }

        skuResults.push({ row: rowNum, status: "updated" });
      } else {
        // INSERT
        // B5 (2026-08-18): create + slug + primary-category + audit now go
        // through `createSkuCore` (see its doc comment). This site already
        // got `base_unit`, the single `recordAudit` call, and the
        // `is_primary: index === 0` rule right — the one gap was slug
        // uniqueness, computed manually here (`data.slug` or a derived
        // fallback) with no check against the `Sku_slug_nobrand_uniq` /
        // `[brand_id, slug]` constraints it has to satisfy, so a duplicate
        // failed the whole row on a raw Postgres error instead of a message
        // the importer could act on.
        const newSku = await createSkuCore(
          prisma,
          {
            data: {
              code: data.code ?? undefined,
              name: data.name,
              kind: data.kind as "MATERIAL" | "FURNITURE" | "FIXTURE" | "SERVICE",
              status: data.status as "DRAFT" | "ACTIVE" | "DISCONTINUED",
              brand_id: brandId,
              spec: spec as Prisma.InputJsonValue,
              dim_length: data.dim_length ?? undefined,
              dim_width: data.dim_width ?? undefined,
              dim_height: data.dim_height ?? undefined,
              dim_unit: data.dim_unit ?? undefined,
              notes: data.notes ?? undefined,
            },
            slugSeed: slug,
            categoryIds,
          },
          actor
        );
        skuId = newSku.id;

        skuResults.push({ row: rowNum, status: "created" });
      }

      // Map slug → id so price import can find the SKU
      importedSkuIdMap.set(data.slug ?? slug, skuId);
      if (data.id) importedSkuIdMap.set(data.id, skuId);
    } catch (err) {
      skuResults.push({
        row: rowNum,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // ─── Import Prices ───────────────────────────────────────────────────────
  const priceObjects = sheetToObjects(priceSheet);

  // Pre-fetch party (supplier) map
  const allParties = await prisma.party.findMany({ select: { id: true, name: true } });
  const partyMap = new Map(allParties.map((p) => [p.name.toLowerCase(), p.id]));

  for (let i = 0; i < priceObjects.length; i++) {
    const rowNum = i + 2;
    const raw = priceObjects[i];

    const skuIdCell = String(raw["sku_id"] ?? "");
    if (skuIdCell.startsWith("⚠")) continue;

    // Skip rows that have no price_net — these are either placeholder rows
    // from a prior export (SKUs that had no price at export time) or rows the
    // user intentionally left blank. Do this BEFORE Zod so we don't produce a
    // spurious "unit is required" error for rows we were going to skip anyway.
    const rawPriceNet = raw["price_net"];
    if (rawPriceNet === null || rawPriceNet === undefined || rawPriceNet === "") {
      continue;
    }

    const parsed = SkuPriceImportRowSchema.safeParse({
      sku_id: raw["sku_id"] ?? null,
      sku_slug: raw["sku_slug"] ?? null,
      supplier_name: raw["supplier_name"] ?? null,
      price_net: toNum(raw["price_net"]),
      unit: raw["unit"],
      currency: raw["currency"] ?? "IDR",
    });

    if (!parsed.success) {
      priceResults.push({
        row: rowNum,
        status: "error",
        message: parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      });
      continue;
    }

    const data = parsed.data;

    try {
      // Resolve SKU id
      let skuId: string | null = null;
      if (data.sku_id) {
        skuId =
          importedSkuIdMap.get(data.sku_id) ??
          (await prisma.sku.findUnique({ where: { id: data.sku_id }, select: { id: true } }))?.id ??
          null;
      }
      if (!skuId && data.sku_slug) {
        skuId =
          importedSkuIdMap.get(data.sku_slug) ??
          (await prisma.sku.findFirst({ where: { slug: data.sku_slug }, select: { id: true } }))?.id ??
          null;
      }
      if (!skuId) {
        priceResults.push({ row: rowNum, status: "error", message: "SKU not found — check sku_id or sku_slug" });
        continue;
      }

      // R4 (keputusan owner U2): satuan harga wajib cocok dengan
      // `purchase_unit` SKU — aturan yang sama dengan `recordSkuPrice`.
      // Impor tidak boleh menjadi pintu belakang baris yang readiness BQ
      // nanti tolak karena `UNIT_MISMATCH`.
      const purchaseUnit = (
        await prisma.sku.findUnique({ where: { id: skuId }, select: { purchase_unit: true } })
      )?.purchase_unit ?? null;
      const unitCheck = checkPriceUnit(data.unit, purchaseUnit);
      if (!unitCheck.ok) {
        priceResults.push({
          row: rowNum,
          status: "error",
          message: `Unit "${unitCheck.unit}" does not match the SKU's purchase unit "${unitCheck.purchaseUnit}"`,
        });
        continue;
      }

      // Skip placeholder rows (exported Sku rows that have no price yet)
      const priceNet = data.price_net;
      if (priceNet === null || priceNet === undefined) {
        continue;
      }

      // Resolve supplier
      const supplierPartyId = data.supplier_name
        ? (partyMap.get(data.supplier_name.toLowerCase()) ?? null)
        : null;

      await prisma.$transaction(async (tx) => {
        const written = await recordSkuPrice(tx, {
          sku_id: skuId!,
          supplier_party_id: supplierPartyId,
          price: priceNet,
          unit: resolveEffectivePriceUnit(data.unit, purchaseUnit),
          currency: data.currency,
          updated_by_name: actor.name,
          notes: null,
        }, actor);
        if (!written) {
          throw new Error("Excel import could not persist the current price row.");
        }
        await recordAudit(tx, {
          entity: "SkuPrice",
          entity_id: written.id,
          action: "UPDATE",
          actor,
          changes: { source: "excel_import", row: rowNum },
        });
      });

      priceResults.push({ row: rowNum, status: "updated" });
    } catch (err) {
      priceResults.push({
        row: rowNum,
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const allResults = [...skuResults, ...priceResults];
  const summary = {
    created: allResults.filter((r) => r.status === "created").length,
    updated: allResults.filter((r) => r.status === "updated").length,
    errors: allResults.filter((r) => r.status === "error").length,
  };

  return { skuResults, priceResults, summary };
}
