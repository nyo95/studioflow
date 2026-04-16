import { PhaseName } from "@/generated/prisma";

export type ProgressState = 
  | { type: 'IN_PROGRESS'; phases: { name: PhaseName; major: number; minor: number; status_enum: string }[] }
  | { type: 'READY_FOR'; nextPhaseName: PhaseName }
  | { type: 'PROJECT_DONE' };

interface PhaseData {
  name_enum: PhaseName;
  status_enum: string;
  order_index: number;
  revisions: { major: number; minor: number }[];
}

export function getProjectProgress(phases: PhaseData[]): ProgressState {
  const sortedPhases = [...phases].sort((a, b) => a.order_index - b.order_index);
  
  // 1. Prioritize explicitly active phases (IN_PROGRESS, ON_REVIEW, etc.)
  // If one or more phases are in an active state, we only show those.
  const inProgressStatuses = ['IN_PROGRESS', 'ON_REVIEW_INTERNAL', 'ON_REVIEW_CLIENT', 'APPROVED_INTERNAL'];
  const activePhases = sortedPhases.filter(p => inProgressStatuses.includes(p.status_enum));
  
  if (activePhases.length > 0) {
    return {
      type: 'IN_PROGRESS',
      phases: activePhases.map(p => ({
        name: p.name_enum,
        major: p.revisions[0]?.major ?? 1,
        minor: p.revisions[0]?.minor ?? 0,
        status_enum: p.status_enum,
      })),
    };
  }

  // 2. Fallback to furthest phase with revisions (if no phase is explicitly active)
  // This handles cases where a phase was reset to PENDING but has work history.
  // We only show the FURTHEST one in this fallback state to keep the dashboard clean.
  const historyPhases = sortedPhases.filter(p => 
    p.revisions.length > 0 && p.status_enum !== 'COMPLETED' && p.status_enum !== 'READY_FOR_NEXT'
  );
  
  if (historyPhases.length > 0) {
    const furthest = historyPhases[historyPhases.length - 1];
    return {
      type: 'IN_PROGRESS',
      phases: [{
        name: furthest.name_enum,
        major: furthest.revisions[0]?.major ?? 1,
        minor: furthest.revisions[0]?.minor ?? 0,
        status_enum: furthest.status_enum,
      }],
    };
  }

  // 3. READY FOR state (if no active and no history)
  const firstNonDoneIndex = sortedPhases.findIndex(p => 
    p.status_enum !== 'COMPLETED' && p.status_enum !== 'READY_FOR_NEXT'
  );

  if (firstNonDoneIndex !== -1) {
    const firstNonDone = sortedPhases[firstNonDoneIndex];
    if (firstNonDone.status_enum === 'PENDING') {
      return { type: 'READY_FOR', nextPhaseName: firstNonDone.name_enum };
    }
  }

  // 4. Project Done check
  const allDone = sortedPhases.every(p => 
    p.status_enum === 'COMPLETED' || p.status_enum === 'READY_FOR_NEXT'
  );
  if (allDone) {
    return { type: 'PROJECT_DONE' };
  }

  // Fallback
  return { type: 'READY_FOR', nextPhaseName: sortedPhases[0].name_enum };
}

export function formatPhaseName(name: PhaseName): string {
  return name.replace(/_/g, " ");
}
