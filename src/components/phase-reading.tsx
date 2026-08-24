import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";
import type { PhaseProgress, PhaseReading, PhaseTone } from "@/lib/domain/phase-presenter";

/**
 * PHASE READING — display pieces for the projection built by
 * src/lib/domain/phase-presenter.ts.
 *
 * ============================================================================
 * WHY THIS FILE EXPORTS PARTS, NOT JUST A LINE
 * ============================================================================
 * The first version of this file exported only `PhaseReadingLine`: one
 * self-contained sentence, `state · owner · duration · progress`. That is right
 * for a dense surface, and wrong inside a table — a table's whole job is to
 * split those fields into columns, so dropping a joined sentence into a Status
 * cell next to a Time column prints the duration twice on the same row.
 *
 * So the parts are exported individually (`PhaseStatusPill`, `PhaseOwner`,
 * `PhaseDuration`) for column layouts, and `PhaseReadingLine` remains for
 * places with room for exactly one line. Pick one; never both on one row.
 *
 * All server components. They take a prepared `PhaseReading`, never a raw phase
 * row, so none of them can read a clock of its own.
 */

const TONE_DOT: Record<PhaseTone, string> = {
  idle: "bg-slate-300",
  active: "bg-emerald-500",
  waiting: "bg-amber-500",
  done: "bg-slate-900",
};

const TONE_PILL: Record<PhaseTone, string> = {
  idle: "border-slate-200 bg-slate-50 text-slate-500",
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  waiting: "border-amber-200 bg-amber-50 text-amber-700",
  done: "border-slate-200 bg-white text-slate-600",
};

// ---------------------------------------------------------------------------
// Parts — for table/column layouts
// ---------------------------------------------------------------------------

export interface PhaseStatusPillProps extends React.HTMLAttributes<HTMLSpanElement> {
  reading: PhaseReading;
}

/**
 * The state, and only the state. Quiet semantic colours rather than a single
 * loud badge: the point of the pill is to be scannable down a column, and five
 * identically-styled chips are no faster to read than five plain words.
 */
export function PhaseStatusPill({ reading, className, ...props }: PhaseStatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1",
        "font-sans text-xs font-medium leading-none",
        TONE_PILL[reading.tone],
        className
      )}
      {...props}
    >
      {reading.headline}
    </span>
  );
}

export interface PhaseOwnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  reading: PhaseReading;
}

/** "with client" / "with drafter" / "with us". Renders nothing when idle or done. */
export function PhaseOwner({ reading, className, ...props }: PhaseOwnerProps) {
  if (!reading.actorLabel) return null;
  return (
    <span className={cn("font-sans text-xs text-slate-500", className)} {...props}>
      {reading.actorLabel}
    </span>
  );
}

export interface PhaseDurationProps extends React.HTMLAttributes<HTMLSpanElement> {
  reading: PhaseReading;
}

/**
 * Elapsed time, phrased for what it means — "3 days" while someone is holding
 * the phase, "6 weeks ago" once it is finished.
 *
 * Stalled work turns amber, not red: it is a nudge about elapsed time, not an
 * error, and red here would cry wolf on every project that is merely slow. A
 * finished phase can never be stalled, so it never carries the icon regardless
 * of how long ago it was approved.
 */
export function PhaseDuration({ reading, className, ...props }: PhaseDurationProps) {
  if (!reading.durationLabel) {
    return (
      <span className={cn("font-sans text-xs text-slate-300", className)} {...props}>
        —
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-sans text-xs",
        reading.isStalled ? "font-medium text-amber-700" : "text-slate-500",
        className
      )}
      {...props}
    >
      {reading.isStalled ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
      {reading.durationLabel}
    </span>
  );
}

export interface PhaseToneDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  reading: PhaseReading;
}

export function PhaseToneDot({ reading, className, ...props }: PhaseToneDotProps) {
  return (
    <span
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[reading.tone], className)}
      aria-hidden
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Joined line — for single-line surfaces only
// ---------------------------------------------------------------------------

export interface PhaseReadingLineProps extends React.HTMLAttributes<HTMLDivElement> {
  reading: PhaseReading;
  progress?: PhaseProgress | null;
  /** Active revision label, e.g. "v2.0". Rendered between state and owner. */
  revisionLabel?: string | null;
  /** Hides the done/total fraction when the surface is too dense for it. */
  compact?: boolean;
}

/**
 * Everything the reading knows, on one line. Use where there is room for a
 * sentence and nothing else — a page header, a tooltip. Inside a table, use the
 * parts above instead.
 */
export function PhaseReadingLine({
  reading,
  progress = null,
  revisionLabel = null,
  compact = false,
  className,
  ...props
}: PhaseReadingLineProps) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-sm", className)}
      {...props}
    >
      <PhaseToneDot reading={reading} />

      <span
        className={cn(
          "font-medium",
          reading.tone === "idle" || reading.tone === "done" ? "text-slate-500" : "text-slate-900"
        )}
      >
        {reading.headline}
      </span>

      {revisionLabel ? (
        <>
          <Separator />
          <span className="text-xs font-medium text-slate-500">{revisionLabel}</span>
        </>
      ) : null}

      {reading.actorLabel ? (
        <>
          <Separator />
          <span className="text-slate-500">{reading.actorLabel}</span>
        </>
      ) : null}

      {reading.durationLabel ? (
        <>
          <Separator />
          <span
            className={cn(
              "inline-flex items-center gap-1",
              reading.isStalled ? "font-medium text-amber-700" : "text-slate-500"
            )}
          >
            {reading.isStalled ? <AlertTriangle className="h-3 w-3" aria-hidden /> : null}
            {reading.durationLabel}
          </span>
        </>
      ) : null}

      {!compact && progress ? (
        <>
          <Separator />
          <span className="text-slate-500">
            {progress.done}/{progress.total} done
          </span>
        </>
      ) : null}
    </div>
  );
}

function Separator() {
  return (
    <span className="select-none text-slate-300" aria-hidden>
      ·
    </span>
  );
}

export interface PhaseProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
  progress: PhaseProgress | null;
}

/**
 * Thin completion bar for the same numbers.
 *
 * Renders nothing when there is no countable work: an empty phase drawing a
 * 0% bar reads as "behind", when in fact nothing has been asked of it yet.
 */
export function PhaseProgressBar({ progress, className, ...props }: PhaseProgressBarProps) {
  if (!progress) return null;

  return (
    <div className={cn("flex items-center gap-3", className)} {...props}>
      <div
        className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-valuenow={progress.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${progress.done} of ${progress.total} items done`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            progress.percent === 100 ? "bg-emerald-500" : "bg-slate-900"
          )}
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <span className="shrink-0 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
        {progress.done}/{progress.total}
      </span>
    </div>
  );
}
