"use client";

/**
 * BQ — tampilan breakdown tiga lapis.
 *
 * ============================================================================
 * PRINSIP TAMPILAN (PRD Bab 6)
 * ============================================================================
 * *"Tertutup = pandangan klien, terbuka = pandangan estimator."* Satu layar
 * melayani keduanya tanpa pindah halaman. L1 tertutup menampilkan persis satu
 * baris BQ: nama, qty, unit, rate, total.
 *
 * Requirement yang ditegakkan di berkas ini:
 *   FR-EXP-01  L1 default tertutup, ringkasannya adalah satu baris BQ.
 *   FR-EXP-02  Expand L1 -> daftar L2 + qty pengali + subtotal. L2 tertutup.
 *   FR-EXP-03  Expand L2 -> baris L3, bahan dulu lalu jasa.
 *   FR-EXP-04  Expand All / Collapse All per object.
 *   FR-EXP-05  Status buka-tutup diingat per pengguna per object selama sesi.
 *   FR-EXP-06  Ubah angka L3 -> subtotal, rate, grand total ikut, tanpa reload.
 *   FR-EXP-07  Kedalaman ditandai indentasi + garis penghubung + warna.
 *   FR-EXP-08  L1 tertutup tetap menampilkan jumlah sub-object dan baris.
 *
 * ============================================================================
 * KOMPONEN INI TIDAK MENGHITUNG APA PUN
 * ============================================================================
 * Seluruh angka datang jadi dari `view.totals` / `view.objects[].computed`,
 * yang dihitung `lib/calc.ts` di server. Kalau suatu saat ada `reduce` yang
 * menjumlahkan biaya di berkas ini, ia jadi sumber kebenaran kedua — dan
 * selisih semacam itu selalu ketahuan belakangan, di kertas penawaran.
 *
 * FR-EXP-05 memakai `sessionStorage`… TIDAK. Ia memakai state React biasa,
 * yang hidup selama komponen ini mounted. "Selama sesi" di PRD berarti selama
 * estimator bekerja di halaman itu, dan state React sudah menjawabnya tanpa
 * menyimpan apa pun di browser.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Hammer,
  Lock,
  LockOpen,
  Package,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Input,
  PageHeader,
  SectionCard,
  SpreadsheetTemplate,
  StatusBadge,
  UI_ENGINE_RADIUS_CONTROL,
} from "@/ui_engine";
import { UI_ENGINE_TYPE_META } from "@/ui_engine/tokens";
import { statusToTone } from "@/lib/ui/status-tone";
import { cn } from "@/lib/utils";
import { formatIdr, formatPct, formatQty, type WasteSource } from "../lib/calc";
import {
  addBqMaterialLineAction,
  addBqLocalMaterialLineAction,
  addBqServiceLineAction,
  addBqLocalServiceLineAction,
  createBqObjectAction,
  createBqSubObjectAction,
  deleteBqMaterialLineAction,
  deleteBqObjectAction,
  deleteBqServiceLineAction,
  deleteBqSubObjectAction,
  setBqObjectLockAction,
  updateBqMaterialLineAction,
  updateBqObjectAction,
  updateBqServiceLineAction,
  updateBqSubObjectAction,
} from "../actions/bq-project-actions";
import { saveSubObjectToLibraryAndLinkAction } from "../actions/bq-library-actions";
import { BqLinePicker, LibraryPickerDialog } from "./BqLinePicker";
import { BqPurchaseSummary } from "./BqPurchaseSummary";
import type { BqObjectView, BqProjectView } from "../types/breakdown";

// ---------------------------------------------------------------------------
// Bantu
// ---------------------------------------------------------------------------

type ActionResultLike = { success: boolean; error?: string };

/** Setiap mutasi lewat sini. Mutasi dikirim ke server tanpa memblokir UI;
 *  `router.refresh()` dijadwalkan di belakang untuk reconciliation. PRD rule
 *  #5 aman — server tetap SSOT, dan angka yang muncul di layar sesudah
 *  `router.refresh()` adalah angka server, bukan angka klien. */
