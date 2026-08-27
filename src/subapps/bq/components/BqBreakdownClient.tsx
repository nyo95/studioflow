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
import { UI_ENGINE_TYPE_META } from "@/ui_engine/tokens";
import { statusToTone } from "@/lib/ui/status-tone";
import { cn } from "@/lib/utils";
import { formatIdr, formatQty } from "../lib/calc";
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
import {
  createBqSectionAction,
  deleteBqSectionAction,
} from "../actions/bq-project-actions";
import {
  loadFromLibraryObjectAction,
  loadFromLibrarySubObjectAction,
  saveSubObjectToLibraryAndLinkAction,
} from "../actions/bq-library-actions";
import { BqLinePicker } from "./BqLinePicker";
import {
  BqQuickAddRow,
  type QuickAddCommit,
  type QuickAddMode,
} from "./BqQuickAddRow";
import {
  acceptsOnObject,
  acceptsOnSubObject,
  BqLibraryPanel,
  BqToolbar,
  isRecipeDrag,
  readRecipeDrag,
  type BqRecipeDrag,
  type OutlineLevel,
} from "./BqToolbar";
import {
  addTemplateItemAction,
  applyBqTemplateAction,
} from "../actions/bq-template-actions";
import { BQ_TEMPLATE_SUMMARY } from "../lib/bq-template-data";
import {
  displayName,
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

  return { run, pending };
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

/**
 * Drop zone untuk resep library.
 *
 * `dragover` HARUS memanggil `preventDefault()` — tanpa itu browser menolak
 * drop dan `onDrop` tidak pernah jalan. Yang sering luput: `dragenter` juga
 * perlu diperiksa, karena `dragleave` menyala setiap kali kursor melintasi
 * anak elemen. Penghitung `depth` di bawah mencegah sorotan berkedip-kedip
 * saat kursor bergerak di atas isi baris.
 */
function useRecipeDropZone(
  onDrop: (drag: BqRecipeDrag) => Promise<boolean>,
  enabled: boolean,
  accepts: (kind: BqRecipeDrag["kind"]) => boolean,
  rejectMessage?: (kind: BqRecipeDrag["kind"]) => string,
) {
  const [over, setOver] = React.useState(false);
  const depth = React.useRef(0);

  const reset = () => {
    depth.current = 0;
    setOver(false);
  };

  if (!enabled) {
    return { over: false, handlers: {} as React.HTMLAttributes<HTMLElement> };
  }

  return {
    over,
    handlers: {
      onDragEnter: (e: React.DragEvent) => {
        const drag = readRecipeDrag(e);
        if (!drag) return;
        e.preventDefault();
        if (!accepts(drag.kind)) return;
        depth.current += 1;
        setOver(true);
      },
      onDragOver: (e: React.DragEvent) => {
        const drag = readRecipeDrag(e);
        if (!drag) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = accepts(drag.kind) ? "copy" : "none";
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!isRecipeDrag(e)) return;
        depth.current -= 1;
        if (depth.current <= 0) reset();
      },
      onDrop: (e: React.DragEvent) => {
        const drag = readRecipeDrag(e);
        if (!drag) return;
        e.preventDefault();
        e.stopPropagation();
        reset();
        // Jenis yang tidak sah untuk lapis ini ditolak DI SINI, bukan dibiarkan
        // sampai ke server: pesan "item template tidak bisa masuk ke dalam
        // sub-pekerjaan" lebih berguna daripada error validasi dari action.
        if (!accepts(drag.kind)) {
          toast.error(
            rejectMessage?.(drag.kind) ??
              (drag.kind === "TEMPLATE"
                ? "Item template adalah pekerjaan — jatuhkan ke seksi/divisi, bukan ke dalam pekerjaan."
                : "Bahan dan jasa adalah baris — jatuhkan ke sub-pekerjaan, bukan ke pekerjaan."),
          );
          return;
        }
        void onDrop(drag);
      },
    } as React.HTMLAttributes<HTMLElement>,
  };
}

