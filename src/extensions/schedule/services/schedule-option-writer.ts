import type { Prisma, ProjectScheduleOption } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
import { deriveScheduleSpecFields } from "./schedule-spec-fields";

// Re-export so existing imports from this module continue to resolve.
export { deriveScheduleSpecFields } from "./schedule-spec-fields";

/**
 * SATU-SATUNYA jalur tulis `data_snapshot` ke ProjectScheduleOption.
 *
 * Alasannya ada di docs/ANALISA-SCHEDULE-REUSE-2026-08-12.md §2: `spec_*`
 * adalah index turunan dari snapshot, dan sebelum ini 17 titik tulis menulis
 * snapshot tanpa ikut memperbarui index-nya — akibatnya reuse pool
 * ("From a past project") tidak pernah menemukan apa pun. Jangan panggil
 * `tx.projectScheduleOption.create/update` dengan `data_snapshot` di luar
 * berkas ini.
 *
 * Pemanggil WAJIB menyerahkan snapshot yang sudah divalidasi ScheduleSnapshotSchema.parse().
 * Helper ini tidak menambah validasi baru — ia hanya memastikan spec_* selalu ditulis.
 */

type OptionStatus = "DRAFT" | "APPROVED" | "NOT_USED";

type ProjectScheduleOptionCreateInput = Omit<
  Prisma.ProjectScheduleOptionUncheckedCreateInput,
  "data_snapshot" | "spec_brand_id" | "spec_product_name" | "spec_color" | "spec_finishing" | "spec_search_key"
> & {
  data_snapshot: ScheduleSnapshot;
};

/**
 * Membuat ProjectScheduleOption baru dengan `data_snapshot` dan `spec_*` yang
 * selalu sinkron.
 */
export async function createScheduleOption(
  tx: PrismaTransaction,
  data: ProjectScheduleOptionCreateInput,
): Promise<ProjectScheduleOption> {
  const { data_snapshot, ...rest } = data;
  return tx.projectScheduleOption.create({
    data: {
      ...rest,
      data_snapshot: data_snapshot as unknown as Prisma.InputJsonValue,
      ...deriveScheduleSpecFields(data_snapshot),
    },
  });
}

/**
 * Mengupdate `data_snapshot` dan `spec_*` sekaligus (selalu sinkron).
 * `extra` memungkinkan perubahan status/is_final/sku_id dalam operasi yang sama.
 */
export async function updateScheduleOptionSnapshot(
  tx: PrismaTransaction,
  optionId: string,
  snapshot: ScheduleSnapshot,
  extra?: {
    status?: OptionStatus;
    is_final?: boolean;
    sku_id?: string | null;
  },
): Promise<ProjectScheduleOption> {
  return tx.projectScheduleOption.update({
    where: { id: optionId },
    data: {
      data_snapshot: snapshot as unknown as Prisma.InputJsonValue,
      ...deriveScheduleSpecFields(snapshot),
      ...(extra ?? {}),
    },
  });
}
