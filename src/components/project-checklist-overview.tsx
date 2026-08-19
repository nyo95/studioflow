"use client";

/**
 * Project-level (global) task list — the sidebar card on the project page.
 *
 * Rendering is delegated to `TaskList`, the same component the phase view uses.
 * This file used to hold its own flat list that re-sorted alphabetically in the
 * browser, patching over a server query that ordered by UUID. Both are gone:
 * ordering now comes from `sort_order` on the server, in one place.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { syncProjectChecklists } from "@/actions/project-actions";
import { unwrapActionResult } from "@/lib/result";
import { TaskList } from "@/components/task-list";
import type { ChecklistTask, ChecklistUserRef } from "@/types/checklist";

interface ProjectChecklistOverviewProps {
  projectId: string;
  checklists: ChecklistTask[];
  canEdit: boolean;
  currentUserId: string | null;
  members: ChecklistUserRef[];
  knownLabels?: { id: string; name: string; color: string }[];
  /** Admin-only. Where global checklist items are actually defined. */
  settingsHref?: string | null;
}

export function ProjectChecklistOverview({
  projectId,
  checklists,
  canEdit,
  currentUserId,
  members,
  knownLabels = [],
  settingsHref = null,
}: ProjectChecklistOverviewProps) {
  const router = useRouter();

  // Pulls in any template added since the project was created. Additive and
  // idempotent — it dedups on (template_id, phase_id), so re-running it never
  // duplicates a row and never touches a task somebody typed.
  React.useEffect(() => {
    let cancelled = false;

    void syncProjectChecklists({ projectId })
      .then((result) => {
        const synced = unwrapActionResult(result);
        // Only refresh when the sync actually produced something. Refreshing
        // unconditionally on mount meant every visit to the project page did a
        // second server render for no reason.
        if (!cancelled && synced.count > 0) router.refresh();
      })
      .catch(console.error);

    return () => {
      cancelled = true;
    };
  }, [projectId, router]);

  return (
    <TaskList
      tasks={checklists}
      projectId={projectId}
      canEdit={canEdit}
      currentUserId={currentUserId}
      members={members}
      knownLabels={knownLabels}
      settingsHref={settingsHref}
      emptyMessage="No global checklist items. These come from Studio settings and apply to every project."
    />
  );
}
