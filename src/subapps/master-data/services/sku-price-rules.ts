/**
 * MASTER DATA — the pricing rules, with no I/O.
 *
 * Deliberately free of `server-only` and of any Prisma import, so `npm test`
 * can reach it. That constraint is documented in roadmap §Perkakas and it is
 * not an obstacle here — it is the reason these functions are worth separating
 * from `sku-price-service.ts` at all. They encode judgements that no index and
 * no type can check:
 *
 *   - what a blank price field means
 *   - when an edit is a new offer rather than a correction
 *   - when a row is worth writing
 *
 * Each was answered differently by four different call sites before 2026-08-11.
 * Having one answer is the point; having it testable is what keeps it one
 * answer.
 *
 * ----------------------------------------------------------------------------
 * 2026-08-14 — SATU HARGA
 * ----------------------------------------------------------------------------
 * `resolveNetPrice(net, list)` di sini dulu bertugas memilih di antara dua
 * kolom. Kolom keduanya sudah dihapus (lihat migrasi
 * `20260814100000_skuprice_single_price`), jadi tidak ada lagi yang perlu
 * dipilih — yang tersisa hanyalah pertanyaan "apakah angkanya benar-benar ada",
 * dan itulah yang dijawab `resolvePrice`.
 */

/**
 * Decides whether the form actually supplied a price.
 *
 *   angka valid  -> pakai
 *   kosong / NaN -> null. Pemanggil WAJIB tidak menulis baris apa pun.
 *
 * Aturan yang digantikan ini adalah `price_net: … ?? 0`, di empat tempat.
 * `v_bq_material_rate` menghitung `bq_ready` dari kolom ini, jadi nol karangan
 * tidak berhenti di Master Data — ia menjadi satu baris di dokumen komersial.
 */
export function resolvePrice(price: number | null): number | null {
  if (price !== null && Number.isFinite(price)) return price;
  return null;
}

/** True when the input carries enough to justify a price row at all. */
export function hasPriceContent(input: { price: number | null }): boolean {
  return resolvePrice(input.price) !== null;
}

/**
 * Harga yang WAJIB ada — dipakai `WorkPrice` (Excel Table 3 dan 4).
 * ---------------------------------------------------------------------------
 * Bedanya dengan `resolvePrice` adalah siapa yang boleh kosong. Sebuah
 * `SkuPrice` boleh tidak ditulis sama sekali: mengedit ejaan nama material
 * tanpa menyentuh harga adalah hal normal, jadi kosong berarti "jangan tulis
 * baris", bukan kesalahan. Sebuah `WorkPrice` TIDAK punya keadaan itu — barisnya
 * adalah tarifnya. Tarif tanpa angka bukan tarif.
 *
 * Ditambahkan 2026-08-18 setelah audit menemukan `WorkPrice` masih memakai
 * `Number(input.price)` polos di empat tempat. `Number("")` adalah `0`, jadi
 * field yang dikosongkan tersimpan sebagai tarif nol — persis cacat
 * `price_net ?? 0` yang dibuang dari `SkuPrice` pada 2026-08-11, dan yang
 * migrasi `20260811120000` anggap cukup serius untuk MEMBATALKAN dirinya
 * sendiri saat menemukannya:
 *
 *   "Baris yang kedua harganya NULL menghasilkan price = 0. Itu bukan harga,
 *    itu data yang tidak lengkap ... Migrasinya BERHENTI berisik supaya
 *    barisnya diperiksa manusia, bukan diperbaiki diam."
 *
 * Perlindungan itu ada di migrasi dan tidak pernah ada di form. Sekarang ada.
 * `v_bq_work_rate` membaca kolom ini, jadi nol karangan tidak berhenti di
 * Master Data — ia menjadi satu baris di dokumen komersial.
 */
export type WorkPriceIssue = "EMPTY" | "NOT_A_NUMBER" | "NEGATIVE";

export function checkWorkPrice(value: number | string | null | undefined): {
  ok: true; value: number;
} | {
  ok: false; issue: WorkPriceIssue;
} {
  if (value === null || value === undefined) return { ok: false, issue: "EMPTY" };
  if (typeof value === "string" && value.trim() === "") {
    return { ok: false, issue: "EMPTY" };
  }
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return { ok: false, issue: "NOT_A_NUMBER" };
  if (parsed < 0) return { ok: false, issue: "NEGATIVE" };
  return { ok: true, value: parsed };
}

export const WORK_PRICE_ISSUE_MESSAGE: Record<WorkPriceIssue, string> = {
  EMPTY: "Price is required. A rate without a cost cannot be saved.",
  NOT_A_NUMBER: "Price must be a number.",
  NEGATIVE: "Price cannot be negative.",
};

/**
 * Fields whose change means "this is a different offer" rather than "the last
 * entry had a typo in its annotation".
 *
 * Editing any of these supersedes: the old row is closed and a new current row
 * is written, so the price the studio quoted last month is still answerable.
 * Editing only `notes` amends in place — an annotation is not an offer, and
 * spawning a history row for a corrected spelling makes the real price changes
 * harder to find.
 *
 * `before` values arrive straight off a Prisma row, where decimals are objects
 * rather than numbers. They are put through `Number()` first: comparing a
 * Decimal to a number with `!==` is always true, which would make every save
 * look like a price change and turn the history into one row per click.
 */
export function isOfferChange(
  before: {
    price_net: unknown;
    unit: string;
    supplier_party_id: string | null;
  },
  after: {
    price: number | null;
    unit: string | null;
    supplier_party_id: string | null;
  }
): boolean {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return (
    num(before.price_net) !== resolvePrice(after.price) ||
    before.unit !== (after.unit?.trim() || "pcs") ||
    before.supplier_party_id !== after.supplier_party_id
  );
}
