// Raw interaction primitives (Button, Input, Dialog, Select…), re-exported so
// application code has exactly one import surface: `@/ui_engine`. See
// ./primitives/index.ts for which layer to reach for and why.
export * from "./primitives";

export * from "./layout/page-header";
export * from "./navigation/page-back-link";
export * from "./primitives/phase-section";
export * from "./primitives/project-section";
export * from "./primitives/simple-card";
export * from "./components/PhaseLiveProvider";
export * from "./components/ProjectLiveProvider";
export * from "./components/heading";
export * from "./layout/shells/dashboard-page-shell";
export * from "./layout/shells/settings-shell";
export * from "./layout/shells/project-layout-shell";
export * from "./components/section-card";
export * from "./components/table-card";
export * from "./components/status-badge";
export * from "./components/phase-reading";
export * from "./components/phase-lock-notice";
export * from "./components/action-sidebar";
export * from "./design-system.config";
export * from "./tokens"; // Points to ./tokens/index.ts
