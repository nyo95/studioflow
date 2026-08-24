/**
 * UI ENGINE — RAIL ACTIVE-RESOLUTION (PRD Architecture Cleanup v2 §41, R6)
 * ============================================================================
 * Murni dan bebas dependensi: menerima pathname + daftar href rail, menjawab
 * href mana yang aktif. Tidak ada React, tidak ada next/navigation — supaya
 * bisa diuji `npm test` sebagai bukti parity (lihat ./rail-active.test.ts).
 *
 * Semantik ini mereproduksi persis perilaku ketiga nav lama yang digantikan
 * AppShell di R6:
 *
 *   - NavOuter (StudioFlow)      : `pathname === href || (href !== "/" &&
 *                                  pathname.startsWith(href))`
 *   - MasterDataNavOuter         : `pathname.startsWith(href)`
 *   - BqNavOuter                 : custom (`/bq` aktif untuk `/bq` dan
 *                                  `/bq/[projectId]`, tidak untuk `/bq/library`)
 *
 * Ketiganya tercakup oleh dua aturan berikut:
 *
 *   1. Exact match selalu menang — ini yang membuat "/" (Tasks) hanya aktif
 *      di pathname "/", dan "/bq" aktif di pathname "/bq".
 *   2. Di antara href yang prefix-match, yang TERPANJANG menang. Ini yang
 *      membuat `/bq/library` aktif untuk Library (bukan Breakdowns) sementara
 *      `/bq/[projectId]` tetap aktif untuk Breakdowns — perilaku custom BQ
 *      tanpa menulis aturan khusus BQ di engine.
 *
 * Catatan sadar: prefix match memakai `startsWith` polos tanpa cek batas
 * segmen (mis. pathname "/bqlibrary" akan mengaktifkan "/bq"). Itu disengaja —
 * ketiga implementasi lama juga begitu, dan parity berarti menyalin semantik,
 * bukan memperbaikinya diam-diam.
 */

export function resolveActiveRailHref(
  pathname: string,
  hrefs: readonly string[]
): string | null {
  if (hrefs.length === 0) return null;
  if (hrefs.includes(pathname)) return pathname;

  let best: string | null = null;
  for (const href of hrefs) {
    // Href root ("/") exact-only — aturan NavOuter lama; kalau ikut
    // prefix-match maka ia aktif di mana-mana.
    if (href === "/") continue;
    if (!pathname.startsWith(href)) continue;
    if (best === null || href.length > best.length) best = href;
  }
  return best;
}
