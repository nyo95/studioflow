import * as React from "react";
import { cn } from "@/lib/utils";
import { UI_ENGINE_RADIUS_CARD } from "@/ui_engine/tokens";

const SimpleCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "overflow-hidden border border-slate-200 bg-white",
      UI_ENGINE_RADIUS_CARD,
      className
    )}
    {...props}
  />
));
SimpleCard.displayName = "SimpleCard";

const SimpleCardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/50 px-[var(--ui-section-px)] py-[var(--ui-section-py)]",
      className
    )}
    {...props}
  />
));
SimpleCardHeader.displayName = "SimpleCardHeader";

const SimpleCardBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("px-[var(--ui-section-px)] py-[var(--ui-section-py)]", className)} {...props} />
));
SimpleCardBody.displayName = "SimpleCardBody";

const SimpleCardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "border-t border-slate-200 px-[var(--ui-section-px)] py-3 text-slate-500",
      className
    )}
    {...props}
  />
));
SimpleCardFooter.displayName = "SimpleCardFooter";

const SimpleCardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("text-sm font-semibold text-slate-950", className)}
    {...props}
  />
));
SimpleCardTitle.displayName = "SimpleCardTitle";

const SimpleCardBadge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600",
      className
    )}
    {...props}
  />
));
SimpleCardBadge.displayName = "SimpleCardBadge";

export {
  SimpleCard,
  SimpleCardBadge,
  SimpleCardBody,
  SimpleCardFooter,
  SimpleCardHeader,
  SimpleCardTitle,
};
