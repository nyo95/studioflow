/**
 * Logika murni untuk memilih item template mana yang harus dibuat pada proyek.
 * Diekstrak supaya bisa diuji tanpa Prisma.
 * Dipanggil oleh applyDefaultTemplateEntries di schedule-service.ts.
 */
export interface TemplateItemSpec {
  id: string;
  section: string;
  schedule_category: string;
}

export interface ExistingTemplateEntry {
  template_item_id: string | null;
}

/**
 * Menentukan item template mana yang belum ada di proyek.
 * @param allItems Daftar ScheduleTemplateItem aktif
 * @param existingEntries Entry proyek yang sudah punya template_item_id
 * @returns Array item yang harus dibuat
 */
export function planTemplateItemsToCreate(
  allItems: TemplateItemSpec[],
  existingEntries: ExistingTemplateEntry[]
): TemplateItemSpec[] {
  const appliedIds = new Set(
    existingEntries
      .map((e) => e.template_item_id)
      .filter((id): id is string => id !== null)
  );
  return allItems.filter((item) => !appliedIds.has(item.id));
}
