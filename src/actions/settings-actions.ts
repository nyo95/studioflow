"use server";

import { revalidatePath } from "next/cache";
import { createAction } from "@/lib/action-wrapper";
import { settingsService } from "@/lib/services/settings-service";
import { assertAdmin } from "@/lib/permissions";

export const setAutoNamingEnabled = createAction(
  async ({ input, ctx }) => {
    assertAdmin(ctx.role);

    const params = input as { isEnabled: boolean };

    const result = await settingsService.executeSetAutoNamingEnabled(null as any, {
      isEnabled: params.isEnabled,
    });

    revalidatePath("/");
    revalidatePath("/settings");

    return result;
  }
);

export const upsertTimelineTemplate = createAction(
  async ({ input, ctx }) => {
    assertAdmin(ctx.role);

    const params = input as { phaseEnum: string; durationDays: number };

    return settingsService.executeUpsertTimelineTemplate(null as any, {
      phaseEnum: params.phaseEnum,
      durationDays: params.durationDays,
    });
  }
);

export const createChecklistTemplate = createAction(
  async ({ input, ctx }) => {
    assertAdmin(ctx.role);

    const params = input as { phaseEnum: string | null; label: string };

    return settingsService.executeCreateChecklistTemplate(null as any, {
      phaseEnum: params.phaseEnum,
      label: params.label,
    });
  }
);

export const deleteChecklistTemplate = createAction(
  async ({ input, ctx }) => {
    assertAdmin(ctx.role);

    const params = input as { id: string };

    return settingsService.executeDeleteChecklistTemplate(null as any, {
      id: params.id,
    });
  }
);

export const updateUISettings = createAction(
  async ({ input, ctx }) => {
    assertAdmin(ctx.role);

    const params = input as { uiSettings?: any; appTitle?: string };

    const result = await settingsService.executeUpdateUISettings(null as any, {
      uiSettings: params.uiSettings,
      appTitle: params.appTitle,
    });

    revalidatePath("/");
    revalidatePath("/settings");

    return result;
  }
);
