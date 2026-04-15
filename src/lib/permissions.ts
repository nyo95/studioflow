import { Role } from "@/generated/prisma";
import { ActionError } from "./error-types";
import { db } from "./db";

export type TxClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

export const SYSTEM_CONFIG_ID = "default";

export async function getProjectMembershipOrThrow(
  tx: TxClient,
  projectId: string,
  userId: string,
  role: Role
) {
  if (role === "ADMIN") return true;

  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { pic_designer_id: true, pic_drafter_id: true },
  });

  if (!project) {
    throw new ActionError("Project not found", "NOT_FOUND");
  }

  if (project.pic_designer_id !== userId && project.pic_drafter_id !== userId) {
    throw new ActionError("Unauthorized Project Access", "UNAUTHORIZED");
  }

  return true;
}

export function assertAdmin(role: Role) {
  if (role !== "ADMIN") {
    throw new ActionError("Unauthorized: Admin Access Required", "UNAUTHORIZED");
  }
}

export function assertSelfOrAdmin(actorId: string, targetId: string, role: Role) {
  if (role !== "ADMIN" && actorId !== targetId) {
    throw new ActionError("Unauthorized User Action", "UNAUTHORIZED");
  }
}
