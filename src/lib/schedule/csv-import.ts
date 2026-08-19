import { ProductType } from "@/generated/prisma";
import { ActionError } from "@/lib/error-types";
import { TxClient } from "@/core/rbac/permissions";
import { buildScheduleSnapshot, ScheduleService, SourceOrigin } from "@/extensions/schedule/services/schedule-service";
import { ScheduleCsvImportRow } from "./csv-types";
import { createScheduleOption, updateScheduleOptionSnapshot } from "@/extensions/schedule/services/schedule-option-writer";

export interface ImportScheduleOptions {
  projectId: string;
  section: ProductType;
  rows: ScheduleCsvImportRow[];
  sourceOrigin?: SourceOrigin;
}

async function resolveImportCategory(
  tx: TxClient,
  row: ScheduleCsvImportRow,
  section: ProductType
): Promise<string> {
  const explicitCategory = row.category?.trim() || row.productCategory?.trim();
  if (explicitCategory) {
    const normalized = explicitCategory.toLowerCase();
    if (normalized === "general" || normalized === "") {
        throw new ActionError(
            `Invalid category "${explicitCategory}" found in imported row ${row.code}. "General" is not supported.`,
            "VALIDATION_FAILED"
        );
    }
    return explicitCategory;
  }

  const codePrefix = row.code.split("-")[0]?.trim();
  if (codePrefix) {
    const prefixes = await tx.prefixDictionary.findMany({
      where: {
        prefix: { equals: codePrefix, mode: "insensitive" },
        section,
      },
    });

    if (prefixes.length > 1) {
      throw new ActionError(
        `Ambiguous category mapping for imported row ${row.code}: prefix "${codePrefix}" matches multiple categories [${prefixes.map(p => p.schedule_category).join(", ")}] in ${section.toLowerCase()} folder.`,
        "VALIDATION_FAILED"
      );
    }

    if (prefixes[0]?.schedule_category) {
      return prefixes[0].schedule_category;
    }
  }

  throw new ActionError(
    `Cannot determine a valid category for imported row ${row.code}. Please ensure the category header is present and valid.`,
    "VALIDATION_FAILED"
  );
}

function normalizeImportCategory(category: string): string {
  return category.trim();
}

function buildManualImportData(row: ScheduleCsvImportRow, category: string) {
  return {
    catalog_product_name: row.type || "Imported",
    catalog_brand: row.ex || "Unknown",
    catalog_category: category,
    catalog_source_external_id: row.sourceExternalId ?? null,
    catalog_reference_url: row.referenceUrl || null,
    catalog_image_url: row.imageUrl || null,
    catalog_price: row.price ?? undefined,
    catalog_initials_type: row.initialsType ?? null,
    catalog_contact_name: row.contactName ?? undefined,
    catalog_contact_phone: row.contactPhone ?? undefined,
    catalog_contact_email: row.contactEmail ?? undefined,
    catalog_metadata: row.sourcePayload ?? null,
  };
}

async function upsertApprovedOption(
  tx: TxClient,
  entryId: string,
  snapshot: import("@/lib/validations/schedule-snapshot").ScheduleSnapshot
) {
  const existingOptions = await tx.projectScheduleOption.findMany({
    where: { entry_id: entryId },
    orderBy: { option_label: "asc" },
  });

  const approved = existingOptions.find((option) => option.is_final) ?? existingOptions[0];

  if (approved) {
    await updateScheduleOptionSnapshot(tx as import("@/types/common").PrismaTransaction, approved.id, snapshot, {
      is_final: true,
      status: "APPROVED",
    });

    const demoteIds = existingOptions
      .filter((option) => option.id !== approved.id && option.is_final)
      .map((option) => option.id);

    if (demoteIds.length > 0) {
      await tx.projectScheduleOption.updateMany({
        where: { id: { in: demoteIds } },
        data: {
          is_final: false,
          status: "NOT_USED",
        },
      });
    }

    return;
  }

  await createScheduleOption(tx as import("@/types/common").PrismaTransaction, {
    entry_id: entryId,
    option_label: "A",
    is_final: true,
    status: "APPROVED",
    data_snapshot: snapshot,
  });
}

