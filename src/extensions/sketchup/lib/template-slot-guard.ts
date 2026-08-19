/**
 * Logika murni untuk mencari increment bebas berikutnya yang tidak dipegang
 * oleh entry template yang belum diklaim.
 *
 * Dipanggil oleh autoLinkSyncedMaterial dan autoLinkSyncedFixture saat
 * slot yang diminta sudah dipegang entry template (template_item_id != null).
 * Plugin SketchUp diperbaiki belakangan (Fase 4 ini hanya guard sisi server).
 * Lihat: R-SCHED-TPL-2d, docs/ANALISA-SCHEDULE-REUSE-2026-08-12.md §1c.
 *
 * TODO (R-SCHED-TPL-2e — OUT OF SCOPE Fase 4):
 *   - Pencocokan per-kategori
 *   - Adopsi slot template oleh material
 *   - Antrean rename SketchupMergeAction
 *   - Pengiriman reserved_codes ke plugin
 */

export interface OccupiedSlot {
  /** increment yang sudah dipakai (oleh entry template maupun entry biasa) */
  increment: number;
  /** true kalau entry ini punya template_item_id (reserved oleh template) */
  isTemplateReserved: boolean;
}

/**
 * Mengembalikan increment bebas berikutnya yang:
 *   1. Belum dipakai oleh entry mana pun (bukan di occupiedSlots)
 *   2. Lebih besar dari wantedIncrement (kita tidak turun ke nomor lebih kecil)
 *
 * Dimulai dari max(occupiedSlots.increment, wantedIncrement) + 1.
 */
export function findNextFreeIncrement(
  wantedIncrement: number,
  occupiedSlots: OccupiedSlot[]
): number {
  const allUsed = new Set(occupiedSlots.map((s) => s.increment));
  let candidate = Math.max(wantedIncrement, ...occupiedSlots.map((s) => s.increment)) + 1;
  // Fallback: tidak mungkin infinite loop karena candidate terus naik
  while (allUsed.has(candidate)) {
    candidate++;
  }
  return candidate;
}
