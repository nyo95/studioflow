import "server-only";

import { prisma } from "@/lib/db";
import { MILLISECONDS_PER_DAY } from "@/lib/constants";
import type { ProjectDiscussionSnapshot } from "@/types/common";

import { TempFileService } from "./services/temp-file-service";

export async function getProjectDiscussionSnapshot(
  projectId: string
): Promise<ProjectDiscussionSnapshot> {
  const commentsSince = new Date(Date.now() - MILLISECONDS_PER_DAY);

  // Lazy cleanup before fetching
  try {
    await TempFileService.cleanupExpiredFiles(projectId);
  } catch (error) {
    console.error(`[TEMP_CLEANUP_LAZY_FAILURE] for project ${projectId}:`, error);
  }

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
        temp_attachments: true,
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