/**
 * Badge pos biaya. Hanya muncul untuk kategori yang BUKAN default barisnya —
 * baris bahan ber-MATERIAL dan baris jasa ber-UPAH sudah jelas dari seksinya,
 * jadi memberi badge pada keduanya cuma menambah keramaian tanpa memberi tahu
 * apa pun. Yang perlu terlihat adalah baris yang menyimpang: alat, biaya umum,
 * transportasi.
 */
const COST_CATEGORY_LABEL: Record<BqCostCategory, string> = {
  MATERIAL: "Material",
  UPAH: "Upah",
  ALAT: "Alat",
  BIAYA_UMUM: "Biaya Umum",
  TRANSPORT_AKOMODASI: "Transport",
};

function CostCategoryBadge({
  category,
  defaultFor,
}: {
  category: BqCostCategory;
  defaultFor: BqCostCategory;
}) {
  if (category === defaultFor) return null;
  return (
    <span
      className={cn(
        UI_ENGINE_TYPE_META,
        "rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700",
      )}
      title="Pos biaya di luar Master Data — harga diisi per project"
    >
      {COST_CATEGORY_LABEL[category]}
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
  onDropOnObject: (drag: BqRecipeDrag, objectId: string) => Promise<boolean>;
  onDropOnSubObject: (drag: BqRecipeDrag, subObjectId: string) => Promise<boolean>;
  onAddTemplateItem: (
    sectionId: string,
    templateKey: string,
    groupName: string,
    itemName: string,
  ) => Promise<boolean>;
  onAddObject: (sectionId: string, name: string) => Promise<boolean>;
  onAddSubSection: (parentId: string, name: string) => Promise<boolean>;
  onRemoveSection: (section: BqSectionView) => void;
  canEdit: boolean;
  run: (fn: () => Promise<ActionResultLike>, msg?: string) => Promise<boolean>;
  pending: boolean;
};

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

  // Works dan Sub Section tidak dicampur dalam satu pengelompok: begitu ada
  // anak, urutan cetaknya jadi ambigu ("mana dulu, item langsung atau isi
  // divisi?"). Works yang terlanjur ada tetap ditampilkan — menyembunyikannya
  // berarti pengguna tidak bisa memindahkannya.
  const allowsDirectObjects = node.children.length === 0;
  const canNest = depth + 1 < MAX_SECTION_DEPTH;

  return (
    <div className="space-y-1.5">
      <SectionHeader
        section={node.section}
        open={open}
        depth={depth}
        childCount={countWorksDeep(node)}
        childLabel="item"
        onToggle={() => shared.onToggleSection(node.section.id)}
        onRemove={() => shared.onRemoveSection(node.section)}
        canEdit={shared.canEdit}
        pending={shared.pending}
      />

      {open ? (
        <div className="space-y-1.5">
          {/* Works yang menggantung langsung — bentuk PRELIMINARIES di dokumen
              kantor, dan juga Floor Works yang tidak memakai lapis area. */}
          {allowsDirectObjects || node.objects.length > 0 ? (
            <ObjectList
              section={node.section}
              objects={node.objects}
              allowAdd={allowsDirectObjects}
              {...shared}
            />
          ) : null}

          {/* Anak — indentasi menandai bahwa ia satu lapis di dalam. */}
          {node.children.map((child) => (
            <div key={child.section.id} className="space-y-1.5 pl-5">
              <SectionBlock node={child} depth={depth + 1} {...shared} />
            </div>
          ))}

          {/* Sub Section punya induk, jadi tombolnya hidup DI DALAM induk itu —
              berbeda dari L0, yang tidak punya tujuan untuk dipilih dan
              karenanya tinggal di panel. Hilang di lapis terdalam. */}
          {shared.canEdit && canNest ? (
            <div className="pl-5">
              <SectionAddObject
                sectionName={node.section.name}
                pending={shared.pending}
                label="Sub Section"
                placeholder={`Sub Section baru di ${node.section.name}`}
                onAdd={(name) => shared.onAddSubSection(node.section.id, name)}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Kepala pengelompok. Bentuknya sama di tiap lapis, bobot tipografinya turun. */
function SectionHeader({
  section,
  open,
  depth,
  childCount,
  childLabel,
  onToggle,
  onRemove,
  canEdit,
  pending,
}: {
  section: BqSectionView;
  open: boolean;
  /** 0 = L0 Section, 1 = L1 Sub Section, 2 = L2 Sub Section. */
  depth: number;
  childCount: number;
  childLabel: string;
  onToggle: () => void;
  onRemove: () => void;
  canEdit: boolean;
  pending: boolean;
}) {
  return (
    <div className="group/sec flex items-center gap-1">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-baseline justify-between gap-4 pt-1 text-left"
      >
        <span className="flex items-baseline gap-2">
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 self-center text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 self-center text-slate-400" />
          )}
          <span
            className={cn(
              "font-serif text-slate-900",
              // Bobotnya turun tiap lapis — itu satu-satunya pembeda antar
              // lapis selain indentasi. Tanpa ini L1 dan L2 terlihat kembar.
              depth === 0 && "text-base font-semibold",
              depth === 1 && "text-sm font-semibold",
              depth >= 2 && "text-sm font-medium",
            )}
          >
            {section.code ? (
              <span className="mr-2 text-slate-400">{section.code}</span>
            ) : null}
            {section.name}
          </span>
          {/* Saat tertutup, isinya harus tetap terhitung — kalau tidak, seksi
              tertutup terlihat sama dengan seksi kosong. */}
          {!open ? (
            <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
              {childCount} {childLabel}
            </span>
          ) : null}
        </span>
        <span className="w-28 text-right font-sans text-sm font-medium tabular-nums text-slate-700">
          {formatIdr(section.subtotal)}
        </span>
      </button>
      {canEdit ? (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 shrink-0 p-0 text-slate-300 opacity-0 transition-opacity hover:text-red-600 focus-visible:opacity-100 group-hover/sec:opacity-100"
          disabled={pending}
          title={`Hapus "${section.name}"`}
          aria-label={`Hapus ${section.name}`}
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null}
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
  allowAdd = true,
  ...shared
}: { section: BqSectionView; objects: BqObjectView[]; allowAdd?: boolean } & Shared) {
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
  const drop = useRecipeDropZone(
    async (drag) =>
      drag.kind === "TEMPLATE"
        ? shared.onAddTemplateItem(
            section.id,
            drag.templateKey,
            drag.groupName,
            drag.itemName,
          )
        : false,
    allowAdd && shared.canEdit,
    (kind) => kind === "TEMPLATE",
    (kind) =>
      kind === "TEMPLATE"
        ? "Item template hanya bisa dijatuhkan ke seksi/divisi kosong, bukan ke dalam pekerjaan."
        : "Template membuat pekerjaan baru di seksi/divisi. Resep library masuk ke pekerjaan atau sub-pekerjaan; bahan dan jasa masuk ke sub-pekerjaan.",
  );

  const hasAnything =
    objects.length > 0 || (allowAdd && (shared.canEdit || suggestions.length > 0));
  if (!hasAnything) return null;

  return (
    <div
      {...drop.handlers}
      className={cn(
        "divide-y divide-slate-200 overflow-hidden border border-slate-200 bg-white transition-colors",
        drop.over && "bg-slate-50 ring-1 ring-inset ring-slate-300",
        UI_ENGINE_RADIUS_CONTROL,
      )}
    >
      {drop.over ? (
        <div className="border-b border-slate-200 bg-slate-50 px-6 py-1.5">
          <p className={cn(UI_ENGINE_TYPE_META, "font-medium text-slate-700")}>
            Lepas di sini — template jadi pekerjaan baru di &quot;{section.name}&quot;
          </p>
        </div>
      ) : null}
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
          onDropOnObject={shared.onDropOnObject}
          onDropOnSubObject={shared.onDropOnSubObject}
          canEdit={shared.canEdit}
          run={shared.run}
          pending={shared.pending}
        />
      ))}

      {/* Saran dari template — yang tidak diklik tidak pernah ada. */}
      {allowAdd && shared.canEdit && suggestions.length > 0 ? (
        <div className="bg-slate-50/60 px-6 py-3">
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((item) => {
              const name = displayName(item);
              const templateKey = templateItemKey(item);
              if (!templateKey) return null;
              const label = suggestionLabel(item, counts);
              return (
                <button
                  key={templateKey}
                  type="button"
                  disabled={shared.pending}
                  title={
                    item.lines.length > 0
                      ? `${label} — satuan ${item.unit}, membawa ${item.lines.length} baris pembentuk`
                      : `${label} — satuan ${item.unit}`
                  }
                  onClick={() =>
                    void shared.onAddTemplateItem(
                      section.id,
                      templateKey,
                      section.name,
                      name,
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300",
                    "bg-white px-2.5 py-1 text-xs text-slate-600 transition-colors",
                    "hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900",
                    "disabled:opacity-50",
                  )}
                >
                  <Plus className="h-3 w-3 text-slate-400" />
                  {label}
                  <span className="text-slate-400">{item.unit}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {allowAdd && shared.canEdit ? (
        <SectionAddObject
          sectionName={section.name}
          pending={shared.pending}
          onAdd={(name) => shared.onAddObject(section.id, name)}
        />
      ) : null}
    </div>
  );
}

/**
 * Baris "tambah pekerjaan" milik satu seksi.
 *
 * Komponen terpisah karena tiap seksi butuh draft namanya SENDIRI — satu state
 * bersama di induk berarti mengetik di seksi B ikut mengisi kotak di seksi C.
 */
function SectionAddObject({
  sectionName,
  pending,
  onAdd,
  label = "Pekerjaan",
  placeholder,
}: {
  sectionName: string;
  pending: boolean;
  onAdd: (name: string) => Promise<boolean>;
  label?: string;
  placeholder?: string;
}) {
  const [name, setName] = React.useState("");

  const submit = async () => {
    if (!name.trim()) return;
    const ok = await onAdd(name.trim());
    if (ok) setName("");
  };

  return (
    <div className="flex items-center gap-2 bg-slate-50/60 px-6 py-2.5">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
        }}
        placeholder={placeholder ?? `Pekerjaan baru di ${sectionName}`}
        className="h-8 max-w-xs text-xs"
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8"
        disabled={pending || !name.trim()}
        onClick={() => void submit()}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Tambah {label}
      </Button>
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
      {label ? <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>{label}</p> : null}
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
  const { run, pending } = useMutate();

  // FR-EXP-01 / FR-EXP-02: keduanya default TERTUTUP, jadi state menyimpan
  // yang TERBUKA. Menyimpan yang tertutup akan membuat object baru muncul
  // dalam keadaan terbuka, dan "default tertutup" berhenti berlaku persis
  // saat estimator paling butuh pandangan klien.
  const [openObjects, setOpenObjects] = React.useState<Set<string>>(new Set());
  const [openSubObjects, setOpenSubObjects] = React.useState<Set<string>>(
    new Set(),
  );

  // Toolbar global — lihat BqToolbar.tsx untuk alasan pemindahannya ke sini.
  const [outlineLevel, setOutlineLevel] = React.useState<OutlineLevel | null>(1);
  const [libraryOpen, setLibraryOpen] = React.useState(true);

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

  /**
   * Menjatuhkan sesuatu ke SUB-PEKERJAAN (L2).
   *
   * Tiga jenis muatan bertemu di sini karena tujuannya sama — mengisi satu
   * sub-pekerjaan — meski aksi servernya berbeda:
   *
   *   LIB_SUB / LIB_OBJ   menuang seluruh isi resep
   *   MATERIAL / SERVICE  menambah SATU baris L3
   *
   * TEMPLATE tidak diterima di sini: satu item template ADALAH sebuah
   * sub-pekerjaan, jadi menjatuhkannya ke dalam sub-pekerjaan lain tidak punya
   * arti. `acceptsOnSubObject` menolaknya sebelum sampai ke sini.
   */
  const dropOnSubObject = React.useCallback(
    async (drag: BqRecipeDrag, targetSubObjectId: string) => {
      switch (drag.kind) {
        case "LIB_OBJ":
          return run(
            () =>
              loadFromLibraryObjectAction({
                libraryObjectId: drag.id,
                targetSubObjectId,
              }),
            `"${drag.name}" disisipkan.`,
          );
        case "LIB_SUB":
          return run(
            () =>
              loadFromLibrarySubObjectAction({
                librarySubObjectId: drag.id,
                targetSubObjectId,
              }),
            `"${drag.name}" disisipkan.`,
          );
        case "MATERIAL":
          // Koefisien 1 sebagai titik awal — angka sebenarnya cuma diketahui
          // estimator, dan menebaknya berarti menaruh angka karangan di BQ.
          return run(
            () =>
              addBqMaterialLineAction({
                subObjectId: targetSubObjectId,
                skuId: drag.skuId,
                skuPriceId: drag.skuPriceId,
                qtyPerSub: 1,
              }),
            `"${drag.name}" ditambahkan — isi koefisiennya.`,
          );
        case "SERVICE":
          return run(
            () =>
              addBqServiceLineAction({
                subObjectId: targetSubObjectId,
                workPriceId: drag.workPriceId,
                qtyPerSub: 1,
              }),
            `"${drag.name}" ditambahkan — isi koefisiennya.`,
          );
        default:
          return false;
      }
    },
    [run],
  );

  /**
   * Menjatuhkan sesuatu ke PEKERJAAN (L1) menghasilkan sub-pekerjaan BARU.
   *
   * TEMPLATE punya jalur sendiri karena aksinya memang sudah membuat
   * sub-pekerjaan beserta pembentuknya sekaligus — memaksanya lewat jalur
   * "buat dulu, lalu tuang" akan menghasilkan dua sub-pekerjaan.
   *
   * Untuk resep library, dua aksi berurutan dan itu pilihan sadar: keduanya
   * sudah ada dan sudah teruji, sedangkan menggabungkannya berarti menyalin
   * ~190 baris logika penuangan ke aksi ketiga yang harus ikut dirawat. Kalau
   * langkah kedua gagal, yang tertinggal adalah sub-pekerjaan kosong bernama
   * jelas — kelihatan di grid dan bisa dihapus, bukan kerusakan diam-diam.
   */
  const dropOnObject = React.useCallback(
    async (drag: BqRecipeDrag, objectId: string) => {
      const created = await createBqSubObjectAction({
        objectId,
        name: drag.name,
      });
      if (!created.success) {
        toast.error(created.error ?? "Sub-pekerjaan tidak bisa dibuat.");
        return false;
      }
      return dropOnSubObject(drag, created.data.id);
    },
    [run, dropOnSubObject],
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

  const addDivision = React.useCallback(
    async (parentId: string, name: string) =>
      run(
        () =>
          createBqSectionAction({
            projectId: view.project.id,
            parentId,
            name,
          }),
        "Divisi ditambahkan.",
      ),
    [run, view.project.id],
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
          onOpenLibrary={() => setLibraryOpen((v) => !v)}
          libraryOpen={libraryOpen}
          objectCount={view.objects.length}
          lineCount={view.objects.reduce((s, o) => s + o.computed.lineCount, 0)}
          canEdit={canEdit}
          pending={pending}
          onLockAll={(locked) => void lockAll(locked)}
        />
      }
      grid={
        <div className="flex items-start gap-4">
          {canEdit ? (
            <BqLibraryPanel
              open={libraryOpen}
              onClose={() => setLibraryOpen(false)}
              canEdit={canEdit}
              pending={pending}
              onAddSection={(name) =>
                run(
                  () => createBqSectionAction({ projectId: view.project.id, name }),
                  "Seksi ditambahkan.",
                )
              }
            />
          ) : null}

          <div className="min-w-0 flex-1">
          {/* ------------------------------------------------------------------ */}
          {/* Grand total — pandangan klien                                      */}
          {/* ------------------------------------------------------------------ */}
          <SectionCard className="mb-4" padding="md">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
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
                "border-b border-slate-200 bg-[var(--ui-canvas-bg,rgb(248_250_252))] px-4 py-1.5 sm:flex",
              )}
            >
              <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>Pekerjaan</span>
              <div className="flex items-center gap-x-6 pr-0.5">
                <span className={cn(UI_ENGINE_TYPE_META, "w-14 text-right text-slate-400")}>Vol.</span>
                <span className={cn(UI_ENGINE_TYPE_META, "w-24 text-right text-slate-400")}>Harga</span>
                <span className={cn(UI_ENGINE_TYPE_META, "w-28 text-right text-slate-400")}>Jumlah</span>
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
                    <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
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
              seksi jatuh ke satu kelompok tanpa judul — bentuk lamanya persis. */}
          <div className="space-y-3">
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
                onDropOnObject={dropOnObject}
                onDropOnSubObject={dropOnSubObject}
                onAddTemplateItem={addTemplateItem}
                onAddObject={addObjectToSection}
                onAddSubSection={addDivision}
                onRemoveSection={removeSection}
                canEdit={canEdit}
                run={run}
                pending={pending}
              />
            ))}

            {/* Item tanpa seksi — BQ lama, atau sisa dari seksi yang dihapus. */}
            {tree.orphans.length > 0 ? (
              <div className="space-y-1.5">
                <p className={cn(UI_ENGINE_TYPE_META, "px-1 pt-2 text-slate-400")}>
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
                      onDropOnObject={dropOnObject}
                      onDropOnSubObject={dropOnSubObject}
                      canEdit={canEdit}
                      run={run}
                      pending={pending}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

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
  onDropOnObject,
  onDropOnSubObject,
  canEdit,
  run,
  pending,
}: {
  object: BqObjectView;
  isOpen: boolean;
  openSubObjects: Set<string>;
  onToggle: () => void;
  onToggleSub: (id: string) => void;
  onDropOnObject: (drag: BqRecipeDrag, objectId: string) => Promise<boolean>;
  onDropOnSubObject: (drag: BqRecipeDrag, subObjectId: string) => Promise<boolean>;
  canEdit: boolean;
  run: (fn: () => Promise<ActionResultLike>, msg?: string) => Promise<boolean>;
  pending: boolean;
}) {
  const c = object.computed;
  const locked = object.lockedAt !== null;
  const editable = canEdit && !locked;
  const [newSubName, setNewSubName] = React.useState("");

  const drop = useRecipeDropZone(
    (drag) => onDropOnObject(drag, c.objectId),
    editable,
    acceptsOnObject,
    (kind) =>
      kind === "TEMPLATE"
        ? "Item template adalah pekerjaan — jatuhkan ke seksi/divisi, bukan ke dalam pekerjaan."
        : "Bahan dan jasa adalah baris — jatuhkan ke sub-pekerjaan, bukan ke pekerjaan.",
  );

  return (
    <div
      {...drop.handlers}
      className={cn(
        "bg-white transition-colors",
        // Sorotan drop dipindah ke latar, bukan bingkai — barisnya sudah tidak
        // punya bingkai sendiri sejak grid jadi tabel.
        drop.over && "bg-indigo-50 ring-1 ring-inset ring-indigo-300",
      )}
    >
      {/* Umpan balik drop di tingkat pekerjaan: resep akan jadi sub-pekerjaan
          BARU di sini, bukan menimpa yang sudah ada. */}
      {drop.over ? (
        <div className="border-b border-indigo-200 bg-indigo-50 px-6 py-1.5">
          <p className={cn(UI_ENGINE_TYPE_META, "font-medium text-indigo-700")}>
            Lepas di sini — resep jadi sub-pekerjaan baru di &quot;{c.name}&quot;
          </p>
        </div>
      ) : null}
      {/* ---- FR-EXP-01: baris tertutup = satu baris BQ ------------------- */}
      <div className="flex flex-wrap items-start gap-3 px-6 py-4">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          {isOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          <div className="min-w-0 space-y-1">
            {c.code ? (
              <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
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
            <p className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
              {c.subObjectCount} sub-pekerjaan · {c.lineCount} baris
            </p>
          </div>
        </button>

        <div className="ml-auto flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-start justify-end gap-x-6 gap-y-2">
            {/* Tanpa label — strip header sticky di atas grid yang menamainya. */}
            <SummaryMetric
              width="w-14"
              value={
                <>
                  {formatQty(c.qty)} {c.unit}
                </>
              }
            />
            <SummaryMetric
              width="w-24"
              value={formatIdr(c.ratePerUnit)}
              emphasis="strong"
            />
            <SummaryMetric
              width="w-28"
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
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 bg-slate-50/60 px-6 py-2.5">
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
            <div className="border-b border-slate-100 px-6 pb-4 pt-2">
              <LineTable
                parent={{ objectId: c.objectId }}
                records={{ materials: object.materials, services: object.services }}
                computed={{ materials: c.materials, services: c.services }}
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
                  onDropRecipe={(drag) => onDropOnSubObject(drag, sub.id)}
                  editable={editable}
                  pending={pending}
                  run={run}
                />
              );
            })}
          </div>
          {editable ? (
            <div className="flex items-center gap-2 border-t border-slate-100 px-6 py-3">
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
                      "Sub-pekerjaan ditambahkan.",
                    ).then((ok) => ok && setNewSubName(""));
                  }
                }}
                placeholder="Sub-pekerjaan baru, mis: Ambalan, Body, Pintu"
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
                    "Sub-pekerjaan ditambahkan.",
                  ).then((ok) => ok && setNewSubName(""))
                }
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Tambah Sub-pekerjaan
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
  index,
  sub,
  computed,
  isOpen,
  onToggle,
  onDropRecipe,
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
  onDropRecipe: (drag: BqRecipeDrag) => Promise<boolean>;
  editable: boolean;
  pending: boolean;
  run: (fn: () => Promise<ActionResultLike>, msg?: string) => Promise<boolean>;
}) {
  const isLinked = sub.librarySubObjectId !== null;
  const drop = useRecipeDropZone(
    onDropRecipe,
    editable,
    acceptsOnSubObject,
    (kind) =>
      kind === "TEMPLATE"
        ? "Item template adalah pekerjaan — jatuhkan ke seksi/divisi, bukan ke dalam sub-pekerjaan."
        : "Bahan dan jasa hanya bisa masuk ke sub-pekerjaan.",
  );

  return (
    // FR-EXP-07: kedalaman ditandai indentasi + garis kiri + warna latar.
    <div className="group/sub pl-6">
      <div
        {...drop.handlers}
        className={cn(
          "border-l-2 py-2.5 pl-4 pr-4 transition-colors",
          drop.over
            ? "border-indigo-500 bg-indigo-50"
            : cn("border-slate-200", isOpen && "bg-slate-50/40"),
        )}
      >
        {drop.over ? (
          <p className={cn(UI_ENGINE_TYPE_META, "mb-1.5 font-medium text-indigo-700")}>
            Lepas di sini — isi resep masuk ke &quot;{sub.name}&quot;
          </p>
        ) : null}
        <div className="flex flex-wrap items-start gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
          >
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
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
                    "w-4 shrink-0 text-right tabular-nums text-slate-400",
                  )}
                >
                  {index + 1}
                </span>
                <span className="truncate font-sans text-sm font-medium text-slate-800">
                  {sub.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
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
                <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
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
              width="w-28"
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
                className="h-7 w-7 p-0 text-slate-300 opacity-0 transition-opacity hover:text-indigo-600 focus-visible:opacity-100 group-hover/sub:opacity-100"
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
  };
  /** Ditampilkan sebagai "Total" di bawah tabel. NULL = jangan tampilkan. */
  subtotal: number | null;
  editable: boolean;
  pending: boolean;
  run: (fn: () => Promise<ActionResultLike>, msg?: string) => Promise<boolean>;
}) {
  const sub = records;
  const matTotal = computed.materials.reduce((s, l) => s + l.cost, 0);
  const svcTotal = computed.services.reduce((s, l) => s + l.cost, 0);
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
          <Package className="h-3 w-3 text-slate-400" />
          <span className={cn(UI_ENGINE_TYPE_META, "font-medium text-slate-500")}>
            Bahan
          </span>
        </div>

        {computed.materials.length === 0 && quickAdd !== "MATERIAL" ? null : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={cn(UI_ENGINE_TYPE_META, "w-7 py-1 pr-2 text-right font-normal text-slate-400")}>No.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "py-1 pr-3 text-left font-normal text-slate-400")}>Uraian</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-12 py-1 pr-2 text-center font-normal text-slate-400")}>Sat.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-20 py-1 pr-3 text-right font-normal text-slate-400")}>Koef.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-28 py-1 pr-3 text-right font-normal text-slate-400")}>Harga Sat.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-28 py-1 text-right font-normal text-slate-400")}>Jumlah</th>
                  {editable ? <th className="w-8" /> : null}
                </tr>
              </thead>
              <tbody>
                {computed.materials.map((line, index) => {
                  const record = sub.materials.find((m) => m.id === line.lineId);
                  if (!record) return null;
                  return (
                    <tr key={line.lineId} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className={cn(UI_ENGINE_TYPE_META, "py-1.5 pr-2 text-right text-slate-400")}>
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
                        <div className={cn(UI_ENGINE_TYPE_META, "mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-400")}>
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
                    {formatIdr(matTotal)}
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
              className={cn(UI_ENGINE_TYPE_META, "text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline")}
            >
              Manual
            </button>
          </div>
        ) : null}
      </div>

      {/* --- Jasa ------------------------------------------------------ */}
      <div>
        <div className="mb-1.5 flex items-center gap-1.5">
          <Hammer className="h-3 w-3 text-slate-400" />
          <span className={cn(UI_ENGINE_TYPE_META, "font-medium text-slate-500")}>
            Jasa
          </span>
        </div>

        {computed.services.length === 0 && quickAdd !== "SERVICE" ? null : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className={cn(UI_ENGINE_TYPE_META, "w-7 py-1 pr-2 text-right font-normal text-slate-400")}>No.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "py-1 pr-3 text-left font-normal text-slate-400")}>Uraian</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-12 py-1 pr-2 text-center font-normal text-slate-400")}>Sat.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-20 py-1 pr-3 text-right font-normal text-slate-400")}>Koef.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-28 py-1 pr-3 text-right font-normal text-slate-400")}>Harga Sat.</th>
                  <th className={cn(UI_ENGINE_TYPE_META, "w-28 py-1 text-right font-normal text-slate-400")}>Jumlah</th>
                  {editable ? <th className="w-8" /> : null}
                </tr>
              </thead>
              <tbody>
                {computed.services.map((line, index) => {
                  const record = sub.services.find((s) => s.id === line.lineId);
                  return (
                    <tr key={line.lineId} className="group border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                      <td className={cn(UI_ENGINE_TYPE_META, "py-1.5 pr-2 text-right text-slate-400")}>
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
                        <div className={cn(UI_ENGINE_TYPE_META, "mt-0.5 flex flex-wrap items-center gap-x-2 text-slate-400")}>
                          {record ? (
                            <CostCategoryBadge
                              category={record.costCategory}
                              defaultFor="UPAH"
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
                    {formatIdr(svcTotal)}
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
              className={cn(UI_ENGINE_TYPE_META, "text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline")}
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
