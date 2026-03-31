"use server";

import { revalidatePath } from "next/cache";
import { createAction } from "@/lib/action-wrapper";
import { projectService } from "@/lib/services/project-service";
import { canEditProjectMetadata, assertAdmin } from "@/lib/permissions";
import { ProjectPriority } from "@/generated/prisma";

export const bootstrapProject = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as {
      name: string;
      pic_designer_id: string;
      pic_drafter_id: string;
      opening_date?: Date;
      project_type?: string;
      client_name?: string;
      client_contact?: string;
      address?: string;
      area?: number;
    };

    const result = await projectService.executeBootstrapProject(tx, {
      ...params,
      userId: ctx.userId,
    });

    revalidatePath("/");
    revalidatePath(`/projects/${result.id}`);

    return result;
  }
);

export const updateProjectMetadata = createAction(
  async ({ input, ctx, tx }) => {
    const params = input as {
      projectId: string;
      name?: string;
      client_name?: string;
      clientId?: string | null;
      area?: number;
      opening_date?: Date;
      pic_designer_id?: string;
      pic_drafter_id?: string;
    };

    if (!canEditProjectMetadata(ctx.role, ctx.userId, "")) {
      throw new Error("UNAUTHORIZED_ACTION");
    }

    const result = await projectService.executeUpdateProjectMetadata(tx, {
      ...params,
      userId: ctx.userId,
      userRole: ctx.role,
    });

    revalidatePath("/");
    revalidatePath(`/projects/${params.projectId}`);

    return result;
  }
);

export const updateProjectPriority = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { projectId: string; priority: ProjectPriority };

    const result = await projectService.executeUpdateProjectPriority(tx, {
      projectId: params.projectId,
      priority: params.priority,
      userId: ctx.userId,
    });

    revalidatePath("/");

    return result;
  }
);

export const syncProjectChecklists = createAction(
  async ({ input, ctx, tx }) => {
    const params = input as { projectId: string };

    const result = await projectService.executeSyncProjectChecklists(tx, {
      projectId: params.projectId,
      userId: ctx.userId,
    });

    revalidatePath(`/projects/${params.projectId}`);

    return result;
  }
);

export const deleteProject = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { projectId: string };

    const result = await projectService.executeDeleteProject(tx, {
      projectId: params.projectId,
      userId: ctx.userId,
    });

    revalidatePath("/");

    return result;
  }
);
