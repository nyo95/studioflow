"use client";

/**
 * MASTER DATA — Perpustakaan Sample.
 *
 * The office shelf. Two ways to look at it, because staff use it two ways:
 *
 *   Per rak  — "walk to rack A and see what is in it" (default; mirrors how
 *              someone physically retrieves a sample)
 *   Daftar   — one flat table, for searching and auditing
 *
 * Rack and box are normalised server-side, so the rack combobox can offer the
 * existing values without producing near-duplicates like "A" and "a ".
 */

import * as React from "react";
import {
  Boxes, Edit3, Layers, Loader2, MapPin, Package, Plus, Search, Trash2, User,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  Button, DashboardPageShell, Dialog, DialogContent, DialogFooter, DialogHeader,
  DialogTitle, Input, Label, PageHeader, SectionCard,
  TableCard, TableCardBody, TableCardCell, TableCardHead, TableCardHeader, TableCardRow,
  UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_ACTION, UI_ENGINE_RADIUS_CARD,
  UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_BODY, UI_ENGINE_TYPE_H3, UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import { cn } from "@/lib/utils";
import { unwrapActionResult } from "@/lib/result";
import { useUnsavedChangesGuard, UnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-guard";
import {
  createSampleAction, deleteSampleAction, updateSampleAction, updateSampleStatusAction,
} from "../actions/sample-actions";
import { sampleStatusNeedsHolder } from "../types/sample";
import type {
  SampleData, SampleLibrarySummary, SampleStatusValue,
} from "../types/sample";

type SkuOption = { id: string; sku: string; productName: string; brandName: string | null };

/**
 * Kelima status, masing-masing dengan rupanya sendiri.
 *
 * Sampai 2026-08-18 hanya ada tiga entri di sini dan server meratakan lima
 * nilai database menjadi dua sebelum sampai ke layar ini — LOST dan DISCARDED
 * tiba sebagai "Dipinjam". Warna merah untuk LOST bukan hiasan: ia satu-satunya
 * tanda di layar ini bahwa benda itu tidak akan kembali sendiri.
 */
const STATUS_META: Record<SampleStatusValue, { label: string; className: string }> = {
  AVAILABLE: { label: "Available", className: "bg-emerald-50 text-emerald-700" },
  BORROWED: { label: "Borrowed", className: "bg-amber-50 text-amber-700" },
  SENT_TO_CLIENT: { label: "Sent to client", className: "bg-sky-50 text-sky-700" },
  LOST: { label: "Lost", className: "bg-rose-50 text-rose-700" },
  DISCARDED: { label: "Discarded", className: "bg-slate-100 text-slate-500" },
};

/** Urutan tombol di dialog status — dari "ada di rak" ke "tidak akan kembali". */
const ASSIGNABLE_STATUSES = [
  "AVAILABLE",
  "BORROWED",
  "SENT_TO_CLIENT",
  "LOST",
  "DISCARDED",
] as const satisfies readonly SampleStatusValue[];

const EMPTY_FORM = {
  skuId: "",
  rackNumber: "",
  boxNumber: "",
  locationNote: "",
  quantity: "1",
  notes: "",
};

function StatusBadge({ status }: { status: SampleStatusValue }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded-[var(--ui-radius-pill)] px-2 py-0.5 font-sans text-[10px] font-semibold",
        meta.className
      )}
    >
      {meta.label}
    </span>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={cn("uppercase tracking-wide text-slate-400", UI_ENGINE_TYPE_META)}>
        {label}
      </span>
      <span
        className={cn(
          "font-sans text-xl font-semibold tabular-nums",
          tone === "warn" && value > 0 ? "text-amber-700" : "text-slate-950"
        )}
      >
        {value.toLocaleString("id-ID")}
      </span>
    </div>
  );
}

