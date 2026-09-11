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
 *   FR-EXP-03  Expand L2 -> baris L3, bahan dulu lalu jasa, dengan koefisien
 *              yang diisi estimator secara manual.
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
  ChevronDown,
  ChevronRight,
  BookmarkPlus,
  Hammer,
  LayoutTemplate,
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
import {
  UI_ENGINE_ICON_DECORATIVE,
  UI_ENGINE_TEXT_TERTIARY,
  UI_ENGINE_TYPE_META,
} from "@/ui_engine/tokens";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { statusToTone } from "@/lib/ui/status-tone";
import { cn } from "@/lib/utils";
import { formatIdr, formatQty } from "../lib/calc";
import { costCategoryLabel } from "../lib/cost-category";
import {
  MAX_SECTION_DEPTH,
  buildSectionTree,
  countWorksDeep,
  type SectionTreeNode,
} from "../lib/section-tree";
import type { MaterialLineResult, ServiceLineResult } from "../lib/calc";
import {
  addBqMaterialLineAction,
  addBqLocalMaterialLineAction,
  addBqServiceLineAction,
  addBqLocalServiceLineAction,
  createBqObjectAction,
  deleteBqMaterialLineAction,
  deleteBqObjectAction,
  deleteBqServiceLineAction,
  deleteBqSubObjectAction,
  setBqObjectLockAction,
  updateBqMaterialLineAction,
  updateBqObjectAction,
  updateBqSectionAction,
  updateBqServiceLineAction,
  updateBqSubObjectAction,
} from "../actions/bq-project-actions";
import {
  createBqSectionAction,
  deleteBqSectionAction,
} from "../actions/bq-project-actions";
import {
  createBqObjectFromLibraryAction,
  saveObjectToLibraryAction,
  searchLibraryObjectsAction,
  saveSubObjectToLibraryAndLinkAction,
} from "../actions/bq-library-actions";
import { BqLinePicker } from "./BqLinePicker";
import {
  BqQuickAddRow,
  type QuickAddCommit,
  type QuickAddMode,
} from "./BqQuickAddRow";
import { BqToolbar, type OutlineLevel } from "./BqToolbar";
import {
  addTemplateItemAction,
  applyBqTemplateAction,
} from "../actions/bq-template-actions";
import { BQ_TEMPLATE_SUMMARY } from "../lib/bq-template-data";
import {
  suggestedTemplateItems,
  templateItemKey,
} from "../lib/bq-template-lookup";
import type {
  BqCostCategory,
  BqMaterialLineRecord,
  BqObjectView,
  BqServiceLineRecord,
  BqProjectView,
  BqSectionView,
} from "../types/breakdown";

// ---------------------------------------------------------------------------
// Bantu
// ---------------------------------------------------------------------------

type ActionResultLike = { success: boolean; error?: string };
/** Bentuk minimum resep Library untuk ditawarkan di pencarian tambah-pekerjaan. */
type LibraryRecipeOption = {
  id: string;
  name: string;
  unit: string;
  materialLineCount: number;
  serviceLineCount: number;
};
type ActionResultWith<T> = ActionResultLike & { data?: T };

function duplicateSuggestionNames(
  item: {
    name: string;
    area: string | null;
  },
): string {
  return item.area ? `${item.area} — ${item.name}` : item.name;
}

function suggestionNameCounts(
  items: readonly {
    name: string;
    area: string | null;
  }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const name = duplicateSuggestionNames(item);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

function suggestionLabel(
  item: {
    name: string;
    area: string | null;
    spec: string | null;
  },
  counts: ReadonlyMap<string, number>,
): string {
  const name = duplicateSuggestionNames(item);
  if ((counts.get(name) ?? 0) <= 1 || !item.spec?.trim()) return name;
  return `${name} · ${item.spec}`;
}

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

  /**
   * Seperti `run`, tapi mengembalikan payload aksinya.
   *
   * Dibutuhkan sejak Sub Section dibuat langsung dari menu: barisnya harus
   * LANGSUNG masuk mode ganti-nama, dan untuk itu kita perlu id-nya sekarang —
   * bukan setelah `router.refresh()` selesai.
   */
  const runData = React.useCallback(
    async <T,>(
      fn: () => Promise<ActionResultWith<T>>,
      successMessage?: string,
    ): Promise<T | null> => {
      setPending(true);
      const result = await fn();
      setPending(false);

      if (!result.success) {
        toast.error(result.error ?? "That change could not be saved.");
        return null;
      }
      if (successMessage) toast.success(successMessage);
      void router.refresh();
      return result.data ?? null;
    },
    [router],
  );

  return { run, runData, pending };
}

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
        <span className={cn(UI_ENGINE_TYPE_META, UI_ENGINE_TEXT_TERTIARY)}>
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

/**
 * Drag-drop dari panel Sumber DICABUT 2026-08-27 bersama panelnya.
 *
 * Ia tidak pernah berfungsi: `useRecipeDropZone` memanggil
 * `dataTransfer.getData()` di `dragenter`/`dragover`, padahal selama dua fase
 * itu drag data store ada dalam PROTECTED MODE dan `getData()` selalu
 * mengembalikan string kosong — hanya `types` yang boleh dibaca. Penjaganya
 * karena itu selalu bernilai null, `preventDefault()` tidak pernah dipanggil,
 * browser menolak drop, dan `onDrop` tidak pernah jalan.
 *
 * Komentar aslinya sudah menuliskan kegagalan itu persis ("dragover HARUS
 * memanggil preventDefault"), lalu memasang penjaga yang membaca data yang
 * belum boleh dibaca.
 *
 * Tidak diperbaiki, tapi dibuang: seluruh fungsinya sudah ada di klik-kanan
 * (Tambah Pekerjaan, dengan saran template di dalam pencariannya) dan di
 * quick-add row (`+ Tambah Bahan` / `+ Tambah Jasa`, mencari master data
 * inline). Memelihara jalan kedua yang rusak untuk hal yang sudah bisa
 * dilakukan bukan kesederhanaan.
 */

/**
 * Badge pos biaya. Hanya muncul untuk kategori yang BUKAN default barisnya —
 * baris bahan ber-MATERIAL dan jasa UPAH murni sudah jelas dari seksinya.
 * Pengecualian: jasa borongan tetap ber-enum UPAH tetapi membawa material,
 * sehingga harus diberi label terpisah bersama kategori non-default lain.
 */
function CostCategoryBadge({
  category,
  defaultFor,
  hasMaterial = false,
}: {
  category: BqCostCategory;
  defaultFor: BqCostCategory;
  hasMaterial?: boolean;
}) {
  const label = costCategoryLabel(category, defaultFor, hasMaterial);
  if (!label) return null;
  return (
    <span
      className={cn(
        UI_ENGINE_TYPE_META,
        "rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700",
      )}
      title={
        hasMaterial
          ? "This service rate includes material."
          : "Cost category outside the default line type."
      }
    >
      {label}
    </span>
  );
}

/**
 * Satu angka di kolom kanan.
 *
 * `label` OPSIONAL, dan pada baris L1 sengaja tidak diisi: strip header kolom
 * di atas grid bersifat sticky, jadi ia melayani seluruh baris sekaligus.
 * Sebelumnya tiap baris membawa labelnya sendiri dan kata "Jumlah" muncul 11
 * kali dalam satu layar — label bersaing dengan angka yang seharusnya jadi
 * fokus. `width` menjaga kolom tetap sejajar dengan strip header itu.
 */

// ---------------------------------------------------------------------------
// L0 — Seksi & Divisi
// ---------------------------------------------------------------------------

type SectionNode = SectionTreeNode<BqSectionView, BqObjectView>;

