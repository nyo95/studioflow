import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma";
import { canEditProjectMetadata } from "@/lib/permissions";
import { ProjectOverviewForm } from "@/components/project-overview-form";
import { ProjectChecklistOverview } from "@/components/project-checklist-overview";
import { Button } from "@/components/ui/button";
import { DashboardPageShell, PageBackLink, PageHeader } from "@/ui_engine";
import { getProjectProgress, formatPhaseName } from "@/lib/project-progress";

export const generateStaticParams = async () => {
  return [];
};

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const { userId, role } = await getSession();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      area: true,
      opening_date: true,
      pic_designer_id: true,
      pic_drafter_id: true,
      designer: {
        select: {
          name: true,
        },
      },
      drafter: {
        select: {
          name: true,
        },
      },
      phases: {
        select: {
          id: true,
          name_enum: true,
          order_index: true,
          status_enum: true,
          revisions: {
            where: { status_enum: "ACTIVE" },
            select: {
              major: true,
              minor: true,
            },
            take: 1,
          },
        },
        orderBy: {
          order_index: "asc",
        },
      },
      checklists: {
        where: {
          phase_id: { equals: null },
        },
        include: {
          phase: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const globalChecklists = project.checklists.filter((item) => item.phase_id === null);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: {
      name: "asc",
    },
  });
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  const designers = users.filter(
    (user) => user.role === Role.ADMIN || user.role === Role.DIC || user.role === Role.STAFF
  );
  const drafters = users.filter(
    (user) => user.role === Role.STAFF || user.role === Role.DRIC
  );

  const canEdit = canEditProjectMetadata(role as Role, userId, project.pic_designer_id);
  const openingDateDisplay = project.opening_date
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(project.opening_date)
    : "-";
  const openingDateInputValue = project.opening_date
    ? project.opening_date.toISOString().slice(0, 10)
    : "";

  return (
    <DashboardPageShell>
        <PageBackLink />

        {/* Progress Banner */}
        {(() => {
          const progress = getProjectProgress(project.phases);
          
          if (progress.type === 'PROJECT_DONE') {
            return (
              <div className="mb-10 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
                <div className="flex flex-col items-center justify-between gap-6 p-8 md:flex-row">
                  <div className="flex items-center gap-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-100">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400 text-opacity-80">Final State</p>
                      <h2 className="mt-1 font-serif text-2xl font-bold text-slate-950">PROJECT COMPLETED ✓</h2>
                    </div>
                  </div>
                </div>
                <div className="h-1 w-full bg-emerald-500" />
              </div>
            );
          }

          if (progress.type === 'READY_FOR') {
            return (
              <div className="mb-10 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
                <div className="flex flex-col items-center justify-between gap-6 p-8 md:flex-row">
                  <div className="flex items-center gap-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-100">
                      <CheckCircle2 className="h-7 w-7 opacity-50" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-500 text-opacity-80">Next Step</p>
                      <h2 className="mt-1 font-serif text-2xl font-bold text-slate-950">
                        READY FOR {formatPhaseName(progress.nextPhaseName)}
                      </h2>
                    </div>
                  </div>
                  <Link href={`/projects/${projectId}/phases/${project.phases.find(p => p.name_enum === progress.nextPhaseName)?.id}`}>
                    <Button variant="secondary" className="h-12 rounded-xl bg-amber-50 px-8 text-xs font-bold uppercase tracking-widest text-amber-700 hover:bg-amber-100 border-none">
                      Go to Phase
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                <div className="h-1 w-full bg-amber-200" />
              </div>
            );
          }

          const firstActivePhase = project.phases.find(p => p.name_enum === progress.phases[0].name);

          return (
            <div className="mb-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
              <div className="flex flex-col items-center justify-between gap-6 p-8 md:flex-row">
                <div className="flex items-center gap-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-200">
                    <CheckCircle2 className="h-7 w-7" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Current Progress</p>
                    <div className="flex flex-wrap gap-3">
                      {progress.phases.map((p, idx: number) => (
                        <h2 key={idx} className="font-serif text-2xl font-bold text-slate-950">
                          {formatPhaseName(p.name)}
                          <span className="ml-2 text-sm font-light text-slate-400">
                            v{p.major}.{p.minor}
                          </span>
                          {idx < progress.phases.length - 1 && <span className="ml-3 text-slate-200">|</span>}
                        </h2>
                      ))}
                    </div>
                  </div>
                </div>
                {firstActivePhase && (
                  <Link href={`/projects/${projectId}/phases/${firstActivePhase.id}`}>
                    <Button className="h-12 rounded-xl bg-slate-900 px-8 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-800">
                      Jump to Active Phase
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
              <div className="h-1 w-full bg-slate-100">
                <div 
                  className="h-full bg-slate-900 transition-all duration-1000" 
                  style={{ 
                    width: `${((project.phases.findIndex(p => p.name_enum === progress.phases[progress.phases.length - 1].name) + 1) / project.phases.length) * 100}%` 
                  }}
                />
              </div>
            </div>
          );
        })()}

        <PageHeader
          eyebrow="Project Workspace"
          title={project.name}
          description={project.client?.name}
          divider={false}
          titleClassName="mt-2 font-serif text-4xl font-bold tracking-tight text-slate-950 normal-case"
          descriptionClassName="mt-4 font-sans text-base font-medium text-slate-600"
        />

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ProjectOverviewForm
              project={{
                id: project.id,
                name: project.name,
                client: project.client,
                area: project.area,
                opening_date: project.opening_date,
                opening_date_display: openingDateDisplay,
                opening_date_input_value: openingDateInputValue,
                pic_designer_id: project.pic_designer_id,
                pic_drafter_id: project.pic_drafter_id,
                designer_name: project.designer.name,
                drafter_name: project.drafter.name,
              }}
              designers={designers}
              drafters={drafters}
              clients={clients}
              role={role as Role}
              canEdit={canEdit}
            />
          </div>

          <div className="lg:col-span-1">
            <ProjectChecklistOverview
              projectId={project.id}
              checklists={globalChecklists.map((item) => ({
                id: item.id,
                label: item.label,
                completed: item.is_checked,
                phase_id: item.phase_id,
              }))}
              canEdit={canEdit}
            />
          </div>
        </div>
    </DashboardPageShell>
  );
}
