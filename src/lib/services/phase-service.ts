import { ActivityStatus, PhaseStatus, RevisionStatus, ProjectStatus } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { insertAuditLog, getActiveRevision } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit";

export const phaseService = {
  async executeActivatePhase(tx: PrismaTransaction, params: { phaseId: string; userId: string }) {
    const { phaseId, userId } = params;
    const phase = await tx.phase.update({
      where: { id: phaseId },
      data: { status_enum: PhaseStatus.IN_PROGRESS, is_locked: false },
    });
    const revision = await tx.revision.create({
      data: { phase_id: phaseId, major: 1, minor: 0, status_enum: RevisionStatus.ACTIVE },
    });
    await insertAuditLog(tx, AUDIT_ACTIONS.ACTIVATE_PHASE, "PHASE", phaseId, userId, { phase_id: phaseId });
    return { phase, revision };
  },
  // ... other phase methods ...
};
