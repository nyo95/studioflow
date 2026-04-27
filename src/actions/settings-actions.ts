"use server";

import { createAction } from "@/lib/action-wrapper";
import { settingsService } from "@/lib/services/settings-service";
import { assertAdmin } from "@/core/rbac/permissions";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_HOME, REVALIDATE_SETTINGS } from "@/lib/revalidation-tags";
import { ProductType } from "@/generated/prisma";
import { 
  UpdateUISettingsSchema, 
  UpsertScheduleCategorySchema,
  SetAutoNamingSchema,
  UpsertTimelineTemplateSchema,
  CreateChecklistTemplateSchema,
  DeleteByIdSchema,
  DeleteScheduleCategorySchema,
  MergeGlobalCategoriesSchema
} from "@/lib/validations";

export const mergeGlobalCategoriesAction = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await settingsService.executeMergeGlobalCategories(tx, {
      section: input.section,
      sourceCategory: input.sourceCategory,
      targetCategory: input.targetCategory,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    invalidateCache({ scope: REVALIDATE_HOME });

    return result;
  },
  { schema: MergeGlobalCategoriesSchema }
);

export const setAutoNamingEnabled = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await settingsService.executeSetAutoNamingEnabled(tx, {
      isEnabled: input.isEnabled,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME });
    invalidateCache({ scope: REVALIDATE_SETTINGS });

    return result;
  },
  { schema: SetAutoNamingSchema }
);

export const upsertTimelineTemplate = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    return settingsService.executeUpsertTimelineTemplate(tx, {
      phaseEnum: input.phaseEnum,
      durationDays: input.durationDays,
      userId: ctx.userId,
    });
  },
  { schema: UpsertTimelineTemplateSchema }
);

export const createChecklistTemplate = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    return settingsService.executeCreateChecklistTemplate(tx, {
      phaseEnum: input.phaseEnum,
      label: input.label,
      userId: ctx.userId,
    });
  },
  { schema: CreateChecklistTemplateSchema }
);

export const deleteChecklistTemplate = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    return settingsService.executeDeleteChecklistTemplate(tx, {
      id: input.id,
      userId: ctx.userId,
    });
  },
  { schema: DeleteByIdSchema }
);

export const updateUISettings = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await settingsService.executeUpdateUISettings(tx, {
      uiSettings: input.uiSettings,
      appTitle: input.appTitle,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME });
    invalidateCache({ scope: REVALIDATE_SETTINGS });

    return result;
  },
  { schema: UpdateUISettingsSchema }
);

export const upsertScheduleCategoryConfig = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await settingsService.executeUpsertScheduleCategoryConfig(tx, {
      section: input.section,
      category: input.schedule_category,
      prefix: input.prefix,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    invalidateCache({ scope: REVALIDATE_HOME });

    return result;
  },
  { schema: UpsertScheduleCategorySchema }
);

export const deleteScheduleCategoryConfig = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const result = await settingsService.executeDeleteScheduleCategoryConfig(tx, {
      section: input.section,
      category: input.schedule_category,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    invalidateCache({ scope: REVALIDATE_HOME });

    return result;
  },
  { schema: DeleteScheduleCategorySchema }
);

export const getAvailableSchedulerCategories = createAction(async ({ tx }) => {
  return settingsService.getAvailableCategories(tx);
});
