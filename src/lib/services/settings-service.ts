/* eslint-disable @typescript-eslint/no-explicit-any */

import { prisma } from "@/lib/db";
import { PrismaTransaction } from "@/lib/action-wrapper";
import { ActionError } from "@/lib/result";
import { SYSTEM_CONFIG_ID, GLOBAL_CHECKLIST_PHASE } from "@/lib/permissions";

/**
 * Functional Service Layer for Settings operations.
 */
export const settingsService = {
  /**
   * Enables or disables auto project naming.
   */
  async executeSetAutoNamingEnabled(
    _tx: PrismaTransaction,
    params: { isEnabled: boolean }
  ) {
    const { isEnabled } = params;

    await prisma.$executeRaw`
      INSERT INTO "SystemConfig" ("id", "is_auto_naming_enabled")
      VALUES (${SYSTEM_CONFIG_ID}, ${isEnabled})
      ON CONFLICT ("id")
      DO UPDATE SET "is_auto_naming_enabled" = EXCLUDED."is_auto_naming_enabled"
    `;

    return { id: SYSTEM_CONFIG_ID, is_auto_naming_enabled: isEnabled };
  },

  /**
   * Creates or updates a timeline template.
   */
  async executeUpsertTimelineTemplate(
    _tx: PrismaTransaction,
    params: { phaseEnum: string; durationDays: number }
  ) {
    const { phaseEnum, durationDays } = params;

    return prisma.timelineTemplate.upsert({
      where: { phase_enum: phaseEnum },
      update: { duration_days: durationDays },
      create: { phase_enum: phaseEnum, duration_days: durationDays },
    });
  },

  /**
   * Creates a checklist template.
   */
  async executeCreateChecklistTemplate(
    _tx: PrismaTransaction,
    params: { phaseEnum: string | null; label: string }
  ) {
    const { phaseEnum, label } = params;

    const normalizedLabel = label.trim();
    if (!normalizedLabel) {
      throw new ActionError("INVALID_INPUT", "LABEL_REQUIRED");
    }

    const normalizedPhaseEnum =
      phaseEnum === GLOBAL_CHECKLIST_PHASE || phaseEnum == null
        ? GLOBAL_CHECKLIST_PHASE
        : phaseEnum;

    return prisma.checklistTemplate.create({
      data: { phase_enum: normalizedPhaseEnum, label: normalizedLabel, is_active: true },
    });
  },

  /**
   * Deletes a checklist template.
   */
  async executeDeleteChecklistTemplate(_tx: PrismaTransaction, params: { id: string }) {
    const { id } = params;

    return prisma.checklistTemplate.delete({ where: { id } });
  },

  /**
   * Updates UI settings.
   */
  async executeUpdateUISettings(
    _tx: PrismaTransaction,
    params: { uiSettings?: any; appTitle?: string }
  ) {
    const { uiSettings, appTitle } = params;

    const data: any = {};
    if (uiSettings !== undefined) {
      data.ui_settings = uiSettings;
    }
    if (appTitle !== undefined) {
      data.app_title = appTitle;
    }

    return prisma.systemConfig.upsert({
      where: { id: SYSTEM_CONFIG_ID },
      update: data,
      create: {
        id: SYSTEM_CONFIG_ID,
        ...data,
      },
    });
  },
};
