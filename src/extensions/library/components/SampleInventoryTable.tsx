"use client";

import * as React from "react";
import Image from "next/image";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD, UI_ENGINE_RADIUS_ACTION, UI_ENGINE_TYPE_META } from "@/ui_engine";
import {
  Warehouse,
  ArrowDownLeft,
  ArrowUpRight,
  Loader2,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { SampleAction } from "@/generated/prisma";
import { cn } from "@/lib/utils";
import { unwrapActionResult } from "@/lib/result";
import { recordSampleMovementAction } from "../actions/library-actions";
import type { LibrarySampleRow } from "../types";

/**
 * The physical sample inventory.
 *
 * This reads `getPhysicalSamplesAction` rather than being handed the catalog list.
 * The previous table was passed the paginated Catalog page and flattened
 * `samples[0]` out of it, so it listed products (mostly with blank
 * rack/box cells) instead of samples, and any product's 2nd sample was invisible.
 */

interface SampleInventoryTableProps {
  samples: LibrarySampleRow[];
  canManageSamples?: boolean;
  onOpenProduct?: (productId: string) => void;
  onRefresh?: () => void;
}

const HEAD = cn(
  "font-sans font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap",
  UI_ENGINE_TYPE_META
);

// Kelima nilai `master_data.SampleStatus`. LOST dan DISCARDED ditambahkan
// 2026-08-18: keduanya sudah lama ada di database, tetapi tidak punya entri di
// sini sehingga baris berstatus itu tampil tanpa warna sama sekali — persis
// bagian dari cacat yang sama dengan SENT_TO_CLIENT yang tidak pernah tersimpan.
const STATUS_STYLE: Record<string, string> = {
  AVAILABLE: "bg-emerald-50 text-emerald-600",
  BORROWED: "bg-amber-50 text-amber-600",
  SENT_TO_CLIENT: "bg-sky-50 text-sky-600",
  LOST: "bg-rose-50 text-rose-600",
  DISCARDED: "bg-slate-100 text-slate-500",
};

export function SampleInventoryTable({
  samples,
  canManageSamples,
  onOpenProduct,
  onRefresh,
}: SampleInventoryTableProps) {
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  async function record(sampleId: string, action: SampleAction, note: string) {
    setProcessingId(sampleId);
    try {
      unwrapActionResult(
        await recordSampleMovementAction({ sampleId, action, notes: note })
      );
      toast.success(note);
      onRefresh?.();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to record movement"
      );
    } finally {
      setProcessingId(null);
    }
  }

  if (samples.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
          <Warehouse className="h-8 w-8 text-slate-200" />
        </div>
        <h3 className="font-serif text-lg font-medium text-slate-900">
          No physical samples
        </h3>
        <p className="text-sm text-slate-500 font-sans mt-1 max-w-sm">
          Samples are registered per product, with a rack and box location. Open a
          product and add one under Physical Samples.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border overflow-hidden bg-white",
        UI_ENGINE_BORDER_SUBTLE,
        UI_ENGINE_RADIUS_CARD
      )}
    >
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className={cn("hover:bg-transparent", UI_ENGINE_BG_SUBTLE)}>
              <TableHead className={cn(HEAD, "w-[60px] pl-6")}>Img</TableHead>
              <TableHead className={cn(HEAD, "min-w-[220px]")}>Product</TableHead>
              <TableHead className={HEAD}>Brand</TableHead>
              <TableHead className={HEAD}>Location</TableHead>
              <TableHead className={HEAD}>Status</TableHead>
              <TableHead className={HEAD}>With</TableHead>
              <TableHead className={HEAD}>Notes</TableHead>
              <TableHead className={cn(HEAD, "text-right pr-6 w-[120px]")}>
                Movement
              </TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {samples.map((sample) => {
              const product = sample.sku;
              const isBusy = processingId === sample.id;
              const isOut = sample.status !== "AVAILABLE";
              const productName = product.name;
              const productCode = product.code;
              const brand = product.brand?.name ?? "";

              return (
                <TableRow
                  key={sample.id}
                  onClick={() => {
                    onOpenProduct?.(product.id);
                  }}
                  className={cn(
                    "group border-slate-50 hover:bg-slate-50/60 transition-colors",
                    "cursor-pointer"
                  )}
                >
                  <TableCell className="pl-6">
                    <div className="relative h-9 w-9 rounded-lg overflow-hidden bg-slate-50 shrink-0">
                      {/* v2 stores images in SkuMedia, not this raw Sku row —
                          not included here, so no thumbnail on this view. */}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-serif text-sm text-slate-900 leading-snug">
                        {productName}
                      </span>
                      <span className="font-sans text-[10px] font-bold tracking-wider text-slate-400">
                        {productCode}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <span className="font-sans font-black uppercase tracking-wider text-[10px] text-slate-700 whitespace-nowrap">
                      {brand}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold text-slate-700 whitespace-nowrap">
                      <MapPin className="h-3 w-3 text-slate-300" />
                      {sample.rack_number || "—"}
                      <span className="text-slate-200">/</span>
                      {sample.box_number || "—"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <span
                      className={cn(
                        "px-2 py-1 rounded-full font-sans font-black uppercase tracking-widest text-[9px] whitespace-nowrap",
                        STATUS_STYLE[sample.status] ?? "bg-slate-50 text-slate-500"
                      )}
                    >
                      {sample.status.replace(/_/g, " ")}
                    </span>
                  </TableCell>

                  <TableCell className="font-sans text-[11px] text-slate-600 whitespace-nowrap">
                    {sample.borrower_name || <span className="text-slate-200">—</span>}
                  </TableCell>

                  <TableCell className="font-sans text-[11px] text-slate-400">
                    <span className="truncate block max-w-[180px]" title={sample.notes || ""}>
                      {sample.notes || <span className="text-slate-200">—</span>}
                    </span>
                  </TableCell>

                  <TableCell className="text-right pr-6">
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canManageSamples && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isBusy}
                          onClick={() =>
                            record(
                              sample.id,
                              isOut ? SampleAction.IN : SampleAction.OUT,
                              isOut ? "Sample checked in" : "Sample checked out"
                            )
                          }
                          className={cn(
                            "h-8 px-3 font-sans font-bold text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-900",
                            UI_ENGINE_RADIUS_ACTION
                          )}
                        >
                          {isBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isOut ? (
                            <>
                              <ArrowDownLeft className="h-3.5 w-3.5 mr-1.5" /> In
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" /> Out
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
