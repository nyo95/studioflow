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
  BookOpen,
  Plus,
  ChevronDown,
  GripVertical,
  Loader2,
  Lock,
  LockOpen,
  PanelLeftClose,
  Search,
  Settings2,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  UI_ENGINE_RADIUS_CONTROL,
} from "@/ui_engine";
import { UI_ENGINE_TYPE_META } from "@/ui_engine/tokens";
import { cn } from "@/lib/utils";
import {
  searchLibraryObjectsAction,
  searchLibrarySubObjectsAction,
} from "../actions/bq-library-actions";
import {
  searchBqMaterialsAction,
  searchBqServicesAction,
} from "../actions/bq-catalog-actions";
import { browseTemplateItems } from "../lib/bq-template-lookup";
import { formatIdr } from "../lib/calc";
import type {
  BqMaterialCandidate,
  BqServiceCandidate,
} from "../types/breakdown";

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
  onOpenLibrary,
  libraryOpen,
  objectCount,
  lineCount,
  canEdit,
  pending,
  onLockAll,
}: {
  outlineLevel: OutlineLevel | null;
  onOutlineLevel: (level: OutlineLevel) => void;
  onOpenLibrary: () => void;
  libraryOpen: boolean;
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
        <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>Rincian</span>
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

      {/* ---- Library ---------------------------------------------------- */}
      {canEdit ? (
        <Button
          size="sm"
          variant="outline"
          aria-pressed={libraryOpen}
          className={cn(
            "h-7 gap-1.5 px-2.5 text-xs hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700",
            libraryOpen
              ? "border-indigo-300 bg-indigo-50 text-indigo-700"
              : "border-slate-200 text-slate-600",
          )}
          onClick={onOpenLibrary}
        >
          <BookOpen className="h-3.5 w-3.5" />
          Library
        </Button>
      ) : null}

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
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => onLockAll(true)}
              className="gap-2 text-xs"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              Kunci semua pekerjaan
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={pending}
              onSelect={() => onLockAll(false)}
              className="gap-2 text-xs"
            >
              <LockOpen className="h-3.5 w-3.5 text-slate-400" />
              Buka kunci semua pekerjaan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {/* ---- Status ----------------------------------------------------- */}
      <div className="ml-auto flex items-center gap-3">
        {pending ? (
          <span className={cn(UI_ENGINE_TYPE_META, "flex items-center gap-1.5 text-slate-400")}>
            <Loader2 className="h-3 w-3 animate-spin" />
            Menyimpan…
          </span>
        ) : null}
        <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
          {objectCount} pekerjaan · {lineCount} baris
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel Library
// ---------------------------------------------------------------------------


/**
 * Format payload drag. Dibaca oleh drop target di grid.
 *
 * Dipakai sebagai MIME type juga, bukan cuma `text/plain`: dengan tipe khusus,
 * `dragover` bisa membedakan "ini resep library" dari teks apa pun yang kebetulan
 * diseret pengguna dari luar browser — jadi baris grid tidak menyala biru saat
 * seseorang menyeret file gambar ke jendela.
 */
/** Bentuk baris dari `searchLibraryObjectsAction`. */
type LibObjectRow = {
  id: string;
  code: string | null;
  name: string;
  unit: string;
  subObjectCount: number;
  materialLineCount: number;
  serviceLineCount: number;
  createdBy: string | null;
};

/** Bentuk baris dari `searchLibrarySubObjectsAction`. */
type LibSubRow = {
  id: string;
  name: string;
  qty: number;
  materialLineCount: number;
  serviceLineCount: number;
  createdBy: string | null;
};

export const BQ_RECIPE_MIME = "application/x-bq-recipe";

/**
 * Muatan drag. Empat jenis, dari tiga sumber di dock:
 *
 *   LIB_SUB / LIB_OBJ  -> resep tersimpan (Library)      -> tujuan: sub-pekerjaan / pekerjaan
 *   TEMPLATE           -> item template kantor           -> tujuan: pekerjaan
 *   MATERIAL / SERVICE -> bahan & jasa dari Master Data  -> tujuan: sub-pekerjaan
 *
 * Tujuan yang sah berbeda per jenis karena aksi servernya memang berbeda:
 * resep dan template MENGISI sebuah wadah, sedangkan bahan/jasa adalah satu
 * BARIS L3 — dan baris hanya bisa hidup di dalam sub-pekerjaan.
 */