function useMutate() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const run = React.useCallback(
    async (fn: () => Promise<ActionResultLike>, successMessage?: string) => {
      setPending(true);
      const result = await fn();
      setPending(false);

      if (!result.success) {
        toast.error(result.error ?? "That change could not be saved.");
        return false;
      }
      if (successMessage) toast.success(successMessage);
      // Fire-and-forget: router.refresh() berjalan di belakang, UI tidak
      // menunggu. React akan men-reconcile RSC payload saat datang.
      void router.refresh();
      return true;
    },
    [router],
  );

  return { run, pending };
}

/** Sumber angka waste, dijelaskan. Estimator yang melihat "10%" berhak tahu
 *  dari mana ia datang — PRD §4.1 menyusun presedensinya justru supaya tidak
 *  ada angka yang asalnya tidak bisa dijelaskan. */
const WASTE_SOURCE_LABEL: Record<WasteSource, string> = {
  LINE_OVERRIDE: "line override",
  OBJECT_OVERRIDE: "object override",
  MATERIAL_DEFAULT: "material default",
  CATEGORY_DEFAULT: "category default",
  ZERO_FALLBACK: "no default set",
};

/** Input angka yang hanya menyimpan saat blur atau Enter. Menyimpan tiap
 *  ketikan akan mengirim satu mutasi per karakter dan membuat kursor melompat
 *  setiap `router.refresh()`. */