type Shared = {
  closedSections: Set<string>;
  onToggleSection: (id: string) => void;
  openObjects: Set<string>;
  openSubObjects: Set<string>;
  toggleManual: (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) => void;
  setOpenObjects: React.Dispatch<React.SetStateAction<Set<string>>>;
  setOpenSubObjects: React.Dispatch<React.SetStateAction<Set<string>>>;
  onAddTemplateItem: (
    sectionId: string,
    templateKey: string,
    groupName: string,
    itemName: string,
  ) => Promise<boolean>;
  onAddObject: (sectionId: string, name: string) => Promise<boolean>;
  /** Resep Works yang tersimpan di Library BQ — ikut ditawarkan di pencarian
   *  yang sama dengan saran template. */
  libraryRecipes: LibraryRecipeOption[];
  onAddFromLibrary: (sectionId: string, libraryObjectId: string) => Promise<boolean>;
  onRemoveSection: (section: BqSectionView) => void;
  /**
   * SATU baris tambah untuk seluruh pohon.
   *
   * Sebelumnya tiap `SectionBlock` memegang state-nya sendiri, jadi dua kotak
   * bisa terbuka sekaligus di dua pengelompok berbeda — dan yang di atas tampak
   * seperti form permanen yang tertinggal, persis yang mau dihapus BQ-35.
   * Dengan satu state, membuka yang baru menutup yang lama dengan sendirinya.
   */
  /** Satu baris cari-Works untuk seluruh pohon — membuka yang baru menutup
   *  yang lama. Sub Section TIDAK lewat sini: ia dibuat langsung dari menu. */
  addWorksIn: string | null;
  setAddWorksIn: (sectionId: string | null) => void;
  /** Section yang baru dibuat dan harus langsung masuk mode ganti-nama. */
  renameTarget: string | null;
  onRenameSection: (sectionId: string, name: string) => void;
  onAddSubSection: (parentId: string) => Promise<void>;
  canEdit: boolean;
  run: (fn: () => Promise<ActionResultLike>, msg?: string) => Promise<boolean>;
  pending: boolean;
};

/**
 * SATU GRID ANGKA UNTUK SELURUH BARIS.
 *
 * Sebelum 2026-08-27 ada TIGA sistem layout untuk kolom yang sama:
 *
 *   strip header    px-4 + pr-0.5   w-14 / w-24 / w-28
 *   baris seksi     tanpa padding                 w-28
 *   baris Works     px-6, di dalam kartu berbingkai  w-14 / w-24 / w-28
 *
 * Akibatnya "Rp 0" milik seksi mendarat ~24px di kanan "Rp 0" milik Works, dan
 * tidak satu pun sejajar dengan judul kolomnya sendiri. Pada layar bertipe
 * spreadsheet itu bukan cacat kosmetik: mata membaca kolom, dan kolom yang
 * bergeser antar jenis baris membuat angka tidak bisa dibandingkan sekilas.
 *
 * Ketiganya sekarang memakai konstanta yang sama. Kalau salah satu kolom
 * berubah lebar, ubah DI SINI — jangan di salah satu pemakainya.
 */
const ROW_PX = "px-4";
const COL_GAP = "gap-x-6";
const COL_VOL = "w-14";
const COL_PRICE = "w-24";
const COL_TOTAL = "w-28";

/**
 * Nama yang bisa diganti di tempat.
 *
 * Menggantikan kotak "Sub Section baru di …" yang dulu muncul terpisah. Alurnya
 * jadi satu langkah: menu membuat barisnya, baris itu langsung masuk mode
 * ganti-nama (`autoEdit`), pengguna mengetik dan menekan Enter. Tidak ada kotak
 * mengambang yang bisa tertinggal terbuka.
 *
 * Escape membatalkan dan mengembalikan nama lama — penting karena baris yang
 * baru dibuat sudah punya nama bawaan yang sah; membatalkan tidak boleh
 * meninggalkan nama kosong.
 */
function EditableName({
  value,
  onCommit,
  autoEdit = false,
  disabled = false,
  className,
}: {
  value: string;
  onCommit: (next: string) => void;
  /** Langsung masuk mode edit — dipakai baris yang baru dibuat. */
  autoEdit?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = React.useState(autoEdit);
  const [draft, setDraft] = React.useState(value);
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  React.useEffect(() => {
    if (editing) ref.current?.select();
  }, [editing]);

  if (!editing || disabled) {
    return (
      <span
        className={cn(className, !disabled && "cursor-text")}
        onClick={
          disabled
            ? undefined
            : (event) => {
                // Header seksi itu tombol buka/tutup. Tanpa ini, mengklik nama
                // ikut melipat isinya.
                event.stopPropagation();
                setEditing(true);
              }
        }
        title={disabled ? undefined : "Klik untuk ganti nama"}
      >
        {value}
      </span>
    );
  }

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onCommit(next);
    setEditing(false);
  };

  return (
    <Input
      ref={ref}
      autoFocus
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setDraft(value);
          setEditing(false);
        }
      }}
      className={cn("h-7 max-w-xs text-sm", className)}
    />
  );
}

/**
 * Satu pengelompok beserta isinya — dipakai untuk KETIGA lapis.
 *
 * Sebelumnya ada dua komponen kembar (`SectionBlock` + `DivisionBlock`) yang
 * mengunci tampilan di dua lapis. Begitu L2 Sub Section ada, seluruh Works di
 * dalamnya tidak akan pernah dirender — hilang dari layar tanpa pesan apa pun.
 * Karena itu bentuknya jadi rekursi: kedalaman berapa pun tetap tampil, dan
 * batas tiga lapis ditegakkan di server (lihat `lib/section-tree.ts`).
 */
function SectionBlock({
  node,
  depth = 0,
  ...shared
}: { node: SectionNode; depth?: number } & Shared) {
  const open = !shared.closedSections.has(node.section.id);
  const canNest = depth + 1 < MAX_SECTION_DEPTH;

  const addingWorks = shared.addWorksIn === node.section.id;
  const closeAdd = () => shared.setAddWorksIn(null);

  const openSection = () => {
    if (!open) shared.onToggleSection(node.section.id);
  };

  return (
    <div className="space-y-1.5">
      <ContextMenu>
        <ContextMenuTrigger asChild disabled={!shared.canEdit}>
          <div>
            <SectionHeader
              section={node.section}
              open={open}
              depth={depth}
              childCount={countWorksDeep(node)}
              childLabel="item"
              onToggle={() => shared.onToggleSection(node.section.id)}
              canEdit={shared.canEdit}
              autoEdit={shared.renameTarget === node.section.id}
              onRename={(name) => shared.onRenameSection(node.section.id, name)}
            />
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuLabel>{node.section.name}</ContextMenuLabel>
          <ContextMenuItem
            onSelect={() => {
              openSection();
              shared.setAddWorksIn(node.section.id);
            }}
          >
            <Plus /> Tambah Pekerjaan
          </ContextMenuItem>
          {canNest ? (
            <ContextMenuItem
              onSelect={() => {
                openSection();
                void shared.onAddSubSection(node.section.id);
              }}
            >
              <Plus /> Tambah Sub Section
            </ContextMenuItem>
          ) : null}
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onSelect={() => shared.onRemoveSection(node.section)}
          >
            <Trash2 /> Hapus
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {open ? (
        <div className="space-y-1.5">
          {/* Works yang menggantung langsung — bentuk PRELIMINARIES di dokumen
              kantor, dan juga Floor Works yang tidak memakai lapis area. */}
          <ObjectList
            section={node.section}
            objects={node.objects}
            addOpen={addingWorks}
            onAddClose={closeAdd}
            {...shared}
          />

          {/* Anak — indentasi menandai bahwa ia satu lapis di dalam. */}
          {node.children.map((child) => (
            <div key={child.section.id} className="space-y-1.5 pl-5">
              <SectionBlock node={child} depth={depth + 1} {...shared} />
            </div>
          ))}

        </div>
      ) : null}
    </div>
  );
}

