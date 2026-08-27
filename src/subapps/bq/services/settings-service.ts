import "server-only";

/**
 * BQ — setelan kantor.
 *
 * Field costing (konversi, waste, minimum order, rounding) sekarang duduk
 * langsung di `master_data.Sku` (P1, 2026-08-19). File ini hanya mengelola
 * setelan kantor yang masih berlaku.
 */

import { prisma } from "@/core/platform/db";
import {
  BQ_DEFAULT_CURRENCY,
  BQ_SETTINGS_ID,
} from "../lib/constants";

export type BqSettingsView = {
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
      currency: BQ_DEFAULT_CURRENCY,
      updatedAt: null,
      updatedByName: null,
    };
  }

  return {
    currency: row.currency,
    updatedAt: row.updated_at?.toISOString() ?? null,
    updatedByName: row.updated_by_name,
  };
}
