import "server-only";

/**
 * BQ — setelan kantor.
 *
 * Field costing (konversi, waste, minimum order, rounding) sekarang duduk
 * langsung di `master_data.Sku` (P1, 2026-08-19). File ini hanya mengelola
 * `BqSettings` (default markup + detail mode).
 */

import { prisma } from "@/core/platform/db";
import type { PrismaTransaction } from "@/types/common";
import {
  BQ_DEFAULT_CURRENCY,
  BQ_DEFAULT_MARKUP_PCT,
  BQ_SETTINGS_ID,
} from "../lib/constants";
import { decToNumberStrict } from "./master-data-service";

export type BqSettingsView = {
  defaultMarkupPct: number;
  currency: string;
  updatedAt: string | null;
  updatedByName: string | null;
};

/**
 * Baca setelan, dengan default kalau barisnya belum pernah dibuat.
 *
 * Sengaja TIDAK meng-`upsert` di jalur baca. Sebuah halaman yang dibuka
 * seorang estimator tidak seharusnya menulis ke database, dan `upsert` di
 * fungsi baca berarti setiap pemuatan halaman memegang lock baris yang sama.
 * Barisnya dibuat saat seseorang benar-benar menyimpan setelan.
 */
export async function getSettings(): Promise<BqSettingsView> {
  const row = await prisma.bqSettings.findUnique({ where: { id: BQ_SETTINGS_ID } });

  if (!row) {
    return {
      defaultMarkupPct: BQ_DEFAULT_MARKUP_PCT,
      currency: BQ_DEFAULT_CURRENCY,
      updatedAt: null,
      updatedByName: null,
    };
  }

  return {
    defaultMarkupPct: decToNumberStrict(row.default_markup_pct),
    currency: row.currency,
    updatedAt: row.updated_at?.toISOString() ?? null,
    updatedByName: row.updated_by_name,
  };
}

/** Dipakai saat membuat object baru. Nilainya DISALIN ke `BqObject.markup_pct`,
 *  bukan dirujuk — mengubah default kantor tidak boleh mengubah object yang
 *  sudah jadi, alasan yang sama dengan snapshot harga. */
export async function getObjectDefaults(
  tx: PrismaTransaction
): Promise<{ markupPct: number }> {
  const row = await tx.bqSettings.findUnique({ where: { id: BQ_SETTINGS_ID } });
  return {
    markupPct: row ? decToNumberStrict(row.default_markup_pct) : BQ_DEFAULT_MARKUP_PCT,
  };
}
