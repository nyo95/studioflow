import type { SettingsTemplateSlots, TemplateCanvasProps } from "./contracts";
import { DashboardPageShell } from "../layout/shells/dashboard-page-shell";

/**
 * UI ENGINE — SETTINGS TEMPLATE (PRD Architecture Cleanup v2 §42, R7)
 *
 * Grid navigasi-kiri/konten-kanan (260px) milik permukaan settings; kartu
 * navigasi dan judul section tetap milik pemanggil lewat slot `navigation`
 * dan `content`, jadi teks tab (domain) tidak pernah masuk engine.
 */
export function SettingsTemplate({
  header,
  navigation,
  content,
  className,
  as,
}: SettingsTemplateSlots & TemplateCanvasProps) {
  return (
    <DashboardPageShell as={as} className={className}>
      {header}
      {navigation != null ? (
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
          {navigation}
          <section className="space-y-6">{content}</section>
        </div>
      ) : (
        content
      )}
    </DashboardPageShell>
  );
}
