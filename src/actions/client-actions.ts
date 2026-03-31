"use server";

import { revalidatePath } from "next/cache";
import { createAction } from "@/lib/action-wrapper";
import { clientService } from "@/lib/services/client-service";

export const deleteClient = createAction(
  async ({ input, ctx, tx }) => {
    const params = input as { clientId: string };

    const result = await clientService.executeDeleteClient(tx, {
      clientId: params.clientId,
      userId: ctx.userId,
    });

    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/settings/clients");

    return result;
  }
);

export const mergeClients = createAction(
  async ({ input, ctx, tx }) => {
    const params = input as { sourceClientId: string; targetClientId: string };

    const result = await clientService.executeMergeClients(tx, {
      sourceClientId: params.sourceClientId,
      targetClientId: params.targetClientId,
      userId: ctx.userId,
    });

    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/settings/clients");
    revalidatePath("/today");

    for (const projectId of result.movedProjectIds) {
      revalidatePath(`/projects/${projectId}`);
    }

    return result;
  }
);

export const updateClientBranding = createAction(
  async ({ input, ctx, tx }) => {
    const params = input as { clientId: string; address?: string; logo_url?: string };

    const result = await clientService.executeUpdateClientBranding(tx, {
      clientId: params.clientId,
      address: params.address,
      logo_url: params.logo_url,
      userId: ctx.userId,
    });

    revalidatePath("/", "layout");
    revalidatePath("/settings");
    revalidatePath("/settings/clients");

    return result;
  }
);
