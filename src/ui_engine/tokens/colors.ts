export const CANVAS_BG = "bg-[var(--ui-canvas-bg,rgb(248_250_252))]";
export const BORDER_COLOR = "border-slate-200";
/** Alias so both names resolve — BORDER_DEFAULT = slate-200. */
export const BORDER_DEFAULT = "border-slate-200";
export const BORDER_SUBTLE = "border-[var(--ui-border-subtle,rgb(241_245_249))]";
export const BG_SUBTLE = "bg-[var(--ui-bg-subtle,rgb(248_250_252))]";
/**
 * Tangga teks — SELURUHNYA lolos WCAG AA (4,5:1) di atas putih.
 *
 * Sebelum 2026-08-27 `TEXT_TERTIARY` adalah `slate-400` (#94a3b8), yang cuma
 * 2,6:1 — gagal AA bahkan untuk ambang teks besar. Ia dipakai untuk hal yang
 * BUKAN hiasan: kode pekerjaan, hitungan baris, label kolom. Estimator membaca
 * layar itu berjam-jam, sering di laptop biasa dan ruang terang.
 *
 * Tangganya diturunkan satu tingkat, bukan diratakan — tiga tier tetap ada,
 * tapi yang paling redup pun sekarang terbaca.
 *
 * `TEXT_SECONDARY` juga dibetulkan: ia menulis slate-500 sementara
 * `--ui-text-secondary` di designTokens.css menulis #475569 (slate-600).
 * Keduanya sekarang slate-600.
 *
 * Kalau butuh yang lebih redup dari TERTIARY, jawabannya BUKAN slate-400 —
 * melainkan menghapus teksnya, atau memindahkannya ke tooltip.
 */
export const TEXT_PRIMARY = "text-slate-950";
/** --ui-text-secondary: #475569 (slate-600). 7,5:1. */
export const TEXT_SECONDARY = "text-slate-600";
/** --ui-text-tertiary: #64748b (slate-500). 4,8:1 — tier paling redup yang sah. */
export const TEXT_TERTIARY = "text-slate-500";
export const TEXT_ACCENT = "text-slate-700";

/**
 * Ikon yang MURNI dekoratif — chevron, garis pemisah, glif tanpa makna sendiri.
 * Boleh lebih redup karena maknanya sudah dibawa teks di sebelahnya (WCAG 1.4.11
 * mengecualikan yang murni dekoratif). Jangan dipakai untuk ikon yang
 * sendirian menyampaikan status atau jadi satu-satunya penanda aksi.
 */
export const ICON_DECORATIVE = "text-slate-400";
/** Ikon yang membawa makna atau jadi target aksi. Wajib tier ini ke atas. */
export const ICON_DEFAULT = "text-slate-500";
export const TEXT_INVERSE = "text-white";
/** Amber change-pending series: matches --ui-change-pending* in designTokens.css. */
export const TEXT_CHANGE_PENDING = "text-amber-700";
export const BG_CHANGE_PENDING = "bg-amber-50";
export const BORDER_CHANGE_PENDING = "border-amber-200";

export const UI_ENGINE_BG_SUBTLE = BG_SUBTLE;
export const UI_ENGINE_BORDER_SUBTLE = BORDER_SUBTLE;
export const UI_ENGINE_INTERACTIVE_RESIZER = "hover:bg-slate-300/50 active:bg-slate-400 transition-colors group-hover/head:bg-slate-200/50";
export const INTERACTIVE_RESIZER = "hover:bg-slate-300/50 active:bg-slate-400 transition-colors group-hover/head:bg-slate-200/50";
