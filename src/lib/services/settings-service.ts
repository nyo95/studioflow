import type { PrismaTransaction } from "@/types/common";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit/types";
import { ScheduleSection } from "@/generated/prisma";

export const settingsService = {
  async executeUpdateUISettings(tx: PrismaTransaction, params: any) {
    const { uiSettings, userId } = params;
    const result = await tx.systemConfig.update({
      where: { id: "GLOBAL" },
      data: { ui_settings: uiSettings as any },
    });
    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_SYSTEM_CONFIG, "SYSTEM", "GLOBAL", userId, { ui_updated: true });
    return result;
  },
};
