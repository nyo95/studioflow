import Link from "next/link";
import { ArrowUpRight, CalendarCheck2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { TodayInlineAdd } from "@/components/today-inline-add";
import { TodayQuickAddModal } from "@/components/today-quick-add-modal";
import { TodayTaskItem } from "@/components/today-task-item";
import {
  DashboardPageShell,
  PageHeader,
  SimpleCard,
  SimpleCardBadge,
  SimpleCardBody,
  SimpleCardFooter,
  SimpleCardHeader,
  SimpleCardTitle,
} from "@/ui_engine";

function formatPhaseName(name: string) {
  return name.replace(/_/g, " ");
}

function getPhaseBadgeClass(status: string) {
  if (status === "IN_PROGRESS") {
    return "border-indigo-200 bg-indigo-50 text-indigo-700";
  }

  if (status.startsWith("READY_FOR")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-600";
}

type TaskGroup = {
  projectId: string;
  projectName: string;
  phases: {
    phaseId: string;
    phaseName: string;
    phaseStatus: string;
    tasks: { id: string; label: string; is_checked: boolean }[];
  }[];
};

export default async function TodayPage() {
  const projects = await prisma.project.findMany({
    where: {
      phases: {
        some: { status_enum: "IN_PROGRESS" },
      },
    },
    select: {
      id: true,
      name: true,
      phases: {
        where: { status_enum: "IN_PROGRESS" },
        select: {
          id: true,
          name_enum: true,
          status_enum: true,
          order_index: true,
          checklists: {
            where: { phase_id: { not: null } },
            orderBy: { id: "asc" },
            select: {
              id: true,
              label: true,
              is_checked: true,
            },
          },
        },
        orderBy: { order_index: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  const groups: TaskGroup[] = projects.map((project) => ({
    projectId: project.id,
    projectName: project.name,
    phases: project.phases.map((phase) => ({
      phaseId: phase.id,
      phaseName: formatPhaseName(phase.name_enum),
      phaseStatus: phase.status_enum,
      tasks: phase.checklists,
    })),
  }));

  const modalProjects = projects.map((project) => ({
    projectId: project.id,
    projectName: project.name,
    phases: project.phases.map((phase) => ({
      phaseId: phase.id,
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

      {groups.length === 0 ? (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center text-slate-500">
          <CalendarCheck2 className="h-8 w-8 text-slate-300" />
          <div className="space-y-1">
            <p className="font-serif text-2xl font-bold text-slate-900">No tasks today</p>
            <p className="text-sm text-slate-500">
              All active phases are clear. Use quick add to drop in a new checklist item.
            </p>
          </div>
        </div>
      ) : (
        <div>
          {groups.map((group) => {
            const tasks = group.phases.flatMap((phase) => phase.tasks);
            const doneCount = tasks.filter((task) => task.is_checked).length;
            const totalCount = tasks.length;

            return (
              <SimpleCard
                key={group.projectId}
                className="mb-4 last:mb-0"
              >
                <SimpleCardHeader>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/projects/${group.projectId}`}
                      title={`Open ${group.projectName}`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-950 transition-colors hover:text-slate-700"
                    >
                      <SimpleCardTitle>{group.projectName}</SimpleCardTitle>
                      <ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
                    </Link>
                  </div>
                  <SimpleCardBadge>
                    {totalCount} task{totalCount === 1 ? "" : "s"}
                  </SimpleCardBadge>
                </SimpleCardHeader>

                <SimpleCardBody>
                  {group.phases.map((phase) => (
                    <section
                      key={phase.phaseId}
                      className="border-b border-slate-100 py-3 last:border-b-0"
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <Link
                          href={`/projects/${group.projectId}/phases/${phase.phaseId}`}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors hover:opacity-80 ${getPhaseBadgeClass(
                            phase.phaseStatus
                          )}`}
                        >
                          {phase.phaseName}
                        </Link>
                        <Link
                          href={`/projects/${group.projectId}/phases/${phase.phaseId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-700"
                        >
                          Open phase
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </div>

                      {phase.tasks.length > 0 ? (
                        <div className="space-y-1">
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
                        <p className="px-2 py-1 text-sm text-slate-400">No tasks in this phase yet.</p>
                      )}
                    </section>
                  ))}
                </SimpleCardBody>

                <SimpleCardFooter>
                  <div className="space-y-2">
                    {group.phases.map((phase) => (
                      <TodayInlineAdd
                        key={phase.phaseId}
                        phaseId={phase.phaseId}
                        phaseName={phase.phaseName}
                        className="pt-0"
                        buttonLabel={`+ Add task${group.phases.length > 1 ? ` to ${phase.phaseName}` : ""}`}
                        placeholder={`Add task to ${phase.phaseName}...`}
                        buttonClassName="rounded-md px-0 py-0 text-slate-500 hover:bg-transparent hover:text-slate-800"
                        inputWrapperClassName="rounded-md px-0 py-0"
                      />
                    ))}
                  </div>
                  {totalCount > 0 ? (
                    <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                      <span className={doneCount === totalCount ? "text-emerald-600" : "text-slate-700"}>
                        {doneCount}
                      </span>
                      /{totalCount} done
                    </p>
                  ) : null}
                </SimpleCardFooter>
              </SimpleCard>
            );
          })}
        </div>
      )}
    </DashboardPageShell>
  );
}
