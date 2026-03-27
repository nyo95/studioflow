import * as React from "react";
import { cn } from "@/lib/utils";
import {
  UI_ENGINE_CANVAS_CLASS,
  UI_ENGINE_PAGE_SHELL_CLASS,
} from "@/ui_engine/tokens";

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
      className={cn(UI_ENGINE_PAGE_SHELL_CLASS, UI_ENGINE_CANVAS_CLASS, className)}
      {...props}
    >
      {children}
    </Comp>
  );
}
