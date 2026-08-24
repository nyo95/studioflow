import * as React from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDateWithOptions } from "@/core/utilities/datetime";
import { prisma } from "@/core/platform/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma";
import { canEditProjectMetadata } from "@/core/rbac/permissions";
import { eligibleDesigners, eligibleDrafters } from "@/core/rbac/project-pic";
import { isAdminLevel } from "@/core/rbac/rbac";
import { ProjectIdentityStrip } from "@/components/project-identity-strip";
import { ProjectTasksCard } from "@/components/project-tasks-card";
import { ProjectChecklistOverview } from "@/components/project-checklist-overview";
import {
  CHECKLIST_TASK_ORDER_BY,
  CHECKLIST_TASK_SELECT,
  toChecklistTask,
} from "@/lib/services/checklist-task";
import {
  ProjectTemplate,
  PageBackLink,
  PageHeader,
  StatusBadge,
  ActionSidebar,
  ActionSidebarSection,
  SectionCard,
  Heading,
} from "@/ui_engine";
import {
  PhaseStatusPill,
  PhaseOwner,
  PhaseDuration,
} from "@/components/phase-reading";
import { PhaseRunningAheadBadge } from "@/components/phase-lock-notice";
import { readPhase, formatPhaseLabel } from "@/lib/domain/phase-presenter";
import { explainPhaseLock } from "@/lib/domain/phase-lock";
import { statusToTone } from "@/lib/ui/status-tone";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";
import { getProjectProgress } from "@/lib/project-progress";
import { ProjectAdminActions } from "@/components/project-admin-actions";
import { PROJECT_MEMBER_FETCH_LIMIT } from "@/lib/constants";
// Removed ProjectScheduleMain as it's now a dedicated extension page

