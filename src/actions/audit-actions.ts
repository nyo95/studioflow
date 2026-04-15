"use server";

import { createAction } from "@/lib/action-wrapper";
import { throwActionError } from "@/lib/error-types";
import { insertAuditLog } from "./_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit/types";

export const getAuditLogsByProject = createAction(async ({ input, tx }) => {
  const { projectId } = input as { projectId: string };
  return tx.auditLog.findMany({
    where: { project_id: projectId },
    include: { user: { select: { name: true } } },
    orderBy: { created_at: "desc" },
  });
});

export const revertAuditLog = createAction(async ({ input, ctx, tx }) => {
  const { auditLogId } = input as { auditLogId: string };
  // Implementation of undo-executor logic here if needed via service
  throwActionError("NOT_IMPLEMENTED");
});
