import { cn } from "@/lib/utils";
import { DESIGN_SYSTEM_CONFIG } from "./design-system.config";

export const UI_ENGINE_CANVAS_CLASS = "bg-canvas";
export const UI_ENGINE_RADIUS_CARD = DESIGN_SYSTEM_CONFIG.spacing.radius;
export const UI_ENGINE_CENTERED_CONTAINER_CLASS =
  cn("mx-auto w-full", DESIGN_SYSTEM_CONFIG.spacing.containerMaxWidth);

export const UI_ENGINE_PAGE_SHELL_CLASS =
  cn(UI_ENGINE_CENTERED_CONTAINER_CLASS, DESIGN_SYSTEM_CONFIG.spacing.cardPaddingX, "py-10");
export const UI_ENGINE_PAGE_HEADER_TITLE_CLASS =
  "mt-1 select-none font-serif text-3xl font-extrabold uppercase tracking-widest text-black";
export const UI_ENGINE_PAGE_HEADER_DESCRIPTION_CLASS =
  "mt-1.5 select-none font-sans text-sm font-light text-slate-500";
export const UI_ENGINE_PHASE_SECTION_ITEM_CLASS =
  "overflow-hidden rounded-[var(--ui-radius-card)] border border-slate-200 bg-white";
export const UI_ENGINE_PHASE_SECTION_TRIGGER_CLASS =
  "group flex flex-1 items-start justify-between gap-4 px-6 py-[var(--ui-row-padding-y,1.5rem)] text-left transition-colors hover:bg-slate-50 md:px-8";
export const UI_ENGINE_PHASE_SECTION_CONTENT_CLASS =
  "border-t border-slate-200 px-6 py-[var(--ui-row-padding-y,1.5rem)] md:px-8";
export const UI_ENGINE_PHASE_SECTION_BADGE_CLASS =
  "border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em]";
export const UI_ENGINE_TASK_ROW_CLASS =
  "group flex cursor-pointer items-start gap-3 rounded-xl border border-transparent bg-slate-50/70 px-3 py-2.5 transition-all hover:border-slate-200 hover:bg-white";
export const UI_ENGINE_INLINE_ADD_ACTION_CLASS =
  "flex w-full items-center gap-2 rounded-lg px-0 py-1 text-left text-sm text-slate-400 transition-colors hover:text-slate-700";
export const UI_ENGINE_INLINE_ADD_INPUT_CLASS =
  "flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-all";
export const UI_ENGINE_PROJECT_SECTION_GROUP_CLASS = "space-y-8";
export const UI_ENGINE_PROJECT_SECTION_CARD_CLASS =
  "overflow-hidden rounded-[var(--ui-radius-card)] border border-slate-200 bg-white shadow-[0_18px_50px_-28px_rgba(15,23,42,0.16)] text-left";
export const UI_ENGINE_PROJECT_SECTION_TRIGGER_CLASS =
  "group w-full rounded-[var(--ui-radius-card)] text-left transition-colors hover:bg-slate-100/70";
export const UI_ENGINE_PROJECT_SECTION_HEADER_CLASS =
  "items-start gap-6 border-b border-slate-200 bg-slate-50 px-6 py-[var(--ui-row-padding-y,1.5rem)] md:px-8";
export const UI_ENGINE_PROJECT_SECTION_CONTENT_CLASS = "contents";
