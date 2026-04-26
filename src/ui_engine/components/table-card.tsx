import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { SectionCard } from "./section-card";
import { DESIGN_SYSTEM_CONFIG } from "../design-system.config";
import { UI_ENGINE_INTERACTIVE_RESIZER } from "../tokens";

interface TableCardProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  headerVariant?: "light" | "dark";
  layout?: "auto" | "fixed";
}

/**
 * A standardized Table container that follows the StudioFlow Visual DNA.
 * Features: High-radius corners (3xl), subtle borders, and a clean white background with shadow.
 * Refactored to use SectionCard for container consistency.
 */
export function TableCard({ children, className, header, headerVariant = "light", layout = "auto" }: TableCardProps) {
  return (
    <SectionCard 
      padding="none" 
      className={cn("overflow-hidden", className)}
      headerVariant={headerVariant}
    >
      {header && (
        <div className="px-5 py-5 border-b border-slate-100 bg-white">
          {header}
        </div>
      )}
      <div className="w-full overflow-hidden">
        <table className={cn(
          "w-full border-collapse text-sm",
          layout === "fixed" ? "table-fixed" : "table-auto"
        )}>
          {children}
        </table>
      </div>
    </SectionCard>
  );
}

/**
 * A standardized Table Header Row that features the subtle slate background.
 */
export function TableCardHeader({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TableHeader>
      <TableRow className={cn("border-slate-200 bg-slate-50/80 hover:bg-slate-50/80", className)}>
        {children}
      </TableRow>
    </TableHeader>
  );
}

/**
 * A standardized Table Head cell with metadata typography (uppercase, tracked, bold).
 */
export function TableCardHead({
  children,
  className,
  align = "left",
  onResizeStart,
  ...props
}: React.ComponentProps<typeof TableHead> & { 
  align?: "left" | "right" | "center";
  onResizeStart?: (e: React.MouseEvent) => void;
}) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <TableHead
      className={cn(
        "px-3 py-4 first:pl-5 last:pr-5 relative group/head",
        DESIGN_SYSTEM_CONFIG.typography.uiMeta.family,
        DESIGN_SYSTEM_CONFIG.typography.uiMeta.size,
        DESIGN_SYSTEM_CONFIG.typography.uiMeta.weight,
        DESIGN_SYSTEM_CONFIG.typography.uiMeta.tracking,
        DESIGN_SYSTEM_CONFIG.typography.uiMeta.uppercase ? "uppercase" : "",
        "text-slate-500",
        alignClass,
        className
      )}
      {...props}
    >
      {children}
      
      {onResizeStart && (
        <div 
          onMouseDown={onResizeStart}
          className={cn("absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20", UI_ENGINE_INTERACTIVE_RESIZER)}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </TableHead>
  );
}

/**
 * A standardized Table Row with consistent border and hover effect.
 */
export function TableCardRow({
  children,
  className,
  ...props
}: React.ComponentProps<typeof TableRow>) {
  return (
    <TableRow
      className={cn("border-slate-200 hover:bg-slate-50/60", className)}
      {...props}
    >
      {children}
    </TableRow>
  );
}

/**
 * A standardized Table Cell with consistent padding.
 */
export function TableCardCell({
  children,
  className,
  align = "left",
  ...props
}: React.ComponentProps<typeof TableCell> & { align?: "left" | "right" | "center" }) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <TableCell
      className={cn(
        "px-3 py-[var(--ui-row-padding-y,1rem)] first:pl-5 last:pr-5", 
        alignClass, 
        className
      )}
      {...props}
    >
      {children}
    </TableCell>
  );
}

// Re-export Body for convenience
export { TableBody as TableCardBody };
