import { PhaseName, PhaseStatus } from "@/generated/prisma";

/**
 * PHASE PRESENTER — turns the 7-state machine into the two things a person
 * actually asks about a phase.
 *
 * ============================================================================
 * WHY THIS FILE EXISTS
 * ============================================================================
 * `PhaseStatus` has seven members and `PhaseName` has six, so a project screen
 * can present 42 combinations. Rendering the enum verbatim (`READY_FOR_NEXT`,
 * `APPROVED_INTERNAL`) pushes that whole state machine onto the reader.
 *
 * Nobody in the studio asks "what is the status_enum". They ask two questions:
 *
 *   1. WHOSE COURT IS THE BALL IN?  us / internal reviewer / client / drafter
 *   2. HOW LONG HAS IT BEEN THERE?  the number that reveals a stalled project
 *
 * Everything here answers those two and nothing else.
 *
 * ============================================================================
 * WHAT THIS FILE IS NOT
 * ============================================================================
 * It is NOT a replacement for `PhaseStatus`. The enum stays exactly as it is:
 * it drives PhasePolicy transitions, permissions and audit history, and it is
 * correct. This module is a READ-SIDE projection. It has no opinion on what a
 * phase may do next — that is src/lib/domain/phase-policy.ts.
 *
 * Keep every export PURE. No Prisma client, no I/O, no `new Date()` captured at
 * module scope. Callers pass `now` so server renders and tests are
 * deterministic and so a stale render cannot silently age.
 */

// ---------------------------------------------------------------------------
// Who is being waited on
// ---------------------------------------------------------------------------

/**
 * TEAM      — us; the designer or whoever owns the phase is working on it
 * REVIEWER  — submitted internally, waiting on a senior/lead to look
 * CLIENT    — out of the office entirely; we cannot move it
 * DRAFTER   — the DRIC's court (CD phase)
 * NOBODY    — nothing is pending: not started, or finished
 */
export type PhaseActor = "TEAM" | "REVIEWER" | "CLIENT" | "DRAFTER" | "NOBODY";

export type PhaseTone = "idle" | "active" | "waiting" | "done";

/**
 * What the elapsed time MEANS for this phase.
 *
 * The same number reads differently depending on the state, and conflating the
 * two was a real defect: a phase approved six weeks ago was rendering "6 weeks"
 * in a column headed TIME, which reads as "has been waiting six weeks". It has
 * not been waiting at all — it has been finished for six weeks.
 *
 *   "waiting"  — work is open; the clock is a cost. Can stall.
 *   "elapsed"  — nothing is pending; the clock is just history. Never stalls.
 */
export type PhaseDurationRole = "waiting" | "elapsed";

export interface PhaseReading {
  /** Plain-language state. Never an enum member. */
  headline: string;
  actor: PhaseActor;
  /** Short "with client" / "with drafter" pill text, or null when nobody holds it. */
  actorLabel: string | null;
  tone: PhaseTone;
  /** Whole days since the phase entered this state; null when unknown. */
  waitingDays: number | null;
  /** Bare duration, e.g. "3 days". Null when `status_changed_at` is unknown. */
  waitingLabel: string | null;
  /** How to read `waitingLabel`. See PhaseDurationRole. */
  durationRole: PhaseDurationRole;
  /**
   * Duration phrased for its role: "3 days" while waiting, "6 weeks ago" once
   * finished. Use this for display; `waitingLabel` is the raw part.
   */
  durationLabel: string | null;
  /** True when the wait has passed the threshold for this actor. */
  isStalled: boolean;
}

// ---------------------------------------------------------------------------
// Stall thresholds
// ---------------------------------------------------------------------------

/**
 * Days after which a wait is worth flagging, per actor.
 *
 * These differ on purpose. A designer holding a phase for a week is normal
 * work; an internal review sitting untouched for a week means someone forgot.
 * A client taking two weeks is common in this business, so the client
 * threshold is the most forgiving of the three — flagging it sooner would
 * train people to ignore the flag.
 *
 * NOBODY has no threshold: a finished or unstarted phase cannot stall.
 */
