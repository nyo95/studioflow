"use server";

import { createAction } from "@/lib/action-wrapper";
import { settingsService } from "@/lib/services/settings-service";
import { assertAdmin } from "@/lib/permissions";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_HOME, REVALIDATE_SETTINGS } from "@/lib/revalidation-tags";
import type { UISettings } from "@/types/common";
import { ScheduleSection } from "@/generated/prisma";

export const setAutoNamingEnabled = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { isEnabled: boolean };

    const result = await settingsService.executeSetAutoNamingEnabled(tx, {
      isEnabled: params.isEnabled,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME });
    invalidateCache({ scope: REVALIDATE_SETTINGS });

    return result;
  }
);

export const upsertTimelineTemplate = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { phaseEnum: string; durationDays: number };

    return settingsService.executeUpsertTimelineTemplate(tx, {
      phaseEnum: params.phaseEnum,
      durationDays: params.durationDays,
      userId: ctx.userId,
    });
  }
);

export const createChecklistTemplate = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { phaseEnum: string | null; label: string };

    return settingsService.executeCreateChecklistTemplate(tx, {
      phaseEnum: params.phaseEnum,
      label: params.label,
      userId: ctx.userId,
    });
  }
);

export const deleteChecklistTemplate = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { id: string };

    return settingsService.executeDeleteChecklistTemplate(tx, {
      id: params.id,
      userId: ctx.userId,
    });
  }
);

export const updateUISettings = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { uiSettings?: UISettings; appTitle?: string };

    const result = await settingsService.executeUpdateUISettings(tx, {
      uiSettings: params.uiSettings,
      appTitle: params.appTitle,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_HOME });
    invalidateCache({ scope: REVALIDATE_SETTINGS });

    return result;
  }
);

export const upsertScheduleCategoryConfig = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { section: ScheduleSection; category: string; prefix?: string };

    const result = await settingsService.executeUpsertScheduleCategoryConfig(tx, {
      section: params.section,
      category: params.category,
      prefix: params.prefix,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    invalidateCache({ scope: REVALIDATE_HOME });

    return result;
  }
);

export const deleteScheduleCategoryConfig = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { section: ScheduleSection; category: string };

    const result = await settingsService.executeDeleteScheduleCategoryConfig(tx, {
      section: params.section,
      category: params.category,
      userId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    invalidateCache({ scope: REVALIDATE_HOME });

    return result;
  }
);

export const getAvailableSchedulerCategories = createAction(async ({ tx }) => {
  return settingsService.getAvailableCategories(tx);
});
