import { prisma } from "@/core/platform/db";
import { Prisma, Role, PhaseStatus } from "@/generated/prisma";
import { TodayQuickAddModal } from "@/components/today-quick-add-modal";
import { TodayView } from "@/components/today-view";
import { DashboardProject, DashboardPhase } from "@/types/dashboard";
import {
  DashboardPageShell,
  PageHeader,
  SectionCard,
} from "@/ui_engine";
import { getSession } from "@/lib/auth";
import { CalendarCheck2 } from "lucide-react";

function formatPhaseName(name: string) {
  return name.replace(/_/g, " ");
}

export default async function HomePage() {
  const { userId, role } = await getSession();

  const activePhaseStatuses: PhaseStatus[] = ["IN_PROGRESS", "ON_REVIEW_INTERNAL", "ON_REVIEW_CLIENT"];

  const whereClause: Prisma.ProjectWhereInput = {
    phases: {
      some: { status_enum: { in: activePhaseStatuses } },
    },
  };

  if (role !== Role.ADMIN) {
    whereClause.OR = [
      { pic_designer_id: userId },
      { pic_drafter_id: userId },
    ];
  }

  const projects = await prisma.project.findMany({
    where: whereClause,
    include: {
      phases: {
        orderBy: { order_index: "asc" },
        include: {
          revisions: {
            where: { status_enum: "ACTIVE" },
            take: 1,
            include: {
              activities: {
                where: { mode: { in: ["TODO", "FEEDBACK"] } },
                orderBy: { id: "asc" },
              },
            },
          },
        },
      },
      activities: {
        where: { phase_id: null, revision_id: null, mode: { in: ["TODO", "FEEDBACK"] } },
        orderBy: { id: "asc" },
      },
    },
    orderBy: [
      { priority: "asc" },
      { name: "asc" },
    ],
  });

  // Filter projects/phases with 0 tasks and transform
  const projectsWithTasks: DashboardProject[] = projects.map((project) => {
    const phasesWithTasks: DashboardPhase[] = project.phases.map((phase) => {
      const activeRevision = phase.revisions[0];
      const tasks = activeRevision?.activities || [];
      return {
        id: phase.id,
        name: formatPhaseName(phase.name_enum),
        status: phase.status_enum,
        revisionId: activeRevision?.id,
        isLocked: phase.is_locked,
        tasks: tasks.map(t => ({
          id: t.id,
          content: t.content,
          status: t.status,
          mode: t.mode,
          projectName: project.name,
          phaseName: formatPhaseName(phase.name_enum),
          isUrgent: project.priority === "URGENT"
        }))
      };
    });

    const projectTodoTasks = project.activities || [];
    if (projectTodoTasks.length > 0) {
      phasesWithTasks.push({
        id: `general-${project.id}`,
        name: "General Tasks",
        status: "IN_PROGRESS" as PhaseStatus,
        isProjectLevel: true,
        projectId: project.id,
        tasks: projectTodoTasks.map(t => ({
          id: t.id,
          content: t.content,
          status: t.status,
          mode: t.mode,
          projectName: project.name,
          phaseName: "General Tasks",
          isUrgent: project.priority === "URGENT"
        }))
      });
    }

    return {
      id: project.id,
      name: project.name,
      isUrgent: project.priority === "URGENT",
      phases: phasesWithTasks
    };
  }).filter(p => p.phases.length > 0);

  const modalProjects = projects.map((project) => ({
    projectId: project.id,
    projectName: project.name,
    phases: [
      {
        phaseId: "general",
        phaseName: "General Tasks",
        isProjectLevel: true,
        isLocked: false,
      },
      ...project.phases.map((phase) => ({
        phaseId: phase.id,
        activeRevisionId: phase.revisions[0]?.id,
        phaseName: formatPhaseName(phase.name_enum),
        isLocked: phase.is_locked || (!phase.revisions[0]?.id),
      })),
    ],
  }));

  return (
    <DashboardPageShell>
      <PageHeader
        eyebrow="Daily Pulse"
        title="Today's View"
        description="All active phases across your projects in one place."
        action={<TodayQuickAddModal projects={modalProjects} />}
      />

      {projectsWithTasks.length === 0 ? (
        <SectionCard className="min-h-[320px]">
          <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
            <CalendarCheck2 className="h-10 w-10 text-slate-200" />
            <div className="space-y-1">
              <h3 className="font-sans text-sm font-medium text-slate-400">No open tasks today.</h3>
              <p className="text-xs text-slate-300">Active phases and feedback items will appear here.</p>
            </div>
          </div>
        </SectionCard>
      ) : (
        <TodayView projects={projectsWithTasks} />
      )}
    </DashboardPageShell>
  );
}
