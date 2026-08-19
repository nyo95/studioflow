import { Prisma, ProductType } from "@/generated/prisma";
import { ScheduleService } from "@/extensions/schedule/services/schedule-service";
import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { SYSTEM_CONFIG_ID, GLOBAL_CHECKLIST_PHASE } from "@/core/rbac/permissions";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit";
import { sanitizeUISettings } from "@/lib/ui-settings";
import type { UISettings } from "@/types/common";

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
      update: data as Prisma.SystemConfigUpdateInput,
      create: {
        id: SYSTEM_CONFIG_ID,
        ...(data as Prisma.SystemConfigCreateInput),
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
    params: { section: ProductType; category: string; prefix?: string; userId: string }
  ) {
    const { section, userId } = params;
    const category = params.category.trim().toUpperCase();
    const prefix = (params.prefix?.trim() || category.substring(0, 2)).toUpperCase();

    if (!category || category.toLowerCase() === "general") {
      throw new ActionError("VALIDATION_FAILED", "CATEGORY_REQUIRED");
    }

    const template = await tx.scheduleTemplate.upsert({
      where: {
        section_schedule_category: { section, schedule_category: category },
      },
      update: { is_active: true },
      create: { section, schedule_category: category, is_active: true },
    });

    const prefixConfig = await tx.prefixDictionary.upsert({
      where: {
        section_schedule_category: { section, schedule_category: category },
      },
      update: { prefix },
      create: { schedule_category: category, prefix, section },
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
    params: { section: ProductType; category: string; userId: string }
  ) {
    const { section, userId } = params;
    const category = params.category.trim().toUpperCase();

    const template = await tx.scheduleTemplate.findFirst({
      where: {
        section,
        schedule_category: { equals: category, mode: "insensitive" },
      },
    });

    const prefix = await tx.prefixDictionary.findFirst({
      where: {
        section,
        schedule_category: { equals: category, mode: "insensitive" },
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
   * Toggles whether a global schedule category is one of the defaults that
   * gets auto-materialized (as an empty "reserve" entry) on every project.
   * See PLAN-AUDIT-ROADMAP-2026Q3.md §2.1 (R1).
   */
  async executeSetScheduleTemplateDefaultEntry(
    tx: PrismaTransaction,
    params: { section: ProductType; category: string; isDefaultEntry: boolean; userId: string }
  ) {
    const { section, isDefaultEntry, userId } = params;
    const category = params.category.trim().toUpperCase();

    const template = await tx.scheduleTemplate.findFirst({
      where: { section, schedule_category: { equals: category, mode: "insensitive" } },
    });

    if (!template) {
      throw new ActionError("NOT_FOUND", `Category "${category}" not found in Global Config.`);
    }

    const result = await tx.scheduleTemplate.update({
      where: { id: template.id },
      data: { is_default_entry: isDefaultEntry },
    });

    await insertAuditLog(
      tx,
      AUDIT_ACTIONS.SET_SCHEDULE_TEMPLATE_DEFAULT_ENTRY,
      "SYSTEM",
      `${section}:${category}`,
      userId,
      { section, category, is_default_entry: isDefaultEntry }
    );

    return result;
  },

  /**
   * Fetches unique categories from both Library and existing Scheduler config.
   *
   * MASTER DATA v2 (2026-08-10): Sku no longer carries a `catalog_tags`
   * string array — product categorization now lives in the standalone
   * `master_data.Category` table (kind PRODUCT), joined via SkuCategory. Read
   * category names from there instead.
   */
  async getAvailableCategories(tx: PrismaTransaction) {
    const [catalogCats, dictionaryCats] = await Promise.all([
      tx.category.findMany({
        where: { kind: "PRODUCT" },
        select: { name: true },
      }),
      tx.prefixDictionary.findMany({
        select: { schedule_category: true },
        distinct: ["schedule_category"],
      }),
    ]);

    const all = new Set([
      ...catalogCats.map((c) => c.name.toUpperCase()),
      ...dictionaryCats.map((c) => c.schedule_category.toUpperCase()),
    ]);

    return Array.from(all).sort((a, b) => a.localeCompare(b));
  },

  async executeMergeGlobalCategories(
    tx: PrismaTransaction,
    params: { section: ProductType; sourceCategory: string; targetCategory: string; userId: string }
  ) {
    const { section, userId } = params;
    const src = params.sourceCategory.trim().toUpperCase();
    const dst = params.targetCategory.trim().toUpperCase();

    if (src === dst) throw new ActionError("VALIDATION_FAILED", "CATEGORIES_MUST_BE_DIFFERENT");

    // 1. Ensure target category exists in global config
    const targetPrefix = await tx.prefixDictionary.findFirst({
      where: { section, schedule_category: { equals: dst, mode: "insensitive" } }
    });
    if (!targetPrefix) {
      throw new ActionError("NOT_FOUND", `Target category "${dst}" not found in Global Config.`);
    }

    // 2. Update all ProjectScheduleEntry globally
    const entriesUpdated = await tx.projectScheduleEntry.updateMany({
      where: { section, schedule_category: src },
      data: { 
        schedule_category: dst,
        prefix_id: targetPrefix.id,
        schedule_prefix: targetPrefix.prefix
      }
    });

    // 3. [REMOVED — owner decision Q14, 2026-08-10] This used to also rename
    // the source category tag on every matching master_data.Sku (via
    // catalog_tags). Master Data v2 severs that link: schedule categories and
    // product categories are no longer the same concept, so renaming a
    // schedule category here must NOT reach into master_data anymore. This
    // step now only ever touches StudioFlow's own
    // ScheduleTemplate/PrefixDictionary/ProjectScheduleEntry rows (steps 2,
    // 4, 5, 6 below).
    const libraryUpdated = { count: 0 };

    // 4. Update PrefixDictionary (if exists) - we delete the source one
    await tx.prefixDictionary.deleteMany({
      where: { section, schedule_category: src }
    });

    // 5. Update ScheduleTemplate (if exists) - we delete the source one
    await tx.scheduleTemplate.deleteMany({
      where: { section, schedule_category: src }
    });

    // 6. Normalize all projects that were affected
    await ScheduleService.normalizeAllProjectsCodesForCategory(tx, dst, section, userId);

    await insertAuditLog(tx, AUDIT_ACTIONS.SCHEDULE_MERGE_CATEGORIES, "SYSTEM", `${section}:${src}->${dst}`, userId, {
      section,
      source: src,
      target: dst,
      entries_affected: entriesUpdated.count,
      library_affected: libraryUpdated.count
    });

    return { entries_moved: entriesUpdated.count, library_moved: libraryUpdated.count };
  },
};
