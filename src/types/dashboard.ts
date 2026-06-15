import { PhaseStatus } from "@/generated/prisma";

export interface DashboardTask {
  id: string;
  content: string;
  status: string;
  mode: string;
  projectName: string;
  phaseName: string;
  isUrgent: boolean;
}

export interface DashboardPhase {
  id: string;
  name: string;
  status: PhaseStatus;
  revisionId?: string;
  tasks: DashboardTask[];
  isProjectLevel?: boolean;
  projectId?: string;
}

export interface DashboardProject {
  id: string;
  name: string;
  isUrgent: boolean;
  phases: DashboardPhase[];
}
