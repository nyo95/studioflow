import "server-only";

import { prisma } from "@/lib/db";
import { MILLISECONDS_PER_DAY } from "@/lib/constants";
import type { ProjectDiscussionSnapshot } from "@/types/common";

export async function getProjectDiscussionSnapshot(
  projectId: string
): Promise<ProjectDiscussionSnapshot> {
  const commentsSince = new Date(Date.now() - MILLISECONDS_PER_DAY);

  try {
    const comments = await prisma.comment.findMany({
      where: {
        project_id: projectId,
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
    });

    return {
      comments,
    };
  } catch (error) {
    console.error(`[PROJECT_DISCUSSION_FAILURE] for project ${projectId}:`, error);
    throw error;
  }
}
