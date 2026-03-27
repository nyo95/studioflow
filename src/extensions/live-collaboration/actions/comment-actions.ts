"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { CommentWithAuthor } from "../types/comment";
import { getPhaseHeartbeatSnapshot } from "@/lib/phase-heartbeat";

export async function getComments(phaseId: string): Promise<CommentWithAuthor[]> {
  const snapshot = await getPhaseHeartbeatSnapshot(phaseId);
  return snapshot.comments;
}

export async function createComment(phaseId: string, content: string) {
  const { userId } = await getSession();
  
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }

  const comment = await prisma.comment.create({
    data: {
      content,
      phase_id: phaseId,
      author_id: userId,
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
  });

  revalidatePath(`/projects/[id]/phases/${phaseId}`, "page");
  return comment;
}

export async function deleteComment(commentId: string, phaseId: string) {
  const { userId, role } = await getSession();

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
  });

  if (!comment) return;

  // Only author or admin can delete
  if (comment.author_id !== userId && role !== "ADMIN") {
    throw new Error("UNAUTHORIZED");
  }

  await prisma.comment.delete({
    where: { id: commentId },
  });

  revalidatePath(`/projects/[id]/phases/${phaseId}`, "page");
}