function SectionHeader({
  section,
  open,
  depth,
  childCount,
  childLabel,
  onToggle,
  canEdit,
  autoEdit = false,
  onRename,
}: {
  section: BqSectionView;
  open: boolean;
  /** 0 = L0 Section, 1 = L1 Sub Section, 2 = L2 Sub Section. */
  depth: number;
  childCount: number;
  childLabel: string;
  onToggle: () => void;
  /** Dipakai hanya untuk petunjuk klik-kanan — aksinya sendiri di context menu. */
  canEdit: boolean;
  /** Baris yang baru dibuat langsung bisa diketik namanya. */
  autoEdit?: boolean;
  onRename: (name: string) => void;
}) {
  return (
    <div
      className={cn("group/sec flex items-center gap-1", ROW_PX)}
      title={canEdit ? "Klik kanan untuk menambah atau menghapus" : undefined}
    >
      {/* Tombol lipat dan nama SENGAJA bersebelahan, bukan bersarang.
          `EditableName` merender <Input>, dan <input> di dalam <button> itu
          HTML tidak sah — kliknya nyasar ke tombol dan pengetikan bisa memicu
          lipat. Jadi tombolnya cuma memuat chevron dan kode; namanya berdiri
          sendiri sebagai target ganti-nama. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? `Tutup ${section.name}` : `Buka ${section.name}`}
        className="flex shrink-0 items-center gap-2 py-1 text-left"
      >
        {open ? (
          <ChevronDown className={cn("h-4 w-4 shrink-0", UI_ENGINE_ICON_DECORATIVE)} />
        ) : (
          <ChevronRight className={cn("h-4 w-4 shrink-0", UI_ENGINE_ICON_DECORATIVE)} />
        )}
        {section.code ? (
          <span className="text-slate-500">{section.code}</span>
        ) : null}
      </button>

      <span
        className={cn(
          "min-w-0 font-serif text-slate-900",
          // Bobotnya turun tiap lapis — itu satu-satunya pembeda antar lapis
          // selain indentasi. Tanpa ini L1 dan L2 terlihat kembar.
          depth === 0 && "text-base font-semibold",
          depth === 1 && "text-sm font-semibold",
          depth >= 2 && "text-sm font-medium",
        )}
      >
        <EditableName
          value={section.name}
          autoEdit={autoEdit}
          disabled={!canEdit}
          onCommit={onRename}
        />
      </span>

      {/* Saat tertutup, isinya harus tetap terhitung — kalau tidak, seksi
          tertutup terlihat sama dengan seksi kosong. */}
      {!open ? (
        <span className={cn(UI_ENGINE_TYPE_META, UI_ENGINE_TEXT_TERTIARY)}>
          {childCount} {childLabel}
        </span>
      ) : null}

      {/* Kolom kosong supaya subtotal mendarat tepat di bawah "Jumlah",
          sejajar dengan Works — bukan menempel di tepi kanan sendiri. */}
      <span className={cn("ml-auto flex items-center", COL_GAP)}>
        <span className={COL_VOL} aria-hidden />
        <span className={COL_PRICE} aria-hidden />
        <span
          className={cn(
            COL_TOTAL,
            "text-right font-sans text-sm font-medium tabular-nums text-slate-700",
          )}
        >
          {formatIdr(section.subtotal)}
        </span>
      </span>
    </div>
  );
}

/**
 * Daftar item di dalam sebuah seksi/divisi, plus saran template dan tombol
 * tambah item.
 *
 * Kosong pun tetap merender wadahnya kalau ada saran — seksi hasil template
 * memang lahir kosong, dan justru di situlah sarannya paling dibutuhkan.
 */
