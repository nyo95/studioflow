import type { DirectoryTemplateSlots, TemplateCanvasProps } from "./contracts";
import { DashboardPageShell } from "../layout/shells/dashboard-page-shell";

/**
 * UI ENGINE — DIRECTORY TEMPLATE (PRD Architecture Cleanup v2 §42, R7)
 *
 * Susunan slot mengikuti halaman direktori yang hidup: header (PageHeader —
 * aksi primer lewat prop `action`-nya), search, filters, content, pagination.
 * Template tidak menambah wrapper atau spacing apa pun; margin bepergian
 * dengan node slotnya supaya migrasi nol perubahan visual. Kontrol yang
 * strukturnya satu form dengan search (mis. filter dalam <form> yang sama)
 * ikut slot `search` — template merender slot berurutan tanpa pembungkus.
 */
export function DirectoryTemplate({
  header,
  actions,
  search,
  filters,
  content,
  pagination,
  className,
  as,
}: DirectoryTemplateSlots & TemplateCanvasProps) {
  return (
    <DashboardPageShell as={as} className={className}>
      {header}
      {actions}
      {search}
      {filters}
      {content}
      {pagination}
    </DashboardPageShell>
  );
}
