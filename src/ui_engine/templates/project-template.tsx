import type { ProjectTemplateSlots, TemplateCanvasProps } from "./contracts";
import { DashboardPageShell } from "../layout/shells/dashboard-page-shell";

/**
 * UI ENGINE — PROJECT TEMPLATE (PRD Architecture Cleanup v2 §42, R7)
 *
 * Sadar-proyek secara struktural (menerima konteks lewat slot), tidak
 * sadar-bisnis. Dua kolom memakai idiom persis halaman overview proyek:
 * `flex flex-col gap-8 lg:flex-row` + content `min-w-0 flex-1 space-y-8`;
 * `aside` dirender mentah (pemanggil mengirim ActionSidebar apa adanya).
 */
export function ProjectTemplate({
  navigation,
  header,
  content,
  aside,
  className,
  as,
}: ProjectTemplateSlots & TemplateCanvasProps) {
  return (
    <DashboardPageShell as={as} className={className}>
      {navigation}
      {header}
      {aside != null ? (
        <div className="flex flex-col gap-8 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-8">{content}</div>
          {aside}
        </div>
      ) : (
        content
      )}
    </DashboardPageShell>
  );
}