const STALL_AFTER_DAYS: Record<PhaseActor, number | null> = {
  TEAM: 14,
  REVIEWER: 3,
  CLIENT: 10,
  DRAFTER: 14,
  NOBODY: null,
};

const ACTOR_LABEL: Record<PhaseActor, string | null> = {
  TEAM: "with us",
  REVIEWER: "with reviewer",
  CLIENT: "with client",
  DRAFTER: "with drafter",
  NOBODY: null,
};

// ---------------------------------------------------------------------------
// Status -> reading
// ---------------------------------------------------------------------------

interface StatusFace {
  headline: string;
  actor: PhaseActor;
  tone: PhaseTone;
}

/**
 * The projection table. Note READY_FOR_NEXT and COMPLETED both read as finished
 * work: the distinction between them ("a later phase exists" vs "this was the
 * last one") is a scheduling fact the phase itself should not have to explain.
 */
const STATUS_FACE: Record<PhaseStatus, StatusFace> = {
  [PhaseStatus.PENDING]: { headline: "Not started", actor: "NOBODY", tone: "idle" },
  [PhaseStatus.IN_PROGRESS]: { headline: "In progress", actor: "TEAM", tone: "active" },
  [PhaseStatus.ON_REVIEW_INTERNAL]: { headline: "In internal review", actor: "REVIEWER", tone: "waiting" },
  [PhaseStatus.APPROVED_INTERNAL]: { headline: "Approved internally", actor: "TEAM", tone: "active" },
  [PhaseStatus.ON_REVIEW_CLIENT]: { headline: "Sent to client", actor: "CLIENT", tone: "waiting" },
  [PhaseStatus.READY_FOR_NEXT]: { headline: "Approved", actor: "NOBODY", tone: "done" },
  [PhaseStatus.COMPLETED]: { headline: "Completed", actor: "NOBODY", tone: "done" },
};

// ---------------------------------------------------------------------------
// Phase naming
// ---------------------------------------------------------------------------

/**
 * Display names for the pipeline. Canonical home for these strings — a copy
 * previously lived inside components/nav-inner.tsx, which meant the sidebar and
 * every other surface could drift ("CD" vs "Construction Drawings").
 *
 * COMPLETED is a terminal marker rather than a phase people work in, hence the
 * plain wording.
 */
export const PHASE_LABEL: Record<PhaseName, string> = {
  [PhaseName.MOODBOARD]: "Moodboard",
  [PhaseName.LAYOUT]: "Layout 2D",
  [PhaseName.DESIGN_3D]: "Design 3D",
  [PhaseName.CD]: "Construction Drawings",
  [PhaseName.SUPERVISION]: "Supervision",
  [PhaseName.COMPLETED]: "Completed",
};

export function formatPhaseLabel(name: PhaseName | string): string {
  return PHASE_LABEL[name as PhaseName] ?? String(name).replace(/_/g, " ");
}

const MS_PER_DAY = 86_400_000;

/**
 * Whole days elapsed, floored. Returns null for unknown or future timestamps —
 * a clock-skewed future date would otherwise render "-1 days".
 */
export function daysSince(from: Date | string | null | undefined, now: Date): number | null {
  if (!from) return null;
  const start = from instanceof Date ? from : new Date(from);
  if (Number.isNaN(start.getTime())) return null;
  const elapsed = now.getTime() - start.getTime();
  if (elapsed < 0) return null;
  return Math.floor(elapsed / MS_PER_DAY);
}

/**
 * Duration phrasing. Deliberately coarse: nobody schedules around "3 days 4
 * hours", and precision here would imply the timestamp is more meaningful than
 * it is (it moves on manual status changes, not on real work).
 */
