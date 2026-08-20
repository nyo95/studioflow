"use client";

/**
 * BQ — pemilih bahan / jasa dari Master Data.
 *
 * ============================================================================
 * Master Data is preferred, but local project snapshots remain valid when the
 * canonical catalogue is incomplete.
 *
 * Yang boleh dilakukan estimator adalah menyunting SNAPSHOT baris sesudah ia
 * ditambahkan (harga nego, sisa stok, konversi khusus). Suntingan itu hidup di
 * project BQ ini saja dan tidak pernah merambat balik ke Master Data.
 *
 * ============================================================================
 * KANDIDAT YANG BELUM SIAP TETAP DITAMPILKAN
 * ============================================================================
 * Lengkap dengan alasannya. Menyaringnya diam-diam adalah cara tercepat
 * membuat estimator mencari bahan yang ia TAHU ada di Master Data dan tidak
 * pernah tahu kenapa ia tidak muncul — lalu menyimpulkan alatnya rusak.
 *
 * Dua alasan mengarah ke tempat yang berbeda:
 *   NO_PRICE       -> Master Data (harga belum dicatat staff)
 *   UNIT_MISMATCH  -> salah satu dari keduanya, dan BQ tidak menebak yang mana
 */

import * as React from "react";
import { Plus, Search } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  UI_ENGINE_RADIUS_CONTROL,
} from "@/ui_engine";
import { UI_ENGINE_TYPE_META } from "@/ui_engine/tokens";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatIdr } from "../lib/calc";
import { searchBqMaterialsAction, searchBqServicesAction } from "../actions/bq-catalog-actions";
import { addBqLocalMaterialLineAction, addBqLocalServiceLineAction } from "../actions/bq-project-actions";
import { loadFromLibraryObjectAction, loadFromLibrarySubObjectAction, searchLibraryObjectsAction, searchLibrarySubObjectsAction } from "../actions/bq-library-actions";
import type { BqMaterialCandidate, BqServiceCandidate } from "../types/breakdown";

type Mode = "MATERIAL" | "SERVICE";

export function BqLinePicker({
  subObjectId,
  onAddMaterial,
  onAddService,
  onAddLocalMaterial,
  onAddLocalService,
}: {
  subObjectId: string;
  onAddMaterial: (skuId: string, qtyPerSub: number) => Promise<boolean>;
  onAddService: (workPriceId: string, qtyPerSub: number) => Promise<boolean>;
  onAddLocalMaterial: (input: { name: string; usageUnit: string; price: number; qtyPerSub: number }) => Promise<boolean>;
  onAddLocalService: (input: { name: string; rateUnit: string; price: number; qtyPerSub: number }) => Promise<boolean>;
}) {
  const [mode, setMode] = React.useState<Mode | null>(null);

  return (
    <div className="flex items-center gap-2 pt-1">
      <Button size="sm" variant="outline" className="h-7" onClick={() => setMode("MATERIAL")}>
        <Plus className="mr-1.5 h-3 w-3" />
        Material
      </Button>
      <Button size="sm" variant="outline" className="h-7" onClick={() => setMode("SERVICE")}>
        <Plus className="mr-1.5 h-3 w-3" />
        Service
      </Button>

      <PickerDialog
        key={`${subObjectId}-${mode ?? "closed"}`}
        mode={mode}
        onClose={() => setMode(null)}
        onAddMaterial={onAddMaterial}
        onAddService={onAddService}
        onAddLocalMaterial={onAddLocalMaterial}
        onAddLocalService={onAddLocalService}
      />
    </div>
  );
}

