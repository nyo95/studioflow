import { prisma } from "@/core/platform/db";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { PhaseActions } from "@/components/phase-actions";
import { ActivityManager } from "@/components/activity-manager";
import { CDListTable } from "@/components/cd-list-table";
import { PhaseChecklist } from "@/components/phase-checklist";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardPageShell, PageBackLink, PageHeader, PhaseLiveProvider, Heading, SectionCard, StatusBadge, ActionSidebar, ActionSidebarSection } from "@/ui_engine";
import { getSession } from "@/lib/auth";
import { PhaseName, Role } from "@/generated/prisma";

import { getPhaseHeartbeatSnapshot } from "@/lib/phase-heartbeat";
import { HydrationGuard } from "@/ui_engine/components/HydrationGuard";
import { AdminRevisionOverride } from "@/components/admin-revision-override";
import { cn } from "@/lib/utils";
import { evaluateAccess, PERMISSION } from "@/core/rbac/rbac";

export const generateStaticParams = async () => {
  return [];
};

// Style mapping moved to generic StatusBadge

export default async function PhaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; phaseId: string }>
}) {
  const { id: projectId, phaseId } = await params;
  const { userId, role } = await getSession();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      pic_designer_id: true,
      pic_drafter_id: true,
      status_progress: true,
      client: {
        select: {
          name: true
        }
      },
      phases: {
        select: {
          order_index: true,
          status_enum: true
        },
        orderBy: { order_index: "asc" }
      }
    },
  });

  if (!project) {
    notFound();
  }

  const phase = await prisma.phase.findUnique({
    where: { id: phaseId },
    include: {
      revisions: {
        include: {
          activities: {
            orderBy: { id: "asc" },
          },
          files: true,
        },
        orderBy: [
          { created_at: "desc" },
          { major: "desc" },
          { minor: "desc" },
        ],
      },
      checklists: {
        orderBy: { id: "asc" },
      },
      cd_lists: {
        orderBy: { group_code: "asc" },
      },
    },
  });

  if (!phase) {
    notFound();
  }
  if (phase.project_id !== projectId) {
    notFound();
  }

  const allUsers = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });

  const canManagePhase =
    role === Role.ADMIN ||
    (role === Role.DIC && userId === project.pic_designer_id) ||
    (phase.name_enum === "CD" && role === Role.DRIC && userId === project.pic_drafter_id);
  
  const canMutateContent =
    role === Role.ADMIN ||
    (phase.name_enum === "CD"
      ? (userId === project.pic_drafter_id || userId === project.pic_designer_id)
      : role === Role.DIC && userId === project.pic_designer_id);

  const canOverride =
    role === Role.ADMIN || (role === Role.DIC && userId === project.pic_designer_id);
  
  const initialSnapshot = await getPhaseHeartbeatSnapshot(phaseId);
  const session = await getSession();
  const currentUserName = session.user?.name || "User";

  // Calculate if this phase is ready to start (Project is ACTIVE)
  const isReadyToStart = project.status_progress === "ACTIVE";
  const canMutateChecklist =
    role === Role.ADMIN ||
    (phase.name_enum === "CD"
      ? userId === project.pic_drafter_id
      : userId === project.pic_designer_id);

  const activeRevision = phase.revisions.find((revision) => revision.status_enum === "ACTIVE") || phase.revisions[0];
  const archivedRevisions = phase.revisions.filter((revision) => revision.id !== activeRevision?.id);
  const hasOngoingTasks = activeRevision?.activities?.some((a) => a.status === "OPEN") ?? false;

  const reviewPanel = (
    <section className="space-y-8">
      <Heading variant="uiMeta" level={2} className="mb-6 flex items-center gap-4">
        Active Iteration Review
        <div className="h-px flex-1 bg-zinc-100" />
      </Heading>

      <HydrationGuard>
        {activeRevision ? (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <ActivityManager
              revisionId={activeRevision.id}
              isLocked={phase.is_locked || activeRevision.status_enum !== "ACTIVE"}
              phaseStatus={phase.status_enum}
              phaseName={phase.name_enum as PhaseName}
              userId={userId}
              userRole={role as Role}
              canMutate={canMutateContent}
            />
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-zinc-100 bg-zinc-50/10 py-20 text-center font-sans text-slate-400">
            <Clock className="mx-auto mb-4 h-10 w-10 opacity-20" />
            <p className="text-sm font-light">No iterations created for this phase yet.</p>
          </div>
        )}
      </HydrationGuard>
    </section>
  );

  return (
    <DashboardPageShell>
      <PhaseLiveProvider phaseId={phaseId} initialSnapshot={initialSnapshot}>
        <PageBackLink />

        <PageHeader
          title={`${phase.name_enum.replace(/_/g, " ")} ${activeRevision ? `${activeRevision.major}.${activeRevision.minor}` : ""}`}
          description={`${project.client?.name || "No Client Assigned"}`}
          divider={false}
          className="mb-6"
          action={
            <div className="flex flex-wrap items-center gap-3">
              <StatusBadge status={phase.status_enum} />
              
              {phase.is_locked && (
                <div className="inline-flex h-8 items-center rounded-[var(--ui-radius-action)] border border-amber-200 bg-amber-50 px-3 text-[10px] font-bold uppercase tracking-widest text-amber-700 select-none">
                  LOCKED
                </div>
              )}

              {archivedRevisions.length > 0 && (
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-8 items-center justify-center rounded-[var(--ui-radius-action)] border border-slate-200 bg-white px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all hover:bg-zinc-100 hover:text-slate-900 focus-visible:outline-none cursor-pointer"
                    >
                      <Clock className="mr-2 h-3.5 w-3.5" strokeWidth={1.5} />
                      History ({archivedRevisions.length})
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md border-slate-200 bg-white rounded-[var(--ui-radius-card)]">
                    <DialogHeader>
                      <DialogTitle className="border-b border-slate-100 pb-4 font-serif text-xl font-bold text-black">Revision History</DialogTitle>
                    </DialogHeader>
                    <div className="mt-4 flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-2">
                      {archivedRevisions.map((revision) => (
                        <div key={revision.id} className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50/50 p-4 transition-colors hover:bg-zinc-50">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 font-sans">Revision {revision.major}.{revision.minor}</p>
                            <p className="mt-1 text-xs text-slate-500 font-sans">{revision.activities.length} Activities, {revision.files.length} Files</p>
                          </div>
                          <Badge variant="secondary" className="bg-zinc-200/50 text-zinc-600 hover:bg-zinc-200/50 rounded-[var(--ui-radius-action)]">ARCHIVED</Badge>
                        </div>
                      ))}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
              
              {canOverride && activeRevision && activeRevision.activities.length === 0 && (
                <AdminRevisionOverride 
                  phaseId={phase.id}
                  currentVersion={{
                    major: activeRevision.major,
                    minor: activeRevision.minor,
                  }}
                />
              )}
              
              <PhaseActions
                phaseId={phase.id}
                status={phase.status_enum}
                isLocked={phase.is_locked}
                nameEnum={phase.name_enum}
                userId={userId}
                userRole={role as Role}
                canMutate={canManagePhase}
                isReadyToStart={isReadyToStart}
                hasHistory={phase.revisions.length > 0}
                hasOngoingTasks={hasOngoingTasks}
              />
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-10 xl:grid-cols-12">
          <div className="space-y-8 xl:col-span-8">

            
            {phase.name_enum === "CD" ? (
              <Tabs defaultValue="review" className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-2 border border-slate-200 bg-slate-50 p-1 mb-8">
                  <TabsTrigger value="review" className="py-2 text-xs font-semibold uppercase tracking-[0.18em]">
                    Active Review
                  </TabsTrigger>
                  <TabsTrigger value="cd-list" className="py-2 text-xs font-semibold uppercase tracking-[0.18em]">
                    CD List
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="review" className="mt-0">
                  {reviewPanel}
                </TabsContent>
                <TabsContent value="cd-list" className="mt-0">
                  <CDListTable
                    phaseId={phase.id}
                    items={phase.cd_lists}
                    userId={userId}
                    userRole={role as Role}
                    canMutate={canManagePhase}
                    users={allUsers}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              reviewPanel
            )}
          </div>

          <ActionSidebar className="xl:col-span-4">
            <ActionSidebarSection title="Phase Requirements" subtitle="Checklist items">
              <HydrationGuard>
                <PhaseChecklist
                  isLocked={phase.is_locked}
                  canEdit={canMutateChecklist}
                  phaseStatus={phase.status_enum}
                />
              </HydrationGuard>
            </ActionSidebarSection>
            
            <ActionSidebarSection title="Internal Notes" subtitle="Guidelines">
              <p className="font-sans text-xs font-light leading-relaxed text-slate-500 italic">
                &quot;Ensure all checklist items above are resolved before submitting for formal internal review. Formal client approval will lock the phase.&quot;
              </p>
            </ActionSidebarSection>
          </ActionSidebar>
        </div>
      </PhaseLiveProvider>
    </DashboardPageShell>
  );
}
