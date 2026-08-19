import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardPageShell, PageBackLink, PageHeader } from "@/ui_engine";
import {
  generateApiKeyAction,
  revokeApiKeyAction,
} from "@/extensions/sketchup/actions/sketchup-actions";
import { collapseMergeActionChains } from "@/extensions/sketchup/utils/merge-queue";

import { getSession } from "@/lib/auth";

export default async function SketchupIntegrationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { role } = await getSession();
  
  if (role !== "DEVELOPER") {
    notFound();
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      sketchup_projects: {
        include: {
          materials: true,
          ffes: true,
          merge_actions: {
            orderBy: [
              { queue_order: "asc" },
              { created_at: "asc" },
              { id: "asc" },
            ],
          },
        },
      },
    },
  });

  if (!project) notFound();

  return (
    <DashboardPageShell>
      <PageBackLink />
      <PageHeader
        title="SketchUp Integration"
        description={`Connection bridge and Pull/Sync status for ${project.name}. Product codes are managed from Product Schedule.`}
        action={
          <div className="flex items-center gap-3">
            <Link
              href={`/projects/${id}/extensions/product-catalog`}
              className="px-4 py-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] text-sm font-medium transition-colors"
            >
              Open Product Schedule
            </Link>
            <form
              action={async () => {
                "use server";
                await generateApiKeyAction(id, "Main Design Model");
              }}
            >
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 text-white rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] text-sm font-medium hover:bg-slate-800 transition-colors cursor-pointer"
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
          <div className="p-12 text-center border border-slate-200 border-dashed rounded-[var(--ui-radius-card,0.75rem)] bg-white shadow-sm">
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
              <div className="border border-slate-200 rounded-[var(--ui-radius-card,0.75rem)] bg-white overflow-hidden shadow-sm">
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
                        className="text-xs text-red-600 hover:text-red-700 font-medium px-2.5 py-1.5 bg-red-50 hover:bg-red-100 rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] transition-colors"
                      >
                        Rotate API Key
                      </button>
                    </form>
                  </div>
                </div>

                <div className="p-6">
                  <h4 className="font-sans font-semibold text-sm text-slate-900 mb-3 border-b border-slate-100 pb-2">
                    Pending Pull/Sync Bridge Actions
                  </h4>
                  {(() => {
                    const pending = sp.merge_actions.filter((a) => !a.executed_at);
                    if (pending.length === 0) {
                      return <p className="text-sm text-slate-500 italic">No pending merge actions.</p>;
                    }

                    // Renumbering queues each rename as source -> temp -> target
                    // to avoid code collisions; collapse that into a single
                    // logical row here so the queue reads as one change per
                    // material instead of two confusing hops.
                    const collapsed = collapseMergeActionChains(pending);

                    return (
                      <ul className="space-y-2">
                        {collapsed.map((change) => (
                          <li
                            key={change.steps[0].id}
                            className="text-xs flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2 rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))]"
                          >
                            <span className="font-mono font-bold">{change.sourceCode}</span>
                            <span>&rarr;</span>
                            <span className="font-mono font-bold">{change.targetCode}</span>
                            {change.isMultiStep && (
                              <span className="opacity-60">(renumbering, {change.steps.length} steps)</span>
                            )}
                            <span className="ml-auto opacity-70">Pending execution</span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              </div>

            </div>
          ))
        )}
      </div>
    </DashboardPageShell>
  );
}
