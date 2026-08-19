"use server";

import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { assertAdmin } from "@/core/rbac/permissions";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit/types";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_SETTINGS } from "@/lib/revalidation-tags";
import { z } from "zod";
import { Prisma, ProductType } from "@/generated/prisma";
import { ScheduleSnapshotSchema } from "@/lib/validations/schedule-snapshot";

// Zod schemas — nama field identik dengan Prisma schema (AGENTS.md §Pillar 2 no.7)
const CreateFromEntrySchema = z.object({
  project_id: z.string().uuid(),
  entry_id: z.string().uuid(),
});

const ListTemplateItemsSchema = z.object({
  section: z.nativeEnum(ProductType).optional(),
});

const ReorderTemplateItemsSchema = z.object({
  section: z.nativeEnum(ProductType),
  schedule_category: z.string().min(1),
  ordered_ids: z.array(z.string().uuid()).min(1),
});

const DeleteTemplateItemSchema = z.object({
  id: z.string().uuid(),
});

/**
 * Jalur pengisian utama: salin snapshot dari kartu yang sudah final di Catalog Board
 * ke ScheduleTemplateItem. Izin: admin (setting kantor, bukan aksi project-level).
 * DILARANG menulis ke master_data (keputusan owner 2026-08-12 #3).
 */
export async function createScheduleTemplateItemFromEntryAction(
  projectId: string,
  entryId: string
) {
  try {
    const { userId, role } = await requireSession();
    assertAdmin(role);

    const { project_id, entry_id } = CreateFromEntrySchema.parse({ project_id: projectId, entry_id: entryId });

    const result = await prisma.$transaction(async (tx) => {
      // Ambil opsi final dari entry
      const entry = await tx.projectScheduleEntry.findUniqueOrThrow({
        where: { id: entry_id },
        select: {
          project_id: true,
          section: true,
          schedule_category: true,
          options: {
            orderBy: { option_label: "asc" },
            select: { id: true, is_final: true, data_snapshot: true, sku_id: true },
          },
        },
      });

      if (entry.project_id !== project_id) {
        throw new Error("Entry tidak ditemukan di proyek ini.");
      }

      const finalOption = entry.options.find((o) => o.is_final) ?? entry.options[0];
      if (!finalOption) throw new Error("Entry belum punya opsi produk.");

      // Validasi snapshot
      const snapshot = ScheduleSnapshotSchema.parse(finalOption.data_snapshot);

      // sort_order = max+1 dalam kategori yang sama
      const maxOrder = await tx.scheduleTemplateItem.aggregate({
        where: { section: entry.section, schedule_category: entry.schedule_category, is_active: true },
        _max: { sort_order: true },
      });
      const nextSortOrder = (maxOrder._max.sort_order ?? 0) + 1;

      const item = await tx.scheduleTemplateItem.create({
        data: {
          section: entry.section,
          schedule_category: entry.schedule_category,
          sort_order: nextSortOrder,
          data_snapshot: snapshot as unknown as Prisma.InputJsonValue,
          sku_id: finalOption.sku_id,
          is_active: true,
        },
      });

      await insertAuditLog(tx, AUDIT_ACTIONS.SET_SCHEDULE_TEMPLATE_DEFAULT_ENTRY, "ScheduleTemplateItem", item.id, userId, {
        source_entry_id: entry_id,
        project_id: project_id,
        section: entry.section,
        schedule_category: entry.schedule_category,
      });

      return item;
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    return { success: true, item: result };
  } catch (error) {
    console.error("[CREATE_TEMPLATE_ITEM_ERROR]", error);
    return { error: error instanceof Error ? error.message : "Gagal menyimpan item template." };
  }
}

export async function listScheduleTemplateItemsAction(section?: ProductType) {
  try {
    const { role } = await requireSession();
    assertAdmin(role);

    void ListTemplateItemsSchema.parse({ section });

    const items = await prisma.scheduleTemplateItem.findMany({
      where: { is_active: true, ...(section ? { section } : {}) },
      orderBy: [{ section: "asc" }, { schedule_category: "asc" }, { sort_order: "asc" }],
    });

    return { success: true, items };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal memuat item template." };
  }
}

export async function reorderScheduleTemplateItemsAction(
  section: ProductType,
  schedule_category: string,
  ordered_ids: string[]
) {
  try {
    const { role } = await requireSession();
    assertAdmin(role);

    const { ordered_ids: ids } = ReorderTemplateItemsSchema.parse({ section, schedule_category, ordered_ids });

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.scheduleTemplateItem.update({
          where: { id },
          data: { sort_order: index + 1 },
        })
      )
    );

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    return { success: true };
  } catch (error) {
    console.error("[REORDER_TEMPLATE_ITEMS_ERROR]", error);
    return { error: error instanceof Error ? error.message : "Gagal mengurutkan item template." };
  }
}

/**
 * Soft delete: is_active = false supaya entry proyek yang sudah ada tidak kehilangan
 * tautan (template_item_id masih valid, hanya tidak akan dipakai lagi untuk proyek baru).
 */
export async function deleteScheduleTemplateItemAction(id: string) {
  try {
    const { userId, role } = await requireSession();
    assertAdmin(role);

    const { id: itemId } = DeleteTemplateItemSchema.parse({ id });

    await prisma.$transaction(async (tx) => {
      const item = await tx.scheduleTemplateItem.update({
        where: { id: itemId },
        data: { is_active: false },
      });

      await insertAuditLog(tx, AUDIT_ACTIONS.SET_SCHEDULE_TEMPLATE_DEFAULT_ENTRY, "ScheduleTemplateItem", itemId, userId, {
        action: "soft_delete",
        section: item.section,
        schedule_category: item.schedule_category,
      });
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    return { success: true };
  } catch (error) {
    console.error("[DELETE_TEMPLATE_ITEM_ERROR]", error);
    return { error: error instanceof Error ? error.message : "Gagal menghapus item template." };
  }
}
