import { PhaseStatus, PhaseName } from "@/generated/prisma";
import { ActionError } from "@/lib/error-types";

/**
 * Phase Domain Policy
 * 
 * Centralizes lifecycle rules for project phases.
 */
export const PhasePolicy = {
  /**
   * Can a phase's content be mutated?
   * Content includes activities, files, checklist items, etc.
   */
  isModifiable: (phase: { status_enum: string; is_locked: boolean }) => {
    // Standard block: Locked phases or phases in review/complete states are usually non-modifiable
    if (phase.is_locked) return false;
    
    const unmodifiableStates: PhaseStatus[] = [
      PhaseStatus.READY_FOR_NEXT,
      PhaseStatus.COMPLETED
    ];

    return !unmodifiableStates.includes(phase.status_enum as PhaseStatus);
  },

  /**
   * Assert phase modifiability or throw.
   */
  assertModifiable: (phase: { status_enum: string; is_locked: boolean }) => {
    if (!PhasePolicy.isModifiable(phase)) {
      throw new ActionError("Phase is locked or completed. Mutation forbidden.", "INVALID_PHASE_STATE");
    }
  },

  /**
   * Sequential Logic: Can this phase be activated?
   */
  canActivate: (
    currentPhase: { order_index: number; allow_parallel: boolean }, 
    prevPhase?: { status_enum: string }
  ) => {
    if (currentPhase.order_index === 0) return true;
    if (currentPhase.allow_parallel) return true;
    if (!prevPhase) return true;

    const completedStates: PhaseStatus[] = [PhaseStatus.READY_FOR_NEXT, PhaseStatus.COMPLETED];
    return completedStates.includes(prevPhase.status_enum as PhaseStatus);
  },

  /**
   * Transition Logic: Check valid status movements
   */
  isValidTransition: (current: PhaseStatus, target: PhaseStatus) => {
    // Simplified transition matrix for v1.5
    const transitions: Record<PhaseStatus, PhaseStatus[]> = {
      [PhaseStatus.PENDING]: [PhaseStatus.IN_PROGRESS, PhaseStatus.READY_FOR_NEXT, PhaseStatus.COMPLETED],
      [PhaseStatus.IN_PROGRESS]: [PhaseStatus.ON_REVIEW_INTERNAL, PhaseStatus.ON_REVIEW_CLIENT, PhaseStatus.READY_FOR_NEXT],
      [PhaseStatus.ON_REVIEW_INTERNAL]: [PhaseStatus.IN_PROGRESS, PhaseStatus.APPROVED_INTERNAL, PhaseStatus.ON_REVIEW_CLIENT],
      [PhaseStatus.APPROVED_INTERNAL]: [PhaseStatus.ON_REVIEW_CLIENT, PhaseStatus.IN_PROGRESS],
      [PhaseStatus.ON_REVIEW_CLIENT]: [PhaseStatus.IN_PROGRESS, PhaseStatus.READY_FOR_NEXT, PhaseStatus.COMPLETED],
      [PhaseStatus.READY_FOR_NEXT]: [PhaseStatus.IN_PROGRESS], // Re-opening
      [PhaseStatus.COMPLETED]: [PhaseStatus.IN_PROGRESS],      // Re-opening
    };

    return transitions[current]?.includes(target) ?? false;
  }
};
