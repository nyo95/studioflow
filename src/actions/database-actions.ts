"use server";

import { Role } from "@/generated/prisma";
import { assertAdmin } from "@/core/rbac/permissions";
import { DatabaseService } from "@/core/platform/system/database-service";
import { Database } from "lucide-react";
import { createAction } from "@/lib/action-wrapper";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_SETTINGS } from "@/lib/revalidation-tags";

/**
 * Creates a new database backup
 */
export const createBackupAction = createAction(
  async ({ ctx }) => {
    assertAdmin(ctx.role);
    const fileName = await DatabaseService.createBackup();
    invalidateCache({ scope: REVALIDATE_SETTINGS });
    return { fileName };
  }
);

/**
 * Restores a database from a specific backup
 */
export const restoreBackupAction = createAction(
  async ({ input, ctx }) => {
    assertAdmin(ctx.role);
    await DatabaseService.restoreBackup((input as { fileName: string }).fileName);
    invalidateCache({ scope: REVALIDATE_SETTINGS });
  }
);

/**
 * Lists all available backups
 */
export const listBackupsAction = createAction(
  async ({ ctx }) => {
    assertAdmin(ctx.role);
    const backups = await DatabaseService.listBackups();
    return { backups };
  }
);

/**
 * Deletes a backup record
 */
export const deleteBackupAction = createAction(
  async ({ input, ctx }) => {
    assertAdmin(ctx.role);
    await DatabaseService.deleteBackup((input as { fileName: string }).fileName);
    invalidateCache({ scope: REVALIDATE_SETTINGS });
  }
);
