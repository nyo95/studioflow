"use server";

import { createAction } from "@/lib/action-wrapper";
import { clientService } from "@/lib/services/client-service";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_SETTINGS } from "@/lib/revalidation-tags";
import { assertAdmin } from "@/lib/permissions";

export const getClients = createAction(async ({ tx }) => {
  return clientService.getAllClients(tx);
});

export const createClient = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);
    const params = input as { name: string; address?: string };
    const result = await clientService.executeCreateClient(tx, {
      ...params,
      actorId: ctx.userId,
    });
    invalidateCache({ scope: REVALIDATE_SETTINGS });
    return result;
  }
);
