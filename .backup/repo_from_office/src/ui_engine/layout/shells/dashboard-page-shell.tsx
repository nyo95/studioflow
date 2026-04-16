import * as React from "react";
import { cn } from "@/lib/utils";
import { CANVAS_BG, CONTAINER_MAX_WIDTH } from "@/ui_engine/tokens";

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
        "mx-auto w-full px-[var(--ui-section-px)] py-[var(--ui-page-padding-y,2.5rem)]",
        CANVAS_BG,
        className
      )}
      style={{ maxWidth: "var(--ui-page-max-width, 1280px)" }}
      {...props}
    >
      {children}
    </Comp>
  );
}
