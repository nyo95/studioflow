"use server";

/**
 * BQ — pencarian master data untuk picker L3.
 *
 * Read-only sepenuhnya. Tidak ada mutasi, tidak ada transaksi
 * (`useTransaction: false`) — sebuah pencarian yang membuka transaksi menahan
 * koneksi pool untuk pekerjaan yang tidak pernah menulis apa pun.
 *
 * Izinnya `BQ_BREAKDOWN_EDIT`, bukan sekadar `BQ_ACCESS`: yang boleh melihat
 * daftar harga master adalah orang yang memang sedang menyusun breakdown.
 * `MASTERDATA_PRICE_VIEW` di matriks ESTIMATOR yang membuat itu sah — dan
 * DIC/DRIC tidak memegangnya sama sekali (constants.ts: *"PRICE IS NOT A
 * DESIGNER CONCERN"*).
 */

import { z } from "zod";
import { createAction } from "@/lib/action-wrapper";
import { ActionError } from "@/lib/error-types";
import { hasPermission, PERMISSION } from "@/core/rbac/rbac";
import type { Role } from "@/generated/prisma";
import {
  searchMaterialCandidates,
  searchServiceCandidates,
} from "../services/master-data-service";

function assertCanBrowse(role: Role): void {
  if (!hasPermission(role, PERMISSION.BQ_BREAKDOWN_EDIT)) {
    throw new ActionError("You are not allowed to browse BQ pricing.", "UNAUTHORIZED_ACTION");
  }
}

export const searchBqMaterialsAction = createAction(
  async ({ input, ctx }) => {
    assertCanBrowse(ctx.role);
    return searchMaterialCandidates(input.query, { onlyReady: input.onlyReady });
  },
  {
    useTransaction: false,
    schema: z.object({
      query: z.string().default(""),
      /** Default `false` — SKU yang belum siap tetap ditampilkan LENGKAP
       *  DENGAN ALASANNYA. Menyaringnya diam-diam membuat estimator mencari
       *  bahan yang ia tahu ada di Master Data tanpa pernah tahu kenapa ia
       *  tidak muncul. */
      onlyReady: z.boolean().default(false),
    }),
  }
);

export const searchBqServicesAction = createAction(
  async ({ input, ctx }) => {
    assertCanBrowse(ctx.role);
    return searchServiceCandidates(input.query);
  },
  {
    useTransaction: false,
    schema: z.object({ query: z.string().default("") }),
  }
);
