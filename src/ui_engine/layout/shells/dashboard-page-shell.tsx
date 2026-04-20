import * as React from "react";
import { cn } from "@/lib/utils";
import { CANVAS_BG } from "@/ui_engine/tokens";

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
        "mx-auto w-full max-w-[var(--ui-page-max-width,1280px)] px-[var(--ui-section-px,1.5rem)] py-[var(--ui-page-padding-y,2.5rem)]",
        CANVAS_BG,
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