function PickerDialog({
  mode,
  onClose,
  onAddMaterial,
  onAddService,
  onAddLocalMaterial,
  onAddLocalService,
}: {
  mode: Mode | null;
  onClose: () => void;
  onAddMaterial: (skuId: string, qtyPerSub: number) => Promise<boolean>;
  onAddService: (workPriceId: string, qtyPerSub: number) => Promise<boolean>;
  onAddLocalMaterial: (input: { name: string; usageUnit: string; price: number; qtyPerSub: number }) => Promise<boolean>;
  onAddLocalService: (input: { name: string; rateUnit: string; price: number; qtyPerSub: number }) => Promise<boolean>;
}) {
  const [query, setQuery] = React.useState("");
  const [materials, setMaterials] = React.useState<BqMaterialCandidate[]>([]);
  const [services, setServices] = React.useState<BqServiceCandidate[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [qty, setQty] = React.useState("1");
  const [saving, setSaving] = React.useState(false);
  const [custom, setCustom] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [customUnit, setCustomUnit] = React.useState("");
  const [customPrice, setCustomPrice] = React.useState("");

  // Debounce: satu permintaan per jeda ketik, bukan satu per karakter. 250ms
  // cukup untuk mengetik "plywood" tanpa mengirim tujuh query.
  React.useEffect(() => {
    if (!mode) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      if (mode === "MATERIAL") {
        const result = await searchBqMaterialsAction({ query });
        if (!cancelled && result.success) setMaterials(result.data);
      } else {
        const result = await searchBqServicesAction({ query });
        if (!cancelled && result.success) setServices(result.data);
      }
      if (!cancelled) setLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, mode]);

  const handleAdd = React.useCallback(async () => {
    if (!mode) return;
    const parsed = Number(qty.replace(",", "."));
    const price = Number(customPrice.replace(",", "."));
    if (custom ? (!customName.trim() || !customUnit.trim() || Number.isNaN(price) || price < 0) : (!selectedId || Number.isNaN(parsed) || parsed < 0)) return;

    setSaving(true);
    const ok = custom
      ? mode === "MATERIAL"
        ? await onAddLocalMaterial({ name: customName, usageUnit: customUnit, price, qtyPerSub: parsed })
        : await onAddLocalService({ name: customName, rateUnit: customUnit, price, qtyPerSub: parsed })
      : mode === "MATERIAL"
        ? await onAddMaterial(selectedId!, parsed)
        : await onAddService(selectedId!, parsed);
    setSaving(false);
    if (ok) onClose();
  }, [selectedId, mode, qty, custom, customName, customUnit, customPrice, onAddMaterial, onAddService, onAddLocalMaterial, onAddLocalService, onClose]);

  const selectedUnit =
    mode === "MATERIAL"
      ? materials.find((m) => m.skuId === selectedId)?.profile?.usageUnit
      : services.find((s) => s.workPriceId === selectedId)?.rateUnit;

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pr-12">
          <DialogTitle>{mode === "SERVICE" ? "Add service" : "Add material"}</DialogTitle>
          <DialogDescription>
            {mode === "SERVICE"
              ? "Services come from Master Data. Rates are frozen onto the line when you add it."
              : "Materials come from Master Data. Price and waste are frozen onto the line when you add it."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "SERVICE" ? "Search services…" : "Search materials…"}
            className="pl-9"
            autoFocus
          />
        </div>

        {!custom ? <div className="max-h-80 space-y-1 overflow-y-auto">
          {loading ? (
            <p className={cn(UI_ENGINE_TYPE_META, "py-6 text-center text-slate-400")}>Searching…</p>
          ) : mode === "MATERIAL" ? (
            materials.length === 0 ? (
              <EmptyResult mode={mode} />
            ) : (
              materials
              .filter((m) => m.readiness.ok || m.readiness.reason !== "NO_PRICE")
              .map((m) => (
                <MaterialRow
                  key={m.skuId}
                  candidate={m}
                  selected={selectedId === m.skuId}
                  onSelect={() => m.readiness.ok && setSelectedId(m.skuId)}
                />
              ))
            )
          ) : services.length === 0 ? (
            <EmptyResult mode={mode} />
          ) : (
            services.map((s) => (
              <ServiceRow
                key={s.workPriceId}
                candidate={s}
                selected={selectedId === s.workPriceId}
                onSelect={() => setSelectedId(s.workPriceId)}
              />
            ))
          )}
        </div> : (
          <div className="grid gap-3 md:grid-cols-2">
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder={mode === "MATERIAL" ? "Custom material name" : "Custom service name"} />
            <Input value={customUnit} onChange={(e) => setCustomUnit(e.target.value)} placeholder="Unit (e.g. m², lot)" />
            <Input value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="Unit price" inputMode="decimal" />
          </div>
        )}

        {!custom ? (
          <Button variant="outline" onClick={() => { setCustom(true); setSelectedId(null); }}>
            <Plus className="mr-1.5 h-3 w-3" /> Add custom {mode === "MATERIAL" ? "material" : "service"}
          </Button>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <label className="flex items-center gap-2">
            <span className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}>
              Qty per sub-object
            </span>
            <Input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-8 w-24 text-right"
              inputMode="decimal"
            />
            {selectedUnit ? (
              <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>{selectedUnit}</span>
            ) : null}
          </label>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={saving || (!custom && !selectedId)}>
            {saving ? "Adding…" : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function EmptyResult({ mode }: { mode: Mode | null }) {
  return (
    <div className="py-6 text-center">
      <p className="font-sans text-sm text-slate-600">Nothing matched.</p>
      <p className={cn(UI_ENGINE_TYPE_META, "mt-1 text-slate-400")}>
        {mode === "SERVICE"
          ? "Services live in Master Data. Ask Master Data staff to add it there first."
          : "Materials live in Master Data. Ask Master Data staff to add it there first."}
      </p>
    </div>
  );
}

const READINESS_HINT: Record<string, string> = {
  NO_PRICE: "No price in Master Data",
  UNIT_MISMATCH: "Unit mismatch",
  SKU_DISCONTINUED: "Discontinued in Master Data",
  PURCHASE_UNIT_MISSING: "Purchase unit missing",
  CONVERSION_INVALID: "Conversion missing",
};

function MaterialRow({
  candidate,
  selected,
  onSelect,
}: {
  candidate: BqMaterialCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  const ready = candidate.readiness.ok;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!ready}
      className={cn(
        "flex w-full items-start justify-between gap-3 border px-3 py-2 text-left transition-colors",
        UI_ENGINE_RADIUS_CONTROL,
        selected
          ? "border-slate-300 bg-slate-100"
          : ready
            ? "border-transparent hover:bg-slate-50"
            : "border-transparent opacity-60"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {candidate.code ? (
            <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>{candidate.code}</span>
          ) : null}
          <span className="truncate font-sans text-sm text-slate-900">{candidate.name}</span>
          {candidate.brandName ? (
            <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
              {candidate.brandName}
            </span>
          ) : null}
        </div>

        {ready && candidate.profile && candidate.price ? (
          <p className={cn(UI_ENGINE_TYPE_META, "mt-0.5 text-slate-500")}>
            {formatIdr(candidate.price.price, candidate.price.currency)} /{" "}
            {candidate.profile.purchaseUnit} · 1 {candidate.profile.purchaseUnit} ={" "}
            {candidate.profile.conversion} {candidate.profile.usageUnit}
            {candidate.price.supplierName ? ` · ${candidate.price.supplierName}` : ""}
          </p>
        ) : (
          // Alasannya ditampilkan penuh, bukan disingkat jadi "unavailable".
          // Ketiga alasan mengarah ke layar yang berbeda.
          <p className={cn(UI_ENGINE_TYPE_META, "mt-0.5 text-amber-700")}>
            {candidate.readiness.ok ? null : candidate.readiness.detail}
          </p>
        )}
      </div>

      {!ready && !candidate.readiness.ok ? (
        <span className={cn(UI_ENGINE_TYPE_META, "shrink-0 text-amber-700")}>
          {READINESS_HINT[candidate.readiness.reason]}
        </span>
      ) : null}
    </button>
  );
}

function ServiceRow({
  candidate,
  selected,
  onSelect,
}: {
  candidate: BqServiceCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start justify-between gap-3 border px-3 py-2 text-left transition-colors",
        UI_ENGINE_RADIUS_CONTROL,
        selected ? "border-slate-300 bg-slate-100" : "border-transparent hover:bg-slate-50"
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>{candidate.code}</span>
          <span className="truncate font-sans text-sm text-slate-900">{candidate.name}</span>
          {/* Dinyatakan, bukan disimpulkan dari harga (AGENTS.md §3.4). */}
          {candidate.hasMaterial ? (
            <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>incl. material</span>
          ) : null}
        </div>
        <p className={cn(UI_ENGINE_TYPE_META, "mt-0.5 text-slate-500")}>
          {formatIdr(candidate.price, candidate.currency)} / {candidate.rateUnit}
          {candidate.vendorName ? ` · ${candidate.vendorName}` : ""}
        </p>
        {/* PRD §5.3 menyebut scope penting: "Jasa Pasang HPL" harus jelas
            sudah termasuk lem atau belum. */}
        {candidate.scopeNote ? (
          <p className={cn(UI_ENGINE_TYPE_META, "mt-0.5 truncate text-slate-400")}>
            {candidate.scopeNote}
          </p>
        ) : null}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Library picker — pour saved recipe into current sub-object
// ---------------------------------------------------------------------------

type LibTab = "OBJECTS" | "SUB_OBJECTS";

type LibObjectRow = {
  id: string;
  name: string;
  unit: string;
  subObjectCount: number;
  materialLineCount: number;
  serviceLineCount: number;
};

type LibSubRow = {
  id: string;
  name: string;
  materialLineCount: number;
  serviceLineCount: number;
};

export function LibraryPickerDialog({
  subObjectId,
  onClose,
}: {
  subObjectId: string;
  onClose: () => void;
}) {
  const [tab, setTab] = React.useState<LibTab>("OBJECTS");
  const [query, setQuery] = React.useState("");
  const [objects, setObjects] = React.useState<LibObjectRow[]>([]);
  const [subs, setSubs] = React.useState<LibSubRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (tab === "OBJECTS") {
          const result = await searchLibraryObjectsAction({ query });
          if (result.success) setObjects(result.data);
        } else {
          const result = await searchLibrarySubObjectsAction({ query });
          if (result.success) setSubs(result.data);
        }
      } catch {
        // action failed silently
      }
      if (!cancelled) setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, tab]);

  const handleLoad = React.useCallback(async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      if (tab === "OBJECTS") {
        const result = await loadFromLibraryObjectAction({
          libraryObjectId: selectedId,
          targetSubObjectId: subObjectId,
        });
        if (result.success) {
          toast.success("Library object loaded");
          onClose();
        } else {
          toast.error(result.error ?? "Failed to load");
        }
      } else {
        const result = await loadFromLibrarySubObjectAction({
          librarySubObjectId: selectedId,
          targetSubObjectId: subObjectId,
        });
        if (result.success) {
          toast.success("Library sub-object loaded");
          onClose();
        } else {
          toast.error(result.error ?? "Failed to load");
        }
      }
    } catch {
      toast.error("Failed to load from library");
    } finally {
      setSaving(false);
    }
  }, [selectedId, tab, subObjectId, onClose]);

  const itemCount = tab === "OBJECTS" ? objects.length : subs.length;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="pr-12">
          <DialogTitle>Load from library</DialogTitle>
          <DialogDescription>
            Pour a saved recipe into this sub-object. Lines are frozen from Master Data at load time.
          </DialogDescription>
        </DialogHeader>

        {/* Tab bar */}
        <div className="flex gap-1 border-b border-slate-200">
          {(["OBJECTS", "SUB_OBJECTS"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setSelectedId(null); setQuery(""); }}
              className={cn(
                "px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {t === "OBJECTS" ? "Objects" : "Sub-objects"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search library…"
            className="pl-9"
            autoFocus
          />
        </div>

        {/* List */}
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {loading ? (
            <p className={cn(UI_ENGINE_TYPE_META, "py-6 text-center text-slate-400")}>Searching…</p>
          ) : itemCount === 0 ? (
            <p className={cn(UI_ENGINE_TYPE_META, "py-6 text-center text-slate-400")}>
              No library entries found.
            </p>
          ) : tab === "OBJECTS" ? (
            objects.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setSelectedId(o.id)}
                className={cn(
                  "flex w-full items-start justify-between gap-3 border px-3 py-2 text-left transition-colors",
                  UI_ENGINE_RADIUS_CONTROL,
                  selectedId === o.id
                    ? "border-slate-300 bg-slate-100"
                    : "border-transparent hover:bg-slate-50"
                )}
              >
                <div className="min-w-0">
                  <span className="truncate font-sans text-sm text-slate-900">{o.name}</span>
                  <p className={cn(UI_ENGINE_TYPE_META, "mt-0.5 text-slate-500")}>
                    {o.subObjectCount} sub · {o.materialLineCount} mat · {o.serviceLineCount} svc
                  </p>
                </div>
              </button>
            ))
          ) : (
            subs.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className={cn(
                  "flex w-full items-start justify-between gap-3 border px-3 py-2 text-left transition-colors",
                  UI_ENGINE_RADIUS_CONTROL,
                  selectedId === s.id
                    ? "border-slate-300 bg-slate-100"
                    : "border-transparent hover:bg-slate-50"
                )}
              >
                <div className="min-w-0">
                  <span className="truncate font-sans text-sm text-slate-900">{s.name}</span>
                  <p className={cn(UI_ENGINE_TYPE_META, "mt-0.5 text-slate-500")}>
                    {s.materialLineCount} material · {s.serviceLineCount} service
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleLoad} disabled={!selectedId || saving}>
            {saving ? "Loading…" : "Load"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
