/**
 * UI ENGINE — PRIMITIVE RE-EXPORTS
 * ============================================================================
 * The shadcn-derived components under `@/components/ui/*` are the *internal*
 * primitives of the UI Engine, not a parallel public API. Application code
 * imports them from `@/ui_engine`; only files inside `src/ui_engine/**` may
 * import `@/components/ui/*` directly (enforced by `no-restricted-imports` in
 * eslint.config.mjs).
 *
 * WHY THIS FILE EXISTS
 * ----------------------------------------------------------------------------
 * Before it, two layers coexisted with no stated relationship, and they did
 * not agree on tokens:
 *
 *   SectionCard / SimpleCard (ui_engine)  ->  border-slate-200 + --ui-surface-shadow
 *   Card (components/ui)                  ->  --ui-border-subtle + --ui-shadow-card
 *
 * A page composed from the wrong layer renders subtly differently from the rest
 * of the app, and nothing flags it. That is exactly how MASTER_SSOT §8 Issue 7
 * ("Design Token Hardcoding") got reintroduced in the first version of
 * BrandLibraryExplorer.
 *
 * WHICH LAYER TO USE
 * ----------------------------------------------------------------------------
 * Prefer the UI Engine composition components for anything structural:
 *   containers/sections -> SectionCard, SimpleCard, TableCard
 *   headings            -> Heading
 *   page frames         -> DashboardPageShell, SettingsShell
 *   status pills        -> StatusBadge (tone-only; mapping status→tone ada di
 *                          domain, lihat `@/lib/ui/status-tone`)
 *
 * Komponen Phase/Project bukan bagian engine lagi — sejak R5 (PRD §36) ia
 * hidup di `@/components` dan TIDAK boleh dikembalikan ke barrel ini.
 *
 * Reach for the raw primitives below only for genuine form/interaction
 * controls (Button, Input, Dialog, Select…) that the Engine does not wrap.
 * If you find yourself reaching for a raw CSS variable in an arbitrary-value
 * class on one of them, that is the signal an Engine component is missing — add
 * it here rather than hardcoding the token at the call site.
 */

export * from "@/components/ui/accordion";
export * from "@/components/ui/alert-dialog";
export * from "@/components/ui/avatar";
export * from "@/components/ui/badge";
export * from "@/components/ui/button";
export * from "@/components/ui/card";
export * from "@/components/ui/checkbox";
export * from "@/components/ui/creatable-checklist";
export * from "@/components/ui/creatable-search";
export * from "@/components/ui/creatable-tag-input";
export * from "@/components/ui/dialog";
export * from "@/components/ui/dropdown-menu";
export * from "@/components/ui/image-lightbox";
export * from "@/components/ui/image-markup-modal";
export * from "@/components/ui/input";
export * from "@/components/ui/label";
export * from "@/components/ui/optimized-uploader";
export * from "@/components/ui/scroll-area";
export * from "@/components/ui/select";
export * from "@/components/ui/sheet";
export * from "@/components/ui/skeleton";
export * from "@/components/ui/sonner";
export * from "@/components/ui/table";
export * from "@/components/ui/tabs";
export * from "@/components/ui/tag-input";
export * from "@/components/ui/tooltip";
export * from "@/components/ui/universal-image-uploader";
export * from "@/components/ui/visual-asset";
