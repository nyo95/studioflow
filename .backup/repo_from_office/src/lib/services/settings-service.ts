import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { SYSTEM_CONFIG_ID, GLOBAL_CHECKLIST_PHASE } from "@/lib/permissions";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit";
import { sanitizeUISettings } from "@/lib/ui-settings";
import type { UISettings } from "@/types/common";
import { ScheduleSection } from "@/generated/prisma";
import { ScheduleService } from "./schedule-service";

/**
 * Functional Service Layer for Settings operations.
 */
export const settingsService = {
  /**
   * Enables or disables auto project naming.
   */
  async executeSetAutoNamingEnabled(
    tx: PrismaTransaction,
    params: { isEnabled: boolean; userId: string }
  ) {
    const { isEnabled, userId } = params;

    const result = await tx.systemConfig.upsert({
      where: { id: SYSTEM_CONFIG_ID },
      update: { is_auto_naming_enabled: isEnabled },
      create: { id: SYSTEM_CONFIG_ID, is_auto_naming_enabled: isEnabled },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_SYSTEM_CONFIG, "SYSTEM", SYSTEM_CONFIG_ID, userId, {
      is_auto_naming_enabled: isEnabled
    });

    return result;
  },

  /**
   * Creates or updates a timeline template.
   */
  async executeUpsertTimelineTemplate(
    tx: PrismaTransaction,
    params: { phaseEnum: string; durationDays: number; userId: string }
  ) {
    const { phaseEnum, durationDays, userId } = params;

    const result = await tx.timelineTemplate.upsert({
      where: { phase_enum: phaseEnum },
      update: { duration_days: durationDays },
      create: { phase_enum: phaseEnum, duration_days: durationDays },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_TIMELINE_TEMPLATE, "SYSTEM", phaseEnum, userId, {
      phase_enum: phaseEnum,
      duration_days: durationDays
    });

    return result;
  },

  /**
   * Creates a checklist template.
   */
  async executeCreateChecklistTemplate(
    tx: PrismaTransaction,
    params: { phaseEnum: string | null; label: string; userId: string }
  ) {
    const { phaseEnum, label, userId } = params;

    const normalizedLabel = label.trim();
    if (!normalizedLabel) {
      throw new ActionError("INVALID_INPUT", "LABEL_REQUIRED");
    }

    const normalizedPhaseEnum =
      phaseEnum === GLOBAL_CHECKLIST_PHASE || phaseEnum == null
        ? GLOBAL_CHECKLIST_PHASE
        : phaseEnum;

    const result = await tx.checklistTemplate.create({
      data: { phase_enum: normalizedPhaseEnum, label: normalizedLabel, is_active: true },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.CREATE_CHECKLIST_TEMPLATE, "SYSTEM", result.id, userId, {
      label: normalizedLabel,
      phase_enum: normalizedPhaseEnum
    });

    return result;
  },

  /**
   * Deletes a checklist template.
   */
  async executeDeleteChecklistTemplate(tx: PrismaTransaction, params: { id: string; userId: string }) {
    const { id, userId } = params;

    const result = await tx.checklistTemplate.delete({ where: { id } });

    await insertAuditLog(tx, AUDIT_ACTIONS.DELETE_CHECKLIST_TEMPLATE, "SYSTEM", id, userId, {
      label: result.label
    });

    return result;
  },

  /**
   * Updates UI settings.
   */
  async executeUpdateUISettings(
    tx: PrismaTransaction,
    params: { uiSettings?: UISettings; appTitle?: string; userId: string }
  ) {
    const { uiSettings, appTitle, userId } = params;

    const data: {
      ui_settings?: UISettings;
      app_title?: string;
    } = {};
    const normalizedUISettings = sanitizeUISettings(uiSettings);

    if (uiSettings !== undefined) {
      data.ui_settings = normalizedUISettings;
    }
    if (appTitle !== undefined) {
      data.app_title = appTitle.trim();
    }

    const result = await tx.systemConfig.upsert({
      where: { id: SYSTEM_CONFIG_ID },
      update: data,
      create: {
        id: SYSTEM_CONFIG_ID,
        ...data,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.UPDATE_SYSTEM_CONFIG, "SYSTEM", SYSTEM_CONFIG_ID, userId, {
      ui_settings_updated: uiSettings !== undefined,
      app_title_updated: appTitle !== undefined,
      app_title: data.app_title
    });

    return result;
  },

  async executeUpsertScheduleCategoryConfig(
    tx: PrismaTransaction,
    params: { section: ScheduleSection; category: string; prefix?: string; userId: string }
  ) {
    const { section, userId } = params;
    const category = params.category.trim().toUpperCase();
    const prefix = (params.prefix?.trim() || category.substring(0, 2)).toUpperCase();

    if (!category || category.toLowerCase() === "general") {
      throw new ActionError("VALIDATION_FAILED", "CATEGORY_REQUIRED");
    }

    const existingTemplate = await tx.scheduleTemplate.findFirst({
      where: {
        section,
        category: { equals: category, mode: "insensitive" },
      },
    });

    const template =
      existingTemplate
        ? await tx.scheduleTemplate.update({
            where: { id: existingTemplate.id },
            data: { category, is_active: true },
          })
        : await tx.scheduleTemplate.create({
            data: { section, category, is_active: true },
          });

    const existingPrefix = await tx.prefixDictionary.findFirst({
      where: {
        section,
        category: { equals: category, mode: "insensitive" },
      },
    });

    const prefixConfig =
      existingPrefix
        ? await tx.prefixDictionary.update({
            where: { id: existingPrefix.id },
            data: { category, prefix, section },
          })
        : await tx.prefixDictionary.create({
            data: { category, prefix, section },
          });

    await insertAuditLog(
      tx,
      AUDIT_ACTIONS.UPSERT_SCHEDULE_CATEGORY_CONFIG,
      "SYSTEM",
      `${section}:${category}`,
      userId,
      { section, category, prefix }
    );

    // Trigger global code re-normalization for all projects using this category
    await ScheduleService.normalizeAllProjectsCodesForCategory(tx, category, section);

    return { template, prefixConfig };
  },

  async executeDeleteScheduleCategoryConfig(
    tx: PrismaTransaction,
    params: { section: ScheduleSection; category: string; userId: string }
  ) {
    const { section, userId } = params;
    const category = params.category.trim().toUpperCase();

    const template = await tx.scheduleTemplate.findFirst({
      where: {
        section,
        category: { equals: category, mode: "insensitive" },
      },
    });

    const prefix = await tx.prefixDictionary.findFirst({
      where: {
        section,
        category: { equals: category, mode: "insensitive" },
      },
    });

    if (template) {
      await tx.scheduleTemplate.delete({ where: { id: template.id } });
    }

    if (prefix) {
      await tx.prefixDictionary.delete({ where: { id: prefix.id } });
    }

    await insertAuditLog(
      tx,
      AUDIT_ACTIONS.DELETE_SCHEDULE_CATEGORY_CONFIG,
      "SYSTEM",
      `${section}:${category}`,
      userId,
      { section, category }
    );

    return { success: true };
  },

  /**
   * Fetches unique categories from both Library and existing Scheduler config
   */
  async getAvailableCategories(tx: PrismaTransaction) {
    const [catalogCats, dictionaryCats] = await Promise.all([
      tx.materialCatalog.findMany({
        select: { category: true },
        distinct: ["category"],
      }),
      tx.prefixDictionary.findMany({
        select: { category: true },
        distinct: ["category"],
      }),
    ]);

    const all = new Set([
      ...catalogCats.map((c) => c.category.toUpperCase()),
      ...dictionaryCats.map((c) => c.category.toUpperCase()),
    ]);

    return Array.from(all).sort((a, b) => a.localeCompare(b));
  },
};
