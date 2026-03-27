import "server-only";

import { prisma } from "@/lib/db";
import { CommentWithAuthor } from "@/extensions/live-collaboration/types/comment";

export interface PhaseHeartbeatChecklistItem {
  id: string;
  label: string;
  is_checked: boolean;
  phase_id: string | null;
}

export interface Activity {
  id: string;
  content: string;
  mode: string;
  status: string;
}

export interface PhaseHeartbeatSnapshot {
  comments: CommentWithAuthor[];
  checklistItems: PhaseHeartbeatChecklistItem[];
  activities: Activity[];
}

export async function getPhaseHeartbeatSnapshot(
  phaseId: string
): Promise<PhaseHeartbeatSnapshot> {
  const commentsSince = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [comments, checklistItems, activeRevision] = await Promise.all([
    prisma.comment.findMany({
      where: {
        phase_id: phaseId,
        created_at: {
          gte: commentsSince,
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: "asc" },
    }),
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
          orderBy: { id: "asc" },
        },
      },
      orderBy: [{ major: "desc" }, { minor: "desc" }],
    }),
  ]);

  return {
    comments,
    checklistItems,
    activities: activeRevision?.activities ?? [],
  };
}