function ObjectList({
  section,
  objects,
  addOpen,
  onAddClose,
  ...shared
}: {
  section: BqSectionView;
  objects: BqObjectView[];
  /** Dibuka dari menu klik-kanan pengelompok. */
  addOpen: boolean;
  onAddClose: () => void;
} & Shared) {
  const suggestions = React.useMemo(
    () =>
      suggestedTemplateItems(
        section.name,
        objects.map((o) => ({
          name: o.computed.name,
          unit: o.computed.unit,
          spec: o.notes,
        })),
      ),
    [section.name, objects],
  );
  const counts = React.useMemo(() => suggestionNameCounts(suggestions), [suggestions]);

  const hasAnything = objects.length > 0 || addOpen;
  if (!hasAnything) return null;

  return (
    <div
            className={cn(
        // Baris polos, bukan kartu berbingkai. Kartu membuat Works terbaca
        // sebagai jenis benda yang berbeda dari pengelompoknya, padahal
        // keduanya baris di tabel yang sama — dan bingkainya menambah inset
        // yang menggeser kolom angka. Kedalaman sudah dibawa indentasi.
        "divide-y divide-slate-100 bg-white transition-colors",
      )}
    >
      {objects.map((object) => (
        <ObjectRow
          key={object.computed.objectId}
          object={object}
          isOpen={shared.openObjects.has(object.computed.objectId)}
          openSubObjects={shared.openSubObjects}
          onToggle={() =>
            shared.toggleManual(shared.setOpenObjects, object.computed.objectId)
          }
          onToggleSub={(id) => shared.toggleManual(shared.setOpenSubObjects, id)}
          canEdit={shared.canEdit}
          run={shared.run}
          pending={shared.pending}
        />
      ))}

      {/* Baris tambah muncul HANYA saat diminta lewat klik-kanan. Saran
          template ikut ke dalam pencariannya — dulu ia blok chip permanen yang
          menempel di setiap daftar. */}
      {addOpen ? (
        <div className={cn("py-2", ROW_PX)}>
          <CreatableSearch
            groups={[
              {
                label: "Library",
                options: shared.libraryRecipes.map((r) => ({
                  id: `lib:${r.id}`,
                  name: r.name,
                  subText: `${r.unit} · ${r.materialLineCount + r.serviceLineCount} sub-works`,
                })),
              },
              {
                label: "Template",
                options: suggestions
              .map((item) => {
                const key = templateItemKey(item);
                return key
                  ? {
                      id: key,
                      name: suggestionLabel(item, counts),
                      subText: item.unit,
                    }
                  : null;
              })
                  .filter((o): o is { id: string; name: string; subText: string } => o !== null),
              },
            ].filter((g) => g.options.length > 0)}
            allowFreeText
            placeholder={`Pekerjaan baru di ${section.name}`}
            createLabel={'Buat "{q}"'}
            emptyLabel="Ketik nama pekerjaannya"
            aria-label={`Tambah pekerjaan di ${section.name}`}
            onSelect={(id, name) => {
              if (!id) return;
              // Prefiks `lib:` memisahkan resep Library dari kunci template.
              // Keduanya hidup di satu pencarian karena bagi estimator keduanya
              // hal yang sama — "pekerjaan yang sudah pernah disusun".
              if (id.startsWith("lib:")) {
                void shared
                  .onAddFromLibrary(section.id, id.slice(4))
                  .then(onAddClose);
                return;
              }
              void shared
                .onAddTemplateItem(section.id, id, section.name, name)
                .then(onAddClose);
            }}
            onCreate={(name) => {
              void shared.onAddObject(section.id, name).then(onAddClose);
            }}
            className="max-w-sm"
          />
        </div>
      ) : null}
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  emphasis = "default",
  width,
}: {
  label?: string;
  value: React.ReactNode;
  emphasis?: "default" | "strong" | "serif";
  width?: string;
}) {
  return (
    <div className={cn("min-w-0 text-right", width)}>
      {label ? <p className={cn(UI_ENGINE_TYPE_META, UI_ENGINE_TEXT_TERTIARY)}>{label}</p> : null}
      <p
        className={cn(
          "font-sans text-sm tabular-nums text-slate-700",
          emphasis === "strong" && "font-medium text-slate-900",
          emphasis === "serif" && "font-serif text-base font-semibold text-slate-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Komponen utama
// ---------------------------------------------------------------------------

export function BqBreakdownClient({
  view,
  canEdit,
}: {
  view: BqProjectView;
  canEdit: boolean;
}) {
  const { run, runData, pending } = useMutate();

  // FR-EXP-01 / FR-EXP-02: keduanya default TERTUTUP, jadi state menyimpan
  // yang TERBUKA. Menyimpan yang tertutup akan membuat object baru muncul
  // dalam keadaan terbuka, dan "default tertutup" berhenti berlaku persis
  // saat estimator paling butuh pandangan klien.
  /**
   * Resep Library dimuat SEKALI saat halaman siap, bukan per pencarian.
   *
   * Daftarnya kecil (resep kantor, bukan katalog master data) dan dipakai di
   * setiap kotak tambah-pekerjaan — memuatnya ulang tiap ketikan berarti satu
   * server action per karakter untuk data yang praktis tidak berubah.
   */
  const [libraryRecipes, setLibraryRecipes] = React.useState<LibraryRecipeOption[]>([]);
  React.useEffect(() => {
    if (!canEdit) return;
    let alive = true;
    void searchLibraryObjectsAction({ query: "" }).then((result) => {
      if (alive && result.success && result.data) setLibraryRecipes(result.data);
    });
    return () => {
      alive = false;
    };
  }, [canEdit]);

  /** Baris cari-Works yang sedang terbuka — SATU untuk seluruh pohon. */
  const [addWorksIn, setAddWorksIn] = React.useState<string | null>(null);
  /** Section yang baru dibuat dan harus langsung bisa diketik namanya. */
  const [renameTarget, setRenameTarget] = React.useState<string | null>(null);
  const [openObjects, setOpenObjects] = React.useState<Set<string>>(new Set());
  const [openSubObjects, setOpenSubObjects] = React.useState<Set<string>>(
    new Set(),
  );

  // Toolbar global — lihat BqToolbar.tsx untuk alasan pemindahannya ke sini.
  const [outlineLevel, setOutlineLevel] = React.useState<OutlineLevel | null>(1);

  /** Seksi yang DITUTUP. Menyimpan yang tertutup, bukan yang terbuka, supaya
   *  seksi baru muncul terbuka — seksi yang lahir tertutup menyembunyikan
   *  pekerjaan yang baru saja dibuat pengguna. */
  const [closedSections, setClosedSections] = React.useState<Set<string>>(
    new Set(),
  );

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

  /** Tingkat rincian 1/2/3 menata SELURUH dokumen sekaligus (outline Excel).
   *  Chevron per baris tetap bebas menyimpang sesudahnya — begitu itu terjadi
   *  `outlineLevel` dilepas ke null supaya tombol tidak berbohong soal keadaan. */
  const applyOutline = React.useCallback(
    (level: OutlineLevel) => {
      setOutlineLevel(level);
      const objectIds = view.objects.map((o) => o.computed.objectId);
      const subIds = view.objects.flatMap((o) => o.subObjects.map((s) => s.id));
      setOpenObjects(level >= 2 ? new Set(objectIds) : new Set());
      setOpenSubObjects(level >= 3 ? new Set(subIds) : new Set());
    },
    [view.objects],
  );

  const toggleSection = React.useCallback((id: string) => {
    setClosedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  /** Setiap toggle manual melepas penanda tingkat — lihat komentar di atas. */
  const toggleManual = React.useCallback(
    (setter: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) => {
      setOutlineLevel(null);
      toggle(setter, id);
    },
    [toggle],
  );

  /** Object dikelompokkan per seksi, urut `sortOrder`. Object tanpa seksi
   *  jatuh ke satu kelompok tanpa judul yang selalu ditaruh paling akhir —
   *  supaya BQ campuran (sebagian berseksi, sebagian tidak) tetap terbaca. */
  /**
   * Pohon tampilan: seksi → divisi → item.
   *
   * Dokumen BQ punya DUA lapis pengelompok, dan keduanya bersubtotal
   * ("SUBTOTAL A", "SUBTOTAL B.I"). Yang berbeda cuma posisinya di pohon —
   * bentuk datanya identik, jadi satu tipe melayani keduanya.
   *
   * Item tanpa seksi tidak disembunyikan: ia jatuh ke kelompok tanpa judul
   * paling bawah. Item yang lenyap dari layar padahal datanya ada adalah cara
   * tercepat membuat estimator kehilangan kepercayaan pada totalnya.
   */
  const tree = React.useMemo(() => {
    const bySection = new Map<string, BqObjectView[]>();
    const orphans: BqObjectView[] = [];
    for (const o of view.objects) {
      if (!o.sectionId) {
        orphans.push(o);
        continue;
      }
      const list = bySection.get(o.sectionId) ?? [];
      list.push(o);
      bySection.set(o.sectionId, list);
    }

    return { nodes: buildSectionTree(view.sections, bySection), orphans };
  }, [view.sections, view.objects]);

  const hasRenderableStructure =
    tree.nodes.length > 0 || tree.orphans.length > 0;

  const lockAll = React.useCallback(
    async (locked: boolean) => {
      const targets = view.objects.filter((o) => (o.lockedAt !== null) !== locked);
      if (targets.length === 0) {
        toast.info(locked ? "Semua sudah terkunci." : "Semua sudah terbuka.");
        return;
      }
      for (const object of targets) {
        await run(() =>
          setBqObjectLockAction({ id: object.computed.objectId, locked }),
        );
      }
      toast.success(
        locked
          ? `${targets.length} pekerjaan dikunci.`
          : `${targets.length} pekerjaan dibuka.`,
      );
    },
    [view.objects, run],
  );



  /** Menambah pekerjaan DI DALAM sebuah seksi. `sectionId` null hanya untuk
   *  BQ lama yang memang tidak memakai seksi. */
  const addObjectToSection = React.useCallback(
    async (sectionId: string | null, name: string) =>
      run(
        () =>
          createBqObjectAction({
            projectId: view.project.id,
            sectionId: sectionId ?? undefined,
            name,
          }),
        "Pekerjaan ditambahkan.",
      ),
    [run, view.project.id],
  );

  const addFromLibrary = React.useCallback(
    async (sectionId: string, libraryObjectId: string) =>
      run(
        () =>
          createBqObjectFromLibraryAction({
            projectId: view.project.id,
            sectionId,
            libraryObjectId,
          }),
        "Pekerjaan dibuat dari Library.",
      ),
    [run, view.project.id],
  );

  const addTemplateItem = React.useCallback(
    async (
      sectionId: string,
      templateKey: string,
      groupName: string,
      itemName: string,
    ) =>
      run(
        () => addTemplateItemAction({ sectionId, templateKey, groupName, itemName }),
        `"${itemName}" ditambahkan.`,
      ),
    [run],
  );

  /**
   * Sub Section dibuat LANGSUNG dari menu, dengan nama bawaan, lalu barisnya
   * masuk mode ganti-nama. Dulu ia lewat kotak "Sub Section baru di …" yang
   * muncul terpisah dan bisa tertinggal terbuka — lihat CHANGELOG 2026-08-27.
   */
  const addSubSection = React.useCallback(
    async (parentId: string) => {
      const created = await runData<{ id: string }>(
        () =>
          createBqSectionAction({
            projectId: view.project.id,
            parentId,
            name: "Sub Section baru",
          }),
      );
      if (created?.id) setRenameTarget(created.id);
    },
    [runData, view.project.id],
  );

  /** Section tingkat atas. Sama polanya dengan Sub Section: dibuat langsung
   *  dengan nama bawaan, lalu barisnya masuk mode ganti-nama. */
  const addSection = React.useCallback(async () => {
    const created = await runData<{ id: string }>(() =>
      createBqSectionAction({ projectId: view.project.id, name: "Section baru" }),
    );
    if (created?.id) setRenameTarget(created.id);
  }, [runData, view.project.id]);

  const renameSection = React.useCallback(
    (sectionId: string, name: string) => {
      setRenameTarget(null);
      void run(() => updateBqSectionAction({ id: sectionId, name }));
    },
    [run],
  );

  const removeSection = React.useCallback(
    async (section: BqSectionView) => {
      if (
        !window.confirm(
          `Hapus seksi "${section.name}"?\n\n` +
            (section.objectCount > 0
              ? `${section.objectCount} pekerjaan di dalamnya TIDAK ikut terhapus — ` +
                `mereka pindah ke kelompok tanpa seksi di bawah.`
              : "Seksi ini kosong."),
        )
      ) {
        return;
      }
      await run(
        () => deleteBqSectionAction({ id: section.id }),
        `Seksi "${section.name}" dihapus.`,
      );
    },
    [run],
  );

  return (
    <SpreadsheetTemplate
      // Halaman ini melebar penuh, tidak mengikuti CONTAINER_MAX_WIDTH kantor.
      // Alasannya bukan selera: dock kiri memakan 288px, dan sisanya harus
      // menampung enam kolom angka plus indentasi tiga lapis. Pada container
      // baku, kolom Jumlah terdorong sampai tabel L3 mulai menggulir sendiri —
      // dan angka yang harus digulir untuk dilihat adalah angka yang tidak
      // dibaca. `twMerge` membuat `max-w-none` menang atas token bawaan shell.
      className="max-w-none"
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
      toolbar={
        <BqToolbar
          outlineLevel={outlineLevel}
          onOutlineLevel={applyOutline}
          objectCount={view.objects.length}
          lineCount={view.objects.reduce((s, o) => s + o.computed.lineCount, 0)}
          canEdit={canEdit}
          pending={pending}
          onLockAll={(locked) => void lockAll(locked)}
        />
      }
      grid={
        <div>
          <div className="min-w-0">
          {/* ------------------------------------------------------------------ */}
          {/* Grand total — pandangan klien                                      */}
          {/* ------------------------------------------------------------------ */}
          <SectionCard className="mb-4" padding="md">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className={cn(UI_ENGINE_TYPE_META, UI_ENGINE_TEXT_TERTIARY)}>
                  Total Anggaran (RAB)
                </p>
                <p className="font-serif text-3xl font-semibold text-slate-900">
                  {formatIdr(view.totals.grandTotal)}
                </p>
              </div>
            </div>
          </SectionCard>

          {/* ------------------------------------------------------------------ */}
          {/* L1                                                                  */}
          {/* ------------------------------------------------------------------ */}

          {/* Header kolom — konteks visual seperti spreadsheet */}
          {hasRenderableStructure ? (
            /* Strip ini STICKY, dan itu yang membuat baris di bawahnya boleh
               tidak berlabel. Sebelumnya tiap baris L1 dan L2 mengulang
               "Vol. / Harga Sat. / Jumlah" — pada satu layar berisi 9
               sub-pekerjaan, kata "Jumlah" muncul 11 kali. Strip header ADA
               justru supaya pengulangan itu tidak perlu; kalau ia ikut tergulir
               hilang, barisnya kehilangan konteks dan pengulangan jadi
               terpaksa. Dibuat menempel, satu label melayani seluruh kolom. */
            <div
              className={cn(
                "sticky top-[3.25rem] z-10 mb-1 hidden items-center justify-between",
                "border-b border-slate-200 bg-[var(--ui-canvas-bg,rgb(248_250_252))] py-1.5 sm:flex",
                ROW_PX,
              )}
            >
              <span className={cn(UI_ENGINE_TYPE_META, UI_ENGINE_TEXT_TERTIARY)}>Pekerjaan</span>
              <div className={cn("flex items-center", COL_GAP)}>
                <span className={cn(UI_ENGINE_TYPE_META, COL_VOL, "text-right text-slate-500")}>Vol.</span>
                <span className={cn(UI_ENGINE_TYPE_META, COL_PRICE, "text-right text-slate-500")}>Harga</span>
                <span className={cn(UI_ENGINE_TYPE_META, COL_TOTAL, "text-right text-slate-500")}>Jumlah</span>
              </div>
            </div>
          ) : (
            <SectionCard padding="md">
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <p className="font-sans text-sm font-medium text-slate-700">Belum ada pekerjaan</p>
                {canEdit ? (
                  <>
                    <Button
                      variant="outline"
                      className="mt-1"
                      disabled={pending}
                      onClick={() =>
                        void run(
                          () => applyBqTemplateAction({ projectId: view.project.id }),
                          "Kerangka template dibuat.",
                        )
                      }
                    >
                      <LayoutTemplate className="mr-2 h-4 w-4" />
                      Mulai dari Template BQ
                    </Button>
                    <p className={cn(UI_ENGINE_TYPE_META, UI_ENGINE_TEXT_TERTIARY)}>
                      {BQ_TEMPLATE_SUMMARY.sectionCount} seksi ·{" "}
                      {BQ_TEMPLATE_SUMMARY.groupCount} divisi, dengan{" "}
                      {BQ_TEMPLATE_SUMMARY.itemCount} pekerjaan template sebagai saran
                    </p>
                  </>
                ) : null}
              </div>
            </SectionCard>
          )}

          {/* Object dikelompokkan per seksi bila BQ ini memakainya. BQ tanpa
              seksi jatuh ke satu kelompok tanpa judul — bentuk lamanya persis.

              Klik kanan di RUANG KOSONG grid menambah Section tingkat atas.
              Dulu itu satu-satunya hal yang cuma ada di panel Sumber; panelnya
              dicabut, jadi jalurnya pindah ke sini — gesture yang sama dengan
              menambah Sub Section dan Works, di tempat hasilnya muncul. */}
          <ContextMenu>
            <ContextMenuTrigger asChild disabled={!canEdit}>
          <div className="min-h-24 space-y-3">
            {tree.nodes.map((node) => (
              <SectionBlock
                key={node.section.id}
                node={node}
                closedSections={closedSections}
                onToggleSection={toggleSection}
                openObjects={openObjects}
                openSubObjects={openSubObjects}
                toggleManual={toggleManual}
                setOpenObjects={setOpenObjects}
                setOpenSubObjects={setOpenSubObjects}
                onAddTemplateItem={addTemplateItem}
                onAddObject={addObjectToSection}
                libraryRecipes={libraryRecipes}
                onAddFromLibrary={addFromLibrary}
                onAddSubSection={addSubSection}
                onRemoveSection={removeSection}
                addWorksIn={addWorksIn}
                setAddWorksIn={setAddWorksIn}
                renameTarget={renameTarget}
                onRenameSection={renameSection}
                canEdit={canEdit}
                run={run}
                pending={pending}
              />
            ))}

            {/* Item tanpa seksi — BQ lama, atau sisa dari seksi yang dihapus. */}
            {tree.orphans.length > 0 ? (
              <div className="space-y-1.5">
                <p className={cn(UI_ENGINE_TYPE_META, "px-1 pt-2 text-slate-500")}>
                  Tanpa seksi
                </p>
                <div
                  className={cn(
                    "divide-y divide-slate-200 overflow-hidden border border-slate-200 bg-white",
                    UI_ENGINE_RADIUS_CONTROL,
                  )}
                >
                  {tree.orphans.map((object) => (
                    <ObjectRow
                      key={object.computed.objectId}
                      object={object}
                      isOpen={openObjects.has(object.computed.objectId)}
                      openSubObjects={openSubObjects}
                      onToggle={() =>
                        toggleManual(setOpenObjects, object.computed.objectId)
                      }
                      onToggleSub={(id) => toggleManual(setOpenSubObjects, id)}
                      canEdit={canEdit}
                      run={run}
                      pending={pending}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => void addSection()}>
                <Plus /> Tambah Section
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>

          </div>
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
  canEdit,
  run,
  pending,
}: {
  object: BqObjectView;
  isOpen: boolean;
  openSubObjects: Set<string>;
  onToggle: () => void;
  onToggleSub: (id: string) => void;
  canEdit: boolean;
  run: (fn: () => Promise<ActionResultLike>, msg?: string) => Promise<boolean>;
  pending: boolean;
}) {
  const c = object.computed;
  const locked = object.lockedAt !== null;
  const editable = canEdit && !locked;


  return (
    <div
            className={cn(
        "bg-white transition-colors",
        // Sorotan drop dipindah ke latar, bukan bingkai — barisnya sudah tidak
        // punya bingkai sendiri sejak grid jadi tabel.
      )}
    >
      {/* Umpan balik drop di tingkat pekerjaan: resep akan jadi sub-pekerjaan
          BARU di sini, bukan menimpa yang sudah ada. */}
      {/* ---- FR-EXP-01: baris tertutup = satu baris BQ ------------------- */}
      <div className={cn("flex flex-wrap items-start gap-3 py-4", ROW_PX)}>
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          {isOpen ? (
            <ChevronDown className={cn("h-4 w-4 shrink-0", UI_ENGINE_ICON_DECORATIVE)} />
          ) : (
            <ChevronRight className={cn("h-4 w-4 shrink-0", UI_ENGINE_ICON_DECORATIVE)} />
          )}
          <div className="min-w-0 space-y-1">
            {c.code ? (
              <p className={cn(UI_ENGINE_TYPE_META, UI_ENGINE_TEXT_TERTIARY)}>
                {c.code}
              </p>
            ) : null}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate font-sans text-sm font-medium text-slate-900">
                {c.name}
              </span>
              {locked ? (
                <span
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    UI_ENGINE_RADIUS_CONTROL,
                    "inline-flex items-center gap-1 border border-slate-200 bg-slate-50 px-2 py-1 text-slate-500",
                  )}
                >
                  <Lock className="h-3 w-3 shrink-0" />
                  Locked
                </span>
              ) : null}
            </div>
            {/* FR-EXP-08 — tertutup pun tetap tahu isinya. */}
            <p className={cn(UI_ENGINE_TYPE_META, UI_ENGINE_TEXT_TERTIARY)}>
              {/* Kosakata mengikuti PRD-BQ §2: Works berisi Sub-Works. Lapis
                  sub-object sudah dipensiunkan (PRD §8) — ia hanya disebut
                  kalau memang MASIH ADA datanya, supaya baris lama tetap bisa
                  dijelaskan tanpa mengiklankan lapis yang tidak dipakai lagi. */}
              {c.lineCount} sub-works
              {c.subObjectCount > 0
                ? ` · ${c.subObjectCount} sub-object (lama)`
                : ""}
            </p>
          </div>
        </button>

        <div className="ml-auto flex flex-col items-end gap-2">
          <div className={cn("flex flex-wrap items-start justify-end gap-y-2", COL_GAP)}>
            {/* Tanpa label — strip header sticky di atas grid yang menamainya. */}
            <SummaryMetric
              width={COL_VOL}
              value={
                <>
                  {formatQty(c.qty)} {c.unit}
                </>
              }
            />
            <SummaryMetric
              width={COL_PRICE}
              value={formatIdr(c.ratePerUnit)}
              emphasis="strong"
            />
            <SummaryMetric
              width={COL_TOTAL}
              value={formatIdr(c.total)}
              emphasis="serif"
            />
          </div>
          {isOpen ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
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
              {/* Simpan resep ke Library. Sebelum 2026-08-27 tombol ini HANYA
                  ada di sub-pekerjaan — lapis yang sudah dipensiunkan — jadi
                  begitu jalur membuatnya dicabut, Library tidak bisa diisi
                  sama sekali. */}
              {editable ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 hover:text-indigo-600"
                  disabled={pending}
                  title={`Simpan "${c.name}" ke Library sebagai resep`}
                  aria-label={`Simpan ${c.name} ke Library`}
                  onClick={() =>
                    void run(
                      () =>
                        saveObjectToLibraryAction({
                          objectId: c.objectId,
                          name: c.name,
                        }),
                      `"${c.name}" tersimpan ke Library.`,
                    )
                  }
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
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
          ) : null}
        </div>
      </div>

      {/* ---- Terbuka: pandangan estimator -------------------------------- */}
      {isOpen ? (
        <div className="border-t border-slate-100">
          {/* Kontrol object */}
          <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2 bg-slate-50/60 py-2.5", ROW_PX)}>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <label className="flex items-center gap-2">
                <span className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}>
                  Vol.
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

            </div>
          </div>

          {/* ---- Baris yang menempel LANGSUNG di item ----------------------
              Bentuk mayoritas item BQ interior: "Screeding Base" punya semen,
              pasir dan tukang per sqm, tanpa sub-rakitan. Dirender sebelum
              daftar L2 karena itu urutan bacanya — yang langsung dulu, yang
              berlapis kemudian. Total tidak ditampilkan di sini: angkanya
              sudah jadi Harga Sat. item di baris atas. */}
          {editable ||
          c.materials.length > 0 ||
          c.services.length > 0 ? (
            <div className={cn("border-b border-slate-100 pb-4 pt-2", ROW_PX)}>
              <LineTable
                parent={{ objectId: c.objectId }}
                records={{ materials: object.materials, services: object.services }}
                computed={{
                  materials: c.materials,
                  services: c.services,
                  materialsSubtotal: c.materialsSubtotal,
                  servicesSubtotal: c.servicesSubtotal,
                }}
                subtotal={null}
                editable={editable}
                pending={pending}
                run={run}
              />
            </div>
          ) : null}

          {/* ---- FR-EXP-02: L2 -------------------------------------------- */}
          <div className="divide-y divide-slate-100">
            {object.subObjects.map((sub, index) => {
              const computedSub = c.subObjects.find(
                (s) => s.subObjectId === sub.id,
              );
              if (!computedSub) return null;
              return (
                <SubObjectRow
                  key={sub.id}
                  index={index}
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
          {/* "Tambah Sub-pekerjaan" DICABUT 2026-08-27.
              `BqSubObject` sudah dipensiunkan (PRD-BQ §8): baris bahan/jasa
              menempel langsung ke Works. Menawarkan tombolnya mengundang orang
              membangun lapis yang sudah dibuang — dan owner menegaskan
              pekerjaan seperti Mobilization atau Security memang tidak butuh
              elemen sub-works.

              Sub-object yang TERLANJUR ada tetap dirender di atas, supaya data
              lama bisa dibaca dan dipindahkan. Yang hilang cuma cara membuat
              yang baru. */}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// L2
// ---------------------------------------------------------------------------

function SubObjectRow({
  index,
  sub,
  computed,
  isOpen,
  onToggle,
  editable,
  pending,
  run,
}: {
  /** Urutan dalam pekerjaan induk, 0-based. */
  index: number;
  sub: BqObjectView["subObjects"][number];
  computed: NonNullable<BqObjectView["computed"]["subObjects"][number]>;
  isOpen: boolean;
  onToggle: () => void;
  /** Resep dijatuhkan ke baris ini — isinya dituang ke sub-pekerjaan ini. */
  editable: boolean;
  pending: boolean;
  run: (fn: () => Promise<ActionResultLike>, msg?: string) => Promise<boolean>;
}) {
  const isLinked = sub.librarySubObjectId !== null;

  return (
    // FR-EXP-07: kedalaman ditandai indentasi + garis kiri + warna latar.
    <div className="group/sub pl-6">
      <div
        className={cn(
          "border-l-2 py-2.5 pl-4 pr-4 transition-colors",
          "border-slate-200",
          isOpen && "bg-slate-50/40",
        )}
      >
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            )}
            <div className="min-w-0 space-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {/* Hanya "Lib" yang ditampilkan. "Lokal" adalah keadaan
                    default — pada BQ yang seluruh barisnya lokal, badge itu
                    muncul di setiap baris tanpa memberi tahu apa pun. Badge
                    berguna justru saat ia MEMBEDAKAN. */}
                {isLinked ? (
                  <span
                    className={cn(
                      UI_ENGINE_TYPE_META,
                      "shrink-0 rounded border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 font-medium text-indigo-600",
                    )}
                    title="Terhubung ke template Library"
                  >
                    Lib
                  </span>
                ) : null}
                {/* Penomoran mengikuti dokumen sumber: seksi A/B/C, divisi
                    I/II/III, item 1/2/3. Tanpa ini, sub-pekerjaan di bawah
                    seksi yang menyatu terbaca sejajar dengan divisi di seksi
                    lain — padahal lapisnya berbeda. Angka menjawabnya tanpa
                    satu kata penjelasan pun. */}
                <span
                  className={cn(
                    UI_ENGINE_TYPE_META,
                    "w-4 shrink-0 text-right tabular-nums text-slate-500",
                  )}
                >
                  {index + 1}
                </span>
                <span className="truncate font-sans text-sm font-medium text-slate-800">
                  {sub.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={cn(UI_ENGINE_TYPE_META, UI_ENGINE_TEXT_TERTIARY)}>
                  {computed.lineCount} baris
                </span>
              </div>
            </div>
          </button>

          <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
            {/* Pengali L2 — kolom yang membuat alat ini lebih cepat dari Excel
                (PRD §2.1). Ubah dari 3 ke 5 dan seluruh angka di atasnya ikut,
                tanpa satu pun bahan diketik ulang. */}
            {/* Pengali L2 tetap ditandai "×" dan BUKAN dilabeli "Vol." —
                angkanya memang bukan volume, melainkan berapa kali
                sub-pekerjaan ini ada di dalam satu pekerjaan. Menyamakan
                labelnya dengan kolom Vol. di atas justru menyesatkan. */}
            <div className="text-right">
              <label className="flex items-center justify-end gap-1.5" title="Berapa kali sub-pekerjaan ini ada dalam satu pekerjaan">
                <span className={cn(UI_ENGINE_TYPE_META, UI_ENGINE_TEXT_TERTIARY)}>
                  ×
                </span>
                <NumberCell
                  value={sub.qty}
                  disabled={!editable || pending}
                  className="w-16"
                  onCommit={(next) =>
                    next !== null &&
                    next > 0 &&
                    void run(() =>
                      updateBqSubObjectAction({ id: sub.id, qty: next }),
                    )
                  }
                />
              </label>
            </div>

            <SummaryMetric
              width={COL_TOTAL}
              value={formatIdr(computed.subtotal)}
              emphasis="strong"
            />

            {/* Menyisipkan resep kini lewat drag & drop dari dock, jadi baris
                tidak lagi punya tombol "Muat Library". Yang tetap di sini
                adalah arah sebaliknya — menjadikan sub-pekerjaan ini resep —
                karena itu aksi ATAS baris ini, bukan aksi global. Muncul saat
                hover supaya kolom angka tetap yang paling menonjol. */}
            {editable && !isLinked ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-slate-500 opacity-0 transition-opacity hover:text-indigo-600 focus-visible:opacity-100 group-hover/sub:opacity-100"
                disabled={pending}
                title={`Simpan "${sub.name}" ke Library sebagai resep`}
                aria-label={`Simpan ${sub.name} ke Library`}
                onClick={() =>
                  void run(
                    () =>
                      saveSubObjectToLibraryAndLinkAction({
                        subObjectId: sub.id,
                        name: sub.name,
                      }),
                    `"${sub.name}" tersimpan ke Library.`,
                  )
                }
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
              </Button>
            ) : null}

            {editable ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-red-600 opacity-0 transition-opacity hover:text-red-700 focus-visible:opacity-100 group-hover/sub:opacity-100"
                disabled={pending}
                title="Hapus sub-pekerjaan"
                onClick={(e) => {
                  e.stopPropagation();
                  void run(
                    () => deleteBqSubObjectAction({ id: sub.id }),
                    "Sub-pekerjaan dihapus.",
                  );
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ---- FR-EXP-03: L3, bahan dulu lalu jasa ------------------------- */}
      {isOpen ? (
        <div className="ml-4 border-l-2 border-slate-100 pb-4 pl-5 pr-4">
          <LineTable
            parent={{ subObjectId: sub.id }}
            records={{ materials: sub.materials, services: sub.services }}
            computed={computed}
            subtotal={computed.subtotal}
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

/**
 * Tabel baris L3. Melayani DUA induk dengan komponen yang sama.
 *
 * Baris boleh menempel di item (L1) atau di sub-item (L2), dan tampilannya
 * identik — yang berbeda cuma ke mana aksi tambah/hapus dikirim. Menduplikasi
 * komponen ini per induk berarti dua tabel yang harus dijaga sinkron, dan
 * perbedaan sekecil apa pun di antaranya akan terbaca sebagai bug.
 */
function LineTable({
  parent,
  records,
  computed,
  subtotal,
  editable,
  pending,
  run,
}: {
  /** Ke mana aksi dikirim. Tepat satu properti terisi. */
  parent: { objectId: string } | { subObjectId: string };
  records: {
    materials: BqMaterialLineRecord[];
    services: BqServiceLineRecord[];
  };
  computed: {
    materials: MaterialLineResult[];
    services: ServiceLineResult[];
    materialsSubtotal: number;
    servicesSubtotal: number;
  };
  /** Ditampilkan sebagai "Total" di bawah tabel. NULL = jangan tampilkan. */
  subtotal: number | null;
  editable: boolean;
  pending: boolean;
  run: (fn: () => Promise<ActionResultLike>, msg?: string) => Promise<boolean>;
}) {
  const sub = records;
  const hasLines = computed.materials.length > 0 || computed.services.length > 0;
  // Fix #1: per-section add buttons so +Bahan lives under Materials,
  // +Jasa lives under Services — not floating together at the bottom.
  /**
   * Baris cepat yang sedang terbuka. Menggantikan dialog picker sebagai jalur
   * utama — lihat kepala `BqQuickAddRow.tsx` untuk alasannya. Dialog masih
   * hidup di balik "input manual", untuk barang yang memang belum ada di
   * Master Data.
   */
  const [quickAdd, setQuickAdd] = React.useState<QuickAddMode | null>(null);
  const [manualFor, setManualFor] = React.useState<QuickAddMode | null>(null);

  const commitQuickAdd = React.useCallback(
    async (input: QuickAddCommit) =>
      input.mode === "MATERIAL"
        ? run(() =>
            addBqMaterialLineAction({
              ...parent,
              skuId: input.skuId,
              skuPriceId: input.skuPriceId,
              qtyPerSub: input.qtyPerSub,
            }),
          )
        : run(() =>
            addBqServiceLineAction({
              ...parent,
              workPriceId: input.workPriceId,
              qtyPerSub: input.qtyPerSub,
            }),
          ),
    [run, parent],
  );

  // Dialog manual: hanya untuk barang di luar Master Data.
  const pickerProps = {
    ...parent,
    openFor: manualFor,
    onExternalClose: () => setManualFor(null),
    onAddMaterial: ({ skuId, skuPriceId, qtyPerSub }: { skuId: string; skuPriceId: string; qtyPerSub: number }) =>
      run(
        () => addBqMaterialLineAction({ ...parent, skuId, skuPriceId, qtyPerSub }),
        "Bahan ditambahkan.",
      ),
    onAddService: (workPriceId: string, qty: number) =>
      run(
        () => addBqServiceLineAction({ ...parent, workPriceId, qtyPerSub: qty }),
        "Jasa ditambahkan.",
      ),
    onAddLocalMaterial: (input: { name: string; usageUnit: string; price: number; qtyPerSub: number }) =>
      run(
        () => addBqLocalMaterialLineAction({ ...parent, ...input, currency: "IDR" }),
        "Bahan custom ditambahkan.",
      ),
    onAddLocalService: (input: { name: string; rateUnit: string; price: number; qtyPerSub: number }) =>
      run(
        () => addBqLocalServiceLineAction({ ...parent, ...input, currency: "IDR" }),
        "Jasa custom ditambahkan.",
      ),
  } as const;

  return (
    <div className="space-y-4 pt-2">
      {/* --- Bahan Material -------------------------------------------- */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <Package className="h-3 w-3 text-slate-500" />
          <span className={cn(UI_ENGINE_TYPE_META, "font-medium text-slate-500")}>
            Bahan
          </span>
        </div>

        {computed.materials.length === 0 && quickAdd !== "MATERIAL" ? null : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={cn(UI_ENGINE_TYPE_META, "w-7 py-1 pr-2 text-right font-normal text-slate-500")}>No.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "py-1 pr-3 text-left font-normal text-slate-500")}>Uraian</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-12 py-1 pr-2 text-center font-normal text-slate-500")}>Sat.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-20 py-1 pr-3 text-right font-normal text-slate-500")}>Koef.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-28 py-1 pr-3 text-right font-normal text-slate-500")}>Harga Sat.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-28 py-1 text-right font-normal text-slate-500")}>Jumlah</th>
                  {editable ? <th className="w-8" /> : null}
                </tr>
              </thead>
              <tbody>
                {computed.materials.map((line, index) => {
                  const record = sub.materials.find((m) => m.id === line.lineId);
                  if (!record) return null;
                  return (
                    <tr key={line.lineId} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className={cn(UI_ENGINE_TYPE_META, "py-1.5 pr-2 text-right text-slate-500")}>
                        {index + 1}
                      </td>
                      <td className="py-1.5 pr-3">
                        <TextCell
                          value={line.name}
                          disabled={!editable || pending}
                          onCommit={(name) =>
                            void run(() =>
                              updateBqMaterialLineAction({ id: line.lineId, name }),
                            )
                          }
                          className="min-w-32"
                        />
                        <div className={cn(UI_ENGINE_TYPE_META, "mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-500")}>
                          <CostCategoryBadge
                            category={record.costCategory}
                            defaultFor="MATERIAL"
                          />
                          {record.code ? <span>{record.code}</span> : null}
                          {record.isManualOverride ? (
                            <span className="text-amber-600" title={record.overrideNote ?? "Manual"}>
                              Manual
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className={cn(UI_ENGINE_TYPE_META, "py-1.5 pr-2 text-center text-slate-600")}>
                        {line.unit ?? "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        <NumberCell
                          value={line.qtyPerSub}
                          disabled={!editable || pending}
                          className="w-16"
                          onCommit={(next) =>
                            next !== null &&
                            void run(() =>
                              updateBqMaterialLineAction({ id: line.lineId, qtyPerSub: next }),
                            )
                          }
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <NumberCell
                          value={line.pricePerUnit}
                          disabled={!editable || pending}
                          className="w-24"
                          onCommit={(next) =>
                            next !== null &&
                            next >= 0 &&
                            void run(() =>
                              updateBqMaterialLineAction({ id: line.lineId, price: next }),
                            )
                          }
                        />
                      </td>
                      <td className="py-1.5 text-right font-sans text-xs font-medium text-slate-800">
                        {formatIdr(line.cost)}
                      </td>
                      {editable ? (
                        <td className="w-8 py-1.5 text-right">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              void run(() => deleteBqMaterialLineAction({ id: line.lineId }))
                            }
                            className="text-slate-200 opacity-0 transition-all group-hover:opacity-100 hover:text-red-500"
                            aria-label={`Hapus ${line.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                {quickAdd === "MATERIAL" ? (
                  <BqQuickAddRow
                    mode="MATERIAL"
                    editable={editable}
                    colSpanBefore={1}
                    onCommit={commitQuickAdd}
                    onClose={() => setQuickAdd(null)}
                  />
                ) : null}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/60">
                  <td colSpan={editable ? 5 : 4} />
                  <td className={cn(UI_ENGINE_TYPE_META, "py-1 text-right font-medium text-slate-600")}>
                    {formatIdr(computed.materialsSubtotal)}
                  </td>
                  {editable ? <td /> : null}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {editable ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQuickAdd("MATERIAL")}
              className="flex items-center gap-1.5 rounded-md border border-dashed border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 transition-colors hover:border-sky-300 hover:bg-sky-100"
            >
              <Plus className="h-3 w-3" />
              + Tambah Bahan
            </button>
            {/* Jalur untuk barang yang memang belum ada di Master Data.
                Sengaja lebih sunyi: master data tetap SSOT, dan baris karangan
                adalah pengecualian, bukan kebiasaan. */}
            <button
              type="button"
              onClick={() => setManualFor("MATERIAL")}
              className={cn(UI_ENGINE_TYPE_META, "text-slate-500 underline-offset-2 hover:text-slate-600 hover:underline")}
            >
              Manual
            </button>
          </div>
        ) : null}
      </div>

      {/* --- Jasa ------------------------------------------------------ */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <Hammer className="h-3 w-3 text-slate-500" />
          <span className={cn(UI_ENGINE_TYPE_META, "font-medium text-slate-500")}>
            Jasa
          </span>
        </div>

        {computed.services.length === 0 && quickAdd !== "SERVICE" ? null : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={cn(UI_ENGINE_TYPE_META, "w-7 py-1 pr-2 text-right font-normal text-slate-500")}>No.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "py-1 pr-3 text-left font-normal text-slate-500")}>Uraian</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-12 py-1 pr-2 text-center font-normal text-slate-500")}>Sat.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-20 py-1 pr-3 text-right font-normal text-slate-500")}>Koef.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-28 py-1 pr-3 text-right font-normal text-slate-500")}>Harga Sat.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-28 py-1 text-right font-normal text-slate-500")}>Jumlah</th>
                  {editable ? <th className="w-8" /> : null}
                </tr>
              </thead>
              <tbody>
                {computed.services.map((line, index) => {
                  const record = sub.services.find((s) => s.id === line.lineId);
                  return (
                    <tr key={line.lineId} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className={cn(UI_ENGINE_TYPE_META, "py-1.5 pr-2 text-right text-slate-500")}>
                        {index + 1}
                      </td>
                      <td className="py-1.5 pr-3">
                        <TextCell
                          value={line.name}
                          disabled={!editable || pending}
                          onCommit={(name) =>
                            void run(() =>
                              updateBqServiceLineAction({ id: line.lineId, name }),
                            )
                          }
                          className="min-w-32"
                        />
                        <div className={cn(UI_ENGINE_TYPE_META, "mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-500")}>
                          {record ? (
                            <CostCategoryBadge
                              category={record.costCategory}
                              defaultFor="UPAH"
                              hasMaterial={record.hasMaterial}
                            />
                          ) : null}
                          {record?.code ? <span>{record.code}</span> : null}
                        </div>
                      </td>
                      <td className={cn(UI_ENGINE_TYPE_META, "py-1.5 pr-2 text-center text-slate-600")}>
                        {line.rateUnit ?? "—"}
                      </td>
                      <td className="py-1.5 pr-3 text-right">
                        <NumberCell
                          value={line.qtyPerSub}
                          disabled={!editable || pending}
                          className="w-16"
                          onCommit={(next) =>
                            next !== null &&
                            void run(() =>
                              updateBqServiceLineAction({ id: line.lineId, qtyPerSub: next }),
                            )
                          }
                        />
                      </td>
                      <td className="py-1.5 pr-3">
                        <NumberCell
                          value={line.pricePerRateUnit}
                          disabled={!editable || pending}
                          className="w-24"
                          onCommit={(next) =>
                            next !== null &&
                            next >= 0 &&
                            void run(() =>
                              updateBqServiceLineAction({ id: line.lineId, price: next }),
                            )
                          }
                        />
                      </td>
                      <td className="py-1.5 text-right font-sans text-xs font-medium text-slate-800">
                        {formatIdr(line.cost)}
                      </td>
                      {editable ? (
                        <td className="w-8 py-1.5 text-right">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() =>
                              void run(() => deleteBqServiceLineAction({ id: line.lineId }))
                            }
                            className="text-slate-200 opacity-0 transition-all group-hover:opacity-100 hover:text-red-500"
                            aria-label={`Hapus ${line.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                {quickAdd === "SERVICE" ? (
                  <BqQuickAddRow
                    mode="SERVICE"
                    editable={editable}
                    colSpanBefore={1}
                    onCommit={commitQuickAdd}
                    onClose={() => setQuickAdd(null)}
                  />
                ) : null}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50/60">
                  <td colSpan={editable ? 5 : 4} />
                  <td className={cn(UI_ENGINE_TYPE_META, "py-1 text-right font-medium text-slate-600")}>
                    {formatIdr(computed.servicesSubtotal)}
                  </td>
                  {editable ? <td /> : null}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {editable ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQuickAdd("SERVICE")}
              className="flex items-center gap-1.5 rounded-md border border-dashed border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:border-violet-300 hover:bg-violet-100"
            >
              <Plus className="h-3 w-3" />
              + Tambah Jasa
            </button>
            {/* Jalur untuk barang yang memang belum ada di Master Data.
                Sengaja lebih sunyi: master data tetap SSOT, dan baris karangan
                adalah pengecualian, bukan kebiasaan. */}
            <button
              type="button"
              onClick={() => setManualFor("SERVICE")}
              className={cn(UI_ENGINE_TYPE_META, "text-slate-500 underline-offset-2 hover:text-slate-600 hover:underline")}
            >
              Manual
            </button>
          </div>
        ) : null}
      </div>

      {/* --- Total sub-pekerjaan --------------------------------------- */}
      {hasLines && subtotal !== null ? (
        <div className="flex items-center justify-end gap-8 border-t-2 border-slate-300 pt-2">
          <span className={cn(UI_ENGINE_TYPE_META, "text-slate-500")}>Total</span>
          <span className="font-sans text-sm font-semibold tabular-nums text-slate-900">
            {formatIdr(subtotal)}
          </span>
        </div>
      ) : null}

      {/* Dialog manual — hanya untuk barang di luar Master Data. */}
      {editable && manualFor ? <BqLinePicker {...pickerProps} /> : null}
    </div>
  );
}
