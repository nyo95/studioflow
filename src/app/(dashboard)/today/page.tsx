import Link from "next/link";
import { cn } from "@/lib/utils";
import { CalendarCheck2, CircleDashed } from "lucide-react";
import { prisma } from "@/lib/db";
import { TodayInlineAdd } from "@/components/today-inline-add";
import { PhaseLink } from "@/components/phase-link";
import { TodayQuickAddModal } from "@/components/today-quick-add-modal";
import { TodayTaskItem } from "@/components/today-task-item";
import {
  DashboardPageShell,
  PageHeader,
  PhaseSectionContent,
  PhaseSectionGroup,
  PhaseSectionItem,
  PhaseSectionTrigger,
  ProjectSectionContent,
  ProjectSectionGroup,
  ProjectSectionItem,
  ProjectSectionTrigger,
  SimpleCardBadge,
  SimpleCardBody,
  Heading,
} from "@/ui_engine";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma";

function formatPhaseName(name: string) {
  return name.replace(/_/g, " ");
}

function getPhaseBadgeClass(status: string) {
  if (status === "IN_PROGRESS") {
    return "text-slate-700";
  }

  if (status.startsWith("READY_FOR")) {
    return "text-slate-600";
  }

  return "text-slate-500";
}

type TaskGroup = {
  projectId: string;
  projectName: string;
  projectPriority: string;
  phases: {
    phaseId: string;
    revisionId?: string;
    phaseName: string;
    phaseStatus: string;
    tasks: { id: string; label: string; is_checked: boolean }[];
  }[];
};

