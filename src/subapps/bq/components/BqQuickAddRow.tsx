"use client";

/**
 * BQ — baris cepat L3: menambah bahan / jasa tanpa lepas dari keyboard.
 *
 * ============================================================================
 * KENAPA BARIS, BUKAN DIALOG (DAN BUKAN DRAG)
 * ============================================================================
 * Mengisi L3 adalah pekerjaan dengan frekuensi tertinggi di seluruh subapp ini
 * — satu BQ berisi 50–200 baris — dan targetnya TIDAK PERNAH ambigu: estimator
 * sudah berada di dalam sub-pekerjaan yang mau diisi. Dua alat yang sempat
 * dipakai keduanya salah untuk beban sebesar itu:
 *
 *   Dialog picker  menutup dirinya tiap kali satu baris masuk. Menambah lima
 *                  bahan berarti mengulang siklus buka–cari–pilih–tutup lima
 *                  kali dari nol.
 *   Drag & drop    menuntut ketik DULU (untuk menemukan barangnya di panel),
 *                  BARU menyeret melintasi layar ke baris yang mungkin sudah
 *                  ter-scroll keluar. Ia juga meninggalkan koefisien sebagai
 *                  langkah terpisah — padahal koefisien itulah pekerjaan yang
 *                  sesungguhnya. Menemukan "Plywood 18mm" sepele; tahu bahwa
 *                  satu ambalan butuh 2,5 lembar adalah keahlian estimator.
 *
 * Yang dipakai di sini adalah memori otot Excel, karena alat ini memang
 * pengganti Excel: ketik ke bawah satu kolom.
 *
 *   ketik nama -> Panah pilih -> Enter -> fokus LOMPAT ke Koef.
 *   -> ketik angka -> Enter simpan DAN buka baris kosong berikutnya
 *   -> Esc selesai
 *
 * Lima bahan berturut-turut = satu alur, nol sentuhan mouse sesudah klik
 * pertama.
 *
 * ============================================================================
 * KANDIDAT YANG BELUM SIAP TETAP MUNCUL
 * ============================================================================
 * Lengkap dengan alasannya, dan tidak bisa dipilih. Menyaringnya diam-diam
 * adalah cara tercepat membuat estimator mencari bahan yang ia TAHU ada di
 * Master Data, tidak menemukannya, lalu menyimpulkan alatnya rusak — alasan
 * yang sama dengan di `BqLinePicker`.
 */

import * as React from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Input, UI_ENGINE_RADIUS_CONTROL } from "@/ui_engine";
import { UI_ENGINE_TYPE_META } from "@/ui_engine/tokens";
import { cn } from "@/lib/utils";
import { formatIdr } from "../lib/calc";
import {
  searchBqMaterialsAction,
  searchBqServicesAction,
} from "../actions/bq-catalog-actions";
import type {
  BqMaterialCandidate,
  BqServiceCandidate,
} from "../types/breakdown";

export type QuickAddMode = "MATERIAL" | "SERVICE";

/** Satu pilihan yang siap dimasukkan, sudah diratakan dari dua bentuk kandidat. */
type Pick = {
  key: string;
  name: string;
  detail: string | null;
  unit: string;
  price: number;
  /** Alasan tidak bisa dipilih. NULL = siap. */
  blocked: string | null;
} & (
  | { mode: "MATERIAL"; skuId: string; skuPriceId: string | null }
  | { mode: "SERVICE"; workPriceId: string }
);

export type QuickAddCommit =
  | { mode: "MATERIAL"; skuId: string; skuPriceId: string; qtyPerSub: number }
  | { mode: "SERVICE"; workPriceId: string; qtyPerSub: number };

