import type { TemplateCanvasProps, WorkspaceTemplateSlots } from "./contracts";
import { DashboardPageShell } from "../layout/shells/dashboard-page-shell";

/**
 * UI ENGINE — WORKSPACE TEMPLATE (PRD Architecture Cleanup v2 §42, R7)
 *
 * Dua kolom gaya grid 12 (gap-10, primary col-span-8 + space-y-8) persis
 * seperti halaman fase; `secondary` dirender mentah supaya pemanggil bisa
 * mengirim ActionSidebar dengan col-span-nya sendiri. Tanpa `secondary`,
 * primary dilebar penuh — template tidak mengarang batasan kolom.
 */
export function WorkspaceTemplate({
  navigation,
  header,
  primary,
  secondary,
  actions,
  className,
  as,
}: WorkspaceTemplateSlots & TemplateCanvasProps) {
  return (
    <DashboardPageShell as={as} className={className}>
      {navigation}
      {header}
      {actions}
      {secondary != null ? (
        <div className="grid grid-cols-1 gap-10 xl:grid-cols-12">
          <div className="space-y-8 xl:col-span-8">{primary}</div>
          {secondary}
        </div>
      ) : (
        primary
      )}
    </DashboardPageShell>
  );
}
