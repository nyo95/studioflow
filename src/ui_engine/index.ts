// Raw interaction primitives (Button, Input, Dialog, Select…), re-exported so
// application code has exactly one import surface: `@/ui_engine`. See
// ./primitives/index.ts for which layer to reach for and why.
export * from "./primitives";

// PRD Architecture Cleanup v2 §36: the engine must not know business domains.
// Phase/Project components used to live here; they were relocated to
// `@/components` in R5 — import them from there, never re-add them to this
// barrel.
export * from "./layout/page-header";
// §41 AppShell — satu shell untuk semua sub-app; rail-active murni (diuji unit).
export * from "./layout/rail-active";
export * from "./layout/app-shell";
export * from "./layout/app-rail";
export * from "./navigation/page-back-link";
export * from "./primitives/simple-card";
export * from "./components/heading";
export * from "./layout/shells/settings-shell";
export * from "./components/section-card";
export * from "./components/table-card";
export * from "./components/action-sidebar";
// §40 generic status component — tone-only; status→tone mapping lives in
// the domains (`@/lib/ui/status-tone`), never here.
export * from "./components/status-badge";
export * from "./patterns";
export * from "./theme";
// §42 R7: kontrak slot + implementasi ketujuh template (templates/index.ts
// juga mengekspor ./contracts, jadi jangan diekspor dua kali di sini).
export * from "./templates";
export * from "./design-system.config";
export * from "./tokens"; // Points to ./tokens/index.ts
