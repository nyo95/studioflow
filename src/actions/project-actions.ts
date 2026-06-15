"use server";

import { createAction } from "@/lib/action-wrapper";
import { projectService } from "@/lib/services/project-service";
import { assertAdmin, getProjectMetadataAccessOrThrow, getProjectSyncChecklistAccessOrThrow, getProjectMembershipOrThrow } from "@/core/rbac/permissions";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_ACTIVITY, REVALIDATE_HOME, REVALIDATE_PROJECT, REVALIDATE_PROJECTS, REVALIDATE_TODAY } from "@/lib/revalidation-tags";
import { 
  BootstrapProjectSchema, 
  UpdateProjectMetadataSchema, 
  UpdateProjectPrioritySchema, 
  ProjectIdSchema,
  AddProjectActivitySchema
} from "@/lib/validations";

export const bootstrapProject = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await projectService.executeBootstrapProject(tx, {
      ...input,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME });
    invalidateCache({ scope: REVALIDATE_PROJECTS });
    invalidateCache({ scope: REVALIDATE_PROJECT, id: result.id });

    return result;
  },
  { schema: BootstrapProjectSchema }
);

export const updateProjectMetadata = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMetadataAccessOrThrow(tx, input.projectId, ctx.userId, ctx.role);

    const result = await projectService.executeUpdateProjectMetadata(tx, {
      ...input,
      userId: ctx.userId,
      userRole: ctx.role,
    });

    invalidateCache({ scope: REVALIDATE_HOME });
    invalidateCache({ scope: REVALIDATE_PROJECTS });
    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    invalidateCache({ scope: REVALIDATE_ACTIVITY });

    return result;
  },
  { schema: UpdateProjectMetadataSchema }
);

export const updateProjectPriority = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await projectService.executeUpdateProjectPriority(tx, {
      projectId: input.projectId,
      priority: input.priority,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME });
    invalidateCache({ scope: REVALIDATE_PROJECTS });

    return result;
  },
  { schema: UpdateProjectPrioritySchema }
);

export const syncProjectChecklists = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectSyncChecklistAccessOrThrow(tx, input.projectId, ctx.userId, ctx.role);

    const result = await projectService.executeSyncProjectChecklists(tx, {
      projectId: input.projectId,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });

    return result;
  },
  { schema: ProjectIdSchema }
);

export const deleteProject = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await projectService.executeDeleteProject(tx, {
      projectId: input.projectId,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME });
    invalidateCache({ scope: REVALIDATE_PROJECTS });

    return result;
  },
  { schema: ProjectIdSchema }
);

export const completeProject = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await projectService.executeCompleteProject(tx, {
      projectId: input.projectId,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME });
    invalidateCache({ scope: REVALIDATE_PROJECTS });
    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });

    return result;
  },
  { schema: ProjectIdSchema }
);

export const addProjectActivity = createAction(
  async ({ input, ctx, tx }) => {
    await getProjectMembershipOrThrow(tx, input.projectId, ctx.userId, ctx.role);

    const result = await projectService.executeAddProjectActivity(tx, {
      projectId: input.projectId,
      content: input.content,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_PROJECT, id: input.projectId });
    invalidateCache({ scope: REVALIDATE_TODAY });

    return result;
  },
  { schema: AddProjectActivitySchema }
);
