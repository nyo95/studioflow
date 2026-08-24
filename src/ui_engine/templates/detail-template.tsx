import type { DetailTemplateSlots, TemplateCanvasProps } from "./contracts";
import { DashboardPageShell } from "../layout/shells/dashboard-page-shell";

/**
 * UI ENGINE — DETAIL TEMPLATE (PRD Architecture Cleanup v2 §42, R7)
 *
 * Alur vertikal: header → actions → summary → content(+aside). Bila `aside`
 * diisi, content dan aside dipasangkan dengan idiom dua kolom halaman proyek
 * (`flex flex-col gap-8 lg:flex-row`, content `min-w-0 flex-1`); tanpa aside,
 * content dilebar penuh seperti halaman detail yang ada hari ini.
 */
export function DetailTemplate({
  header,
  actions,
  summary,
  content,
  aside,
  className,
  as,
}: DetailTemplateSlots & TemplateCanvasProps) {
  return (
    <DashboardPageShell as={as} className={className}>
      {header}
      {actions}
      {summary}
      {aside != null ? (
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="min-w-0 flex-1">{content}</div>
          {aside}
        </div>
      ) : (
        content
      )}
    </DashboardPageShell>
  );
}