export const generateStaticParams = async () => {
  return [];
};

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id: projectId } = await params;
  await searchParams;
  const { userId, role } = await getSession();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      status_progress: true,
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
          // Feed the pipeline strip below: how long each phase has held its
          // state, and whether it is frozen or running ahead of its gate.
          status_changed_at: true,
          is_locked: true,
          allow_parallel: true,
          // Newest revision, ACTIVE or not.
          //
          // This used to filter `status_enum: "ACTIVE"`, which made the Rev
          // column read "—" for exactly the phases whose version matters most:
          // approving a phase marks its revision COMPLETED, so every finished
          // phase reported no revision at all. The version an approved phase
          // was signed off at is a fact worth keeping on screen.
          //
          // getProjectProgress() also reads this relation. It takes
          // `revisions[0]`, so the newest-first ordering still hands it the
          // current version; its "has work history" fallback now sees completed
          // revisions too, which is what its own comment always claimed.
          revisions: {
            select: {
              major: true,
              minor: true,
            },
            orderBy: [{ major: "desc" }, { minor: "desc" }],
            take: 1,
          },
        },
        orderBy: {
          order_index: "asc",
        },
      },
      activities: {
        where: { revision_id: null },
        select: {
          id: true,
          content: true,
          status: true,
          mode: true,
          phase_id: true,
          deferred_from_version: true,
        },
      },
      // Ordering and shape come from checklist-task.ts, the one place that
      // decides both. `phase` used to be included here and never read.
      checklists: {
        where: {
          phase_id: { equals: null },
        },
        select: CHECKLIST_TASK_SELECT,
        orderBy: CHECKLIST_TASK_ORDER_BY,
      },
    },
  });

  if (!project) {
    notFound();
  }

  const globalChecklists = project.checklists.map(toChecklistTask);
  const checklistLabels = await prisma.checklistLabel.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
  const deferredActivities = project.activities.filter(
    (act) => act.phase_id !== null,
  );
  const projectTodoActivities = project.activities.filter(
    (act) => act.phase_id === null,
  );

  const users = await prisma.user.findMany({
    where: { deleted_at: null },
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: {
      name: "asc",
    },
    take: PROJECT_MEMBER_FETCH_LIMIT,
  });
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
    take: PROJECT_MEMBER_FETCH_LIMIT,
  });

  // Designer seat: DIC plus admin-level roles (owner, 2026-08-10). Drafter
  // seat: DRIC. Both lists also carry whoever already holds the seat —
  // dropping the incumbent would make the uncontrolled <select> fall back to
  // its first option, and a save that never touched the field would reassign
  // the project.
  const designers = eligibleDesigners(users, project.pic_designer_id);
  const drafters = eligibleDrafters(users, project.pic_drafter_id);

  // Assignee candidates. Deliberately the same roster the project already
  // offers for designer/drafter — an assignee who cannot open the project would
  // be a dead end, and the RBAC check in `updateTask` would reject it anyway.
  const projectMembers = users.map((user) => ({
    id: user.id,
    name: user.name,
  }));

  const canEdit = canEditProjectMetadata(
    role as Role,
    userId,
    project.pic_designer_id,
  );
  const openingDateDisplay = project.opening_date
    ? formatDateWithOptions(project.opening_date, {
        locale: "id-ID",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";
  const openingDateInputValue = project.opening_date
    ? project.opening_date.toISOString().slice(0, 10)
    : "";

  // One clock for the whole strip, so two phases cannot report day counts taken
  // either side of a midnight boundary within the same render.
  const pipelineNow = new Date();

  const projectProgress = getProjectProgress(project.phases);

  return (
    <ProjectTemplate
      navigation={<PageBackLink />}
      header={
        <>
          {/* TIER 1 — IDENTITY. Which project is this.
              The `description` prop used to read "<client> — <area> SQM" and the
              `meta` row repeated the opening date. All three facts are fields in
              the identity strip immediately below, so the header now carries only
              the name and the lifecycle status. */}
          <PageHeader
            title={project.name}
            divider={false}
            meta={
              <StatusBadge
                status={project.status_progress}
                tone={statusToTone(project.status_progress)}
              />
            }
          />

          <ProjectIdentityStrip
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

          {/* Project-level call to action. Deliberately NOT per-phase: the matrix
              below owns that. This says only what the matrix cannot — the project
              as a whole is finished, or nothing is running and something should be
              started. Silent while work is in progress. */}
          {projectProgress.type !== "IN_PROGRESS" &&
            projectProgress.type !== "NO_PHASES" && (
              <div className="mb-8 flex flex-wrap items-center gap-3">
                {projectProgress.type === "PROJECT_DONE" ? (
                  <Heading level={3} className="text-emerald-600">
                    Project completed
                  </Heading>
                ) : (
                  <>
                    <Heading level={3} className="text-amber-600">
                      Ready for{" "}
                      {formatPhaseLabel(projectProgress.nextPhaseName)}
                    </Heading>
                    <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-sans text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-amber-700">
                      Action required
                    </span>
                  </>
                )}
              </div>
            )}
        </>
      }
      content={
        <>
          {/* PHASE MATRIX — the per-phase detail table. Four columns, one row per
              phase, no summary of any kind.
              =====================================================================
              WHAT THIS DELIBERATELY DOES NOT SHOW, AND WHY
              =====================================================================
              * No progress bar, completion count or percentage. Those belong to the
                Overview card below and appearing twice was the original complaint.
              * No FLOW column. An earlier draft had one carrying "Frozen" and
                "Waiting" alongside PARALLEL — but `is_locked` is set by the very
                action that writes READY_FOR_NEXT, so "Frozen" only ever restated
                "Approved", and "Waiting" is fully derivable from "Not started" plus
                an unapproved predecessor. Only the parallel override said anything
                new, so only it survived, as a badge on the phase name.
              * No duration inside the Status cell. PhaseReadingLine would print it
                there AND the Time column would print it again; the parts are used
                individually here for exactly that reason.
              The lock is still explained — via the row's title attribute, and in
              full on the phase page. */}
          <SectionCard padding="none">
            <table className="w-full table-fixed">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-left">
                  <Th className="w-[34%]">Phase</Th>
                  <Th className="w-[30%]">Status / Owner</Th>
                  <Th className="w-[16%]">Rev</Th>
                  <Th className="w-[20%]">Time</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {project.phases.map((phase, index) => {
                  const reading = readPhase(phase, pipelineNow);
                  const lock = explainPhaseLock(
                    phase,
                    project.phases[index - 1] ?? null,
                    pipelineNow,
                  );
                  const revision = phase.revisions[0];

                  return (
                    <tr
                      key={phase.id}
                      className="group transition-colors hover:bg-slate-50"
                      title={
                        lock.isBlocked
                          ? [lock.reason, lock.prerequisite]
                              .filter(Boolean)
                              .join(" ")
                          : undefined
                      }
                    >
                      <Td>
                        {/* The whole row is a navigation target, but only an anchor
                            can be one accessibly, so the link fills the first cell
                            and the rest of the row is hover feedback. */}
                        <Link
                          href={`/projects/${project.id}/phases/${phase.id}`}
                          className="flex items-center gap-2.5 font-sans text-sm font-medium text-slate-900 hover:underline"
                        >
                          {lock.isBlocked ? (
                            <Lock
                              className="h-3 w-3 shrink-0 text-slate-300"
                              aria-hidden
                            />
                          ) : null}
                          <span className="truncate">
                            {formatPhaseLabel(phase.name_enum)}
                          </span>
                          {lock.isRunningAhead ? (
                            <PhaseRunningAheadBadge />
                          ) : null}
                        </Link>
                      </Td>

                      <Td>
                        <span className="flex flex-wrap items-center gap-2">
                          <PhaseStatusPill reading={reading} />
                          <PhaseOwner reading={reading} />
                        </span>
                      </Td>

                      {/* Revision version lives here now, not in the Overview card.
                          It used to be printed there as "LAYOUT v6.0 / DESIGN 3D
                          v5.0", which re-announced which phases were active — a
                          fact this table already states, one row per phase. */}
                      <Td>
                        <span className="font-sans text-xs text-slate-500">
                          {revision
                            ? `v${revision.major}.${revision.minor}`
                            : "—"}
                        </span>
                      </Td>

                      <Td>
                        <PhaseDuration reading={reading} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SectionCard>

          <ProjectTasksCard
            projectId={project.id}
            canEdit={canEdit}
            phases={project.phases}
            deferredActivities={
              deferredActivities as React.ComponentProps<
                typeof ProjectTasksCard
              >["deferredActivities"]
            }
            projectTodoActivities={
              projectTodoActivities as React.ComponentProps<
                typeof ProjectTasksCard
              >["projectTodoActivities"]
            }
          />
        </>
      }
      aside={
        <ActionSidebar>
          <ActionSidebarSection title="Global Checklist">
            <ProjectChecklistOverview
              projectId={project.id}
              checklists={globalChecklists}
              canEdit={canEdit}
              currentUserId={userId}
              members={projectMembers}
              knownLabels={checklistLabels}
              settingsHref={isAdminLevel(role) ? "/settings/studio" : null}
            />
          </ActionSidebarSection>

          {isAdminLevel(role) && (
            <ActionSidebarSection title="Admin">
              <ProjectAdminActions
                projectId={project.id}
                projectName={project.name}
                isCompleted={project.status_progress === "COMPLETED"}
              />
            </ActionSidebarSection>
          )}
        </ActionSidebar>
      }
    />
  );
}

/**
 * Local cells for the phase matrix. Kept in this file rather than promoted to
 * ui_engine: there is exactly one table of this shape, and a shared abstraction
 * built from a single example usually encodes that example's accidents.
 * Promote them when a second caller appears.
 */
function Th({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-[var(--ui-section-px,1.5rem)] py-3",
        "font-sans text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-slate-400",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td className="px-[var(--ui-section-px,1.5rem)] py-3.5 align-middle">
      {children}
    </td>
  );
}
