"use server";

import { createAction } from "@/lib/action-wrapper";
import { auditService } from "@/core/platform/audit";
import { assertAdmin, throwActionError } from "@/core/rbac/permissions";
import { Role } from "@/generated/prisma";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_ACTIVITY, REVALIDATE_HOME, REVALIDATE_TODAY } from "@/lib/revalidation-tags";

export const undoAction = createAction(
  async ({ input, ctx, tx }) => {
    if (ctx.role !== Role.ADMIN && ctx.role !== Role.DIC) {
      throwActionError("UNAUTHORIZED_ACTION");
    }

    const { logId } = input as { logId: string };

    const result = await auditService.executeUndoPhaseTrigger(tx, {
      logId,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME });
    invalidateCache({ scope: REVALIDATE_TODAY });
    invalidateCache({ scope: REVALIDATE_ACTIVITY });

    return result;
  }
);
