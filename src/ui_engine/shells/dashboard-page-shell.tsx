import * as React from "react";
import { cn } from "@/lib/utils";
import { DESIGN_SYSTEM_CONFIG } from "@/ui_engine/design-system.config";

type DashboardPageShellProps = React.HTMLAttributes<HTMLDivElement> & {
  as?: "div" | "main" | "section";
};

export function DashboardPageShell({
  as,
  className,
  children,
  ...props
}: DashboardPageShellProps) {
  const Comp = as ?? "main";

  return (
    <Comp
      className={cn(
        DESIGN_SYSTEM_CONFIG.spacing.containerMaxWidth,
        "mx-auto w-full px-[var(--ui-section-px)] py-10",
        DESIGN_SYSTEM_CONFIG.colors.canvas,
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
