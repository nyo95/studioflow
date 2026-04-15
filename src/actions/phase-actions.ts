"use server";

import { createAction } from "@/lib/action-wrapper";
import { phaseService } from "@/lib/services/phase-service";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_PROJECT } from "@/lib/revalidation-tags";

export const getProjectPhases = createAction(async ({ input, tx }) => {
  const { projectId } = input as { projectId: string };
  return phaseService.getPhasesByProject(tx, projectId);
});

export const updatePhaseStatus = createAction(
  async ({ input, ctx, tx }) => {
    const params = input as { phaseId: string; status: any; projectId: string };
    const result = await phaseService.executeUpdatePhaseStatus(tx, {
      ...params,
      actorId: ctx.userId,
    });
    invalidateCache({ scope: REVALIDATE_PROJECT, id: params.projectId });
    return result;
  }
);