function NumberCell({
  value,
  onCommit,
  disabled,
  className,
  suffix,
  placeholder,
}: {
  value: number | null;
  onCommit: (next: number | null) => void;
  disabled?: boolean;
  className?: string;
  suffix?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState(value === null ? "" : String(value));

  React.useEffect(() => {
    setDraft(value === null ? "" : String(value));
  }, [value]);

  const commit = React.useCallback(() => {
    const trimmed = draft.trim();
    // Kosong berarti NULL, bukan nol. Ini bukan kelonggaran input — ia aturan
    // domain: 0 eksplisit MENANG atas default di bawahnya, kosong tidak
    // (PRD §4.1, AT-04).
    if (trimmed === "") {
      if (value !== null) onCommit(null);
      return;
    }
    const parsed = Number(trimmed.replace(",", "."));
    if (Number.isNaN(parsed)) {
      setDraft(value === null ? "" : String(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  }, [draft, value, onCommit]);

  return (
    <span className="inline-flex items-center gap-1">
      <Input
        value={draft}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") setDraft(value === null ? "" : String(value));
        }}
        className={cn("h-7 w-20 px-2 text-right font-sans text-xs", className)}
        inputMode="decimal"
      />
      {suffix ? (
        <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

function TextCell({
  value,
  onCommit,
  disabled,
  className,
  placeholder,
}: {
  value: string;
  onCommit: (next: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    else if (!next) setDraft(value);
  };
  return (
    <Input
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      className={cn("h-7 text-xs", className)}
    />
  );
}

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------

export function BqBreakdownClient({
  view,
  canEdit,
  canEditMarkup,
}: {
  view: BqProjectView;
  canEdit: boolean;
  canEditMarkup: boolean;
}) {
  const { run, pending } = useMutate();

  // FR-EXP-01 / FR-EXP-02: keduanya default TERTUTUP, jadi state menyimpan
  // yang TERBUKA. Menyimpan yang tertutup akan membuat object baru muncul
  // dalam keadaan terbuka, dan "default tertutup" berhenti berlaku persis
  // saat estimator paling butuh pandangan klien.
  const [openObjects, setOpenObjects] = React.useState<Set<string>>(new Set());
  const [openSubObjects, setOpenSubObjects] = React.useState<Set<string>>(
    new Set(),
  );
  const [newObjectName, setNewObjectName] = React.useState("");

  const toggle = React.useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );

  /** FR-EXP-04 — per object, bukan global. Expand All global pada project
   *  berisi 30 object menghasilkan ratusan baris sekaligus, dan tidak ada
   *  requirement yang memintanya. */
  const expandObject = React.useCallback(
    (object: BqObjectView, expand: boolean) => {
      const subIds = object.subObjects.map((s) => s.id);
      setOpenObjects((prev) => {
        const next = new Set(prev);
        if (expand) next.add(object.computed.objectId);
        else next.delete(object.computed.objectId);
        return next;
      });
      setOpenSubObjects((prev) => {
        const next = new Set(prev);
        for (const id of subIds) {
          if (expand) next.add(id);
          else next.delete(id);
        }
        return next;
      });
    },
    [],
  );

  const handleAddObject = React.useCallback(async () => {
    if (!newObjectName.trim()) {
      toast.error("Object name is required.");
      return;
    }
    const ok = await run(
      () =>
        createBqObjectAction({
          projectId: view.project.id,
          name: newObjectName,
        }),
      "Object added.",
    );
    if (ok) setNewObjectName("");
  }, [newObjectName, run, view.project.id]);

  return (
    <SpreadsheetTemplate
      header={
        <PageHeader
          eyebrow={view.project.code ? `BQ · ${view.project.code}` : "BQ"}
          title={view.project.name}
          description="Closed rows read like a client BQ. Open them to see how each rate was reached."
          meta={
            <>
              <StatusBadge
                status={view.project.status}
                tone={statusToTone(view.project.status)}
              />
              <span className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}>
                {view.objects.length}{" "}
                {view.objects.length === 1 ? "object" : "objects"}
              </span>
            </>
          }
        />
      }
      grid={
        <>
          {/* ------------------------------------------------------------------ */}
          {/* Grand total — pandangan klien                                      */}
          {/* ------------------------------------------------------------------ */}
          <SectionCard className="mb-4" padding="md">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
                  Grand total
                </p>
                <p className="font-serif text-3xl font-semibold text-slate-900">
                  {formatIdr(view.totals.grandTotal)}
                </p>
              </div>
              {/* Biaya pokok dan markup TIDAK PERNAH tercetak ke klien (PRD §3.4)
                  — ia muncul di sini karena layar ini internal, dan disembunyikan
                  dari siapa pun yang tidak memegang izin markup. */}
              {canEditMarkup ? (
                <div className="flex gap-6">
                  <div>
                    <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
                      Base cost
                    </p>
                    <p className="font-sans text-sm font-medium text-slate-700">
                      {formatIdr(view.totals.baseCost)}
                    </p>
                  </div>
                  <div>
                    <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
                      Markup
                    </p>
                    <p className="font-sans text-sm font-medium text-slate-700">
                      {formatIdr(view.totals.markupAmount)}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>

          {/* ------------------------------------------------------------------ */}
          {/* L1                                                                  */}
          {/* ------------------------------------------------------------------ */}
          <div className="space-y-3">
            {view.objects.map((object) => (
              <ObjectRow
                key={object.computed.objectId}
                object={object}
                isOpen={openObjects.has(object.computed.objectId)}
                openSubObjects={openSubObjects}
                onToggle={() =>
                  toggle(setOpenObjects, object.computed.objectId)
                }
                onToggleSub={(id) => toggle(setOpenSubObjects, id)}
                onExpandAll={(expand) => expandObject(object, expand)}
                canEdit={canEdit}
                canEditMarkup={canEditMarkup}
                run={run}
                pending={pending}
              />
            ))}
          </div>

          {canEdit ? (
            <div className="mt-4 flex items-center gap-2">
              <Input
                value={newObjectName}
                onChange={(e) => setNewObjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleAddObject();
                  }
                }}
                placeholder="New object — e.g. Counter Cabinet CC-1"
                className="max-w-sm"
              />
              <Button
                variant="outline"
                onClick={handleAddObject}
                disabled={pending}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add object
              </Button>
            </div>
          ) : null}
        </>
      }
      summary={
        <div className="mt-8">
          <BqPurchaseSummary summary={view.purchase} />
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// L1
// ---------------------------------------------------------------------------

function ObjectRow({
  object,
  isOpen,
  openSubObjects,
  onToggle,
  onToggleSub,
  onExpandAll,
  canEdit,
  canEditMarkup,
  run,
  pending,
}: {
  object: BqObjectView;
  isOpen: boolean;
  openSubObjects: Set<string>;
  onToggle: () => void;
  onToggleSub: (id: string) => void;
  onExpandAll: (expand: boolean) => void;
  canEdit: boolean;
  canEditMarkup: boolean;
  run: (fn: () => Promise<ActionResultLike>, msg?: string) => Promise<boolean>;
  pending: boolean;
}) {
  const c = object.computed;
  const locked = object.lockedAt !== null;
  const editable = canEdit && !locked;
  const [newSubName, setNewSubName] = React.useState("");

  return (
    <div
      className={cn(
        "border border-slate-200 bg-white",
        UI_ENGINE_RADIUS_CONTROL,
      )}
    >
      {/* ---- FR-EXP-01: baris tertutup = satu baris BQ ------------------- */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {c.code ? (
                <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
                  {c.code}
                </span>
              ) : null}
              <span className="truncate font-sans text-sm font-medium text-slate-900">
                {c.name}
              </span>
              {locked ? (
                <Lock className="h-3 w-3 shrink-0 text-slate-400" />
              ) : null}
            </div>
            {/* FR-EXP-08 — tertutup pun tetap tahu isinya. */}
            <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
              {c.subObjectCount} sub-objects · {c.lineCount} lines
            </p>
          </div>
        </button>

        <div className="flex items-center gap-6 text-right">
          <div>
            <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>Qty</p>
            <p className="font-sans text-sm text-slate-700">
              {formatQty(c.qty)} {c.unit}
            </p>
          </div>
          <div>
            <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
              Rate / unit
            </p>
            <p className="font-sans text-sm font-medium text-slate-900">
              {formatIdr(c.ratePerUnit)}
            </p>
          </div>
          <div className="min-w-[7rem]">
            <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>Total</p>
            <p className="font-serif text-base font-semibold text-slate-900">
              {formatIdr(c.total)}
            </p>
          </div>
        </div>
      </div>

      {/* ---- Terbuka: pandangan estimator -------------------------------- */}
      {isOpen ? (
        <div className="border-t border-slate-100">
          {/* Kontrol object */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-slate-50/60 px-4 py-2.5">
            <label className="flex items-center gap-2">
              <span className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}>
                Qty
              </span>
              <NumberCell
                value={c.qty}
                disabled={!editable || pending}
                onCommit={(next) =>
                  next !== null &&
                  next > 0 &&
                  void run(() =>
                    updateBqObjectAction({ id: c.objectId, qty: next }),
                  )
                }
              />
            </label>

            {canEditMarkup ? (
              <label className="flex items-center gap-2">
                <span className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}>
                  Markup
                </span>
                <NumberCell
                  value={c.markupPct * 100}
                  suffix="%"
                  disabled={!editable || pending}
                  onCommit={(next) =>
                    next !== null &&
                    void run(() =>
                      updateBqObjectAction({ id: c.objectId, markupPct: next }),
                    )
                  }
                />
              </label>
            ) : null}

            <label className="flex items-center gap-2">
              <span className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}>
                Waste override
              </span>
              <NumberCell
                value={
                  object.wasteOverridePct === null
                    ? null
                    : object.wasteOverridePct * 100
                }
                suffix="%"
                placeholder="—"
                disabled={!editable || pending}
                onCommit={(next) =>
                  void run(() =>
                    updateBqObjectAction({
                      id: c.objectId,
                      wasteOverridePct: next,
                    }),
                  )
                }
              />
            </label>

            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => onExpandAll(true)}
              >
                Expand all
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => onExpandAll(false)}
              >
                Collapse all
              </Button>
              {canEdit ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      () =>
                        setBqObjectLockAction({
                          id: c.objectId,
                          locked: !locked,
                        }),
                      locked ? "Object unlocked." : "Object locked.",
                    )
                  }
                >
                  {locked ? (
                    <LockOpen className="h-3.5 w-3.5" />
                  ) : (
                    <Lock className="h-3.5 w-3.5" />
                  )}
                </Button>
              ) : null}
              {editable ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-red-600 hover:text-red-700"
                  disabled={pending}
                  onClick={() =>
                    void run(
                      () => deleteBqObjectAction({ id: c.objectId }),
                      "Object removed.",
                    )
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>

          {/* ---- FR-EXP-02: L2 -------------------------------------------- */}
          <div className="divide-y divide-slate-100">
            {object.subObjects.map((sub) => {
              const computedSub = c.subObjects.find(
                (s) => s.subObjectId === sub.id,
              );
              if (!computedSub) return null;
              return (
                <SubObjectRow
                  key={sub.id}
                  sub={sub}
                  computed={computedSub}
                  isOpen={openSubObjects.has(sub.id)}
                  onToggle={() => onToggleSub(sub.id)}
                  editable={editable}
                  pending={pending}
                  run={run}
                />
              );
            })}
          </div>

          {editable ? (
            <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-2.5">
              <Input
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newSubName.trim()) {
                    e.preventDefault();
                    void run(
                      () =>
                        createBqSubObjectAction({
                          objectId: c.objectId,
                          name: newSubName,
                        }),
                      "Sub-object added.",
                    ).then((ok) => ok && setNewSubName(""));
                  }
                }}
                placeholder="New sub-object — e.g. Ambalan"
                className="h-8 max-w-xs text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                disabled={pending || !newSubName.trim()}
                onClick={() =>
                  void run(
                    () =>
                      createBqSubObjectAction({
                        objectId: c.objectId,
                        name: newSubName,
                      }),
                    "Sub-object added.",
                  ).then((ok) => ok && setNewSubName(""))
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add sub-object
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// L2
// ---------------------------------------------------------------------------

function SubObjectRow({
  sub,
  computed,
  isOpen,
  onToggle,
  editable,
  pending,
  run,
}: {
  sub: BqObjectView["subObjects"][number];
  computed: NonNullable<BqObjectView["computed"]["subObjects"][number]>;
  isOpen: boolean;
  onToggle: () => void;
  editable: boolean;
  pending: boolean;
  run: (fn: () => Promise<ActionResultLike>, msg?: string) => Promise<boolean>;
}) {
  const isLinked = sub.librarySubObjectId !== null;
  const [showLibraryPicker, setShowLibraryPicker] = React.useState(false);
  const [showSaveToLib, setShowSaveToLib] = React.useState(false);
  const [libName, setLibName] = React.useState(sub.name);

  return (
    // FR-EXP-07: kedalaman ditandai indentasi + garis kiri + warna latar.
    <div className="pl-6">
      <div className="flex flex-wrap items-center gap-3 border-l-2 border-slate-200 py-2 pl-4 pr-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          )}
          {/* R2 — ⧉ indicates linked instance, ◇ indicates standalone */}
          <span
            className={cn(
              UI_ENGINE_TYPE_META,
              "shrink-0",
              isLinked ? "text-indigo-500" : "text-slate-300",
            )}
            title={
              isLinked
                ? `Linked to library template`
                : "Standalone — not linked to library"
            }
          >
            {isLinked ? "⧉" : "◇"}
          </span>
          <span className="truncate font-sans text-sm text-slate-800">
            {sub.name}
          </span>
          <span className={cn(UI_ENGINE_TYPE_META, "shrink-0 text-slate-400")}>
            {computed.lineCount} {computed.lineCount === 1 ? "line" : "lines"}
          </span>
        </button>

        {/* R6 — Library load button at L2 level */}
        {editable ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-slate-500"
            disabled={pending}
            title="Load from library"
            onClick={() => setShowLibraryPicker(true)}
          >
            <BookOpen className="h-3.5 w-3.5" />
          </Button>
        ) : null}

        {/* R3 — Save to Library (only for standalone ◇ sub-objects) */}
        {editable && !isLinked ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-slate-500"
            disabled={pending}
            title="Save to library and link (⧉)"
            onClick={() => {
              setLibName(sub.name);
              setShowSaveToLib(true);
            }}
          >
            <span className={cn(UI_ENGINE_TYPE_META)}>+⧉</span>
          </Button>
        ) : null}

        {/* Pengali L2 — kolom yang membuat alat ini lebih cepat dari Excel
            (PRD §2.1). Ubah dari 3 ke 5 dan seluruh angka di atasnya ikut,
            tanpa satu pun bahan diketik ulang. */}
        <label className="flex items-center gap-1.5">
          <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>×</span>
          <NumberCell
            value={sub.qty}
            disabled={!editable || pending}
            className="w-16"
            onCommit={(next) =>
              next !== null &&
              next > 0 &&
              void run(() => updateBqSubObjectAction({ id: sub.id, qty: next }))
            }
          />
        </label>

        <div className="min-w-[7rem] text-right">
          <p className="font-sans text-sm font-medium text-slate-800">
            {formatIdr(computed.subtotal)}
          </p>
        </div>

        {editable ? (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-red-600 hover:text-red-700"
            disabled={pending}
            onClick={() =>
              void run(
                () => deleteBqSubObjectAction({ id: sub.id }),
                "Sub-object removed.",
              )
            }
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      {/* R3 — inline "save to library" form */}
      {showSaveToLib ? (
        <div className="ml-4 flex items-center gap-2 border-l-2 border-indigo-100 py-2 pl-4">
          <span className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}>
            Save as:
          </span>
          <Input
            value={libName}
            onChange={(e) => setLibName(e.target.value)}
            className="h-7 max-w-xs text-xs"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Escape") setShowSaveToLib(false);
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={!libName.trim() || pending}
            onClick={() =>
              void run(
                () =>
                  saveSubObjectToLibraryAndLinkAction({
                    subObjectId: sub.id,
                    name: libName.trim(),
                  }),
                "Saved to library and linked ⧉",
              ).then((ok) => ok && setShowSaveToLib(false))
            }
          >
            Save ⧉
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7"
            onClick={() => setShowSaveToLib(false)}
          >
            Cancel
          </Button>
        </div>
      ) : null}

      {/* R6 — Library picker dialog rendered at L2 level */}
      {showLibraryPicker ? (
        <LibraryPickerDialog
          key={`lib-${sub.id}`}
          subObjectId={sub.id}
          onClose={() => setShowLibraryPicker(false)}
        />
      ) : null}

      {/* ---- FR-EXP-03: L3, bahan dulu lalu jasa ------------------------- */}
      {isOpen ? (
        <div className="ml-4 border-l-2 border-slate-100 pb-3 pl-4">
          <LineTable
            sub={sub}
            computed={computed}
            editable={editable}
            pending={pending}
            run={run}
          />
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// L3
// ---------------------------------------------------------------------------

function LineTable({
  sub,
  computed,
  editable,
  pending,
  run,
}: {
  sub: BqObjectView["subObjects"][number];
  computed: NonNullable<BqObjectView["computed"]["subObjects"][number]>;
  editable: boolean;
  pending: boolean;
  run: (fn: () => Promise<ActionResultLike>, msg?: string) => Promise<boolean>;
}) {
  return (
    <div className="space-y-3 pt-1">
      {/* --- Bahan ----------------------------------------------------- */}
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Package className="h-3 w-3 text-slate-400" />
          <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
            Materials
          </span>
        </div>

        {computed.materials.length === 0 ? (
          <p className={cn(UI_ENGINE_TYPE_META, "py-1 text-slate-400")}>
            None yet.
          </p>
        ) : (
          <table className="w-full">
            {/* R5 — column headers for BQ table (Indonesian convention) */}
            <thead>
              <tr className="border-b border-slate-100">
                <th
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    "py-1 pr-3 text-left font-normal text-slate-400",
                  )}
                >
                  Uraian Pekerjaan
                </th>
                <th
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    "py-1 pr-2 text-right font-normal text-slate-400",
                  )}
                >
                  Vol · Koef
                </th>
                <th
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    "py-1 pr-2 text-right font-normal text-slate-400",
                  )}
                >
                  Susut
                </th>
                <th
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    "py-1 pr-2 text-right font-normal text-slate-400",
                  )}
                >
                  Susut line
                </th>
                <th
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    "py-1 pr-3 text-right font-normal text-slate-400",
                  )}
                >
                  Harga Satuan
                </th>
                <th
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    "py-1 text-right font-normal text-slate-400",
                  )}
                >
                  Jumlah
                </th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {computed.materials.map((line) => {
                const record = sub.materials.find((m) => m.id === line.lineId);
                if (!record) return null;
                return (
                  <tr
                    key={line.lineId}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-1.5 pr-3">
                      <TextCell
                        value={line.name}
                        disabled={!editable || pending}
                        onCommit={(name) =>
                          void run(() =>
                            updateBqMaterialLineAction({
                              id: line.lineId,
                              name,
                            }),
                          )
                        }
                        className="min-w-32"
                      />
                      <span
                        className={cn(
                          UI_ENGINE_TYPE_META,
                          "ml-2 text-slate-400",
                        )}
                      >
                        {record.source === "PROJECT_LOCAL" ? "Local" : "Master"}
                      </span>
                      {/* R4 — † badge for manually overridden snapshot price */}
                      {record.isManualOverride ? (
                        <span
                          className={cn(
                            UI_ENGINE_TYPE_META,
                            "ml-1 text-amber-600",
                          )}
                          title={
                            record.overrideNote ?? "Price edited inside BQ"
                          }
                        >
                          †
                        </span>
                      ) : null}
                      {record.brandName ? (
                        <span
                          className={cn(
                            UI_ENGINE_TYPE_META,
                            "ml-2 text-slate-400",
                          )}
                        >
                          {record.brandName}
                        </span>
                      ) : null}
                    </td>

                    <td className="py-1.5 pr-2 text-right">
                      <NumberCell
                        value={line.qtyPerSub}
                        suffix={line.usageUnit ?? undefined}
                        disabled={!editable || pending}
                        className="w-16"
                        onCommit={(next) =>
                          next !== null &&
                          void run(() =>
                            updateBqMaterialLineAction({
                              id: line.lineId,
                              qtyPerSub: next,
                            }),
                          )
                        }
                      />
                    </td>

                    {/* Waste: nilai + dari mana ia datang. Presedensi §4.1
                        disusun justru supaya angka ini bisa dijelaskan. */}
                    <td className="py-1.5 pr-2 text-right">
                      <span
                        className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}
                        title={WASTE_SOURCE_LABEL[line.wasteSource]}
                      >
                        {`+${formatPct(line.wastePct)}`}
                      </span>
                    </td>

                    <td className="py-1.5 pr-2 text-right">
                      <NumberCell
                        value={
                          record.wasteOverridePct === null
                            ? null
                            : record.wasteOverridePct * 100
                        }
                        suffix="%"
                        placeholder="—"
                        disabled={!editable || pending}
                        className="w-14"
                        onCommit={(next) =>
                          void run(() =>
                            updateBqMaterialLineAction({
                              id: line.lineId,
                              wasteOverridePct: next,
                            }),
                          )
                        }
                      />
                    </td>

                    {/* R4 — editable price per usage unit */}
                    <td className="py-1.5 pr-3 text-right">
                      <span
                        className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}
                      >
                        {formatQty(line.grossTotal)}
                        {line.usageUnit ? ` ${line.usageUnit}` : ""} @{" "}
                      </span>
                      <NumberCell
                        value={
                          line.pricePerUsageUnit * (record.conversion ?? 1)
                        }
                        disabled={!editable || pending}
                        className="w-24"
                        onCommit={(next) =>
                          next !== null &&
                          next >= 0 &&
                          void run(() =>
                            updateBqMaterialLineAction({
                              id: line.lineId,
                              price: next,
                            }),
                          )
                        }
                      />
                    </td>

                    <td className="py-1.5 text-right font-sans text-xs text-slate-800">
                      {formatIdr(line.cost)}
                    </td>

                    {editable ? (
                      <td className="w-8 py-1.5 text-right">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            void run(() =>
                              deleteBqMaterialLineAction({ id: line.lineId }),
                            )
                          }
                          className="text-slate-300 transition-colors hover:text-red-600"
                          aria-label={`Remove ${line.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* --- Jasa ------------------------------------------------------ */}
      <div>
        <div className="mb-1 flex items-center gap-1.5">
          <Hammer className="h-3 w-3 text-slate-400" />
          <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
            Services
          </span>
        </div>

        {computed.services.length === 0 ? (
          <p className={cn(UI_ENGINE_TYPE_META, "py-1 text-slate-400")}>
            None yet.
          </p>
        ) : (
          <table className="w-full">
            {/* R5 — column headers */}
            <thead>
              <tr className="border-b border-slate-100">
                <th
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    "py-1 pr-3 text-left font-normal text-slate-400",
                  )}
                >
                  Uraian Pekerjaan
                </th>
                <th
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    "py-1 pr-2 text-right font-normal text-slate-400",
                  )}
                >
                  Vol · Koef
                </th>
                <th className="py-1 pr-2" colSpan={2} />
                <th
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    "py-1 pr-3 text-right font-normal text-slate-400",
                  )}
                >
                  Harga Satuan
                </th>
                <th
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    "py-1 text-right font-normal text-slate-400",
                  )}
                >
                  Jumlah
                </th>
                {editable ? <th /> : null}
              </tr>
            </thead>
            <tbody>
              {computed.services.map((line) => {
                const record = sub.services.find((s) => s.id === line.lineId);
                return (
                  <tr
                    key={line.lineId}
                    className="border-b border-slate-50 last:border-0"
                  >
                    <td className="py-1.5 pr-3">
                      <TextCell
                        value={line.name}
                        disabled={!editable || pending}
                        onCommit={(name) =>
                          void run(() =>
                            updateBqServiceLineAction({
                              id: line.lineId,
                              name,
                            }),
                          )
                        }
                        className="min-w-32"
                      />
                      <span
                        className={cn(
                          UI_ENGINE_TYPE_META,
                          "ml-2 text-slate-400",
                        )}
                      >
                        {record?.source === "PROJECT_LOCAL"
                          ? "Local"
                          : "Master"}
                      </span>
                      {record?.hasMaterial ? (
                        <span
                          className={cn(
                            UI_ENGINE_TYPE_META,
                            "ml-2 text-slate-400",
                          )}
                          title="Supply and install — the rate already includes material"
                        >
                          incl. material
                        </span>
                      ) : null}
                      {record?.scopeNote ? (
                        <span
                          className={cn(
                            UI_ENGINE_TYPE_META,
                            "ml-2 truncate text-slate-400",
                          )}
                          title={record.scopeNote}
                        >
                          {record.scopeNote}
                        </span>
                      ) : null}
                    </td>

                    <td className="py-1.5 pr-2 text-right">
                      <NumberCell
                        value={line.qtyPerSub}
                        suffix={line.rateUnit}
                        disabled={!editable || pending}
                        className="w-16"
                        onCommit={(next) =>
                          next !== null &&
                          void run(() =>
                            updateBqServiceLineAction({
                              id: line.lineId,
                              qtyPerSub: next,
                            }),
                          )
                        }
                      />
                    </td>

                    {/* Kolom waste sengaja kosong untuk jasa — bukan diisi
                        "0%". Baris jasa memang TIDAK punya waste (PRD §3.2),
                        dan menampilkan 0% menyiratkan angka yang bisa diubah. */}
                    <td className="py-1.5 pr-2" />
                    <td className="py-1.5 pr-2" />

                    <td className="py-1.5 pr-3 text-right">
                      <span
                        className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}
                      >
                        {formatQty(line.qtyTotal)} {line.rateUnit} @{" "}
                      </span>
                      <NumberCell
                        value={line.pricePerRateUnit}
                        disabled={!editable || pending}
                        className="w-24"
                        onCommit={(next) =>
                          next !== null &&
                          next >= 0 &&
                          void run(() =>
                            updateBqServiceLineAction({
                              id: line.lineId,
                              price: next,
                            }),
                          )
                        }
                      />
                    </td>

                    <td className="py-1.5 text-right font-sans text-xs text-slate-800">
                      {formatIdr(line.cost)}
                    </td>

                    {editable ? (
                      <td className="w-8 py-1.5 text-right">
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() =>
                            void run(() =>
                              deleteBqServiceLineAction({ id: line.lineId }),
                            )
                          }
                          className="text-slate-300 transition-colors hover:text-red-600"
                          aria-label={`Remove ${line.name}`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editable ? (
        <BqLinePicker
          subObjectId={sub.id}
          onAddMaterial={({ skuId, skuPriceId, qtyPerSub }) =>
            run(
              () =>
                addBqMaterialLineAction({
                  subObjectId: sub.id,
                  skuId,
                  skuPriceId,
                  qtyPerSub,
                }),
              "Material added.",
            )
          }
          onAddService={(workPriceId, qty) =>
            run(
              () =>
                addBqServiceLineAction({
                  subObjectId: sub.id,
                  workPriceId,
                  qtyPerSub: qty,
                }),
              "Service added.",
            )
          }
          onAddLocalMaterial={(input) =>
            run(
              () =>
                addBqLocalMaterialLineAction({
                  subObjectId: sub.id,
                  ...input,
                  currency: "IDR",
                }),
              "Custom material added.",
            )
          }
          onAddLocalService={(input) =>
            run(
              () =>
                addBqLocalServiceLineAction({
                  subObjectId: sub.id,
                  ...input,
                  currency: "IDR",
                }),
              "Custom service added.",
            )
          }
        />
      ) : null}
    </div>
  );
}
