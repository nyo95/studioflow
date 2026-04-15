"use server";

import { createAction } from "@/lib/action-wrapper";
import { settingsService } from "@/lib/services/settings-service";
import { assertAdmin } from "@/lib/permissions";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_SETTINGS, REVALIDATE_HOME } from "@/lib/revalidation-tags";
import { ScheduleSection } from "@/generated/prisma";

export const getSystemConfigAction = createAction(async ({ tx }) => {
  return settingsService.getSystemConfig(tx);
});

export const updateSystemConfig = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);
    const params = input as { appTitle: string };
    const result = await settingsService.executeUpdateSystemConfig(tx, {
      appTitle: params.appTitle,
      userId: ctx.userId,
    });
    invalidateCache({ scope: REVALIDATE_HOME });
    invalidateCache({ scope: REVALIDATE_SETTINGS });
    return result;
  }
);