export function BqQuickAddRow({
  mode,
  editable,
  colSpanBefore,
  onCommit,
  onClose,
}: {
  mode: QuickAddMode;
  editable: boolean;
  /** Jumlah kolom sebelum "Uraian" — dipakai agar baris sejajar dengan tabel. */
  colSpanBefore: number;
  /** Kembalikan `true` kalau baris berhasil disimpan. */
  onCommit: (input: QuickAddCommit) => Promise<boolean>;
  onClose: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<Pick[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [chosen, setChosen] = React.useState<Pick | null>(null);
  const [coef, setCoef] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const nameRef = React.useRef<HTMLInputElement>(null);
  const coefRef = React.useRef<HTMLInputElement>(null);

  // Fokus awal ke sel nama saat baris dibuka.
  React.useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Pencarian ditunda 200ms. Cukup pendek untuk terasa langsung saat mengetik,
  // cukup panjang untuk tidak mengirim satu request per huruf.
  React.useEffect(() => {
    if (chosen) return;
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        if (mode === "MATERIAL") {
          const r = await searchBqMaterialsAction({ query: q });
          if (!cancelled && r.success) setResults(r.data.map(toMaterialPick));
        } else {
          const r = await searchBqServicesAction({ query: q });
          if (!cancelled && r.success) setResults(r.data.map(toServicePick));
        }
      } catch {
        if (!cancelled) setResults([]);
      }
      if (!cancelled) {
        setLoading(false);
        setActiveIndex(0);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, mode, chosen]);

  const selectable = results.filter((r) => !r.blocked);

  const choose = React.useCallback((pick: Pick) => {
    if (pick.blocked) return;
    setChosen(pick);
    setResults([]);
    setQuery(pick.name);
    // Inti dari seluruh komponen ini: fokus pindah SENDIRI ke koefisien.
    // requestAnimationFrame supaya input koefisien sudah ter-render.
    requestAnimationFrame(() => coefRef.current?.focus());
  }, []);

  const reset = React.useCallback(() => {
    setChosen(null);
    setQuery("");
    setCoef("");
    setResults([]);
    setActiveIndex(0);
    requestAnimationFrame(() => nameRef.current?.focus());
  }, []);

  const commit = React.useCallback(async () => {
    if (!chosen || saving) return;
    const parsed = Number(coef.trim().replace(",", "."));
    if (!coef.trim() || Number.isNaN(parsed) || parsed <= 0) {
      coefRef.current?.focus();
      return;
    }

    const payload: QuickAddCommit | null =
      chosen.mode === "MATERIAL"
        ? chosen.skuPriceId
          ? {
              mode: "MATERIAL",
              skuId: chosen.skuId,
              skuPriceId: chosen.skuPriceId,
              qtyPerSub: parsed,
            }
          : null
        : {
            mode: "SERVICE",
            workPriceId: chosen.workPriceId,
            qtyPerSub: parsed,
          };
    if (!payload) return;

    setSaving(true);
    const ok = await onCommit(payload);
    setSaving(false);
    // Berhasil -> baris kosong berikutnya langsung terbuka, tanpa klik.
    if (ok) reset();
  }, [chosen, coef, saving, onCommit, reset]);

  if (!editable) return null;

  const preview =
    chosen && coef.trim() && !Number.isNaN(Number(coef.trim().replace(",", ".")))
      ? chosen.price * Number(coef.trim().replace(",", "."))
      : null;

  const accent =
    mode === "MATERIAL"
      ? "border-sky-300 bg-sky-50/40"
      : "border-violet-300 bg-violet-50/40";

  return (
    <tr className={cn("border-y", accent)}>
      {/* Kolom sebelum Uraian (No.) */}
      {Array.from({ length: colSpanBefore }).map((_, i) => (
        <td key={i} className="py-1.5 pr-2 text-right">
          <Plus className="ml-auto h-3 w-3 text-slate-500" />
        </td>
      ))}

      {/* ---- Uraian: cari + dropdown hasil ------------------------------- */}
      <td className="relative py-1.5 pr-3">
        <Input
          ref={nameRef}
          value={query}
          disabled={saving}
          placeholder={
            mode === "MATERIAL" ? "Ketik nama bahan…" : "Ketik nama jasa…"
          }
          onChange={(e) => {
            setQuery(e.target.value);
            if (chosen) setChosen(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
              return;
            }
            if (selectable.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, selectable.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const pick = selectable[activeIndex];
              if (pick) choose(pick);
            }
          }}
          className="h-7 w-full min-w-40 text-xs"
        />

        {results.length > 0 && !chosen ? (
          <div
            className={cn(
              "absolute left-0 top-full z-30 mt-1 max-h-64 w-[26rem] overflow-y-auto",
              "border border-slate-200 bg-white shadow-lg",
              UI_ENGINE_RADIUS_CONTROL,
            )}
            role="listbox"
          >
            {results.map((r) => {
              const idx = selectable.indexOf(r);
              const active = idx >= 0 && idx === activeIndex;
              return (
                <button
                  key={r.key}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={!!r.blocked}
                  onMouseEnter={() => idx >= 0 && setActiveIndex(idx)}
                  onClick={() => choose(r)}
                  className={cn(
                    "flex w-full items-start justify-between gap-3 px-3 py-1.5 text-left",
                    r.blocked
                      ? "cursor-not-allowed bg-slate-50"
                      : active
                        ? "bg-indigo-50"
                        : "hover:bg-slate-50",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate font-sans text-xs",
                        r.blocked ? "text-slate-500" : "text-slate-900",
                      )}
                    >
                      {r.name}
                    </span>
                    {r.detail ? (
                      <span className={cn(UI_ENGINE_TYPE_META, "block truncate text-slate-500")}>
                        {r.detail}
                      </span>
                    ) : null}
                    {r.blocked ? (
                      <span className={cn(UI_ENGINE_TYPE_META, "block text-amber-700")}>
                        {r.blocked}
                      </span>
                    ) : null}
                  </span>
                  {!r.blocked ? (
                    <span
                      className={cn(
                        UI_ENGINE_TYPE_META,
                        "shrink-0 tabular-nums text-slate-500",
                      )}
                    >
                      {formatIdr(r.price)} / {r.unit}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}

        {loading && !chosen ? (
          <Loader2 className="absolute right-5 top-3 h-3 w-3 animate-spin text-slate-500" />
        ) : null}
      </td>

      {/* ---- Sat. -------------------------------------------------------- */}
      <td className={cn(UI_ENGINE_TYPE_META, "py-1.5 pr-2 text-center text-slate-600")}>
        {chosen?.unit ?? "—"}
      </td>

      {/* ---- Koef. ------------------------------------------------------- */}
      <td className="py-1.5 pr-3 text-right">
        <Input
          ref={coefRef}
          value={coef}
          disabled={!chosen || saving}
          inputMode="decimal"
          placeholder="0"
          onChange={(e) => setCoef(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          className="h-7 w-16 px-2 text-right text-xs"
        />
      </td>

      {/* ---- Harga Sat. -------------------------------------------------- */}
      <td className={cn(UI_ENGINE_TYPE_META, "py-1.5 pr-3 text-right tabular-nums text-slate-500")}>
        {chosen ? formatIdr(chosen.price) : "—"}
      </td>

      {/* ---- Jumlah (pratinjau) ------------------------------------------ */}
      <td className="py-1.5 text-right font-sans text-xs font-medium tabular-nums text-slate-800">
        {saving ? (
          <Loader2 className="ml-auto h-3 w-3 animate-spin text-slate-500" />
        ) : preview !== null ? (
          formatIdr(preview)
        ) : (
          "—"
        )}
      </td>

      {/* ---- Tutup ------------------------------------------------------- */}
      <td className="w-8 py-1.5 text-right">
        <button
          type="button"
          onClick={onClose}
          title="Selesai (Esc)"
          aria-label="Tutup baris cepat"
          className="text-slate-500 transition-colors hover:text-slate-600"
        >
          <X className="h-3 w-3" />
        </button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Meratakan dua bentuk kandidat jadi satu
// ---------------------------------------------------------------------------

function toMaterialPick(m: BqMaterialCandidate): Pick {
  const price = m.priceOptions[0] ?? null;
  const blocked = !m.readiness.ok
    ? m.readiness.detail
    : !price
      ? "Harga belum dicatat di Master Data."
      : null;
  return {
    mode: "MATERIAL",
    key: m.skuId,
    skuId: m.skuId,
    skuPriceId: price?.skuPriceId ?? null,
    name: m.name,
    detail: [m.code, m.brandName, price?.supplierName].filter(Boolean).join(" · ") || null,
    unit: price?.unit ?? m.baseUnit,
    price: price?.price ?? 0,
    blocked,
  };
}

function toServicePick(s: BqServiceCandidate): Pick {
  return {
    mode: "SERVICE",
    key: s.workPriceId,
    workPriceId: s.workPriceId,
    name: s.name,
    detail:
      [s.code, s.vendorName, s.hasMaterial ? "incl. material" : null]
        .filter(Boolean)
        .join(" · ") || null,
    unit: s.rateUnit,
    price: s.price,
    blocked: null,
  };
}