export type BqRecipeDrag =
  | { kind: "LIB_SUB"; id: string; name: string }
  | { kind: "LIB_OBJ"; id: string; name: string }
  | {
      kind: "TEMPLATE";
      templateKey: string;
      groupName: string;
      itemName: string;
      name: string;
    }
  | {
      kind: "MATERIAL";
      skuId: string;
      skuPriceId: string;
      name: string;
    }
  | { kind: "SERVICE"; workPriceId: string; name: string };

/** Jenis yang boleh dijatuhkan ke sebuah pekerjaan (L1). */
export function acceptsOnObject(kind: BqRecipeDrag["kind"]): boolean {
  // TEMPLATE tidak lagi diterima di sini: satu item template ADALAH sebuah
  // item BQ (L1), jadi tujuannya seksi/divisi, bukan ke dalam item lain.
  return kind === "LIB_SUB" || kind === "LIB_OBJ";
}

/** Jenis yang boleh dijatuhkan ke sebuah sub-pekerjaan (L2). */
export function acceptsOnSubObject(kind: BqRecipeDrag["kind"]): boolean {
  return kind !== "TEMPLATE";
}

/** Baca muatan drag dari sebuah DragEvent. NULL kalau bukan dari dock. */
export function readRecipeDrag(e: React.DragEvent): BqRecipeDrag | null {
  const raw = e.dataTransfer.getData(BQ_RECIPE_MIME);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as BqRecipeDrag;
    return parsed && parsed.kind ? parsed : null;
  } catch {
    return null;
  }
}

/** `true` kalau drag yang sedang lewat berasal dari dock. */
export function isRecipeDrag(e: React.DragEvent): boolean {
  return e.dataTransfer.types.includes(BQ_RECIPE_MIME);
}

/** Pasang muatan ke event drag. Dipakai seluruh kartu di dock. */
function startDrag(e: React.DragEvent, payload: BqRecipeDrag) {
  e.dataTransfer.setData(BQ_RECIPE_MIME, JSON.stringify(payload));
  // text/plain sebagai cadangan supaya kursor drag muncul benar di sebagian browser.
  e.dataTransfer.setData("text/plain", payload.name);
  e.dataTransfer.effectAllowed = "copy";
}

// ---------------------------------------------------------------------------
// Dock kiri — tiga sumber
// ---------------------------------------------------------------------------

/**
 * Dock sumber: Library, Template BQ, dan Master Data.
 *
 * ============================================================================
 * KENAPA TIGA SUMBER DALAM SATU PANEL
 * ============================================================================
 * Ketiganya menjawab pertanyaan yang sama pada momen yang sama — "apa yang
 * saya taruh di baris ini?" — tapi datang dari tempat berbeda:
 *
 *   Library      resep yang PERNAH dibuat kantor ini    (paling spesifik)
 *   Template BQ  daftar baku pekerjaan interior         (paling lengkap)
 *   Master Data  bahan & jasa berikut harganya          (paling dasar)
 *
 * Memisahkannya jadi tiga panel akan memaksa estimator menebak di mana sesuatu
 * berada sebelum boleh mencarinya. Satu dock dengan tiga tab membiarkan ia
 * mencoba yang paling spesifik dulu, lalu turun ke yang lebih dasar.
 *
 * ============================================================================
 * DOCK TERKUNCI TERBUKA
 * ============================================================================
 * Default terbuka, bukan tertutup. Menyusun BQ berarti bolak-balik ke sumber
 * ini hampir di setiap baris; panel yang harus dibuka lebih dulu setiap kali
 * halaman dimuat cuma menambah satu klik pada pekerjaan yang berulang.
 *
 * ============================================================================
 * PANEL INI TIDAK MENULIS APA PUN
 * ============================================================================
 * Ia hanya daftar yang bisa diseret. Seluruh mutasi terjadi di drop handler
 * milik grid — satu tempat, sehingga aturan "apa boleh jatuh di mana" tidak
 * tersebar di dua berkas.
 */

type DockTab = "LIBRARY" | "TEMPLATE" | "MASTER";

const DOCK_TABS: { id: DockTab; label: string; hint: string }[] = [
  { id: "LIBRARY", label: "Library", hint: "Resep yang pernah disimpan" },
  { id: "TEMPLATE", label: "Template", hint: "Daftar baku pekerjaan interior" },
  { id: "MASTER", label: "Harga", hint: "Bahan & jasa dari Master Data" },
];

