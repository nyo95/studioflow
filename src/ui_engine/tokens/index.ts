import { cn } from "@/lib/utils";
import { DESIGN_SYSTEM_CONFIG } from "../design-system.config";

// --- Atomic Token Exports ---
export * from "./spacing";
export * from "./radius";
export * from "./colors";
export * from "./typography";
export * from "./components";

import * as spacing from "./spacing";
import * as radius from "./radius";
import * as colors from "./colors";
import * as typography from "./typography";

// --- LEGACY UI_ENGINE_* MAPPINGS (SSOT) ---
// These satisfy existing components throughout the application.

// 1. Core Layout & Widths
export const CONTAINER_MAX_WIDTH = spacing.CONTAINER_MAX_WIDTH;
export const UI_ENGINE_CONTAINER_MAX_WIDTH = spacing.CONTAINER_MAX_WIDTH;
export const UI_ENGINE_CENTERED_CONTAINER_CLASS = cn("mx-auto w-full", spacing.CONTAINER_MAX_WIDTH);
export const UI_ENGINE_SPACING_SECTION_PX = "px-[var(--ui-section-px)]";
export const UI_ENGINE_SPACING_SECTION_PY = "py-[var(--ui-section-py)]";
export const UI_ENGINE_PAGE_SHELL_CLASS = cn(UI_ENGINE_CENTERED_CONTAINER_CLASS, "px-8 py-10");

// 2. Aesthetic Tokens (Radius & Colors)
export const UI_ENGINE_RADIUS_CARD = radius.RADIUS_CARD;
export const UI_ENGINE_RADIUS_BUTTON = radius.RADIUS_BUTTON;
export const UI_ENGINE_RADIUS_INPUT = radius.RADIUS_INPUT;

export const CANVAS_BG = colors.CANVAS_BG;
export const UI_ENGINE_CANVAS_BG = colors.CANVAS_BG;
export const UI_ENGINE_CANVAS_CLASS = colors.CANVAS_BG;
export const UI_ENGINE_NAV_BG = "bg-white";
export const UI_ENGINE_CARD_BG = "bg-white";
export const UI_ENGINE_ACCENT_PRIMARY = colors.TEXT_PRIMARY;
export const UI_ENGINE_BORDER_COLOR = colors.BORDER_COLOR || "border-slate-200";

// 3. Typography Tokens
export const TYPE_H1 = typography.TEXT_H1;
export const TYPE_H2 = typography.TEXT_H2;
export const TYPE_H3 = typography.TEXT_H3;
export const TYPE_H4 = typography.TEXT_H4;
export const TYPE_BODY = typography.TEXT_SIZE_BODY;
export const TYPE_META = typography.TEXT_SIZE_BADGE;

export const UI_ENGINE_FONT_SANS = typography.FONT_BODY;
export const UI_ENGINE_FONT_SERIF = typography.FONT_HEADING;
export const UI_ENGINE_TYPE_H1 = typography.TEXT_H1;
export const UI_ENGINE_TYPE_H2 = cn("font-serif font-bold tracking-tight lowercase italic", typography.TEXT_H2);
export const UI_ENGINE_TYPE_BODY = typography.TEXT_SIZE_BODY;
export const UI_ENGINE_TYPE_META = typography.TEXT_SIZE_BADGE;

// 4. Page Header Specifics
export const UI_ENGINE_PAGE_HEADER_TITLE_CLASS = cn("mt-1 select-none", typography.FONT_HEADING, typography.TEXT_H1, colors.TEXT_PRIMARY);
export const UI_ENGINE_PAGE_HEADER_DESCRIPTION_CLASS = cn("mt-1.5 select-none", typography.FONT_BODY, typography.TEXT_SIZE_BODY, colors.TEXT_SECONDARY);

// 5. Phase Section Component Classes
export const UI_ENGINE_PHASE_SECTION_ITEM_CLASS = cn("overflow-hidden border bg-white", colors.BORDER_COLOR, radius.RADIUS_CARD);
export const UI_ENGINE_PHASE_SECTION_TRIGGER_CLASS = cn("group flex flex-1 items-start justify-between gap-4 transition-colors hover:bg-slate-50", spacing.CARD_PADDING_X, spacing.ROW_PADDING_Y);
export const UI_ENGINE_PHASE_SECTION_CONTENT_CLASS = cn("border-t", colors.BORDER_COLOR, spacing.CARD_PADDING_X, spacing.ROW_PADDING_Y);
export const UI_ENGINE_PHASE_SECTION_BADGE_CLASS = cn("bg-white px-4 py-2 font-semibold uppercase tracking-[0.18em]", colors.BORDER_COLOR, typography.TEXT_SIZE_BADGE);

// 6. Project Section Component Classes
export const UI_ENGINE_PROJECT_SECTION_GROUP_CLASS = "space-y-8";
export const UI_ENGINE_PROJECT_SECTION_CARD_CLASS = cn("overflow-hidden border bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.16)] text-left", radius.RADIUS_CARD, colors.BORDER_COLOR);
export const UI_ENGINE_PROJECT_SECTION_TRIGGER_CLASS = cn("group w-full text-left transition-colors hover:bg-slate-100/70", radius.RADIUS_CARD);
export const UI_ENGINE_PROJECT_SECTION_HEADER_CLASS = cn("items-start gap-6 border-b bg-slate-50", colors.BORDER_COLOR, spacing.CARD_PADDING_X, spacing.ROW_PADDING_Y);
export const UI_ENGINE_PROJECT_SECTION_CONTENT_CLASS = "contents";

// 7. Utility Classes
export const UI_ENGINE_TASK_ROW_CLASS = "group flex cursor-pointer items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 transition-colors duration-150 hover:bg-slate-50";
export const UI_ENGINE_INLINE_ADD_ACTION_CLASS = "flex w-full items-center gap-2 rounded-lg px-0 py-1 text-left text-sm text-slate-400 transition-colors hover:text-slate-700";
export const UI_ENGINE_INLINE_ADD_INPUT_CLASS = "flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-all";

// 8. Schedule Component Classes (Pillar 2)
export const UI_ENGINE_SCHEDULE_CODE_CLASS = "font-sans text-sm font-bold tracking-tight text-slate-900 uppercase";
export const UI_ENGINE_SCHEDULE_NAME_CLASS = "font-sans text-sm font-medium text-slate-900 hover:underline cursor-pointer truncate leading-tight";
export const UI_ENGINE_SCHEDULE_BRAND_CLASS = "font-sans text-xs font-medium text-slate-500";
export const UI_ENGINE_SCHEDULE_META_CLASS = "font-sans text-[10px] font-medium text-slate-400 uppercase tracking-wider";
export const UI_ENGINE_SCHEDULE_FINAL_BADGE_CLASS = "font-sans text-[10px] font-bold text-slate-950 bg-slate-200 px-1.5 py-0.5 rounded";
export const UI_ENGINE_SCHEDULE_OPTION_CARD_CLASS = "rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 hover:shadow-sm transition-all";
export const UI_ENGINE_SCHEDULE_DROPDOWN_CLASS = "h-8 w-8 p-0 text-slate-400 hover:text-slate-900 hover:bg-slate-100";

// 9. Color Aliases for convenience
export const TEXT_PRIMARY = colors.TEXT_PRIMARY;
export const TEXT_SECONDARY = colors.TEXT_SECONDARY;
export const TEXT_MUTED = colors.TEXT_MUTED;
