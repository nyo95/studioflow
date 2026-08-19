/**
 * BQ — konstanta bersama.
 *
 * Murni (tidak menyentuh Prisma) supaya `npm test` bisa mengimpornya bersama
 * `calc.ts`. Lihat kepala `calc.ts` untuk kenapa batas itu penting.
 */

/**
 * `BqSettings` adalah tabel satu baris. Id-nya dikunci ke konstanta ini,
 * pola yang sama dengan `SYSTEM_CONFIG_ID` di `src/core/rbac/permissions.ts`.
 *
 * Kenapa bukan sekadar "ambil baris pertama": `findFirst()` tanpa `where`
 * pada tabel yang seharusnya punya satu baris akan diam-diam benar sampai
 * suatu hari ada baris kedua, dan sesudahnya ia mengembalikan baris yang
 * berbeda tergantung urutan fisik di disk.
 */
export const BQ_SETTINGS_ID = "bq-settings";

/** Dipakai saat tabel setelan belum diisi sama sekali. Sengaja sama dengan
 *  `@default` di skema — dua tempat, satu nilai, dan kalau salah satunya
 *  berubah tanpa yang lain, object baru akan lahir dengan markup berbeda
 *  tergantung apakah barisnya sudah pernah dibuat. */
export const BQ_DEFAULT_MARKUP_PCT = 0.2;
export const BQ_DEFAULT_CURRENCY = "IDR";

/** Batas atas jumlah baris yang boleh diminta sekali jalan oleh picker master
 *  data, supaya sebuah pencarian tidak berubah jadi table scan. */
export const BQ_PICKER_PAGE_SIZE = 40;

/**
 * Satuan yang dikenali BQ untuk baris jasa (PRD §5.3). Ini BUKAN validasi —
 * `WorkPrice.unit` adalah teks bebas milik Master Data dan BQ tidak berhak
 * menolak nilai yang sudah ada di sana. Daftar ini hanya untuk urutan dan
 * label di UI.
 */
export const BQ_KNOWN_RATE_UNITS = ["sqm", "m'", "pcs", "ls", "org-hari"] as const;

/** Ambang "harga master sudah bergerak" untuk banner drift. Perbandingan
 *  memakai selisih relatif supaya pembulatan rupiah pada harga besar tidak
 *  memunculkan banner palsu; 0 tetap terdeteksi karena pembandingnya `!==`
 *  saat salah satu sisi nol. */
export const BQ_DRIFT_EPSILON = 1e-9;