export function SampleLibraryClient({
  initialSamples,
  skuOptions,
  canManage,
}: {
  initialSamples: SampleData[];
  skuOptions: SkuOption[];
  canManage: boolean;
}) {
  const [samples, setSamples] = React.useState(initialSamples);
  const [view, setView] = React.useState<"rack" | "list">("rack");
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | SampleStatusValue>("ALL");

  const [dialog, setDialog] = React.useState<{
    open: boolean;
    mode: "CREATE" | "EDIT";
    row: SampleData | null;
  }>({ open: false, mode: "CREATE", row: null });
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  const [statusDialog, setStatusDialog] = React.useState<SampleData | null>(null);
  const [statusValue, setStatusValue] = React.useState<SampleStatusValue>("AVAILABLE");
  const [borrower, setBorrower] = React.useState("");
  const [statusNotes, setStatusNotes] = React.useState("");
  const [statusSaving, setStatusSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<SampleData | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // --- guards ---
  const editGuard = useUnsavedChangesGuard({
    open: dialog.open,
    value: form,
    onOpenChange: (open) => setDialog((d) => ({ ...d, open })),
  });
  const statusGuard = useUnsavedChangesGuard({
    open: Boolean(statusDialog),
    value: { statusValue, borrower, statusNotes },
    onOpenChange: (open) => !open && setStatusDialog(null),
  });

  // Summary is recomputed client-side so the header updates the moment a status
  // changes, instead of waiting for a round trip.
  const summary = React.useMemo<SampleLibrarySummary>(
    () => ({
      total: samples.length,
      available: samples.filter((s) => s.status === "AVAILABLE").length,
      borrowed: samples.filter((s) => s.status === "BORROWED").length,
      sentToClient: samples.filter((s) => s.status === "SENT_TO_CLIENT").length,
      offShelf: samples.filter(
        (s) => s.status === "LOST" || s.status === "DISCARDED"
      ).length,
      rackCount: new Set(samples.map((s) => s.rackNumber)).size,
    }),
    [samples]
  );

  const visible = React.useMemo(() => {
    const q = query.trim().toLocaleLowerCase("id-ID");
    return samples.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (!q) return true;
      return [
        s.skuCode, s.skuProductName, s.brandName, s.companyName,
        s.rackNumber, s.boxNumber, s.borrowerName,
      ]
        .filter(Boolean)
        .some((v) => v!.toLocaleLowerCase("id-ID").includes(q));
    });
  }, [samples, query, statusFilter]);

  /** Grouped by rack for the shelf view, racks in physical order. */
  const byRack = React.useMemo(() => {
    const map = new Map<string, SampleData[]>();
    for (const s of visible) {
      const list = map.get(s.rackNumber);
      if (list) list.push(s);
      else map.set(s.rackNumber, [s]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "id-ID"));
  }, [visible]);

  /** Existing racks, offered as a datalist so a new entry matches an old one. */
  const rackOptions = React.useMemo(
    () => [...new Set(samples.map((s) => s.rackNumber))].sort((a, b) => a.localeCompare(b, "id-ID")),
    [samples]
  );

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialog({ open: true, mode: "CREATE", row: null });
    editGuard.markPristine(EMPTY_FORM);
  };

  const openEdit = (row: SampleData) => {
    const next = {
      skuId: row.skuId,
      rackNumber: row.rackNumber,
      boxNumber: row.boxNumber,
      locationNote: row.locationNote ?? "",
      quantity: String(row.quantity),
      notes: row.notes ?? "",
    };
    setForm(next);
    setDialog({ open: true, mode: "EDIT", row });
    editGuard.markPristine(next);
  };

  const openStatus = (row: SampleData) => {
    setStatusValue(row.status);
    setBorrower(row.borrowerName ?? "");
    setStatusNotes("");
    setStatusDialog(row);
    statusGuard.markPristine({ statusValue: row.status, borrower: row.borrowerName ?? "", statusNotes: "" });
  };

  async function save() {
    setSaving(true);
    try {
      if (dialog.mode === "CREATE") {
        const saved = unwrapActionResult(
          await createSampleAction({
            skuId: form.skuId,
            rackNumber: form.rackNumber,
            boxNumber: form.boxNumber,
            locationNote: form.locationNote,
            quantity: form.quantity,
            notes: form.notes,
          })
        );
        setSamples((prev) => [...prev, saved]);
        toast.success("Sample added to the rack");
      } else if (dialog.row) {
        const saved = unwrapActionResult(
          await updateSampleAction({
            sampleId: dialog.row.id,
            data: {
              rackNumber: form.rackNumber,
              boxNumber: form.boxNumber,
              locationNote: form.locationNote,
              quantity: form.quantity,
              notes: form.notes,
            },
          })
        );
        setSamples((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
        toast.success("Sample updated");
      }
      editGuard.closeAfterSave();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function saveStatus() {
    if (!statusDialog) return;
    setStatusSaving(true);
    try {
      const saved = unwrapActionResult(
        await updateSampleStatusAction({
          sampleId: statusDialog.id,
          status: statusValue,
          borrowerName: borrower,
          notes: statusNotes,
        })
      );
      setSamples((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
      toast.success("Sample status updated");
      statusGuard.closeAfterSave();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setStatusSaving(false);
    }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      unwrapActionResult(await deleteSampleAction({ sampleId: deleteTarget.id }));
      setSamples((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success("Sample removed from the rack");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  }

  const formValid =
    (dialog.mode === "EDIT" || form.skuId) &&
    form.rackNumber.trim() &&
    form.boxNumber.trim();
  // Hanya BORROWED dan SENT_TO_CLIENT yang menuntut nama. Sebelum 2026-08-18
  // aturannya "bukan AVAILABLE", yang berarti menandai sample HILANG memaksa
  // staf mengarang nama pemegang — dan aturan yang memaksa mengarang adalah
  // aturan yang diakali, bukan dipatuhi.
  const statusNeedsBorrower =
    sampleStatusNeedsHolder(statusValue) && !borrower.trim();

  const selectedSku = skuOptions.find((o) => o.id === form.skuId);

  return (
    <DashboardPageShell>
      <PageHeader
        eyebrow="Master Data"
        title="Sample Library"
        description="Physical samples held in the office, with their rack and box position. Linked to materials by SKU."
        action={
          canManage ? (
            <Button
              onClick={openCreate}
              className={cn(
                "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                UI_ENGINE_RADIUS_ACTION
              )}
            >
              <Plus className="size-[var(--ui-icon-size-sm)]" />
              Add Sample
            </Button>
          ) : undefined
        }
      />

      <SectionCard padding="md" className="mb-6">
        <div className="flex flex-wrap gap-8">
          <Stat label="Total samples" value={summary.total} />
          <Stat label="Available" value={summary.available} />
          <Stat label="Borrowed" value={summary.borrowed} tone="warn" />
          <Stat label="Sent to client" value={summary.sentToClient} tone="warn" />
          <Stat label="Lost / discarded" value={summary.offShelf} tone="warn" />
          <Stat label="Rack count" value={summary.rackCount} />
        </div>
      </SectionCard>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1">
          {([
            ["rack", "By rack", Layers],
            ["list", "List", Boxes],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-[var(--ui-radius-control)] px-3 py-1.5 font-sans text-xs font-medium transition-colors",
                view === key
                  ? "bg-slate-900 text-white"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </button>
          ))}
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className={cn(
            "border border-slate-200 bg-white px-3 py-1.5 font-sans text-xs outline-none focus:border-[var(--ui-border-focus)]",
            UI_ENGINE_RADIUS_CONTROL
          )}
        >
          <option value="ALL">All statuses</option>
          <option value="AVAILABLE">Available</option>
          <option value="BORROWED">Borrowed</option>
          <option value="SENT_TO_CLIENT">Sent to client</option>
          <option value="LOST">Lost</option>
          <option value="DISCARDED">Discarded</option>
        </select>

        <div className="relative ml-auto w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search SKU, product, brand, rack, borrower…"
            className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)}
          />
        </div>
        <span className={cn("shrink-0 tabular-nums text-slate-400", UI_ENGINE_TYPE_META)}>
          {visible.length} of {samples.length}
        </span>
      </div>

      {/* Empty */}
      {visible.length === 0 ? (
        <SectionCard padding="lg">
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Package className="size-8 text-slate-300" />
            <p className={cn("max-w-sm text-slate-400", UI_ENGINE_TYPE_META)}>
              {samples.length === 0
                ? "No physical samples recorded yet. Samples arrive automatically when a request is received, or can be added here by hand."
                : "No samples match these filters."}
            </p>
          </div>
        </SectionCard>
      ) : view === "rack" ? (
        /* ---- Shelf view ---- */
        <div className="flex flex-col gap-5">
          {byRack.map(([rack, items]) => (
            <SectionCard key={rack} padding="none" className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--ui-border-subtle)] px-[var(--ui-section-px)] py-3">
                <h3 className="flex items-center gap-2 font-serif text-sm font-semibold text-slate-950">
                  <MapPin className="size-4 text-slate-400" />
                  {rack}
                </h3>
                <span className={cn("tabular-nums text-slate-400", UI_ENGINE_TYPE_META)}>
                  {items.length} sample · {new Set(items.map((i) => i.boxNumber)).size} box
                </span>
              </div>
              <div className="divide-y divide-[var(--ui-border-subtle)]">
                {items.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-[var(--ui-section-px)] py-3 transition-colors hover:bg-slate-50"
                  >
                    <span className="w-20 shrink-0 font-mono text-xs font-semibold text-slate-950">
                      {s.boxNumber}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-sans text-sm font-medium text-slate-950">
                        {s.skuProductName}
                      </div>
                      <div className={cn("truncate text-slate-400", UI_ENGINE_TYPE_META)}>
                        <span className="font-mono">{s.skuCode}</span>
                        {s.brandName ? ` · ${s.brandName}` : ""}
                        {s.quantity > 1 ? ` · ${s.quantity} pcs` : ""}
                      </div>
                    </div>
                    {s.borrowerName ? (
                      <span className={cn("flex items-center gap-1 text-slate-500", UI_ENGINE_TYPE_META)}>
                        <User className="size-3" />
                        {s.borrowerName}
                      </span>
                    ) : null}
                    <StatusBadge status={s.status} />
                    {canManage ? (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openStatus(s)}
                          title="Change status"
                          className="text-slate-400 hover:text-slate-900"
                        >
                          <User className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEdit(s)}
                          title="Edit location"
                          className="text-slate-400 hover:text-slate-900"
                        >
                          <Edit3 className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteTarget(s)}
                          title="Delete"
                          className="text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      ) : (
        /* ---- Flat table ---- */
        <TableCard layout="auto" minWidth="var(--ui-sample-library-table-min-width)">
          <TableCardHeader>
            <TableCardHead style={{ width: "9%" }}>Rack</TableCardHead>
            <TableCardHead style={{ width: "8%" }}>Box</TableCardHead>
            <TableCardHead style={{ width: "14%" }}>SKU</TableCardHead>
            <TableCardHead style={{ width: "24%" }}>Product</TableCardHead>
            <TableCardHead style={{ width: "15%" }}>Brand</TableCardHead>
            <TableCardHead style={{ width: "6%" }}>Qty</TableCardHead>
            <TableCardHead style={{ width: "13%" }}>Status</TableCardHead>
            {canManage ? <TableCardHead style={{ width: "11%" }} /> : null}
          </TableCardHeader>
          <TableCardBody>
            {visible.map((s) => (
              <TableCardRow key={s.id} className="hover:bg-slate-50">
                <TableCardCell className="font-medium">{s.rackNumber}</TableCardCell>
                <TableCardCell className="font-mono text-xs">{s.boxNumber}</TableCardCell>
                <TableCardCell className="font-mono text-xs text-slate-600">{s.skuCode}</TableCardCell>
                <TableCardCell>{s.skuProductName}</TableCardCell>
                <TableCardCell className="text-slate-500">{s.brandName ?? "—"}</TableCardCell>
                <TableCardCell className="tabular-nums text-slate-500">{s.quantity}</TableCardCell>
                <TableCardCell>
                  <div className="flex flex-col gap-0.5">
                    <StatusBadge status={s.status} />
                    {s.borrowerName ? (
                      <span className={cn("truncate text-slate-400", UI_ENGINE_TYPE_META)}>
                        {s.borrowerName}
                      </span>
                    ) : null}
                  </div>
                </TableCardCell>
                {canManage ? (
                  <TableCardCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openStatus(s)} title="Change status" className="text-slate-400 hover:text-slate-900">
                        <User className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(s)} title="Edit location" className="text-slate-400 hover:text-slate-900">
                        <Edit3 className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(s)} title="Delete" className="text-slate-400 hover:text-red-500">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCardCell>
                ) : null}
              </TableCardRow>
            ))}
          </TableCardBody>
        </TableCard>
      )}

      {/* ---- Add / edit dialog ---- */}
      <Dialog open={dialog.open} onOpenChange={editGuard.handleOpenChange}>
        <DialogContent
          className={cn(
            "max-h-[90vh] max-w-xl overflow-y-auto border bg-white p-6",
            UI_ENGINE_BORDER_SUBTLE,
            UI_ENGINE_RADIUS_CARD
          )}
        >
          <DialogHeader>
            <DialogTitle className={UI_ENGINE_TYPE_H3}>
              {dialog.mode === "CREATE" ? "Add Sample to Rack" : "Edit Sample Location"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className={UI_ENGINE_TYPE_META}>
                Material {dialog.mode === "CREATE" ? <span className="text-rose-600">*</span> : null}
              </Label>
              {dialog.mode === "CREATE" ? (
                <select
                  value={form.skuId}
                  onChange={(e) => setForm((p) => ({ ...p, skuId: e.target.value }))}
                  className={cn(
                    "border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--ui-border-focus)]",
                    UI_ENGINE_RADIUS_CONTROL
                  )}
                >
                  <option value="">— Select a material —</option>
                  {skuOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.sku} — {o.productName}
                      {o.brandName ? ` (${o.brandName})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <div
                    className={cn(
                      "border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600",
                      UI_ENGINE_RADIUS_CONTROL,
                      UI_ENGINE_TYPE_BODY
                    )}
                  >
                    {dialog.row?.skuCode} — {dialog.row?.skuProductName}
                  </div>
                  <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                    The material cannot be changed. If it was identified incorrectly,
                    delete this row and record it again so the box contents do not change silently.
                  </p>
                </>
              )}
              {selectedSku && dialog.mode === "CREATE" ? (
                <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                  {selectedSku.brandName ?? "Unknown brand"}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className={UI_ENGINE_TYPE_META}>
                Rack <span className="text-rose-600">*</span>
              </Label>
              <Input
                list="rack-options"
                value={form.rackNumber}
                onChange={(e) => setForm((p) => ({ ...p, rackNumber: e.target.value }))}
                placeholder="RAK A"
                className={UI_ENGINE_RADIUS_CONTROL}
              />
              <datalist id="rack-options">
                {rackOptions.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className={UI_ENGINE_TYPE_META}>
                Box <span className="text-rose-600">*</span>
              </Label>
              <Input
                value={form.boxNumber}
                onChange={(e) => setForm((p) => ({ ...p, boxNumber: e.target.value }))}
                placeholder="3"
                className={UI_ENGINE_RADIUS_CONTROL}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className={UI_ENGINE_TYPE_META}>Quantity</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                className={UI_ENGINE_RADIUS_CONTROL}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className={UI_ENGINE_TYPE_META}>Location note</Label>
              <Input
                value={form.locationNote}
                onChange={(e) => setForm((p) => ({ ...p, locationNote: e.target.value }))}
                placeholder="bottom drawer, near the door…"
                className={UI_ENGINE_RADIUS_CONTROL}
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label className={UI_ENGINE_TYPE_META}>Notes</Label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                className={cn(
                  "min-h-[3.5rem] resize-y border border-slate-200 bg-white p-3 outline-none focus:border-[var(--ui-border-focus)]",
                  UI_ENGINE_RADIUS_CONTROL,
                  UI_ENGINE_TYPE_BODY
                )}
              />
            </div>
          </div>

          <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
            Rack and box names are saved in uppercase, so &quot;rack a&quot; and
            &quot;RACK A&quot; do not become separate locations.
          </p>

          <DialogFooter>
            <Button
              onClick={() => void save()}
              disabled={!formValid || saving}
              className={cn(
                "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                UI_ENGINE_RADIUS_ACTION
              )}
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Status dialog ---- */}
      <Dialog open={Boolean(statusDialog)} onOpenChange={statusGuard.handleOpenChange}>
        <DialogContent
          className={cn(
            "max-w-md border bg-white p-6",
            UI_ENGINE_BORDER_SUBTLE,
            UI_ENGINE_RADIUS_CARD
          )}
        >
          <DialogHeader>
            <DialogTitle className={UI_ENGINE_TYPE_H3}>Sample status</DialogTitle>
            <p className={cn("mt-1 text-slate-500", UI_ENGINE_TYPE_META)}>
              {statusDialog?.skuProductName} · {statusDialog?.rackNumber} box{" "}
              {statusDialog?.boxNumber}
            </p>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className={UI_ENGINE_TYPE_META}>Status</Label>
              <div className="flex flex-wrap gap-1">
                {ASSIGNABLE_STATUSES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStatusValue(v)}
                    className={cn(
                      "flex-1 rounded-[var(--ui-radius-control)] border px-3 py-2 font-sans text-xs font-medium transition-colors",
                      statusValue === v
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                    )}
                  >
                    {STATUS_META[v].label}
                  </button>
                ))}
              </div>
            </div>

            {sampleStatusNeedsHolder(statusValue) ? (
              <div className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>
                  Held by <span className="text-rose-600">*</span>
                </Label>
                <Input
                  value={borrower}
                  onChange={(e) => setBorrower(e.target.value)}
                  placeholder="Designer, client, or contractor name"
                  className={cn(
                    UI_ENGINE_RADIUS_CONTROL,
                    statusNeedsBorrower && "border-rose-300 focus:border-rose-400"
                  )}
                />
                <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                  A sample that leaves without a holder name cannot be tracked.
                </p>
              </div>
            ) : statusDialog?.borrowerName ? (
              <p className={cn("text-slate-500", UI_ENGINE_TYPE_META)}>
                Returned by <strong>{statusDialog.borrowerName}</strong>.
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label className={UI_ENGINE_TYPE_META}>Notes</Label>
              <Input
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="optional"
                className={UI_ENGINE_RADIUS_CONTROL}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => void saveStatus()}
              disabled={statusNeedsBorrower || statusSaving}
              className={cn(
                "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                UI_ENGINE_RADIUS_ACTION
              )}
            >
              {statusSaving ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- Delete ---- */}
      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove sample from the rack?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.skuProductName}</strong> in rack{" "}
              {deleteTarget?.rackNumber} box {deleteTarget?.boxNumber} will be removed
              from the list. The material and its price are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doDelete();
              }}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesPrompt guard={editGuard} description="The sample location or notes have not been saved. Discard these changes?" />
      <UnsavedChangesPrompt guard={statusGuard} description="The sample status has not been saved. Discard these changes?" />
    </DashboardPageShell>
  );
}
