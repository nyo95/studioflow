import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardPageShell, PageBackLink, PageHeader } from "@/ui_engine";
import {
  generateApiKeyAction,
  revokeApiKeyAction,
} from "@/extensions/sketchup/actions/sketchup-actions";
import { SketchupMappingQueue } from "@/extensions/sketchup/components/SketchupMappingQueue";
import { PushToScheduleButton } from "@/extensions/sketchup/components/PushToScheduleButton";

import { getSession } from "@/lib/auth";

export default async function SketchupIntegrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role } = await getSession();
  
  if (role !== "ADMIN") {
    notFound();
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      sketchup_projects: {
        include: {
          materials: true,
          ffes: true,
          merge_actions: true,
        },
      },
    },
  });

  if (!project) notFound();

  // Fetch all material schedule entries for this project to map against
  const scheduleEntries = await prisma.projectScheduleEntry.findMany({
    where: {
      project_id: id,
      section: "material",
    },
    orderBy: [
      { schedule_prefix: "asc" },
      { schedule_increment: "asc" },
    ],
  });

  return (
    <DashboardPageShell>
      <PageBackLink />
      <PageHeader
        title="SketchUp Integration"
        description={`Manage your SketchUp models and synchronize materials/FF&E for ${project.name}.`}
        action={
          <div className="flex items-center gap-3">
            {project.sketchup_projects.length > 0 && (
              <PushToScheduleButton sketchupProjectId={project.sketchup_projects[0].id} />
            )}
            <Link
              href={`/projects/${id}/sketchup/export`}
              className="px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-[var(--ui-radius-action)] text-sm font-medium transition-colors"
            >
              Export Printable PDF
            </Link>
            <form
              action={async () => {
                "use server";
                await generateApiKeyAction(id, "Main Design Model");
              }}
            >
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white rounded-[var(--ui-radius-action)] text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Link New Model
              </button>
            </form>
          </div>
        }
      />

      {/* Linked Models */}
      <div className="grid gap-6">
        {project.sketchup_projects.length === 0 ? (
          <div className="p-12 text-center border border-slate-200 border-dashed rounded-[var(--ui-radius-card)] bg-white shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-2 font-serif">
              No SketchUp Models Linked
            </h3>
            <p className="text-slate-500 font-sans text-sm max-w-sm mx-auto">
              Generate an API key to link your SketchUp Ruby plugin to this project and begin syncing materials.
            </p>
          </div>
        ) : (
          project.sketchup_projects.map((sp) => (
            <div key={sp.id} className="space-y-6">
              {/* API Info Card */}
              <div className="border border-slate-200 rounded-[var(--ui-radius-card)] bg-white overflow-hidden shadow-sm">
                <div className="p-6 bg-slate-50/50 border-b border-slate-200 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <h3 className="font-serif font-bold text-lg text-slate-900">
                      {sp.sketchup_model_name}
                    </h3>
                    <div className="text-sm text-slate-500 flex gap-4 mt-1">
                      <span>{sp.materials.length} Materials Synced</span>
                      <span>{sp.ffes.length} FF&E Synced</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <span className="text-slate-500 mr-2">API Key:</span>
                      <code className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-mono text-xs select-all">
                        {sp.api_key}
                      </code>
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await revokeApiKeyAction(sp.id, id);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:text-red-700 font-medium px-2.5 py-1.5 bg-red-50 hover:bg-red-100 rounded-[var(--ui-radius-action)] transition-colors"
                      >
                        Revoke Access
                      </button>
                    </form>
                  </div>
                </div>

                <div className="p-6">
                  <h4 className="font-sans font-semibold text-sm text-slate-900 mb-3 border-b border-slate-100 pb-2">
                    Merge Actions Queue
                  </h4>
                  {sp.merge_actions.filter((a) => !a.executed_at).length > 0 ? (
                    <ul className="space-y-2">
                      {sp.merge_actions
                        .filter((a) => !a.executed_at)
                        .map((a) => (
                          <li
                            key={a.id}
                            className="text-xs flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 rounded-[var(--ui-radius-control)]"
                          >
                            <span className="font-mono font-bold">{a.source_code}</span>
                            <span>&rarr;</span>
                            <span className="font-mono font-bold">{a.target_code}</span>
                            <span className="ml-auto opacity-70">Pending execution</span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 italic">No pending merge actions.</p>
                  )}
                </div>
              </div>

              {/* Mapping Queue UI */}
              <SketchupMappingQueue
                projectId={id}
                materials={sp.materials}
                ffes={sp.ffes}
                scheduleEntries={scheduleEntries}
              />
            </div>
          ))
        )}
      </div>
    </DashboardPageShell>
  );
}
