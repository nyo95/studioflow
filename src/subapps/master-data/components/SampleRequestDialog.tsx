"use client";

/**
 * MASTER DATA — sample request dialog.
 *
 * Opening a request must not be a one-click "OK". Staff need to see who asked,
 * for which project, and how long it has been waiting — then record the vendor
 * conversation, and later the physical receipt. The dialog is therefore split
 * into three stacked sections rather than a single form:
 *
 *   1. Detail permintaan  — read-only context (designer, project, brand, contacts)
 *   2. Tindak lanjut vendor — the write path for REQUESTED / IN_PROGRESS
 *   3. Terima sample       — the write path that closes the request
 */

import * as React from "react";
import {
  AlertTriangle, Boxes, Building2, CalendarClock, CheckCircle2, ExternalLink,
  Loader2, Mail, Phone, RotateCcw, Send, User,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button, Dialog, DialogContent, DialogHeader, DialogTitle,
  Input, Label,
  UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE,
  UI_ENGINE_RADIUS_ACTION, UI_ENGINE_RADIUS_CARD, UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_TYPE_BODY, UI_ENGINE_TYPE_H3, UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import { cn } from "@/lib/utils";
import { unwrapActionResult } from "@/lib/result";
import { useUnsavedChangesGuard, UnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-guard";
import {
  markRequestUnavailableAction,
  receiveSampleAction,
  recordVendorFollowUpAction,
  reopenSampleRequestAction,
} from "../actions/sample-request-actions";
import { formatDateWithOptions } from "@/core/utilities/datetime";
import type { SampleRequestData } from "../types/sample-request";

const STATUS_META: Record<
  SampleRequestData["status"],
  { label: string; className: string }
> = {
  REQUESTED: { label: "Menunggu", className: "bg-slate-100 text-slate-700" },
  IN_PROGRESS: { label: "Diproses", className: "bg-amber-50 text-amber-700" },
  RECEIVED: { label: "Diterima", className: "bg-emerald-50 text-emerald-700" },
  UNAVAILABLE: { label: "Unavailable", className: "bg-rose-50 text-rose-700" },
};

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return formatDateWithOptions(value, {
    locale: "id-ID",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fmtRupiah(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** Days a request has been open — the number that makes urgency legible. */
function daysWaiting(from: Date | string) {
  const ms = Date.now() - new Date(from).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className={cn("uppercase tracking-wide text-slate-400", UI_ENGINE_TYPE_META)}>
        {label}
      </span>
      <span className={cn("text-slate-950", UI_ENGINE_TYPE_BODY)}>{children ?? "—"}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 font-serif text-sm font-semibold text-slate-950">
      <Icon className="size-4 text-slate-400" />
      {children}
    </h3>
  );
}

export function SampleRequestDialog({
  request,
  open,
  onOpenChange,
  onUpdated,
  canManage,
}: {
  request: SampleRequestData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (updated: SampleRequestData) => void;
  canManage: boolean;
}) {
  // --- vendor follow-up form ---
  const [contactedAt, setContactedAt] = React.useState("");
  const [quotedPrice, setQuotedPrice] = React.useState("");
  const [quotedUnit, setQuotedUnit] = React.useState("");
  const [vendorNotes, setVendorNotes] = React.useState("");
  const [syncPrice, setSyncPrice] = React.useState(true);

  // --- receive form ---
  const [showReceive, setShowReceive] = React.useState(false);
  const [sku, setSku] = React.useState("");
  const [productName, setProductName] = React.useState("");
  const [color, setColor] = React.useState("");
  const [motif, setMotif] = React.useState("");
  const [finishing, setFinishing] = React.useState("");
  const [rack, setRack] = React.useState("");
  const [box, setBox] = React.useState("");
  const [qty, setQty] = React.useState("1");
  const [locationNote, setLocationNote] = React.useState("");

  // --- unavailable ---
  const [showUnavailable, setShowUnavailable] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const [busy, setBusy] = React.useState<null | "followup" | "receive" | "unavailable" | "reopen">(null);

  const guard = useUnsavedChangesGuard({
    open,
    value: { contactedAt, quotedPrice, quotedUnit, vendorNotes, syncPrice, sku, productName, color, motif, finishing, rack, box, qty, locationNote, reason, showReceive, showUnavailable },
    onOpenChange,
  });
  const markPristine = guard.markPristine;

  // Re-seed the forms whenever a different request is opened, so one request's
  // half-typed notes never leak into the next.
  React.useEffect(() => {
    if (!request) return;
    setContactedAt(
      request.vendorContactedAt
        ? new Date(request.vendorContactedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setQuotedPrice(request.vendorQuotedPrice != null ? String(request.vendorQuotedPrice) : "");
    setQuotedUnit(request.vendorQuotedUnit ?? "");
    setVendorNotes(request.vendorNotes ?? "");
    setSyncPrice(true);
    setShowReceive(false);
    setShowUnavailable(false);
    setReason("");
    setSku(request.skuCode ?? "");
    setProductName(request.skuProductName ?? request.itemName ?? "");
    setColor(""); setMotif(""); setFinishing("");
    setRack(""); setBox(""); setQty("1"); setLocationNote("");
    markPristine({
      contactedAt: request.vendorContactedAt
        ? new Date(request.vendorContactedAt).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
      quotedPrice: request.vendorQuotedPrice != null ? String(request.vendorQuotedPrice) : "",
      quotedUnit: request.vendorQuotedUnit ?? "",
      vendorNotes: request.vendorNotes ?? "",
      syncPrice: true,
      sku: request.skuCode ?? "",
      productName: request.skuProductName ?? request.itemName ?? "",
      color: "", motif: "", finishing: "",
      rack: "", box: "", qty: "1", locationNote: "",
      reason: "",
      showReceive: false,
      showUnavailable: false,
    });
  }, [markPristine, request]);

  if (!request) return null;

  const status = STATUS_META[request.status];
  const isOpenRequest = request.status === "REQUESTED" || request.status === "IN_PROGRESS";
  const waiting = daysWaiting(request.requestedAt);

  async function run<T>(
    key: NonNullable<typeof busy>,
    fn: () => Promise<T>,
    successMessage: string
  ) {
    setBusy(key);
    try {
      const result = (await fn()) as unknown as SampleRequestData;
      onUpdated(result);
      toast.success(successMessage);
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const saveFollowUp = () =>
    run(
      "followup",
      async () =>
        unwrapActionResult(
          await recordVendorFollowUpAction({
            requestId: request.id,
            vendorContactedAt: contactedAt || null,
            vendorQuotedPrice: quotedPrice === "" ? null : Number(quotedPrice),
            vendorQuotedUnit: quotedUnit,
            vendorNotes,
            syncToMaterialPrice: syncPrice && quotedPrice !== "",
          })
        ),
      "Tindak lanjut vendor tersimpan"
    );

  const saveReceive = async () => {
    const ok = await run(
      "receive",
      async () =>
        unwrapActionResult(
          await receiveSampleAction({
            requestId: request.id,
            catalogSku: sku,
            catalogProductName: productName,
            catalogColor: color,
            catalogMotif: motif,
            catalogFinishing: finishing,
            rackNumber: rack,
            boxNumber: box,
            quantity: Number(qty) || 1,
            locationNote,
          })
        ),
      "Sample received and shelved"
    );
    if (ok) guard.closeAfterSave();
  };

  const saveUnavailable = async () => {
    const ok = await run(
      "unavailable",
      async () =>
        unwrapActionResult(
          await markRequestUnavailableAction({ requestId: request.id, reason })
        ),
      "Request marked unavailable"
    );
    if (ok) guard.closeAfterSave();
  };

  const doReopen = () =>
    run(
      "reopen",
      async () =>
        unwrapActionResult(await reopenSampleRequestAction({ requestId: request.id })),
      "Request dibuka kembali"
    );

  const receiveValid = Boolean(sku.trim() && productName.trim() && rack.trim() && box.trim());
  const priceWithoutUnit = quotedPrice !== "" && !quotedUnit.trim();

  return (
    <>
    <Dialog open={open} onOpenChange={guard.handleOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[92vh] max-w-3xl overflow-y-auto border bg-white p-6",
          UI_ENGINE_BORDER_SUBTLE,
          UI_ENGINE_RADIUS_CARD
        )}
      >
        <DialogHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className={UI_ENGINE_TYPE_H3}>{request.itemName}</DialogTitle>
              <p className={cn("mt-1 text-slate-500", UI_ENGINE_TYPE_META)}>
                {request.brandName ?? "No brand set"}
                {request.companyName ? ` · ${request.companyName}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-[var(--ui-radius-pill)] px-2.5 py-1 font-sans text-xs font-semibold",
                  status.className
                )}
              >
                {status.label}
              </span>
              {isOpenRequest && (
                <span
                  className={cn(
                    "rounded-[var(--ui-radius-pill)] px-2.5 py-1 font-sans text-xs font-semibold tabular-nums",
                    waiting >= 7 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"
                  )}
                  title="Lama menunggu sejak request dibuat"
                >
                  {waiting} hari
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* ---- 1. Detail permintaan ---- */}
        <section
          className={cn("mb-5 p-4", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CARD)}
        >
          <SectionTitle icon={User}>Detail permintaan</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Diminta oleh">{request.requestedByName}</Field>
            <Field label="Proyek">{request.projectName}</Field>
            <Field label="Tanggal request">{fmtDate(request.requestedAt)}</Field>
            <Field label="Area / lokasi">{request.areaLocation}</Field>
            <Field label="SKU">{request.skuCode}</Field>
            <Field label="Referensi">
              {request.referenceUrl ? (
                <a
                  href={request.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-slate-700 underline underline-offset-2 hover:text-slate-950"
                >
                  Buka link <ExternalLink className="size-3" />
                </a>
              ) : null}
            </Field>
          </div>

          {request.notes ? (
            <div className="mt-4">
              <Field label="Designer note">
                <span className="whitespace-pre-wrap">{request.notes}</span>
              </Field>
            </div>
          ) : null}

          {/* Brand contacts — so staff can call without leaving the page. */}
          {request.brandContacts.length > 0 ? (
            <div className="mt-4 border-t border-[var(--ui-border-subtle)] pt-3">
              <span className={cn("uppercase tracking-wide text-slate-400", UI_ENGINE_TYPE_META)}>
                Contacts brand
              </span>
              <div className="mt-2 flex flex-wrap gap-4">
                {request.brandContacts.map((c, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <span className="font-sans text-sm font-medium text-slate-950">
                      {c.contact_person}
                      {c.contact_role ? (
                        <span className="ml-1 font-normal text-slate-400">· {c.contact_role}</span>
                      ) : null}
                    </span>
                    <span className="flex flex-wrap items-center gap-3 text-slate-500">
                      {c.phone_number ? (
                        <a
                          href={`tel:${c.phone_number}`}
                          className="inline-flex items-center gap-1 text-xs hover:text-slate-950"
                        >
                          <Phone className="size-3" /> {c.phone_number}
                        </a>
                      ) : null}
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1 text-xs hover:text-slate-950"
                        >
                          <Mail className="size-3" /> {c.email}
                        </a>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className={cn("mt-4 text-slate-400", UI_ENGINE_TYPE_META)}>
              Brand ini belum punya kontak tersimpan. Tambahkan di halaman Supplier
              supaya tidak perlu dicari manual lain kali.
            </p>
          )}
        </section>

        {/* ---- Existing follow-up trail (visible in every status) ---- */}
        {request.vendorContactedBy ? (
          <div
            className={cn(
              "mb-5 flex flex-wrap items-center gap-x-6 gap-y-2 border px-4 py-3",
              UI_ENGINE_BORDER_SUBTLE,
              UI_ENGINE_RADIUS_CARD
            )}
          >
            <span className="inline-flex items-center gap-1.5 font-sans text-xs text-slate-500">
              <CalendarClock className="size-3.5 text-slate-400" />
              Dihubungi oleh <strong className="text-slate-950">{request.vendorContactedBy}</strong>
              {" · "}
              {fmtDate(request.vendorContactedAt)}
            </span>
            {request.vendorQuotedPrice != null ? (
              <span className="font-sans text-xs text-slate-500">
                Kutipan:{" "}
                <strong className="tabular-nums text-slate-950">
                  {fmtRupiah(request.vendorQuotedPrice)}
                </strong>
                {request.vendorQuotedUnit ? ` / ${request.vendorQuotedUnit}` : ""}
              </span>
            ) : null}
          </div>
        ) : null}

        {/* ---- 2. Tindak lanjut vendor (open requests only) ---- */}
        {isOpenRequest && canManage ? (
          <section className="mb-5">
            <SectionTitle icon={Send}>Tindak lanjut vendor</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>Tanggal dihubungi</Label>
                <Input
                  type="date"
                  value={contactedAt}
                  onChange={(e) => setContactedAt(e.target.value)}
                  className={UI_ENGINE_RADIUS_CONTROL}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>Quoted price</Label>
                <Input
                  type="number"
                  value={quotedPrice}
                  onChange={(e) => setQuotedPrice(e.target.value)}
                  placeholder="0"
                  className={UI_ENGINE_RADIUS_CONTROL}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>
                  Unit {quotedPrice !== "" ? <span className="text-rose-600">*</span> : null}
                </Label>
                <Input
                  value={quotedUnit}
                  onChange={(e) => setQuotedUnit(e.target.value)}
                  placeholder="m2, pcs, lembar…"
                  className={cn(
                    UI_ENGINE_RADIUS_CONTROL,
                    priceWithoutUnit && "border-rose-300 focus:border-rose-400"
                  )}
                />
              </div>
              <div className="flex items-end pb-1">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={syncPrice}
                    onChange={(e) => setSyncPrice(e.target.checked)}
                    disabled={quotedPrice === ""}
                    className="mt-0.5 size-4 accent-slate-900 disabled:opacity-40"
                  />
                  <span className={cn("leading-tight text-slate-600", UI_ENGINE_TYPE_META)}>
                    Save ke Material Prices
                  </span>
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <Label className={UI_ENGINE_TYPE_META}>Location note</Label>
              <textarea
                value={vendorNotes}
                onChange={(e) => setVendorNotes(e.target.value)}
                placeholder="Lead time, MOQ, stok, syarat pengiriman…"
                className={cn(
                  "min-h-[4rem] resize-y border border-slate-200 bg-white p-3 outline-none focus:border-[var(--ui-border-focus)]",
                  UI_ENGINE_RADIUS_CONTROL,
                  UI_ENGINE_TYPE_BODY
                )}
              />
            </div>

            {priceWithoutUnit ? (
              <p className="mt-2 flex items-center gap-1.5 font-sans text-xs text-rose-600">
                <AlertTriangle className="size-3.5" />
                A unit is required when a price is entered — BQ cannot compute without one.
              </p>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={() => void saveFollowUp()}
                disabled={busy !== null || priceWithoutUnit}
                className={cn(
                  "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                  UI_ENGINE_RADIUS_ACTION
                )}
              >
                {busy === "followup" ? <Loader2 className="size-4 animate-spin" /> : null}
                Save tindak lanjut
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowReceive((v) => !v)}
                disabled={busy !== null}
                className={UI_ENGINE_RADIUS_ACTION}
              >
                <CheckCircle2 className="size-4" /> Sample sudah datang
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowUnavailable((v) => !v)}
                disabled={busy !== null}
                className={cn("text-slate-500 hover:text-rose-600", UI_ENGINE_RADIUS_ACTION)}
              >
                Unavailable
              </Button>
            </div>
          </section>
        ) : null}

        {/* ---- 3. Terima sample ---- */}
        {showReceive && isOpenRequest && canManage ? (
          <section
            className={cn(
              "mb-5 border p-4",
              UI_ENGINE_BORDER_SUBTLE,
              UI_ENGINE_RADIUS_CARD
            )}
          >
            <SectionTitle icon={Boxes}>Terima sample</SectionTitle>
            <p className={cn("mb-4 text-slate-500", UI_ENGINE_TYPE_META)}>
              Mengisi form ini membuat SKU di katalog (kalau belum ada) dan mencatat
              sample fisik di rak. Status request berubah jadi Diterima.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>SKU <span className="text-rose-600">*</span></Label>
                <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="TCO-HPL-MCR-1.2" className={UI_ENGINE_RADIUS_CONTROL} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <Label className={UI_ENGINE_TYPE_META}>Product name <span className="text-rose-600">*</span></Label>
                <Input value={productName} onChange={(e) => setProductName(e.target.value)} className={UI_ENGINE_RADIUS_CONTROL} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>Warna</Label>
                <Input value={color} onChange={(e) => setColor(e.target.value)} className={UI_ENGINE_RADIUS_CONTROL} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>Motif</Label>
                <Input value={motif} onChange={(e) => setMotif(e.target.value)} className={UI_ENGINE_RADIUS_CONTROL} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>Finishing</Label>
                <Input value={finishing} onChange={(e) => setFinishing(e.target.value)} className={UI_ENGINE_RADIUS_CONTROL} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>Rak <span className="text-rose-600">*</span></Label>
                <Input value={rack} onChange={(e) => setRack(e.target.value)} placeholder="A3" className={UI_ENGINE_RADIUS_CONTROL} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>Box <span className="text-rose-600">*</span></Label>
                <Input value={box} onChange={(e) => setBox(e.target.value)} placeholder="12" className={UI_ENGINE_RADIUS_CONTROL} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>Jumlah</Label>
                <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} className={UI_ENGINE_RADIUS_CONTROL} />
              </div>
              <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-3">
                <Label className={UI_ENGINE_TYPE_META}>Location note</Label>
                <Input value={locationNote} onChange={(e) => setLocationNote(e.target.value)} placeholder="e.g. laci bawah, dekat pintu" className={UI_ENGINE_RADIUS_CONTROL} />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                onClick={() => void saveReceive()}
                disabled={!receiveValid || busy !== null}
                className={cn(
                  "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                  UI_ENGINE_RADIUS_ACTION
                )}
              >
                {busy === "receive" ? <Loader2 className="size-4 animate-spin" /> : null}
                Catat sample diterima
              </Button>
              <Button variant="ghost" onClick={() => setShowReceive(false)} className={UI_ENGINE_RADIUS_ACTION}>
                Cancel
              </Button>
            </div>
          </section>
        ) : null}

        {/* ---- Unavailable ---- */}
        {showUnavailable && isOpenRequest && canManage ? (
          <section
            className={cn("mb-5 border border-rose-200 bg-rose-50/40 p-4", UI_ENGINE_RADIUS_CARD)}
          >
            <SectionTitle icon={AlertTriangle}>Mark unavailable</SectionTitle>
            <div className="flex flex-col gap-1.5">
              <Label className={UI_ENGINE_TYPE_META}>
                Alasan <span className="text-rose-600">*</span>
              </Label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Discontinued, stok kosong sampai Q4, MOQ terlalu besar…"
                className={cn(
                  "min-h-[3.5rem] resize-y border border-rose-200 bg-white p-3 outline-none focus:border-rose-400",
                  UI_ENGINE_RADIUS_CONTROL,
                  UI_ENGINE_TYPE_BODY
                )}
              />
              <p className={cn("text-slate-500", UI_ENGINE_TYPE_META)}>
                Alasan ini terbaca desainer di StudioFlow — tanpa itu request yang
                sama akan diajukan lagi.
              </p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => void saveUnavailable()}
                disabled={!reason.trim() || busy !== null}
                className={cn("bg-rose-600 text-white hover:bg-rose-700", UI_ENGINE_RADIUS_ACTION)}
              >
                {busy === "unavailable" ? <Loader2 className="size-4 animate-spin" /> : null}
                Mark unavailable
              </Button>
              <Button variant="ghost" onClick={() => setShowUnavailable(false)} className={UI_ENGINE_RADIUS_ACTION}>
                Cancel
              </Button>
            </div>
          </section>
        ) : null}

        {/* ---- Closed request: reopen ---- */}
        {!isOpenRequest && canManage ? (
          <div className="flex items-center justify-between gap-4 border-t border-[var(--ui-border-subtle)] pt-4">
            <p className={cn("text-slate-500", UI_ENGINE_TYPE_META)}>
              {request.status === "RECEIVED"
                ? "The sample has been received and shelved. Reopening does not delete the SKU or the physical sample."
                : "Request closed as unavailable."}
            </p>
            <Button
              variant="outline"
              onClick={() => void doReopen()}
              disabled={busy !== null}
              className={UI_ENGINE_RADIUS_ACTION}
            >
              {busy === "reopen" ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
              Buka kembali
            </Button>
          </div>
        ) : null}

        {!canManage ? (
          <p className={cn("border-t border-[var(--ui-border-subtle)] pt-4 text-slate-400", UI_ENGINE_TYPE_META)}>
            <Building2 className="mr-1 inline size-3.5" />
            Kamu bisa melihat request ini tapi tidak bisa memprosesnya.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
    <UnsavedChangesPrompt guard={guard} description="Changes in this form have not been saved. Discard them?" />
    </>
  );
}
