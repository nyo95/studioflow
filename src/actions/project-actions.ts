"use server";

import { createAction } from "@/lib/action-wrapper";
import { projectService } from "@/lib/services/project-service";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_PROJECT, REVALIDATE_HOME } from "@/lib/revalidation-tags";

export const getProjects = createAction(async ({ tx }) => {
  return projectService.getAllProjects(tx);
});

export const createProject = createAction(
  async ({ input, ctx, tx }) => {
    const result = await projectService.executeCreateProject(tx, {
      ...input,
      actorId: ctx.userId,
    });
    invalidateCache({ scope: REVALIDATE_HOME });
    return result;
  }
);
