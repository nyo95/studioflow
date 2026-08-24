import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getProjectMembershipOrThrow } from "@/core/rbac/permissions";
import { hasPermission, isAdminLevel, PERMISSION } from "@/core/rbac/rbac";
import { getProjectCatalogDocument } from "@/extensions/sketchup/actions/sketchup-actions";
import { getRenderBoards, getScheduleEntryOptions } from "@/extensions/sketchup/actions/render-board-actions";
import { PrintButton } from "@/extensions/sketchup/components/PrintButton";
import { CatalogBoard } from "@/extensions/sketchup/components/CatalogBoard";
import { CatalogCodeManager } from "@/extensions/sketchup/components/CatalogCodeManager";
import { CatalogCover } from "@/extensions/sketchup/components/CatalogCover";
import { RenderBoardPanel } from "@/extensions/sketchup/components/RenderBoardPanel";
import { ProductScheduleTabs } from "@/extensions/sketchup/components/ProductScheduleTabs";

// The Product Schedule IS the catalog board now — this page replaces the old
// table/board schedule UI (see CATALOG_ARCHITECTURE.md). `/sketchup/catalog`
// redirects here so there is a single canonical implementation.
export default async function ProductCatalogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (process.env.NEXT_PUBLIC_ENABLE_MATERIAL_FIXTURES === "false") {
    notFound();
  }

  const { id } = await params;
  const { userId, role } = await getSession();
  if (!userId) notFound();

  // Anyone with schedule VIEW permission may LOOK at any project's schedule
  // (designers can browse each other's work); EDITING requires membership —
  // ADMIN, or the project's assigned designer/drafter. Every write action
  // re-checks both the permission and the membership server-side.
  if (!hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_VIEW)) notFound();
  let isMember = true;
  try {
    await getProjectMembershipOrThrow(prisma, id, userId, role);
  } catch {
    isMember = false;
  }
  const canEdit = isMember && hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_EDIT);
  const canDelete = isMember && hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_DELETE);
  // Promoting an item into the shared Library mirrors Library-creation authority
  // (ADMIN/STAFF); STAFF entries land as PENDING for admin review. This is a
  // Library-curation act (non-destructive to the schedule), so it doesn't
  // require project membership.
  const canSaveToLibrary = isAdminLevel(role) || role === "STAFF";

  const project = await prisma.project.findUnique({
    where: { id },
    select: { project_code: true, name: true, address: true },
  });
  if (!project) notFound();

  const doc = await getProjectCatalogDocument(id);
  const [renderBoards, entryOptions] = await Promise.all([
    getRenderBoards(id),
    getScheduleEntryOptions(id),
  ]);
  const now = new Date();
  const year = now.getFullYear();

  // Cover: project NAME without the leading code, plus location + export date.
  let coverTitle = (project.name || project.project_code || "").trim();
  if (project.project_code && coverTitle.toUpperCase().startsWith(project.project_code.toUpperCase())) {
    coverTitle = coverTitle.slice(project.project_code.length).replace(/^[\s\-–—:.]+/, "").trim();
  }
  coverTitle = coverTitle || project.name || project.project_code;
  const exportDate = `${String(now.getDate()).padStart(2, "0")} ${String(now.getMonth() + 1).padStart(2, "0")} ${year}`;

  return (
    <div style={{ background: "#fff", minHeight: "100vh" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          /* Cover is print-only — keep it out of the on-screen preview. */
          .catalog-cover-wrap { display: none; }
          @media print {
            .catalog-cover-wrap { display: block !important; }
            /* Zero page margin so the black cover can bleed to the paper edge;
               content pages get their margins back via .catalog-sheet padding. */
            @page { size: A4 landscape; margin: 0; }
            header, nav, footer, button, .no-print, [role="button"] { display: none !important; }
            html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; height: auto !important; overflow: visible !important; }
            /* Plain background everywhere — kill any gradients / shadows / tints
               so the export is pure white. */
            * { background-image: none !important; box-shadow: none !important; text-shadow: none !important; }
            /* The dashboard shell clamps everything to one screen height with
               h-screen + overflow-hidden; unclamp so the catalog can flow onto
               multiple pages instead of printing a single clipped page. */
            .h-screen { height: auto !important; }
            .min-h-0 { min-height: 0 !important; }
            .overflow-hidden { overflow: visible !important; }
            .overflow-y-auto, .overflow-auto { overflow: visible !important; }
            /* R6: shell padding-top now uses the header-height token
               (pt-[var(--ui-header-height)]) instead of the old pt-14 utility. */
            .pt-14, .pt-\[var\(--ui-header-height\)\] { padding-top: 0 !important; }
            main { padding: 0 !important; overflow: visible !important; background: #fff !important; }

            /* Full-bleed cover = whole first page. */
            .catalog-cover-wrap { max-width: none !important; margin: 0 !important; padding: 0 !important; }
            .catalog-cover { width: 100% !important; height: 100vh !important; break-after: page; page-break-after: always; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .catalog-cover, .catalog-cover * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

            .catalog-page { max-width: 100% !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
            /* One sheet = one A4 page (a single row of up to 4 cards); the larger
               padding gives a comfortable page margin. */
            .catalog-sheet { break-inside: avoid; page-break-inside: avoid; padding: 16mm 18mm !important; box-sizing: border-box; }
            .catalog-sheet + .catalog-sheet { break-before: page; page-break-before: always; }
            /* Keep the tall portrait photo from the viewer (4:5). A single row of
               4 fills the page height on its own; cap the height so the details
               below always stay on the same page. */
            .catalog-sheet .catalog-photo-hint { aspect-ratio: 4 / 5 !important; height: auto !important; max-height: 118mm !important; margin-bottom: 10px !important; }
            .catalog-card { break-inside: avoid !important; }
            .catalog-page, .catalog-page * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          }
        `,
        }}
      />

      {/* Toolbar (hidden on print) */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="font-serif text-lg font-bold text-slate-900">Product Schedule</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 font-sans text-xs text-slate-500">{project.project_code}</span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={`/api/projects/${id}/sketchup/sheet-export`}
            className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            Export to Sheets (.xlsx)
          </a>
          <PrintButton />
          <Link
            href={`/projects/${id}`}
            className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            Back to Project
          </Link>
        </div>
      </div>

      {/* Cover — hidden in the preview, prints as page 1. */}
      <div className="catalog-cover-wrap">
        <CatalogCover title={coverTitle} subtitle={project.address} exportDate={exportDate} />
      </div>

      <div className="catalog-page mx-auto max-w-[1400px] p-6">
        <ProductScheduleTabs
          schedule={
            <CatalogBoard
              projectId={id}
              projectName={project.name || project.project_code}
              projectCode={project.project_code}
              location={project.address}
              year={year}
              materials={doc.materials}
              fixtures={doc.fixtures}
              canEdit={canEdit}
              canDelete={canDelete}
              canSaveToLibrary={canSaveToLibrary}
              canSyncSwap={role === "DEVELOPER"}
              codeManager={
                <CatalogCodeManager
                  projectId={id}
                  sketchupProjectId={doc.sketchup_project_id}
                  items={doc.code_manager_items}
                  pendingActionCount={doc.pending_action_count}
                  canEdit={canEdit}
                  canManageSketchup={role === "DEVELOPER"}
                />
              }
            />
          }
          renders={
            <RenderBoardPanel
              projectId={id}
              boards={renderBoards}
              entryOptions={entryOptions}
              canEdit={canEdit}
            />
          }
        />
      </div>
    </div>
  );
}
