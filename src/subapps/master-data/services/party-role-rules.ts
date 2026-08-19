import type { PartyRoleKind } from "@/generated/prisma";

/**
 * MASTER DATA — party-category rules, with no I/O.
 *
 * Free of `server-only` and of Prisma so `npm test` can reach it (roadmap
 * §Perkakas). The list below is a judgement about the workbook, not a lookup,
 * which is exactly the kind of thing worth pinning with a test.
 */

/**
 * Categories that may be named as the source of a material price.
 *
 * All six, and the reason is `design database masterdata.xlsx` Table 1: the
 * workbook's own examples of "Supplier's Company" are **Ace Hardware** and
 * **Informa**, both filed under Company Category *Retail*. A filter on
 * SUPPLIER alone would have excluded both of them.
 *
 * SERVICE_VENDOR and SUBCON are in the list too. They mainly sell work rather
 * than goods, but Excel's §Halaman row 40–41 marks both as *(material & upah)*
 * — a subcon who supplies and installs is quoting for the material as well.
 *
 * What is NOT accepted is a party with **no** category at all. That is not a
 * judgement about the company; it means nobody has said what it is yet.
 */
export const PRICE_SOURCE_ROLES: PartyRoleKind[] = [
  "SUPPLIER",
  "RETAIL",
  "DISTRIBUTOR",
  "MANUFACTURER",
  "SUBCON",
  "SERVICE_VENDOR",
];

/** True when this party may be offered in a price-source picker. */
export function canBePriceSource(roles: PartyRoleKind[]): boolean {
  return roles.length > 0 && roles.some((r) => PRICE_SOURCE_ROLES.includes(r));
}

/**
 * Party yang boleh ditawarkan sebagai VENDOR — penyedia jasa untuk `WorkPrice`.
 *
 * Ditambahkan 2026-08-18 (audit H4). Sampai saat ini `getServiceVendorsAction`
 * mengembalikan SEMUA Party tanpa memfilter role sama sekali — pemilik merek,
 * retail, distributor pun muncul di picker Vendor. `AGENTS.md §0` menetapkan
 * Vendor = penyedia JASA, dan `quickCreateWorkVendorAction` sudah memakai
 * aturan yang sama persis: SUBCON dan SERVICE_VENDOR, karena Sheet2 §40-41
 * menandai keduanya *(material & upah)* — subcon yang memasang sekaligus
 * menyuplai tetap mengutip untuk jasanya.
 *
 * Bukan `PRICE_SOURCE_ROLES` di atas: itu untuk SIAPA MENJUAL BARANG (SkuPrice
 * supplier), dan sengaja lebih luas (termasuk RETAIL, MANUFACTURER). Vendor
 * kerja adalah pertanyaan yang berbeda.
 */
export const WORK_VENDOR_ROLES: PartyRoleKind[] = ["SERVICE_VENDOR", "SUBCON"];

/** True when this party may be offered in a work-vendor picker. */
export function canBeWorkVendor(roles: PartyRoleKind[]): boolean {
  return roles.some((r) => WORK_VENDOR_ROLES.includes(r));
}
