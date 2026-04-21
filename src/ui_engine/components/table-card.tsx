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

interface TableCardProps {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  headerVariant?: "light" | "dark";
}

/**
 * A standardized Table container that follows the StudioFlow Visual DNA.
 * Features: High-radius corners (3xl), subtle borders, and a clean white background with shadow.
 * Refactored to use SectionCard for container consistency.
 */
export function TableCard({ children, className, header, headerVariant = "light" }: TableCardProps) {
  return (
    <SectionCard 
      padding="none" 
      className={className}
      header={header}
      headerVariant={headerVariant}
    >
      <Table className="w-full">
        {children}
      </Table>
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
  ...props
}: React.ComponentProps<typeof TableHead> & { align?: "left" | "right" | "center" }) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  return (
    <TableHead
      className={cn(
        "px-[var(--ui-section-px,1.5rem)] py-4",
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
      className={cn("px-[var(--ui-section-px,1.5rem)] py-[var(--ui-row-padding-y,1rem)]", alignClass, className)}
      {...props}
    >
      {children}
    </TableCell>
  );
}

// Re-export Body for convenience
export { TableBody as TableCardBody };
