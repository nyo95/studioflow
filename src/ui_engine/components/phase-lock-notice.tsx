import * as React from "react";
import { cn } from "@/lib/utils";
import { Lock, GitBranch } from "lucide-react";
import { UI_ENGINE_RADIUS_CARD } from "@/ui_engine/tokens";
import type { PhaseLockExplanation } from "@/lib/domain/phase-lock";

/**
 * PHASE LOCK NOTICE — states the rule, shows how far off the unblock is, and
 * offers the sanctioned way around it.
 *
 * The design intent is that a locked phase stays READABLE. The notice sits
 * above the content rather than replacing it; callers render the phase body
 * underneath in a read-only state. Blanking the screen is what makes a lock
 * feel like the tool fighting the user — most of the time someone opening a
 * locked phase only wants to look at it.
 *
 * Server component. The optional `action` slot takes a client component (the
 * override or reopen button) so this file stays free of interactivity.
 */

export interface PhaseLockNoticeProps extends React.HTMLAttributes<HTMLDivElement> {
  explanation: PhaseLockExplanation;
  /** Override / reopen control. Omit for viewers without the permission. */
  action?: React.ReactNode;
}

export function PhaseLockNotice({ explanation, action, className, ...props }: PhaseLockNoticeProps) {
  if (!explanation.isBlocked) return null;

  const isSequential = explanation.kind === "SEQUENTIAL";

  return (
    <div
      className={cn(
        "border px-5 py-4",
        UI_ENGINE_RADIUS_CARD,
        // Sequential locks are temporary and expected, so they read as neutral
        // information. A finalised phase is a deliberate freeze, so it gets the
        // heavier slate treatment. Neither is red: nothing has gone wrong.
        isSequential ? "border-amber-200 bg-amber-50/60" : "border-slate-200 bg-slate-50",
        className
      )}
      {...props}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              isSequential ? "bg-amber-100 text-amber-700" : "bg-slate-200 text-slate-600"
            )}
            aria-hidden
          >
            <Lock className="h-3.5 w-3.5" />
          </span>

          <div className="min-w-0 space-y-1">
            <p className="font-sans text-sm font-medium text-slate-900">{explanation.reason}</p>

            {explanation.prerequisite ? (
              <p className="font-sans text-sm text-slate-600">{explanation.prerequisite}</p>
            ) : null}

            {explanation.remedy ? (
              <p className="font-sans text-xs text-slate-500">{explanation.remedy}</p>
            ) : null}
          </div>
        </div>

        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

/**
 * RUNNING-AHEAD BADGE — marks a phase that `allow_parallel` carried past a gate
 * which has still not cleared.
 *
 * Deliberately persistent. The override is a legitimate call (site work often
 * genuinely overlaps), but an invisible shortcut is one nobody remembers taking
 * — and the whole reason for the sequential rule is that the earlier phase can
 * still change underneath this one.
 */
export function PhaseRunningAheadBadge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1",
        "font-sans text-[10px] font-bold uppercase leading-none tracking-[0.14em] text-amber-700",
        className
      )}
      title="Started in parallel — the previous phase has not been approved yet."
      {...props}
    >
      <GitBranch className="h-3 w-3" aria-hidden />
      Parallel
    </span>
  );
}
