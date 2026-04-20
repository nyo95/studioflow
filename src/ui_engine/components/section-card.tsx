import React, { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { UI_ENGINE_RADIUS_CARD } from "@/ui_engine/tokens";

interface SectionCardProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  headerClassName?: string;
  headerVariant?: "light" | "dark";
  padding?: "none" | "sm" | "md" | "lg";
}

/**
 * A standardized container for sections and content blocks.
 * Supports light and dark headers, and follows the StudioFlow Visual DNA (radius config, border, shadow).
 */
export function SectionCard({
  children,
  className,
  header,
  headerClassName,
  headerVariant = "light",
  padding = "md",
}: SectionCardProps) {
  const paddingClasses = {
    none: "",
    sm: "px-[var(--ui-section-px,1.5rem)] py-[calc(var(--ui-section-py,1.5rem)*0.8)]",
    md: "px-[var(--ui-section-px,1.5rem)] py-[var(--ui-section-py,1.5rem)]",
    lg: "px-[var(--ui-section-px,1.5rem)] py-[calc(var(--ui-section-py,1.5rem)*1.2)]",
  };

  return (
    <div className={cn("overflow-hidden border border-slate-200 bg-white shadow-[var(--ui-surface-shadow)] transition-all", UI_ENGINE_RADIUS_CARD, className)}>
      {header && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 px-[var(--ui-section-px,1.5rem)] py-4",
            headerVariant === "dark" 
              ? "bg-slate-900 text-white" 
              : "border-b border-slate-100 bg-slate-50/50",
            headerClassName
          )}
        >
          {header}
        </div>
      )}
      <div className={cn(paddingClasses[padding])}>
        {children}
      </div>
    </div>
  );
}