export async function importScheduleFromCsv(
  tx: TxClient,
  options: ImportScheduleOptions
): Promise<{ created: number; updated: number }> {
  const {
    projectId,
    section,
    rows,
    sourceOrigin,
  } = options;

  let created = 0;
  let updated = 0;
  let newEntryOrdinal = 0;

  for (const row of rows) {
    if (!row.code) continue;

    const existing = await tx.projectScheduleEntry.findFirst({
      where: {
        project_id: projectId,
        section,
        schedule_prefix: row.code.split("-")[0]?.trim() || "",
        schedule_increment: parseInt(row.code.split("-")[1]?.trim() || "0", 10),
      },
      include: {
        options: true,
      },
    });

    const category = normalizeImportCategory(existing?.schedule_category ?? await resolveImportCategory(tx, row, section));
    const manualData = buildManualImportData(row, category);
    const snapshot = await buildScheduleSnapshot(tx, null, manualData, sourceOrigin || "gsheets_import");

    if (existing) {
      await upsertApprovedOption(tx, existing.id, snapshot);

      if (row.schedule_qty !== undefined || row.schedule_unit !== undefined || row.location !== undefined) {
        await tx.projectScheduleEntry.update({
          where: { id: existing.id },
          data: {
            ...(row.schedule_qty !== undefined && section !== ProductType.material ? { schedule_qty: row.schedule_qty } : {}),
            ...(row.schedule_unit !== undefined ? { schedule_unit: row.schedule_unit } : {}),
            ...(row.location !== undefined ? { schedule_location: row.location } : {}),
          },
        });
      }

      updated++;
      continue;
    }

    let prefixDict = await tx.prefixDictionary.findFirst({
      where: {
        schedule_category: { equals: category, mode: "insensitive" },
        section,
      },
    });

    if (!prefixDict) {
      prefixDict = await tx.prefixDictionary.create({
        data: {
          schedule_category: category,
          prefix: category.substring(0, 2).toUpperCase(),
          section,
        },
      });
    }

    const lastEntry = await tx.projectScheduleEntry.findFirst({
      where: { project_id: projectId, section },
      orderBy: { schedule_sort_order: "desc" },
    });

    const normalizedCategory = category.trim().toUpperCase();

    // The placeholder increment must be <= 0 and unique within this import
    // batch (see catalog-ownership.ts / normalizeCodes below): a positive
    // guess here — the previous code used the section's last sort_order+1,
    // not even scoped to this category — could collide with or shadow a real
    // increment in this category, and normalizeCodes (gentle) treats any
    // positive value as already-valid and would never revisit it.
    newEntryOrdinal += 1;
    const entry = await tx.projectScheduleEntry.create({
      data: {
        project_id: projectId,
        schedule_category: normalizedCategory,
        section,
        schedule_prefix: prefixDict.prefix || "ITEM",
        schedule_increment: -newEntryOrdinal,
        prefix_id: prefixDict.id,
        schedule_sort_order: (lastEntry?.schedule_sort_order ?? 0) + 1,
        index_number: 0,
        schedule_qty: section === ProductType.material ? null : (row.schedule_qty ?? null),
        schedule_unit: row.schedule_unit ?? null,
        schedule_location: row.location ?? null,
      },
    });

    await createScheduleOption(tx as import("@/types/common").PrismaTransaction, {
      entry_id: entry.id,
      option_label: "A",
      is_final: true,
      status: "APPROVED",
      data_snapshot: snapshot,
    });

    // Canonical scheduler codes are normalized from prefix/category order, not imported raw text.
    await ScheduleService.normalizeCodes(tx, projectId, section, normalizedCategory);

    created++;
  }

  return { created, updated };
}

export async function importFromSketchUp(
  tx: TxClient,
  projectId: string,
  section: ProductType,
  rows: ScheduleCsvImportRow[]
): Promise<{ created: number; updated: number }> {
  void tx;
  void projectId;
  void section;
  void rows;
  throw new ActionError(
    "SketchUp import is temporarily disabled while core extensions are stabilized.",
    "FEATURE_DISABLED"
  );
}
