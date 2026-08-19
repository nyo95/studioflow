/**
 * ReadValue — display-mode field value renderer.
 *
 * Shows a value in a subtle background pill when a form field is in read-only
 * (non-editing) mode. Falls back to an em-dash placeholder when empty.
 *
 * Usage:
 *   <ReadValue>{someValue}</ReadValue>
 *   <ReadValue>{form.brand_name}</ReadValue>
 *
 * Rule: Always use this instead of writing the cn(...) block inline.
 * See docs/CRUD-CONVENTIONS.md §ReadValue.
 */
import * as React from "react";
import {
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_TYPE_BODY,
} from "@/ui_engine";
import { cn } from "@/lib/utils";

interface ReadValueProps {
  children?: React.ReactNode;
  /** Extra Tailwind classes to merge onto the container */
  className?: string;
}

export function ReadValue({ children, className }: ReadValueProps) {
  return (
    <div
      className={cn(
        "min-h-[2.5rem] whitespace-pre-wrap px-[calc(var(--ui-section-px)/2)] py-[calc(var(--ui-section-py)/2)] text-slate-950",
        UI_ENGINE_BG_SUBTLE,
        UI_ENGINE_RADIUS_CONTROL,
        UI_ENGINE_TYPE_BODY,
        className
      )}
    >
      {children || <span className="text-slate-400">—</span>}
    </div>
  );
}
