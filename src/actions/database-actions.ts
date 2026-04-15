"use server";

import { createAction } from "@/lib/action-wrapper";
import { databaseService } from "@/lib/services/system/database-service";
import { assertAdmin } from "@/lib/permissions";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_SETTINGS } from "@/lib/revalidation-tags";

export const resetDatabaseAction = createAction(
  async ({ ctx, tx }) => {
    assertAdmin(ctx.role);
    const result = await databaseService.executeResetDatabase(tx, ctx.userId);
    invalidateCache({ scope: REVALIDATE_SETTINGS });
    return result;
  }
);
