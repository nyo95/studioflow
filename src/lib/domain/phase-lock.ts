import { PhaseName, PhaseStatus } from "@/generated/prisma";
import { PhasePolicy } from "@/lib/domain/phase-policy";
import { formatPhaseLabel, readPhase } from "@/lib/domain/phase-presenter";

/**
 * PHASE LOCK EXPLAINER — makes a lock read as information instead of a wall.
 *
 * ============================================================================
 * WHY THIS FILE EXISTS
 * ============================================================================
 * Two independent mechanisms stop work on a phase, and neither says why:
 *
 *   1. `Phase.is_locked` — set true when a phase is approved or completed.
 *      PhasePolicy.isModifiable() then refuses every content mutation.
 *   2. PhasePolicy.canActivate() — the sequential gate. A phase cannot start
 *      until the previous one reaches READY_FOR_NEXT, unless `allow_parallel`.
 *
 * Both are correct rules. Both currently surface as a disabled button or a
 * thrown ActionError with no context, which reads as the software fighting the
 * user — the single most common complaint about workflow tools. A user who
 * understands a rule works with it; a user who only feels it looks for a way
 * around it.
 *
 * `allow_parallel` already exists in the schema as the sanctioned escape hatch.
 * It was never exposed, so the escape hatch is invisible too.
 *
 * PURE MODULE. No I/O, no Prisma client. Callers supply the rows.
 */

export type PhaseLockKind =
  /** Nothing is blocking this phase. */
  | "NONE"
  /** Work is finished and frozen; reopening is the way back in. */
  | "FINALISED"
  /** The previous phase has not cleared yet. */
  | "SEQUENTIAL";

export interface PhaseLockExplanation {
  isBlocked: boolean;
  kind: PhaseLockKind;
  /** One sentence stating the rule, in plain language. Empty when not blocked. */
  reason: string;
  /**
   * The live state of whatever is being waited on, so the user can see how far
   * away the unblock is instead of guessing. Null when there is nothing to
   * report (e.g. a finalised phase is not waiting on anything).
   */
  prerequisite: string | null;
  /** What the user can actually do about it. Null when nothing applies. */
  remedy: string | null;
  /**
   * True when the sequential gate can be lifted by setting `allow_parallel`.
   * Never true for FINALISED — that needs an explicit reopen, which spawns a
   * new revision and must stay a deliberate act.
   */
  canOverrideWithParallel: boolean;
  /**
   * True when `allow_parallel` is already carrying this phase past a gate that
   * has NOT yet cleared on its own. The UI should keep a visible marker for as
   * long as this holds — a shortcut nobody can see is a shortcut everybody
   * forgets they took.
   */
  isRunningAhead: boolean;
}

const NOT_BLOCKED: PhaseLockExplanation = {
  isBlocked: false,
  kind: "NONE",
  reason: "",
  prerequisite: null,
  remedy: null,
  canOverrideWithParallel: false,
  isRunningAhead: false,
};

export interface LockSubjectPhase {
  name_enum: PhaseName;
  status_enum: PhaseStatus;
  order_index: number;
  is_locked: boolean;
  allow_parallel: boolean;
}

export interface LockPrerequisitePhase {
  name_enum: PhaseName;
  status_enum: PhaseStatus;
  status_changed_at?: Date | string | null;
}

/**
 * Mirrors PhasePolicy.canActivate's notion of "previous phase is out of the
 * way". Kept as its own constant rather than imported so a change to the policy
 * surfaces as a failing explanation to review, not a silently reworded sentence.
 */
const CLEARED_STATES: PhaseStatus[] = [PhaseStatus.READY_FOR_NEXT, PhaseStatus.COMPLETED];

function hasCleared(phase: LockPrerequisitePhase | null | undefined): boolean {
  return !!phase && CLEARED_STATES.includes(phase.status_enum);
}

/**
 * Explains why a phase cannot be worked on right now.
 *
 * @param phase     the phase the user is looking at
 * @param prevPhase the phase at order_index - 1, or null for the first phase
 * @param now       used to age the prerequisite ("sent to client, 3 days")
 */
export function explainPhaseLock(
  phase: LockSubjectPhase,
  prevPhase: LockPrerequisitePhase | null | undefined,
  now: Date
): PhaseLockExplanation {
  const label = formatPhaseLabel(phase.name_enum);

  // ---- 1. Finalised ------------------------------------------------------
  // Checked first: an approved phase is frozen regardless of what came before,
  // and telling someone their finished phase is "waiting on the previous phase"
  // would be nonsense.
  if (phase.is_locked) {
    const isDone =
      phase.status_enum === PhaseStatus.READY_FOR_NEXT || phase.status_enum === PhaseStatus.COMPLETED;

    return {
      isBlocked: true,
      kind: "FINALISED",
      reason: isDone
        ? `${label} is approved and frozen. Its content is kept as the record of what was signed off.`
        : `${label} is locked, so its content cannot be changed.`,
      prerequisite: null,
      remedy: "Reopen the phase to make changes. That starts a new revision and keeps the approved one intact.",
      canOverrideWithParallel: false,
      isRunningAhead: false,
    };
  }

  // ---- 2. Sequential gate ------------------------------------------------
  // Only PENDING phases are gated. Once a phase is running, the gate has
  // already been passed and re-reporting it would be noise.
  if (phase.status_enum !== PhaseStatus.PENDING) {
    return {
      ...NOT_BLOCKED,
      isRunningAhead: phase.allow_parallel && !hasCleared(prevPhase) && phase.order_index > 0,
    };
  }

  if (phase.order_index === 0 || !prevPhase) return NOT_BLOCKED;

  if (PhasePolicy.canActivate(phase, prevPhase)) {
    // Either the previous phase cleared, or allow_parallel is carrying it.
    return {
      ...NOT_BLOCKED,
      isRunningAhead: phase.allow_parallel && !hasCleared(prevPhase),
    };
  }

  const prevLabel = formatPhaseLabel(prevPhase.name_enum);
  const prevReading = readPhase(
    {
      status_enum: prevPhase.status_enum,
      name_enum: prevPhase.name_enum,
      status_changed_at: prevPhase.status_changed_at,
    },
    now
  );

  const prerequisite = [
    `${prevLabel} is currently ${prevReading.headline.toLowerCase()}`,
    prevReading.actorLabel,
    prevReading.durationLabel,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    isBlocked: true,
    kind: "SEQUENTIAL",
    reason: `${label} starts once ${prevLabel} is approved.`,
    prerequisite,
    remedy: `Start ${label} in parallel if the work genuinely overlaps. This is recorded in the activity log.`,
    canOverrideWithParallel: true,
    isRunningAhead: false,
  };
}
