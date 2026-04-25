import "server-only";

import { prisma } from "@/core/platform/db";
import { ACTIVITY_FETCH_LIMIT, MILLISECONDS_PER_DAY } from "@/lib/constants";
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
    const [checklistItems, activeRevision] = await Promise.all([
      prisma.projectChecklist.findMany({
        where: { phase_id: phaseId },
        select: {
          id: true,
          label: true,
          is_checked: true,
          phase_id: true,
        },
        orderBy: { id: "asc" },
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
      checklistItems,
      activities: activeRevision?.activities ?? [],
    };
  } catch (error) {
    console.error(`[HEARTBEAT_FAILURE] for phase ${phaseId}:`, error);
    throw error; // Re-throw to inform the API route
  }
}
