/**
 * MASTER DATA — single canonical slug generator.
 *
 * Perilaku kanonik (keputusan owner 2026-08-12): NFKD → buang diakritik →
 * lowercase → trim → setiap runtun non-alfanumerik jadi satu hyphen → trim
 * hyphen di kedua ujung.
 *
 * "PT Café Créme" → "pt-cafe-creme"   (é jadi e, bukan dibuang)
 *
 * Sebelum ini ada TUJUH implementasi, tiga NFKD dan empat tidak. Yang empat
 * membuang huruf beraksen alih-alih menerjemahkannya, sehingga satu nama yang
 * sama menghasilkan slug berbeda tergantung layar mana yang dipakai.
 *
 * MURNI DAN BEBAS I/O DENGAN SENGAJA — `npm test` tidak boleh mengimpor apa pun
 * yang menyentuh Prisma atau `server-only`.
 */
export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