export default async function TodayPage() {
  const { userId, role } = await getSession();

  const whereClause: any = {
    phases: {
      some: { status_enum: "IN_PROGRESS" },
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
    select: {
      id: true,
      name: true,
      priority: true,
      phases: {
        where: { status_enum: "IN_PROGRESS" },
        select: {
          id: true,
          name_enum: true,
          status_enum: true,
          order_index: true,
          revisions: {
            where: { status_enum: "ACTIVE" },
            take: 1,
            select: {
              id: true,
              activities: {
                where: { mode: "TODO" },
                orderBy: { id: "asc" },
                select: {
                  id: true,
                  content: true,
                  status: true,
                },
              },
            },
          },
        },
        orderBy: { order_index: "asc" },
      },
    },
    orderBy: [
      { priority: "asc" },
      { name: "asc" },
    ],
  });

  const groups: TaskGroup[] = projects.map((project) => ({
    projectId: project.id,
    projectName: project.name,
    projectPriority: project.priority,
    phases: project.phases.map((phase) => {
      const activeRevision = phase.revisions[0];
      return {
        phaseId: phase.id,
        revisionId: activeRevision?.id,
        phaseName: formatPhaseName(phase.name_enum),
        phaseStatus: phase.status_enum,
        tasks: activeRevision?.activities.map((a: any) => ({
          id: a.id,
          label: a.content,
          is_checked: a.status === "DONE",
        })) || [],
      };
    }),
  }));

  // Refinement: Only show projects that have at least one TODO task
  const groupsToDisplay = groups.filter((group) => 
    group.phases.some((phase) => phase.tasks.length > 0)
  );

  const modalProjects = projects.map((project) => ({
    projectId: project.id,
    projectName: project.name,
    phases: project.phases.map((phase) => ({
      phaseId: phase.id,
      activeRevisionId: phase.revisions[0]?.id,
      phaseName: formatPhaseName(phase.name_enum),
    })),
  }));

  return (
    <DashboardPageShell>
      <PageHeader
        eyebrow="Daily Pulse"
        title="Today's View"
        description="All active phases across your projects in one place."
        action={<TodayQuickAddModal projects={modalProjects} />}
      />

      {groupsToDisplay.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center text-slate-500">
          <CalendarCheck2 className="h-8 w-8 text-slate-300" />
          <div className="space-y-1">
            <Heading level={2}>No tasks today</Heading>
            <p className="text-sm text-slate-500">
              All active phases are clear. Todo items from discussion board will appear here.
            </p>
          </div>
        </div>
      ) : (
        <ProjectSectionGroup
          type="multiple"
        >
          {groupsToDisplay.map((group) => {
            const tasks = group.phases.flatMap((phase) => phase.tasks);
            const doneCount = tasks.filter((task) => task.is_checked).length;
            const totalCount = tasks.length;
            const progressPercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

            return (
              <ProjectSectionItem 
                key={group.projectId} 
                value={group.projectId}
                className={cn(
                  group.projectPriority === "URGENT" && "bg-rose-50/40 border-red-100 ring-1 ring-red-200"
                )}
              >
                <ProjectSectionTrigger>
                  <>
                    <div className="min-w-0 flex-1">
                      <Link href={`/projects/${group.projectId}`} className="group/title inline-block">
                        <Heading level={3} className="line-clamp-1 text-lg font-bold text-slate-900 transition-colors group-hover/title:text-slate-600 group-hover/title:underline decoration-slate-300 underline-offset-4">
                          {group.projectName}
                        </Heading>
                      </Link>
                      <p className="mt-1 font-sans text-xs text-slate-500 opacity-80">
                        Active phases and daily todo list for this project.
                      </p>
                    </div>
                    <div className="w-full max-w-44 space-y-2 md:text-right">
                      <div className="flex items-center justify-between gap-3 md:justify-end">
                        <SimpleCardBadge className="border-slate-200 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-slate-600">
                          {totalCount} todo{totalCount === 1 ? "" : "s"}
                        </SimpleCardBadge>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                          {doneCount}/{totalCount} done
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-slate-900 transition-all"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                  </>
                </ProjectSectionTrigger>

                <ProjectSectionContent>
                  <SimpleCardBody className="px-6 py-5 md:px-8">

                    <PhaseSectionGroup
                      type="multiple"
                    >
                      {group.phases.map((phase) => (
                        <PhaseSectionItem key={phase.phaseId} value={phase.phaseId}>
                          <PhaseSectionTrigger>
                            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex min-w-0 flex-wrap items-center gap-3">
                                <PhaseLink
                                  href={`/projects/${group.projectId}/phases/${phase.phaseId}`}
                                  name={phase.phaseName}
                                  badgeClass={getPhaseBadgeClass(phase.phaseStatus)}
                                />
                              </div>
                              <span className="pr-1 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                                {phase.tasks.filter((task) => task.is_checked).length}/{phase.tasks.length} complete
                              </span>
                            </div>
                          </PhaseSectionTrigger>

                          <PhaseSectionContent>
                            {phase.tasks.length > 0 ? (
                              <div className="space-y-2">
                                {phase.tasks.map((task) => (
                                  <TodayTaskItem
                                    key={task.id}
                                    id={task.id}
                                    label={task.label}
                                    isChecked={task.is_checked}
                                  />
                                ))}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-400">
                                <CircleDashed className="h-4 w-4 shrink-0 text-slate-300" />
                                <p className="text-xs font-medium text-slate-400">
                                  No todos scheduled in this phase yet.
                                </p>
                              </div>
                            )}

                            {phase.revisionId ? (
                              <TodayInlineAdd
                                phases={group.phases.map(p => ({
                                  id: p.phaseId,
                                  name: p.phaseName,
                                  revisionId: p.revisionId!,
                                  status: p.phaseStatus
                                }))}
                                className="pt-4"
                                buttonLabel={`Add todo${group.phases.length > 1 ? ` to ${phase.phaseName}` : ""}`}
                                placeholder={`Add todo to ${phase.phaseName}...`}
                                buttonClassName="w-auto justify-start px-0 py-0 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"
                                containerClassName="inline-flex w-auto"
                                inputWrapperClassName="max-w-md rounded-lg"
                                inputClassName="min-w-[14rem]"
                              />
                            ) : (
                              <p className="mt-4 px-1 text-[10px] text-slate-400 italic">
                                Action Items can only be added when an iteration is active.
                              </p>
                            )}
                          </PhaseSectionContent>
                        </PhaseSectionItem>
                      ))}
                    </PhaseSectionGroup>
                  </SimpleCardBody>
                </ProjectSectionContent>
              </ProjectSectionItem>
            );
          })}
        </ProjectSectionGroup>
      )}
    </DashboardPageShell>
  );
}

