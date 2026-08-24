import type { DashboardTemplateSlots, TemplateCanvasProps } from "./contracts";
import { DashboardPageShell } from "../layout/shells/dashboard-page-shell";

/**
 * UI ENGINE — DASHBOARD TEMPLATE (PRD Architecture Cleanup v2 §42, R7)
 *
 * Susunan paling tipis: header → content → sidebar, semuanya opsional kecuali
 * content. Tidak ada pembungkus tambahan — halaman dashboard yang hidup hari
 * ini satu kolom penuh.
 */
export function DashboardTemplate({
  header,
  content,
  sidebar,
  className,
  as,
}: DashboardTemplateSlots & TemplateCanvasProps) {
  return (
    <DashboardPageShell as={as} className={className}>
      {header}
      {content}
      {sidebar}
    </DashboardPageShell>
  );
}
