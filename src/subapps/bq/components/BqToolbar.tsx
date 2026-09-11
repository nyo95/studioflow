"use client";

/**
 * BQ — Toolbar global + panel Library.
 *
 * ============================================================================
 * KENAPA TOOLBAR, BUKAN TOMBOL PER BARIS
 * ============================================================================
 * Sebelumnya "Buka semua / Tutup semua" dan "Muat Library / Simpan Lib" hidup
 * di dalam baris L1 dan L2. Akibatnya dua hal: baris jadi padat sampai angka
 * (Vol., Harga Sat., Jumlah) — yang justru inti BQ — kalah pandang oleh tombol,
 * dan perintah yang sifatnya GLOBAL terlihat seolah hanya berlaku untuk satu
 * baris.
 *
 * Pemisahannya sekarang tegas:
 *   - Toolbar  -> perintah lintas-baris (tingkat rincian, library, alat global)
 *   - Baris    -> data dan angka saja, plus hapus yang muncul saat hover
 *
 * ============================================================================
 * TINGKAT RINCIAN 1 / 2 / 3 (menggantikan Expand all / Collapse all)
 * ============================================================================
 * Meniru outline group Excel, karena BQ ini memang pengganti Excel:
 *   1 = semua tertutup            -> pandangan klien (FR-EXP-01)
 *   2 = pekerjaan terbuka         -> daftar sub-pekerjaan + subtotal (FR-EXP-02)
 *   3 = semua terbuka             -> baris bahan & jasa (FR-EXP-03)
 *
 * FR-EXP-04 tetap terpenuhi — malah lebih kuat: satu klik menata SELURUH
 * dokumen, bukan satu object. Chevron per baris tetap ada untuk pengecualian.
 *
 * ============================================================================
 * PANEL LIBRARY MEMBAWA TUJUANNYA SENDIRI
 * ============================================================================
 * `loadFromLibrary*Action` selalu menuntut `targetSubObjectId`. Dulu itu
 * implisit — tombolnya menempel di baris, jadi tujuan = baris itu. Begitu
 * tombolnya pindah ke toolbar, tujuan harus jadi eksplisit, maka panel
 * memegang pemilih "Sisipkan ke" berisi seluruh sub-pekerjaan project.
 * Klik baris L2 di grid ikut mengisi pemilih itu.
 */

import * as React from "react";
import {
  ChevronDown,
  Loader2,
  Lock,
  LockOpen,
  Settings2,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  UI_ENGINE_RADIUS_CONTROL,
} from "@/ui_engine";
import { UI_ENGINE_TYPE_META } from "@/ui_engine/tokens";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Tipe bantu
// ---------------------------------------------------------------------------

export type OutlineLevel = 1 | 2 | 3;

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

export function BqToolbar({
  outlineLevel,
  onOutlineLevel,
  objectCount,
  lineCount,
  canEdit,
  pending,
  onLockAll,
}: {
  outlineLevel: OutlineLevel | null;
  onOutlineLevel: (level: OutlineLevel) => void;
  objectCount: number;
  lineCount: number;
  canEdit: boolean;
  pending: boolean;
  onLockAll: (locked: boolean) => void;
}) {
  const LEVELS: { level: OutlineLevel; label: string; hint: string }[] = [
    { level: 1, label: "1", hint: "Ringkas — satu baris per pekerjaan (pandangan klien)" },
    { level: 2, label: "2", hint: "Sedang — tampilkan sub-pekerjaan" },
    { level: 3, label: "3", hint: "Rinci — tampilkan bahan & jasa" },
  ];

  return (
    <div
      className={cn(
        "sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-x-5 gap-y-3",
        "border border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur",
        UI_ENGINE_RADIUS_CONTROL,
      )}
    >
      {/* ---- Tingkat rincian ------------------------------------------- */}
      <div className="flex items-center gap-2">
        <span className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}>Rincian</span>
        <div className="flex overflow-hidden rounded-md border border-slate-200">
          {LEVELS.map(({ level, label, hint }) => (
            <button
              key={level}
              type="button"
              title={hint}
              aria-pressed={outlineLevel === level}
              onClick={() => onOutlineLevel(level)}
              className={cn(
                "h-7 w-8 border-r border-slate-200 text-xs font-medium transition-colors last:border-r-0",
                outlineLevel === level
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <span className="hidden h-5 w-px bg-slate-200 sm:block" />

      {/* ---- Alat global ------------------------------------------------ */}
      {canEdit ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1.5 border-slate-200 px-2.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Alat
              <ChevronDown className="h-3 w-3 text-slate-500" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => onLockAll(true)}
              className="gap-2 text-xs"
            >
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              Kunci semua pekerjaan
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => onLockAll(false)}
              className="gap-2 text-xs"
            >
              <LockOpen className="h-3.5 w-3.5 text-slate-500" />
              Buka kunci semua pekerjaan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {/* ---- Status ----------------------------------------------------- */}
      <div className="ml-auto flex items-center gap-3">
        {pending ? (
          <span className={cn(UI_ENGINE_TYPE_META, "flex items-center gap-1.5 text-slate-500")}>
            <Loader2 className="h-3 w-3 animate-spin" />
            Menyimpan…
          </span>
        ) : null}
        <span className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}>
          {objectCount} pekerjaan · {lineCount} baris
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel Library
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Dock kiri — tiga sumber
// ---------------------------------------------------------------------------