export function formatWaitingLabel(days: number | null): string | null {
  if (days === null) return null;
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  const weeks = Math.floor(days / 7);
  return weeks < 9 ? `${weeks} weeks` : `${Math.floor(days / 30)} months`;
}

export interface ReadPhaseInput {
  status_enum: PhaseStatus;
  name_enum?: PhaseName;
  status_changed_at?: Date | string | null;
}

/**
 * Builds the plain-language reading for one phase.
 *
 * `now` is a required argument, not a default: a React Server Component that
 * captured `new Date()` inside this function would bake render time into the
 * output and drift from any sibling reading on the same page.
 */
export function readPhase(phase: ReadPhaseInput, now: Date): PhaseReading {
  const face = STATUS_FACE[phase.status_enum] ?? STATUS_FACE[PhaseStatus.PENDING];

  // CD is the drafter's domain, per the office pipeline. Same status, different
  // person holding it — and "with drafter" is what the designer needs to read.
  const actor: PhaseActor =
    face.actor === "TEAM" && phase.name_enum === PhaseName.CD ? "DRAFTER" : face.actor;

  const waitingDays = daysSince(phase.status_changed_at, now);
  const threshold = STALL_AFTER_DAYS[actor];
  const waitingLabel = formatWaitingLabel(waitingDays);

  // Nobody holding the phase means nothing is pending, so the clock stops being
  // a cost and becomes history. Note this keys off `actor`, not `tone`: a
  // PENDING phase has nobody on it either, and "not started, 6 weeks ago" is
  // the accurate reading of a phase that has simply not begun.
  const durationRole: PhaseDurationRole = actor === "NOBODY" ? "elapsed" : "waiting";

  return {
    headline: face.headline,
    actor,
    actorLabel: ACTOR_LABEL[actor],
    tone: face.tone,
    waitingDays,
    waitingLabel,
    durationRole,
    durationLabel:
      waitingLabel === null
        ? null
        : durationRole === "elapsed"
          ? waitingLabel === "today"
            ? "today"
            : `${waitingLabel} ago`
          : waitingLabel,
    isStalled: threshold !== null && waitingDays !== null && waitingDays >= threshold,
  };
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

export interface PhaseProgress {
  done: number;
  total: number;
  /** 0-100, floored. 0 when there is nothing to count. */
  percent: number;
}

export interface CountableWork {
  /** Checklist items belonging to the phase. */
  checklists?: { is_checked: boolean }[];
  /**
   * Activities in scope for the phase. Pass BOTH the active revision's
   * activities and any deferred (revision_id = null) ones tagged to the phase —
   * phase-service.assertNoPendingTasks blocks approval on both, so both belong
   * in the count the user reads.
   */
  activities?: { status: string }[];
}

/**
 * Counts real, blocking work — the same population that gates approval — so the
 * fraction on screen matches what actually stops someone from moving forward.
 * A phase whose progress reads 12/12 should be a phase that can be submitted.
 *
 * Returns null when there is nothing to count. Rendering "0/0" or a full bar
 * for an empty phase both mislead; showing no bar at all is honest.
 */
export function readPhaseProgress(work: CountableWork): PhaseProgress | null {
  const checklists = work.checklists ?? [];
  const activities = work.activities ?? [];
  const total = checklists.length + activities.length;
  if (total === 0) return null;

  const done =
    checklists.filter((c) => c.is_checked).length +
    activities.filter((a) => a.status === "COMPLETED").length;

  return { done, total, percent: Math.floor((done / total) * 100) };
}

/**
 * Joins a reading and its progress into the one-line summary used in dense
 * contexts (project lists, sidebar tooltips) where a component is too much.
 *
 * Example: `Sent to client · with client · 3 days · 8/12 done`
 */
export function formatPhaseSummary(reading: PhaseReading, progress: PhaseProgress | null): string {
  return [
    reading.headline,
    reading.actorLabel,
    reading.durationLabel,
    progress ? `${progress.done}/${progress.total} done` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
