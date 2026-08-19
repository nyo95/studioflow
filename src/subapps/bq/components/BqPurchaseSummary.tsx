"use client";

/**
 * BQ — Purchase Summary (PRD §3.5).
 *
 * Tiga hal yang tidak boleh hilang dari layar ini, karena ketiganya adalah
 * tempat orang paling mudah salah baca:
 *
 * 1. **Agregasi terjadi sebelum pembulatan.** Kolom `Gross` dan `÷ conversion`
 *    ditampilkan justru supaya terlihat bahwa 2,6975 lembar dibulatkan jadi 3
 *    SEKALI, bukan tiga pemakaian yang masing-masing dibulatkan (AT-06).
 *
 * 2. **Packaging variance adalah barisnya sendiri.** Ia TIDAK dialokasikan
 *    balik ke object, tidak memengaruhi rate mana pun, tidak dikenai markup.
 *    Kalau ia dialokasikan, rate Counter Cabinet berubah setiap kali object
 *    lain ikut pakai plywood — mustahil dijelaskan, dan merusak nilai rate
 *    sebagai entri yang bisa dipakai ulang (PRD §3.5, AT-12).
 *
 * 3. **Object yang dilewati dihitung dan disebut namanya.** AT-05c. Tanpa itu
 *    seseorang akan mengira daftar belanjanya lengkap padahal separuh project
 *    ber-mode ringkas.
 */

import * as React from "react";
import { ShoppingCart } from "lucide-react";
import { SectionCard } from "@/ui_engine";
import { UI_ENGINE_TYPE_META } from "@/ui_engine/tokens";
import { cn } from "@/lib/utils";
import { formatIdr, formatQty } from "../lib/calc";
import type { PurchaseSummary } from "../types/breakdown";

const TH = cn(
  UI_ENGINE_TYPE_META,
  "px-3 py-2 text-left font-medium text-slate-400"
);
const TD = "px-3 py-2 font-sans text-xs text-slate-700";

export function BqPurchaseSummary({ summary }: { summary: PurchaseSummary }) {
  return (
    <SectionCard
      padding="none"
      header={
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-4 w-4 text-slate-400" />
          <span className="font-sans text-sm font-medium text-slate-800">Purchase summary</span>
          <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
            Aggregated across the whole project, then rounded once
          </span>
        </div>
      }
    >
      {summary.rows.length === 0 ? (
        <div className="px-6 py-8 text-center">
          <p className="font-sans text-sm text-slate-600">Nothing to buy yet.</p>
          <p className={cn(UI_ENGINE_TYPE_META, "mt-1 text-slate-400")}>
            {summary.skippedObjectCount > 0
              ? "Every object in this breakdown is in summary mode, so none of them count towards purchasing."
              : "Add material lines to a detailed object and they will appear here."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-slate-100 bg-slate-50/50">
              <tr>
                <th className={TH}>Material</th>
                <th className={cn(TH, "text-right")}>Project gross</th>
                <th className={cn(TH, "text-right")}>÷ conversion</th>
                <th className={cn(TH, "text-right")}>Buy</th>
                <th className={cn(TH, "text-right")}>Unit price</th>
                <th className={cn(TH, "text-right")}>Purchase cost</th>
                <th className={cn(TH, "text-right")}>Cost in BQ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summary.rows.map((row) => (
                <tr key={`${row.skuId}-${row.purchaseUnit}-${row.pricePerPurchaseUnit}`}>
                  <td className={TD}>{row.name}</td>
                  <td className={cn(TD, "text-right")}>
                    {formatQty(row.projectGross)} {row.usageUnit}
                  </td>
                  {/* Nilai sebelum dibulatkan. Ia ada di layar supaya
                      pembulatannya bisa diperiksa, bukan dipercaya. */}
                  <td className={cn(TD, "text-right text-slate-500")}>
                    {formatQty(row.purchaseRaw)}
                  </td>
                  <td className={cn(TD, "text-right font-medium")}>
                    {formatQty(row.purchaseQty)} {row.purchaseUnit}
                  </td>
                  <td className={cn(TD, "text-right")}>{formatIdr(row.pricePerPurchaseUnit)}</td>
                  <td className={cn(TD, "text-right font-medium")}>
                    {formatIdr(row.purchaseCost)}
                  </td>
                  <td className={cn(TD, "text-right text-slate-500")}>{formatIdr(row.bqCost)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50/50">
              <tr>
                <td className={cn(TD, "font-medium")} colSpan={5}>
                  Total
                </td>
                <td className={cn(TD, "text-right font-semibold")}>
                  {formatIdr(summary.totalPurchaseCost)}
                </td>
                <td className={cn(TD, "text-right text-slate-500")}>
                  {formatIdr(summary.totalBqCost)}
                </td>
              </tr>
              <tr>
                <td className={cn(TD, "text-slate-500")} colSpan={5}>
                  Packaging variance
                  <span className={cn(UI_ENGINE_TYPE_META, "ml-2 text-slate-400")}>
                    left out of every rate on purpose — a rate has to stay reusable
                  </span>
                </td>
                <td className={cn(TD, "text-right font-medium text-slate-700")} colSpan={2}>
                  {formatIdr(summary.packagingVariance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* AT-05c — dilewati, dihitung, dan disebut. */}
      {summary.skippedObjectCount > 0 ? (
        <div className="border-t border-slate-100 px-6 py-3">
          <p className={cn(UI_ENGINE_TYPE_META, "text-amber-700")}>
            {summary.skippedObjectCount}{" "}
            {summary.skippedObjectCount === 1 ? "object is" : "objects are"} in summary mode and
            left out of this list: {summary.skippedObjectNames.join(", ")}.
          </p>
        </div>
      ) : null}

      {summary.unlinkedLineCount > 0 ? (
        <div className="border-t border-slate-100 px-6 py-3">
          <p className={cn(UI_ENGINE_TYPE_META, "text-amber-700")}>
            {summary.unlinkedLineCount}{" "}
            {summary.unlinkedLineCount === 1 ? "line is" : "lines are"} no longer linked to a
            Master Data material, so they cannot be grouped for purchasing. They still count
            towards the rate.
          </p>
        </div>
      ) : null}
    </SectionCard>
  );
}
