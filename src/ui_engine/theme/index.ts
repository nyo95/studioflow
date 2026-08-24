/**
 * UI ENGINE — THEME LAYER (PRD Architecture Cleanup v2 §37, dibangun R5)
 * ============================================================================
 * Theme adalah pemilik nilai-nilai visual global:
 *
 *   typography · colors · spacing · radius · shadow · density ·
 *   header height · rail widths · canvas
 *
 * Pembagian kepemilikan saat ini:
 *
 *   - Typography/colors/spacing/radius : `../tokens/*` + `../design-system.config`
 *     (tetap SSOT; theme TIDAK me-re-export mereka — barrel `@/ui_engine` sudah
 *     mengekspor keduanya, dan duplikasi ekspor menciptakan ambiguitas).
 *   - Shadow/density/chrome geometry   : modul ini.
 *
 * §37 secara eksplisit melarang geometri hardcoded seperti `78px`, `256px`,
 * `top-14` tersebar di kode aplikasi — semuanya harus diturunkan dari token
 * di bawah. Shell yang masih menuliskan angka itu (dashboard layout, shell
 * proyek lama) bermigrasi ke token ini di fase R6; sampai saat itu, JANGAN
 * menambahkan angka hardcoded baru — pakai token di sini.
 */

/** Bayangan permukaan kartu — pasangan var(--ui-shadow-card) di designTokens.css. */
export const SHADOW_CARD = "shadow-[var(--ui-shadow-card)]";
/** Bayangan permukaan mengambang (dropdown, drawer, popover). */
export const SHADOW_ELEVATED = "shadow-[var(--ui-shadow-elevated)]";

/** Tinggi header tetap aplikasi. `top-14` pada shell mana pun digantikan ini. */
export const APP_HEADER_HEIGHT_CLASS = "h-[var(--ui-header-height)]";
export const APP_HEADER_TOP_CLASS = "top-[var(--ui-header-height)]";
/** Lebar rail navigasi luar saat collapsed dan expanded. */
export const APP_RAIL_COLLAPSED_WIDTH_CLASS = "w-[var(--ui-rail-width-collapsed)]";
export const APP_RAIL_EXPANDED_WIDTH_CLASS = "w-[var(--ui-rail-width-expanded)]";
export const APP_RAIL_LEFT_CLASS = "left-[var(--ui-rail-width-collapsed)]";

/**
 * Kepadatan baris tabel/list. Nilai default `comfortable`; engine tidak
 * menebak konteks domain — pemanggil yang memilih.
 */
export type Density = "compact" | "comfortable";
export const DENSITY_ROW_PY: Record<Density, string> = {
  compact: "py-1",
  comfortable: "py-2.5",
};
