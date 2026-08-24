import type {
  SpreadsheetTemplateSlots,
  TemplateCanvasProps,
} from "./contracts";
import { DashboardPageShell } from "../layout/shells/dashboard-page-shell";

/**
 * UI ENGINE — SPREADSHEET TEMPLATE (PRD Architecture Cleanup v2 §42, R7)
 *
 * Urutan slot mengikuti lembar kerja: header → toolbar → grid → inspector →
 * summary. Grid dirender mentah — pembungkusnya (stack kartu objek, tabel)
 * adalah isi slot, bukan urusan template.
 */
export function SpreadsheetTemplate({
  header,
  toolbar,
  grid,
  inspector,
  summary,
  className,
  as,
}: SpreadsheetTemplateSlots & TemplateCanvasProps) {
  return (
    <DashboardPageShell as={as} className={className}>
      {header}
      {toolbar}
      {grid}
      {inspector}
      {summary}
    </DashboardPageShell>
  );
}
