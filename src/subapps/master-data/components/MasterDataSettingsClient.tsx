"use client";

/**
 * MASTER DATA — Settings page client.
 *
 * Menampung operasi administrasi data yang bersifat global (bukan per-tampilan):
 *   - Export seluruh SKU + harga ke Excel
 *   - Import SKU + harga dari Excel (upsert)
 *
 * Dipindahkan dari MasterDataMaterialsClient.tsx (2026-08-12, UI-CON-5).
 * Alasan: export/import menyentuh SELURUH dataset, bukan subset yang sedang
 * ditampilkan. Operasi administrasi tidak seharusnya bersarang di halaman
 * kerja sehari-hari.
 *
 * Akses: MASTERDATA_SKU_MANAGE (ADMIN, DEVELOPER, STAFF).
 * ESTIMATOR tidak dapat masuk ke /masterdata sama sekali (APP_ACCESS matrix).
 */

import * as React from "react";
import { ChevronDown, ChevronUp, FileDown, FileUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Button,
  PageHeader,
  SectionCard,
  SettingsTemplate,
  UI_ENGINE_RADIUS_ACTION,
} from "@/ui_engine";
import { cn } from "@/lib/utils";
import { UI_ENGINE_TYPE_BODY, UI_ENGINE_TYPE_META } from "@/ui_engine/tokens";

export function MasterDataSettingsClient() {
  const router = useRouter();
  const [importing, setImporting] = React.useState(false);
  const [importResults, setImportResults] = React.useState<{
    created: number;
    updated: number;
    errors: number;
    total: number;
    errorLines: string[];
  } | null>(null);
  const [showErrors, setShowErrors] = React.useState(false);
  const importInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = React.useCallback(() => {
    window.location.href = "/api/masterdata/excel/export";
  }, []);

  const handleImportFile = React.useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/masterdata/excel/import", {
          method: "POST",
          body: fd,
        });
        const result = (await res.json()) as {
          summary: { created: number; updated: number; errors: number };
          skuResults: { row: number; status: string; message?: string }[];
          priceResults: { row: number; status: string; message?: string }[];
        };
        if (!res.ok) {
          toast.error("Import failed.");
          return;
        }
        const { created, updated, errors } = result.summary;
        const errorLines = [...result.skuResults, ...result.priceResults]
          .filter((r) => r.status === "error")
          .map((r) => `Row ${r.row}: ${r.message ?? "error"}`);
        setImportResults({
          created,
          updated,
          errors,
          total: created + updated + errors,
          errorLines,
        });
        setShowErrors(false);
        if (errors > 0) {
          toast.warning(`Import finished with ${errors} error${errors === 1 ? "" : "s"}.`);
        } else {
          toast.success(`Import finished: ${created} created, ${updated} updated.`);
        }
        router.refresh();
      } catch {
        toast.error("Import failed. Check the connection or file format and try again.");
      } finally {
        setImporting(false);
        if (importInputRef.current) importInputRef.current.value = "";
      }
    },
    [router]
  );

  return (
    <SettingsTemplate
      header={
        <PageHeader
          eyebrow="Master Data"
          title="Settings"
          description="Master Data administration for bulk SKU and pricing export or import."
        />
      }
      content={
        <>
      {/* Hidden file input for Excel import */}
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportFile(file);
        }}
      />

      <SectionCard padding="md">
        <div className="space-y-1 mb-6">
          <h2 className={cn("text-slate-900 font-semibold", UI_ENGINE_TYPE_BODY)}>
            Excel data
          </h2>
          <p className={cn("text-slate-500", UI_ENGINE_TYPE_META)}>
            Export creates one `.xlsx` file with every SKU and current price.
            Import runs as an upsert: existing rows are updated and new rows are created.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            className={UI_ENGINE_RADIUS_ACTION}
            title="Export all SKUs and current prices to Excel"
          >
            <FileDown className="size-[var(--ui-icon-size-sm)]" />
            Export to Excel
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => importInputRef.current?.click()}
            className={UI_ENGINE_RADIUS_ACTION}
            title="Import SKUs and prices from Excel"
          >
            <FileUp className="size-[var(--ui-icon-size-sm)]" />
            {importing ? "Importing…" : "Import from Excel"}
          </Button>
        </div>

        <p className={cn("mt-4 text-slate-400", UI_ENGINE_TYPE_META)}>
          Use the export file as the template. Required columns: SKU, Brand, Category.
        </p>
      </SectionCard>

      {/* Import results card */}
      {importResults && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Import summary</h3>
            <button
              type="button"
              onClick={() => setImportResults(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-600">Created</span>
              <span className="tabular-nums font-semibold text-emerald-700">{importResults.created}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-600">Updated</span>
              <span className="tabular-nums font-semibold text-sky-700">{importResults.updated}</span>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-600">Errors</span>
              <span className="tabular-nums font-semibold text-red-600">{importResults.errors}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 font-semibold">
              <span className="text-sm text-slate-900">Total</span>
              <span className="tabular-nums">{importResults.total}</span>
            </div>
          </div>
          {importResults.errorLines.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setShowErrors((v) => !v)}
                className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                {showErrors ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                {showErrors ? "Hide" : "Show"} error details
              </button>
              {showErrors && (
                <ul className="mt-2 max-h-40 overflow-y-auto rounded bg-slate-50 p-2 text-xs text-red-600">
                  {importResults.errorLines.map((line, i) => (
                    <li key={i} className="py-0.5">{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setImportResults(null)}
              className={UI_ENGINE_RADIUS_ACTION}
            >
              Close
            </Button>
          </div>
        </div>
      )}
        </>
      }
    />
  );
}