export function BqLibraryPanel({
  open,
  onClose,
  canEdit,
  pending,
  onAddSection,
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  pending: boolean;
  onAddSection: (name: string) => Promise<boolean>;
}) {
  const [tab, setTab] = React.useState<DockTab>("LIBRARY");
  const [query, setQuery] = React.useState("");
  const [sectionName, setSectionName] = React.useState("");

  const submitSection = async () => {
    if (!sectionName.trim()) return;
    const ok = await onAddSection(sectionName.trim());
    if (ok) setSectionName("");
  };

  return (
    <aside
      className={cn(
        "sticky top-4 hidden h-[calc(100vh-6rem)] w-72 shrink-0 flex-col overflow-hidden",
        "border border-slate-200 bg-white lg:flex",
        open ? "lg:flex" : "lg:hidden",
        UI_ENGINE_RADIUS_CONTROL,
      )}
      aria-label="Sumber komponen"
    >
      {/* ---- Kepala ------------------------------------------------------ */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="min-w-0">
          <p className="font-serif text-base font-semibold text-slate-900">Sumber</p>
          <p className={cn(UI_ENGINE_TYPE_META, "mt-0.5 text-slate-500")}>
            Seret ke baris di grid
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 shrink-0 p-0 text-slate-400 hover:text-slate-700"
          onClick={onClose}
          title="Sembunyikan panel"
          aria-label="Sembunyikan panel sumber"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {/* ---- Struktur ----------------------------------------------------
          Hanya SEKSI yang tinggal di sini, dan alasannya konsisten dengan
          seluruh grid: yang tidak punya induk hidup di panel, yang punya induk
          hidup di dalam induknya. Divisi butuh seksi, pekerjaan butuh divisi,
          sub-pekerjaan butuh pekerjaan — ketiganya ditambahkan di tempatnya
          masing-masing, di mana tujuannya tidak perlu dipilih lagi. Seksi tidak
          punya tujuan untuk dipilih, jadi ia tidak punya tempat alami di grid. */}
      {canEdit ? (
        <div className="border-b border-slate-100 px-3 py-3">
          <p className={cn(UI_ENGINE_TYPE_META, "mb-1.5 px-0.5 text-slate-500")}>
            Seksi baru
          </p>
          <div className="flex items-center gap-1.5">
            <Input
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitSection();
                }
              }}
              placeholder="mis. Interior Works"
              className="h-8 text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 shrink-0 p-0"
              disabled={pending || !sectionName.trim()}
              title="Tambah seksi"
              aria-label="Tambah seksi"
              onClick={() => void submitSection()}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className={cn(UI_ENGINE_TYPE_META, "mt-1 px-0.5 text-slate-400")}>
            Kode A / B / C otomatis
          </p>
        </div>
      ) : null}

      {/* ---- Tab sumber -------------------------------------------------- */}
      <div className="flex gap-1 border-b border-slate-200 px-3">
        {DOCK_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            title={t.hint}
            onClick={() => {
              setTab(t.id);
              setQuery("");
            }}
            className={cn(
              "px-2.5 py-2 text-xs font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- Cari -------------------------------------------------------- */}
      <div className="px-3 pb-2 pt-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "LIBRARY"
                ? "Cari resep…"
                : tab === "TEMPLATE"
                  ? "Cari item template…"
                  : "Cari bahan / jasa…"
            }
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* ---- Isi --------------------------------------------------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {tab === "LIBRARY" ? (
          <LibrarySource query={query} active={open} />
        ) : tab === "TEMPLATE" ? (
          <TemplateSource query={query} />
        ) : (
          <MasterDataSource query={query} active={open} />
        )}
      </div>

      {/* ---- Petunjuk ---------------------------------------------------- */}
      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <p className={cn(UI_ENGINE_TYPE_META, "leading-relaxed text-slate-500")}>
          {tab === "MASTER"
            ? "Jatuhkan ke sub-pekerjaan — jadi satu baris bahan atau jasa."
            : tab === "TEMPLATE"
              ? "Jatuhkan ke seksi/divisi — jadi pekerjaan baru."
              : "Jatuhkan ke sub-pekerjaan untuk mengisinya, atau ke pekerjaan untuk membuat sub-pekerjaan baru."}
        </p>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Kartu yang bisa diseret — bentuknya sama untuk ketiga sumber
// ---------------------------------------------------------------------------

function DragCard({
  payload,
  title,
  subtitle,
  meta,
  accent,
}: {
  payload: BqRecipeDrag;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  accent: "indigo" | "slate" | "sky";
}) {
  return (
    <div
      draggable
      onDragStart={(e) => startDrag(e, payload)}
      title={`Seret "${title}" ke grid`}
      className={cn(
        "group flex cursor-grab items-start gap-2 border border-slate-200 bg-white px-2.5 py-2",
        "transition-colors active:cursor-grabbing",
        accent === "indigo" && "hover:border-indigo-300 hover:bg-indigo-50/50",
        accent === "slate" && "hover:border-slate-400 hover:bg-slate-50",
        accent === "sky" && "hover:border-sky-300 hover:bg-sky-50/50",
        UI_ENGINE_RADIUS_CONTROL,
      )}
    >
      <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300 group-hover:text-slate-500" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-xs font-medium text-slate-900">{title}</p>
        {subtitle ? (
          <p className={cn(UI_ENGINE_TYPE_META, "mt-0.5 truncate text-slate-400")}>
            {subtitle}
          </p>
        ) : null}
        {meta ? (
          <p className={cn(UI_ENGINE_TYPE_META, "mt-0.5 text-slate-400")}>{meta}</p>
        ) : null}
      </div>
    </div>
  );
}

function SourceState({ children }: { children: React.ReactNode }) {
  return (
    <p className={cn(UI_ENGINE_TYPE_META, "px-1 py-6 text-center italic text-slate-400")}>
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Sumber 1 — Library
// ---------------------------------------------------------------------------

function LibrarySource({ query, active }: { query: string; active: boolean }) {
  const [sub, setSub] = React.useState<LibSubRow[]>([]);
  const [obj, setObj] = React.useState<LibObjectRow[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [a, b] = await Promise.all([
          searchLibrarySubObjectsAction({ query }),
          searchLibraryObjectsAction({ query }),
        ]);
        if (cancelled) return;
        if (a.success) setSub(a.data);
        if (b.success) setObj(b.data);
      } catch {
        /* daftar dibiarkan apa adanya */
      }
      if (!cancelled) setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, active]);

  if (loading) return <SourceState>Memuat…</SourceState>;
  if (sub.length === 0 && obj.length === 0) {
    return (
      <SourceState>
        {query
          ? "Tidak ada yang cocok."
          : "Library masih kosong. Simpan sub-pekerjaan dari grid untuk mengisinya."}
      </SourceState>
    );
  }

  return (
    <div className="space-y-3">
      {sub.length > 0 ? (
        <div className="space-y-1.5">
          <p className={cn(UI_ENGINE_TYPE_META, "px-0.5 font-medium text-slate-500")}>
            Sub-pekerjaan
          </p>
          {sub.map((r) => (
            <DragCard
              key={r.id}
              payload={{ kind: "LIB_SUB", id: r.id, name: r.name }}
              title={r.name}
              subtitle={r.createdBy ? `oleh ${r.createdBy}` : null}
              meta={`${r.materialLineCount} bahan · ${r.serviceLineCount} jasa`}
              accent="indigo"
            />
          ))}
        </div>
      ) : null}

      {obj.length > 0 ? (
        <div className="space-y-1.5">
          <p className={cn(UI_ENGINE_TYPE_META, "px-0.5 font-medium text-slate-500")}>
            Pekerjaan
          </p>
          {obj.map((r) => (
            <DragCard
              key={r.id}
              payload={{ kind: "LIB_OBJ", id: r.id, name: r.name }}
              title={r.name}
              subtitle={[r.code, `per ${r.unit}`].filter(Boolean).join(" · ")}
              meta={`${r.subObjectCount} sub · ${r.materialLineCount} bahan · ${r.serviceLineCount} jasa`}
              accent="indigo"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sumber 2 — Template BQ
// ---------------------------------------------------------------------------

/**
 * Template tidak memanggil server sama sekali — datanya modul statis yang ikut
 * bundle. Itu sebabnya pencariannya tidak ditunda: tidak ada request untuk
 * dihemat, dan menunda 250ms cuma membuatnya terasa lebih lambat dari yang
 * sebenarnya.
 */
function TemplateSource({ query }: { query: string }) {
  const rows = React.useMemo(() => browseTemplateItems(query), [query]);
  if (rows.length === 0) return <SourceState>Tidak ada item yang cocok.</SourceState>;

  // Dikelompokkan per grup supaya asalnya jelas — "Mobilization" tanpa
  // "Preliminaries" di atasnya kehilangan separuh maknanya.
  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = `${r.sectionCode} · ${r.groupName}`;
    const list = grouped.get(key) ?? [];
    list.push(r);
    grouped.set(key, list);
  }

  return (
    <div className="space-y-3">
      {[...grouped.entries()].map(([heading, items]) => (
        <div key={heading} className="space-y-1.5">
          <p className={cn(UI_ENGINE_TYPE_META, "px-0.5 font-medium text-slate-500")}>
            {heading}
          </p>
          {items.map((r) => (
            <DragCard
              key={r.templateKey}
              payload={{
                kind: "TEMPLATE",
                templateKey: r.templateKey,
                groupName: r.groupName,
                itemName: r.itemName,
                name: r.itemName,
              }}
              title={r.itemName}
              subtitle={[r.itemSpec, `satuan ${r.unit}`].filter(Boolean).join(" · ")}
              meta={
                r.lineCount > 0 ? `${r.lineCount} baris pembentuk` : "belum ada pembentuk"
              }
              accent="slate"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sumber 3 — Master Data (harga)
// ---------------------------------------------------------------------------

/**
 * Hanya kandidat SIAP PAKAI yang bisa diseret.
 *
 * Bahan tanpa harga aktif atau dengan unit yang tidak cocok tetap DITAMPILKAN,
 * berikut alasannya, tapi tidak `draggable`. Menyaringnya diam-diam adalah cara
 * tercepat membuat estimator mencari bahan yang ia TAHU ada di Master Data,
 * tidak menemukannya, lalu menyimpulkan alatnya rusak (alasan yang sama dengan
 * di `BqLinePicker`).
 */
function MasterDataSource({ query, active }: { query: string; active: boolean }) {
  const [materials, setMaterials] = React.useState<BqMaterialCandidate[]>([]);
  const [services, setServices] = React.useState<BqServiceCandidate[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [a, b] = await Promise.all([
          searchBqMaterialsAction({ query }),
          searchBqServicesAction({ query }),
        ]);
        if (cancelled) return;
        if (a.success) setMaterials(a.data);
        if (b.success) setServices(b.data);
      } catch {
        /* daftar dibiarkan apa adanya */
      }
      if (!cancelled) setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, active]);

  if (loading) return <SourceState>Memuat…</SourceState>;
  if (materials.length === 0 && services.length === 0) {
    return (
      <SourceState>
        {query ? "Tidak ada yang cocok di Master Data." : "Ketik untuk mencari bahan atau jasa."}
      </SourceState>
    );
  }

  return (
    <div className="space-y-3">
      {materials.length > 0 ? (
        <div className="space-y-1.5">
          <p className={cn(UI_ENGINE_TYPE_META, "px-0.5 font-medium text-slate-500")}>
            Bahan
          </p>
          {materials.map((m) => {
            const price = m.priceOptions[0];
            if (!price) {
              return (
                <div
                  key={m.skuId}
                  className={cn(
                    "border border-dashed border-slate-200 bg-slate-50 px-2.5 py-2",
                    UI_ENGINE_RADIUS_CONTROL,
                  )}
                  title="Harga belum dicatat di Master Data"
                >
                  <p className="truncate font-sans text-xs text-slate-500">{m.name}</p>
                  <p className={cn(UI_ENGINE_TYPE_META, "mt-0.5 text-amber-700")}>
                    belum ada harga — lengkapi di Master Data
                  </p>
                </div>
              );
            }
            return (
              <DragCard
                key={m.skuId}
                payload={{
                  kind: "MATERIAL",
                  skuId: m.skuId,
                  skuPriceId: price.skuPriceId,
                  name: m.name,
                }}
                title={m.name}
                subtitle={[m.code, m.brandName].filter(Boolean).join(" · ") || null}
                meta={`${formatIdr(price.price)} / ${price.unit}`}
                accent="sky"
              />
            );
          })}
        </div>
      ) : null}

      {services.length > 0 ? (
        <div className="space-y-1.5">
          <p className={cn(UI_ENGINE_TYPE_META, "px-0.5 font-medium text-slate-500")}>
            Jasa
          </p>
          {services.map((sv) => (
            <DragCard
              key={sv.workPriceId}
              payload={{ kind: "SERVICE", workPriceId: sv.workPriceId, name: sv.name }}
              title={sv.name}
              subtitle={[sv.code, sv.vendorName].filter(Boolean).join(" · ") || null}
              meta={`${formatIdr(sv.price)} / ${sv.rateUnit}${sv.hasMaterial ? " · incl. material" : ""}`}
              accent="sky"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
