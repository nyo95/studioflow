import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { DESIGN_SYSTEM_CONFIG } from "../design-system.config";

/**
 * §40 Generic Status Component (PRD Architecture Cleanup v2, R5).
 *
 * The engine receives a TONE and nothing else. Mapping a domain status
 * (`PhaseStatus`, `SkuStatus`, `BqProjectStatus`, …) to a tone belongs to the
 * domain — see `@/lib/ui/status-tone`. The auto-mapping this component used to
 * perform ("ON REVIEW CLIENT" → warning, "READY FOR NEXT" → info, …) was the
 * exact list PRD §40 forbids inside the engine: every new domain status would
 * have required editing UI Engine code.
 */
export const STATUS_TONES = ["neutral", "info", "success", "warning", "critical"] as const;
export type StatusTone = (typeof STATUS_TONES)[number];

const statusBadgeVariants = cva(
  cn(
    "inline-flex items-center px-3 py-1 shadow-sm rounded-full border",
    DESIGN_SYSTEM_CONFIG.typography.uiMeta.family,
    DESIGN_SYSTEM_CONFIG.typography.uiMeta.size,
    DESIGN_SYSTEM_CONFIG.typography.uiMeta.weight,
    DESIGN_SYSTEM_CONFIG.typography.uiMeta.tracking,
    DESIGN_SYSTEM_CONFIG.typography.uiMeta.uppercase ? "uppercase" : "",
    "leading-none"
  ),
  {
    variants: {
      tone: {
        neutral: "border-slate-200 bg-white text-slate-500",
        info: "border-slate-200 bg-slate-50 text-slate-900",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        critical: "border-red-200 bg-red-50 text-red-700",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  /** Text shown inside the badge. Underscores render as spaces. */
  status?: string;
}

export function StatusBadge({
  className,
  tone,
  status,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)} {...props}>
      {children ?? (status ? status.replace(/_/g, " ") : "")}
    </span>
  );
}
