import { TodayQuickAddModal } from "@/components/today-quick-add-modal";
import { TodayView } from "@/components/today-view";
import { DashboardTemplate, PageHeader, SectionCard } from "@/ui_engine";
import { getSession } from "@/lib/auth";
import { CalendarCheck2 } from "lucide-react";
import {
  getTaskFeed,
  getTaskFeedLookups,
} from "@/lib/services/task-feed-query";
import { groupTasksByProject } from "@/lib/services/task-feed";
import { getChecklistFilterViews } from "@/lib/services/checklist-filter-view";

/**
 * Tasks — the by-project view.
 *
 * This page was called "Today's View" and showed everything regardless of date,
 * which made the title a lie. The date question moved to `/upcoming`, where it
 * can be answered properly; this one answers the other question — what is on
 * each project I hold — and is named for it.
 *
 * Scope is always the projects you hold. There is no studio-wide toggle: this
 * is a personal working list, and `/projects` already gives anyone who needs it
 * the view across everything.
 */
export default async function TasksPage() {
  const { userId } = await getSession();

  const [{ projects, tasks, addTargets }, { members, labels }, savedFilters] =
    await Promise.all([
      getTaskFeed(userId),
      getTaskFeedLookups(),
      getChecklistFilterViews(userId),
    ]);

  // Projects drive the grouping, not tasks — that is what keeps a project you
  // hold on screen when its queue is empty.
  const groups = groupTasksByProject(projects, tasks);

  return (
    <DashboardTemplate
      header={
        <PageHeader
          eyebrow="Workload"
          title="Tasks"
          description="Every project you hold, with whatever is open on each."
          action={<TodayQuickAddModal projects={addTargets} />}
        />
      }
      content={
        groups.length === 0 ? (
          <SectionCard className="min-h-[320px]">
            <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
              <CalendarCheck2 className="h-10 w-10 text-slate-200" />
              <div className="space-y-1">
                <h3 className="font-sans text-sm font-medium text-slate-400">
                  You aren&apos;t on any active project.
                </h3>
                <p className="text-xs text-slate-300">
                  Projects appear here as soon as you are their designer or
                  drafter.
                </p>
              </div>
            </div>
          </SectionCard>
        ) : (
          <TodayView
            groups={groups}
            addTargets={addTargets}
            currentUserId={userId}
            members={members}
            knownLabels={labels}
            initialSavedFilters={savedFilters}
          />
        )
      }
    />
  );
}
