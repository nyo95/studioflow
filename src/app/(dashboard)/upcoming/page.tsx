import { UpcomingView } from "@/components/upcoming-view";
import { DashboardPageShell, PageHeader } from "@/ui_engine";
import { getSession } from "@/lib/auth";
import { getTaskFeed } from "@/lib/services/task-feed-query";

/**
 * Upcoming — the date view.
 *
 * Same rows as `/`, grouped by when they are due instead of which project they
 * belong to. `/` used to be called "Today's View" while showing everything
 * regardless of date; the date question lives here now, where it can actually
 * be answered.
 */
export default async function UpcomingPage() {
  const { userId } = await getSession();
  const { tasks } = await getTaskFeed(userId);

  // Subtasks are flattened by `bucketTasksByDate`: on a date view they carry
  // their own dates and belong in their own buckets, not under a parent that
  // may sit in a different day entirely.
  return (
    <DashboardPageShell>
      <PageHeader
        eyebrow="Daily Pulse"
        title="Upcoming"
        description="What's due today, and what's coming after."
      />

      <UpcomingView tasks={tasks} currentUserId={userId} />
    </DashboardPageShell>
  );
}
