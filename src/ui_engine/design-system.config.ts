/**
 * StudioFlow Design System Configuration
 * Source of Truth for: Typography, Colors, Spacing, and Rails.
 * Based on the Visual DNA Audit Report.
 */

export const DESIGN_SYSTEM_CONFIG = {
  typography: {
    h1: {
      family: "font-serif", // Primary Heading: Lora
      size: "text-4xl",
      weight: "font-bold",
      tracking: "tracking-tight",
      color: "text-slate-950",
    },
    h2: {
      family: "font-serif",
      size: "text-3xl",
      weight: "font-bold",
      tracking: "tracking-tight",
      color: "text-slate-950",
    },
    h3: {
      family: "font-serif", // Tertiary Heading: Lora
      size: "text-2xl",
      weight: "font-bold",
      tracking: "tracking-tight",
      color: "text-slate-950",
    },
    h4: {
      family: "font-sans", // Functional UI Heading: Inter
      size: "text-lg",
      weight: "font-semibold",
      tracking: "tracking-tight",
      color: "text-slate-900",
    },
    h5: {
      family: "font-sans",
      size: "text-base",
      weight: "font-semibold",
      tracking: "tracking-tight",
      color: "text-slate-900",
    },
    h6: {
      family: "font-sans",
      size: "text-sm",
      weight: "font-medium",
      tracking: "tracking-tight",
      color: "text-slate-900",
    },
    body: {
      family: "font-sans", // Primary UI/Body: Inter
      size: "text-sm",
      weight: "font-normal",
      tracking: "tracking-normal",
      color: "text-slate-600",
    },
    uiMeta: {
      family: "font-sans",
      size: "text-[10px]",
      weight: "font-bold",
      tracking: "tracking-[0.18em]",
      uppercase: true,
      color: "text-slate-400",
    },
  },
  colors: {
    canvas: "bg-[var(--ui-canvas-bg,rgb(248_250_252))]",
    card: "bg-white",
    sidebar: "bg-white",
    borders: "border-slate-200",
    accent: "bg-slate-900",
  },
  spacing: {
    containerMaxWidth: "max-w-[var(--ui-container-max-width,1280px)]",
    sectionGap: "space-y-[var(--ui-section-gap,2rem)]",
    cardPaddingX: "px-[var(--ui-section-px,1.5rem)]",
    cardPaddingY: "py-[var(--ui-section-py,1.5rem)]",
    radius: "rounded-[var(--ui-radius-card,1.5rem)]",
  },
  rails: {
    outerWidth: "var(--ui-sidebar-rail-width, 78px)",
    innerWidth: "var(--ui-sidebar-width, 256px)",
  },
  ui: {
    topBar: {
      theme: "dark" as "light" | "dark",
    },
    footer: {
      theme: "dark" as "light" | "dark",
    },
  },
};

export type DesignSystemConfig = typeof DESIGN_SYSTEM_CONFIG;
