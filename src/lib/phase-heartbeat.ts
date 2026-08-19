import "server-only";

import { prisma } from "@/core/platform/db";
import { ACTIVITY_FETCH_LIMIT, MILLISECONDS_PER_DAY } from "@/lib/constants";
import {
  CHECKLIST_TASK_ORDER_BY,
  CHECKLIST_TASK_SELECT,
  toChecklistTask,
} from "@/lib/services/checklist-task";
import type { PhaseHeartbeatSnapshot } from "@/types/common";

export type {
  PhaseHeartbeatActivity as Activity,
  PhaseHeartbeatChecklistItem,
  PhaseHeartbeatSnapshot,
} from "@/types/common";

export async function getPhaseHeartbeatSnapshot(
  phaseId: string
): Promise<PhaseHeartbeatSnapshot> {
  try {
    const [checklistRows, activeRevision] = await Promise.all([
      // Ordering and shape come from checklist-task.ts so that this and the
      // project overview cannot drift apart again. This query used to say
      // `orderBy: { id: "asc" }` over a UUID, which produced no order at all.
      prisma.projectChecklist.findMany({
        where: { phase_id: phaseId },
        select: CHECKLIST_TASK_SELECT,
        orderBy: CHECKLIST_TASK_ORDER_BY,
      }),
      prisma.revision.findFirst({
        where: { phase_id: phaseId, status_enum: "ACTIVE" },
        include: {
          activities: {
            select: {
              id: true,
              content: true,
              mode: true,
              status: true,
              phase_id: true,
              deferred_from_version: true
            },
            orderBy: { id: "asc" },
            take: ACTIVITY_FETCH_LIMIT,
          },
        },
        orderBy: [{ major: "desc" }, { minor: "desc" }],
      }),
    ]);

    return {
      checklistItems: checklistRows.map(toChecklistTask),
      activities: activeRevision?.activities ?? [],
    };
  } catch (error) {
    console.error(`[HEARTBEAT_FAILURE] for phase ${phaseId}:`, error);
    throw error; // Re-throw to inform the API route
  }
}
