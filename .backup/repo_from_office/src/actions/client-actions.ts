"use server";

import { createAction } from "@/lib/action-wrapper";
import { assertAdmin } from "@/lib/permissions";
import { clientService } from "@/lib/services/client-service";
import { invalidateCache } from "@/lib/revalidation";
import {
  REVALIDATE_HOME_LAYOUT,
  REVALIDATE_PROJECT,
  REVALIDATE_SETTINGS,
  REVALIDATE_TODAY,
} from "@/lib/revalidation-tags";

export const deleteClient = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { clientId: string };

    const result = await clientService.executeDeleteClient(tx, {
      clientId: params.clientId,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME_LAYOUT });
    invalidateCache({ scope: REVALIDATE_SETTINGS });

    return result;
  }
);

export const mergeClients = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { sourceClientId: string; targetClientId: string };

    const result = await clientService.executeMergeClients(tx, {
      sourceClientId: params.sourceClientId,
      targetClientId: params.targetClientId,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME_LAYOUT });
    invalidateCache({ scope: REVALIDATE_SETTINGS });
    invalidateCache({ scope: REVALIDATE_TODAY });

    for (const projectId of result.movedProjectIds) {
      invalidateCache({ scope: REVALIDATE_PROJECT, id: projectId });
    }

    return result;
  }
);

export const updateClientBranding = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { clientId: string; address?: string; logo_url?: string };

    const result = await clientService.executeUpdateClientBranding(tx, {
      clientId: params.clientId,
      address: params.address,
      logo_url: params.logo_url,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME_LAYOUT });
    invalidateCache({ scope: REVALIDATE_SETTINGS });

    return result;
  }
);
