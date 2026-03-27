import { PhaseName } from "@/generated/prisma";

export type ProgressState = 
  | { type: 'IN_PROGRESS'; phases: { name: PhaseName; major: number; minor: number }[] }
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
  
  // 1. Check for IN_PROGRESS phases
  const inProgress = sortedPhases.filter(p => p.status_enum === 'IN_PROGRESS');
  if (inProgress.length > 0) {
    return {
      type: 'IN_PROGRESS',
      phases: inProgress.map(p => ({
        name: p.name_enum,
        major: p.revisions[0]?.major ?? 1,
        minor: p.revisions[0]?.minor ?? 0,
      })),
    };
  }

  // 2. Check for READY FOR state
  // Find the first phase that is not COMPLETED/READY_FOR_NEXT
  // If a phase is COMPLETED or READY_FOR_NEXT, we look at the one after it
  const firstNonDoneIndex = sortedPhases.findIndex(p => 
    p.status_enum !== 'COMPLETED' && p.status_enum !== 'READY_FOR_NEXT'
  );

  if (firstNonDoneIndex !== -1) {
    const firstNonDone = sortedPhases[firstNonDoneIndex];
    if (firstNonDone.status_enum === 'PENDING') {
      return { type: 'READY_FOR', nextPhaseName: firstNonDone.name_enum };
    }
  }

  // 3. Project Done check
  const allDone = sortedPhases.every(p => 
    p.status_enum === 'COMPLETED' || p.status_enum === 'READY_FOR_NEXT'
  );
  if (allDone) {
    return { type: 'PROJECT_DONE' };
  }

  // Fallback (e.g. if something weird happened with statuses)
  return { type: 'READY_FOR', nextPhaseName: sortedPhases[0].name_enum };
}

export function formatPhaseName(name: PhaseName): string {
  return name.replace(/_/g, " ");
}
