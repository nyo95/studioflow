import { ActionError } from "@/lib/error-types";
import { ProjectScheduleEntry, ProjectScheduleOption, ScheduleSection } from "@/generated/prisma";

interface ScheduleEntryWithOptions extends ProjectScheduleEntry {
  options: ProjectScheduleOption[];
}

interface ProjectMetadata {
  projectName?: string;
  client?: string;
  contact?: string;
  address?: string;
}

export function exportScheduleToCsv(
  entries: ScheduleEntryWithOptions[],
  section: ScheduleSection,
  metadata?: ProjectMetadata
): string {
  void entries;
  void section;
  void metadata;
  throw new ActionError(
    "Schedule CSV export is temporarily disabled while core extensions are stabilized.",
    "FEATURE_DISABLED"
  );
}
