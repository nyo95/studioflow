import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center px-3 py-1 text-[10px] uppercase font-bold tracking-[0.2em] shadow-sm rounded-full border",
  {
    variants: {
      variant: {
        default: "border-slate-200 bg-slate-50 text-slate-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        info: "border-blue-200 bg-blue-50 text-blue-700",
        critical: "border-red-200 bg-red-50 text-red-700",
        neutral: "border-slate-200 bg-white text-slate-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  status: string;
}

export function StatusBadge({
  className,
  variant,
  status,
  ...props
}: StatusBadgeProps) {
  // Auto-map variant based on common status strings if variant is not explicitly provided
  let computedVariant = variant || "default";

  if (!variant && status) {
    const normalizedStatus = status.toUpperCase().replace(/_/g, " ");
    if (["IN PROGRESS", "ACTIVE"].includes(normalizedStatus)) {
      computedVariant = "success";
    } else if (["ON REVIEW INTERNAL", "ON REVIEW CLIENT", "PENDING"].includes(normalizedStatus)) {
      computedVariant = "warning";
    } else if (["COMPLETED", "READY FOR NEXT", "APPROVED"].includes(normalizedStatus)) {
      computedVariant = "info";
    } else if (["REJECTED", "CANCELLED", "OVERDUE"].includes(normalizedStatus)) {
      computedVariant = "critical";
    } else {
      computedVariant = "neutral";
    }
  }

  return (
    <span
      className={cn(statusBadgeVariants({ variant: computedVariant }), className)}
      {...props}
    >
      {status ? status.replace(/_/g, " ") : ""}
    </span>
  );
}
