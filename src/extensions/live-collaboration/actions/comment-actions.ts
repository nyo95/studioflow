"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CommentWithAuthor } from "../types/comment";
import { getProjectDiscussionSnapshot } from "@/lib/project-discussion";
import { throwActionError } from "@/lib/error-types";
import { getProjectMembershipOrThrow } from "@/lib/permissions";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_CUSTOM } from "@/lib/revalidation-tags";

export async function getComments(projectId: string): Promise<CommentWithAuthor[]> {
  const { userId, role } = await getSession();

  if (!userId) {
    throwActionError("UNAUTHORIZED");
  }

  await getProjectMembershipOrThrow(
    prisma as never,
    projectId,
    userId,
    role
  );

  const snapshot = await getProjectDiscussionSnapshot(projectId);
  return snapshot.comments;
}

export async function createComment(projectId: string, content: string, attachmentIds?: string[]) {
  const { userId, role } = await getSession();

  if (!userId) {
    throwActionError("UNAUTHORIZED");
  }

  await getProjectMembershipOrThrow(
    prisma as never,
    projectId,
    userId,
    role
  );

  const normalizedContent = content?.trim();
  // Allow empty content if there are attachments
  if (!normalizedContent && (!attachmentIds || attachmentIds.length === 0)) {
    throwActionError("Comment cannot be empty", "EMPTY_COMMENT");
  }
  if (normalizedContent && normalizedContent.length > 5000) {
    throwActionError("Comment too long (max 5000 chars)", "COMMENT_TOO_LONG");
  }

  const comment = await prisma.comment.create({
    data: {
      content: normalizedContent || "",
      project_id: projectId,
      author_id: userId,
      temp_attachments: attachmentIds ? {
        connect: attachmentIds.map(id => ({ id }))
      } : undefined,
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
  });

  invalidateCache({
    scope: REVALIDATE_CUSTOM,
    path: `/projects/${projectId}`,
  });
  return comment;
}

export async function deleteComment(commentId: string, projectId: string) {
  const { userId, role } = await getSession();

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment) return;

  // Only author or admin can delete
  if (comment.author_id !== userId && role !== "ADMIN") {
    throwActionError("UNAUTHORIZED");
  }

  await prisma.comment.delete({
    where: { id: commentId },
  });

  invalidateCache({
    scope: REVALIDATE_CUSTOM,
    path: `/projects/${projectId}`,
  });
}
