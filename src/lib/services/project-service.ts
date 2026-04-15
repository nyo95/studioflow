import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { isGlobalChecklistTemplate } from "@/lib/permissions";
import { insertAuditLog, getSystemConfigTx, upsertClientByName } from "@/actions/_shared";
import { calculateBackwardTimeline } from "@/lib/date-utils";
import { PhaseName, ProjectPriority, ProjectStatus, TimelineStatus, PhaseStatus } from "@/generated/prisma";
import { AUDIT_ACTIONS } from "@/lib/services/audit";

export const projectService = {
  async executeBootstrapProject(tx: PrismaTransaction, params: any) {
    const { name, pic_designer_id, pic_drafter_id, opening_date, project_type, client_name, userId } = params;
    const client = await upsertClientByName(tx, client_name);
    const project = await tx.project.create({
      data: {
        name,
        pic_designer_id,
        pic_drafter_id,
        clientId: client?.id,
        opening_date,
        project_type: project_type || "RETAIL",
        status_progress: ProjectStatus.ACTIVE,
      },
    });
    // ... logic to create phases and timelines ...
    await insertAuditLog(tx, AUDIT_ACTIONS.BOOTSTRAP_PROJECT, "Project", project.id, userId, { name });
    return project;
  },
  // ... other project methods ...
};
