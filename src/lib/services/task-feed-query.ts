import "server-only";

/**
 * The one query behind both task screens.
 *
 * `/` groups the result by project ("what is on each of my projects"); `/upcoming`
 * groups the same result by date ("what is due when"). Two screens, one question
 * asked two ways — so they must not disagree about what exists.
 *
 * Fetching twice would let them drift: one screen would start showing a task the
 * other had filtered out, and nothing would say which was right.
 */

import { prisma } from "@/core/platform/db";
import { Prisma, PhaseStatus } from "@/generated/prisma";
import { CHECKLIST_TASK_ORDER_BY, CHECKLIST_TASK_SELECT, toChecklistTask } from "./checklist-task";
import { formatPhaseLabel, fromActivity, fromChecklistTask, nestChecklistSubtasks } from "./task-feed";
import type { UnifiedTask } from "@/types/task-feed";


/**
 * Checked tasks older than this many days are excluded from the Today and
 * Upcoming feeds immediately. The VPS maintenance job later deletes eligible
 * manual rows through `scripts/purge-expired-checklist-tasks.mjs`; keeping the
 * same cutoff here prevents a row from reappearing while it waits for that job.
 * Rows checked before `checked_at` existed have a null timestamp and stay in
 * active projects, but the maintenance job may delete them once their project
 * is completed.
 */
const CHECKLIST_DONE_RETENTION_DAYS = 7;

/**
 * Phases whose checklists count as current work.
 *
 * A phase that has not started yet still has its template rows generated, but
 * they are not today's problem. The project itself still shows up — only its
 * dormant phases stay quiet.
 */
const ACTIVE_PHASE_STATUSES: PhaseStatus[] = [
  "IN_PROGRESS",
  "ON_REVIEW_INTERNAL",
  "ON_REVIEW_CLIENT",
];

export interface TaskFeedProject {
  id: string;
  name: string;
  is_urgent: boolean;
}

export interface TaskFeedAddTarget {
  projectId: string;
  projectName: string;
  phases: Array<{
    phaseId: string;
    activeRevisionId?: string;
    phaseName: string;
    isProjectLevel?: boolean;
    isLocked?: boolean;
  }>;
}

export interface TaskFeed {
  projects: TaskFeedProject[];
  tasks: UnifiedTask[];
  addTargets: TaskFeedAddTarget[];
}

/**
 * Every project the user holds, with everything open on it.
 *
 * COMPLETED projects are excluded. Both screens ask about work still ahead, and
 * a finished project has none — including it would pile up week after week
 * forever. The full list lives on `/projects`.
 */
export async function getTaskFeed(userId: string): Promise<TaskFeed> {
  const where: Prisma.ProjectWhereInput = {
    status_progress: { not: "COMPLETED" },
    OR: [{ pic_designer_id: userId }, { pic_drafter_id: userId }],
  };

  const projects = await prisma.project.findMany({
    where,
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
                include: { assigned_to: { select: { id: true, name: true } } },
              },
            },
          },
          checklists: {
            where: {
              phase: { status_enum: { in: ACTIVE_PHASE_STATUSES } },
              NOT: {
                is_checked: true,
                checked_at: {
                  lt: new Date(Date.now() - CHECKLIST_DONE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
                },
              },
            },
            select: CHECKLIST_TASK_SELECT,
            orderBy: CHECKLIST_TASK_ORDER_BY,
          },
        },
      },
      activities: {
        where: { phase_id: null, revision_id: null, mode: { in: ["TODO", "FEEDBACK"] } },
        orderBy: { id: "asc" },
        include: { assigned_to: { select: { id: true, name: true } } },
      },
      checklists: {
        where: {
          phase_id: null,
          NOT: {
            is_checked: true,
            checked_at: {
              lt: new Date(Date.now() - CHECKLIST_DONE_RETENTION_DAYS * 24 * 60 * 60 * 1000),
            },
          },
        },
        select: CHECKLIST_TASK_SELECT,
        orderBy: CHECKLIST_TASK_ORDER_BY,
      },
    },
    orderBy: [{ priority: "asc" }, { name: "asc" }],
  });

  const feed: UnifiedTask[] = [];
  const parentIdOf = new Map<string, string | null>();

  for (const project of projects) {
    const ctx = {
      projectId: project.id,
      projectName: project.name,
      projectIsUrgent: project.priority === "URGENT",
    };

    for (const activity of project.activities) {
      feed.push(fromActivity(activity, { ...ctx, phaseLabel: null }));
    }

    for (const task of project.checklists) {
      const mapped = toChecklistTask(task);
      parentIdOf.set(mapped.id, mapped.parent_id);
      feed.push(fromChecklistTask(mapped, { ...ctx, phaseLabel: null }));
    }

    for (const phase of project.phases) {
      const phaseLabel = formatPhaseLabel(phase.name_enum);

      for (const activity of phase.revisions[0]?.activities ?? []) {
        feed.push(fromActivity(activity, { ...ctx, phaseLabel }));
      }

      for (const task of phase.checklists) {
        const mapped = toChecklistTask(task);
        parentIdOf.set(mapped.id, mapped.parent_id);
        feed.push(fromChecklistTask(mapped, { ...ctx, phaseLabel }));
      }
    }
  }

  return {
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      is_urgent: project.priority === "URGENT",
    })),
    tasks: nestChecklistSubtasks(feed, parentIdOf),
    // Quick-add writes an Activity, which is what a loose work item is.
    // Checklist items are requirements and come from Studio settings only.
    addTargets: projects.map((project) => ({
      projectId: project.id,
      projectName: project.name,
      phases: [
        { phaseId: "general", phaseName: "General Tasks", isProjectLevel: true, isLocked: false },
        ...project.phases.map((phase) => ({
          phaseId: phase.id,
          activeRevisionId: phase.revisions[0]?.id,
          phaseName: formatPhaseLabel(phase.name_enum),
          isLocked: phase.is_locked || !phase.revisions[0]?.id,
        })),
      ],
    })),
  };
}

/** Assignee roster and label vocabulary, shared by both screens. */
export async function getTaskFeedLookups() {
  const [members, labels] = await Promise.all([
    prisma.user.findMany({
      where: { deleted_at: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.checklistLabel.findMany({
      select: { id: true, name: true, color: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { members, labels };
}
