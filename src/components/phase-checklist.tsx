"use client";

/**
 * Phase-level task list.
 *
 * Now a thin wrapper: everything that renders a task lives in `TaskList`, which
 * the project overview uses too. Keeping two implementations was what let the
 * two surfaces drift apart in the first place — different sort orders, and only
 * one of them able to add a row.
 */

import { usePhaseLive } from "@/ui_engine";
import { AlertTriangle } from "lucide-react";
import { TaskList } from "@/components/task-list";
import type { ChecklistUserRef } from "@/types/checklist";

interface PhaseChecklistProps {
  projectId: string;
  isLocked: boolean;
  canEdit: boolean;
  phaseStatus: string;
  currentUserId: string | null;
  members: ChecklistUserRef[];
  knownLabels?: { id: string; name: string; color: string }[];
  /** Admin-only. Where phase requirements are actually defined. */
  settingsHref?: string | null;
}

export function PhaseChecklist({
  projectId,
  isLocked,
  canEdit,
  phaseStatus,
  currentUserId,
  members,
  knownLabels = [],
  settingsHref = null,
}: PhaseChecklistProps) {
  const { checklistItems, toggleChecklistOptimistic, syncNow } = usePhaseLive();

  // Same rule as before: a locked phase, or one that is not in progress, is
  // read-only. Approval gating exists precisely so a signed-off phase stops
  // moving.
  const isEditable = canEdit && !isLocked && phaseStatus === "IN_PROGRESS";

  // Progress counts root tasks only, matching `assertNoPendingTasks`. If this
  // counted subtasks, the header could read 9/10 while approval was still
  // blocked by the one task those subtasks belong to.
  const rootItems = checklistItems.filter((item) => item.parent_id === null);
  const completedCount = rootItems.filter((item) => item.is_checked).length;

  return (
    <div className="space-y-4">
      <h3 className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        <div className="flex items-center gap-3">
          Phase Checklist
          <div className="h-[4px] w-[4px] rounded-full bg-slate-300" />
          <span className="text-slate-500">
            {completedCount}/{rootItems.length} Done
          </span>
        </div>
        <div className="h-px flex-1 bg-zinc-100" />
      </h3>

      {checklistItems.length === 0 && !isEditable ? (
        <div className="flex flex-col items-center py-10 text-center">
          <AlertTriangle className="mb-3 h-8 w-8 text-slate-200" />
          <p className="text-xs italic text-slate-400">
            No checklist items defined for this phase.
          </p>
        </div>
      ) : (
        <TaskList
          tasks={checklistItems}
          projectId={projectId}
          canEdit={isEditable}
          currentUserId={currentUserId}
          members={members}
          knownLabels={knownLabels}
          settingsHref={settingsHref}
          onToggleOptimistic={toggleChecklistOptimistic}
          onAfterMutate={() => {
            // The provider polls every few seconds; pulling once immediately
            // stops a just-written row from appearing to lag.
            void syncNow().catch((error) => {
              console.error("Failed to sync phase checklist:", error);
            });
          }}
          emptyMessage="No requirements defined for this phase. These come from Studio settings."
        />
      )}
    </div>
  );
}
