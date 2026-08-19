"use server";

/**
 * BQ — setelan kantor (default markup).
 *
 * Field costing sudah dipindahkan ke `master_data.Sku` (P1, 2026-08-19).
 * `BqDetailMode` sudah dihapus (O3, 2026-08-19) — semua object selalu DETAIL.
 * `BqMaterialProfile` dan `BqCategoryWaste` sudah dihapus.
 *
 * Tidak satu pun aksi di berkas ini menulis ke tabel `master_data`.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { ActionError } from "@/lib/error-types";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import { insertAuditLog } from "@/actions/_shared";
import type { Role } from "@/generated/prisma";
import { BQ_SETTINGS_ID } from "../lib/constants";

function assertSettingsPerm(role: Role): void {
  if (!hasPermission(role, PERMISSION.BQ_SETTINGS_MANAGE)) {
    throw new ActionError("You are not allowed to change BQ settings.", "UNAUTHORIZED_ACTION");
  }
}

const percentToFraction = z.number().min(0).max(1000).transform((v) => v / 100);

export const saveBqSettingsAction = createAction(
  async ({ input, ctx, tx }) => {
    assertSettingsPerm(ctx.role);

    // `upsert` di jalur TULIS, bukan di jalur baca — `getSettings()` sengaja
    // tidak membuat baris, supaya membuka halaman tidak menulis ke database.
    await tx.bqSettings.upsert({
      where: { id: BQ_SETTINGS_ID },
      create: {
        id: BQ_SETTINGS_ID,
        default_markup_pct: input.defaultMarkupPct,
        currency: input.currency,
        updated_by_name: ctx.user.name ?? null,
      },
      update: {
        default_markup_pct: input.defaultMarkupPct,
        currency: input.currency,
        updated_by_name: ctx.user.name ?? null,
      },
    });

    await insertAuditLog(tx, "UPDATE", "BqSettings", BQ_SETTINGS_ID, ctx.userId, {
      default_markup_pct: input.defaultMarkupPct,
    });

    revalidatePath("/bq");
    return { ok: true };
  },
  {
    schema: z.object({
      defaultMarkupPct: percentToFraction,
      currency: z.string().min(1).default("IDR"),
    }),
  }
);
