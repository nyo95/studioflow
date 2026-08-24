"use client";

/**
 * MASTER DATA — Pricing page client component.
 *
 * Three tabs, two v2 tables:
 *   1. Material Prices    → SkuPrice, one current row per (SKU × supplier)
 *   2. Material + Labour  → WorkPrice (kind = MATERIAL_LABOR)
 *   3. Labour Prices      → WorkPrice (kind = LABOR_ONLY)
 *
 * Tab 1 is a HISTORY table, and the UI has to keep saying so: editing an
 * amount writes a new row and retires the old one, and "delete" closes the
 * offer rather than erasing it. Both are deliberate — see
 * `services/sku-price-service.ts`.
 *
 * Trades and service vendors are managed on the Suppliers page; their list
 * arrives here as a prop for the tab 2 and 3 pickers.
 */

import * as React from "react";
import { Loader2, Pencil, Plus, Receipt, Search, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
  Button, CreatableChecklist, CreatableSearch, DashboardTemplate, Dialog, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, Input, Label, PageHeader,
  TableCard, TableCardBody, TableCardCell, TableCardHead, TableCardHeader,
  TableCardRow,
  UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE,
  UI_ENGINE_RADIUS_ACTION, UI_ENGINE_RADIUS_CARD, UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_TYPE_BODY, UI_ENGINE_TYPE_H3, UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import { unwrapActionResult } from "@/lib/result";
import {
  UnsavedChangesPrompt,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { WORK_LEVEL1 } from "@/subapps/master-data/services/category-tree-rules";
import { useQuickEntry } from "../hooks/use-quick-entry";
import {
  quickCreateBrandAction,
  quickCreatePartyAction,
  quickCreateSkuAction,
  quickCreateWorkVendorAction,
} from "../actions/quick-entry-actions";
import type { PartyRoleKind } from "@/generated/prisma";
import {
  createMaterialLaborPriceAction, createMaterialPriceAction,
  createServicePriceAction,
  deleteMaterialLaborPriceAction, deleteMaterialPriceAction,
  deleteServicePriceAction,
  getBrandProductCategoriesAction,
  getMaterialPricesAction,
  updateMaterialLaborPriceAction, updateMaterialPriceAction,
  updateServicePriceAction,
} from "../actions/pricing-actions";
import type {
  MaterialLaborPriceData, MaterialLaborPriceInput,
  MaterialPriceData, MaterialPriceInput, MaterialPricePageData,
  ServicePriceData, ServicePriceInput,
  ServiceVendorData,
  WorkPriceData, WorkPriceInput,
} from "../types/pricing";

import { WorkVendorPicker } from "./WorkVendorPicker";
import { SkuPicker } from "./SkuPicker";
import { SkuDetailDrawer } from "./SkuDetailDrawer";

type Tab = "material" | "material-upah" | "upah";

// ---------------------------------------------------------------------------
// Currency formatter
// ---------------------------------------------------------------------------
function fmt(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
}

/**
 * Tanggal update — item 6 (feedback 2026-08-14): "tanggal update nya ga ada".
 *
 * Kolom "Updated by" hanya menyebut nama, dan nama tanpa tanggal tidak bisa
 * menjawab pertanyaan yang sebenarnya diajukan orang saat melihat kolom itu:
 * "harga ini masih relevan tidak?". Yang ditampilkan adalah `updated_at`, dan
 * kalau baris belum pernah disunting sejak dibuat, `created_at` — sebuah baris
 * harga selalu punya tanggal, jadi sel ini tidak pernah perlu kosong.
 */
function fmtDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

/**
 * Satuan yang pernah dipakai, untuk autocomplete field Unit (item 7).
 *
 * Sumbernya adalah baris-baris yang sudah tampil di halaman ini, bukan query
 * baru: daftar satuan sebuah studio pendek dan berekor panjang ("lembar",
 * "m2", "pcs", lalu selusin yang dipakai sekali), dan yang perlu disarankan
 * justru yang sering. Membaca dari data yang sudah ada di layar juga berarti
 * satuan yang baru saja diketik langsung ikut tersarankan setelah refresh,
 * tanpa perlu tabel master satuan yang harus dirawat sendiri.
 */
function collectUnits(...lists: { unit: string | null }[][]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) {
    for (const row of list) {
      const unit = (row.unit ?? "").trim();
      if (!unit) continue;
      const key = unit.toLocaleLowerCase("id-ID");
      if (!seen.has(key)) seen.set(key, unit);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "id-ID"));
}

/**
 * Field satuan dengan saran — item 7 (feedback 2026-08-14):
 * "unit dibuat creatablesearch dengan autocomplete dari tags yg sudah2 bs ga?
 *  mis. pernah input lembar, maka akan ada suggestion lembar saat ketik 'l'".
 *
 * `CreatableSearch` dipakai dalam mode `allowFreeText`: satuan bukan baris di
 * tabel lain yang harus dipilih, ia hanya teks — jadi id-nya adalah teksnya
 * sendiri, dan mengetik satuan baru sah tanpa membuat apa pun di database.
 */
function UnitField({
  value, onChange, options, editable, hint,
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  editable: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className={UI_ENGINE_TYPE_META}>Unit</Label>
      {editable ? (
        <>
          <CreatableSearch
            options={options.map((unit) => ({ id: unit, name: unit }))}
            value={value}
            allowFreeText
            allowClear
            clearLabel="— No unit —"
            emptyLabel="No matching units yet."
            createLabel={'Use unit "{q}"'}
            placeholder="sheet, m², pcs…"
            aria-label="Unit"
            onSelect={(_id: string, name: string) => onChange(name)}
            onCreate={(name: string) => onChange(name)}
          />
          {hint ? <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>{hint}</p> : null}
        </>
      ) : (
        <ReadValue>{value}</ReadValue>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared ReadValue for view mode
// ---------------------------------------------------------------------------
function ReadValue({ children }: { children?: React.ReactNode }) {
  return (
    <div className={cn("min-h-[2.5rem] whitespace-pre-wrap px-3 py-2 text-slate-950", UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_BODY)}>
      {children || <span className="text-slate-400">—</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------
function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-16 text-center">
      <Icon className="size-8 text-slate-300" />
      <p className={cn("max-w-xs text-slate-400", UI_ENGINE_TYPE_META)}>{message}</p>
    </div>
  );
}

// ===========================================================================
// Shared WorkPrice form — Excel Table 3 and Table 4 have identical columns
// ===========================================================================

const EMPTY_WORK_PRICE: WorkPriceInput = {
  name: "", vendor_category: "", category: "", unit: "",
  price: "",
  specification_1: "", specification_2: "", dimensions: "",
  scope_note: "", notes: "", service_vendor_id: null,
};

function workPriceToForm(row: WorkPriceData): WorkPriceInput {
  return {
    name: row.name,
    vendor_category: row.vendor_category,
    category: row.category,
    unit: row.unit,
    price: row.price,
    specification_1: row.specification_1,
    specification_2: row.specification_2,
    dimensions: row.dimensions,
    scope_note: row.scope_note ?? "",
    notes: row.notes ?? "",
    service_vendor_id: row.service_vendor_id,
  };
}

/**
 * The fields shared by both work-price tabs.
 *
 * Extracted rather than duplicated because Excel Table 3 and Table 4 have the
 * same columns — the only difference is what the single `Price` covers, and
 * that is `WorkPrice.kind`, decided by which tab you are on. Two copies of this
 * markup would drift the first time one of them gained a field.
 */
function WorkPriceFields({
  form, setForm, editable, vendors, unitOptions, priceLabel, priceHint, dimensionsNote,
}: {
  form: WorkPriceInput;
  setForm: React.Dispatch<React.SetStateAction<WorkPriceInput>>;
  editable: boolean;
  vendors: ServiceVendorData[];
  /** Satuan yang pernah dipakai di seluruh halaman ini — lihat `collectUnits`. */
  unitOptions: string[];
  priceLabel: string;
  priceHint: string;
  /** Optional note shown beneath the Dimensions field — used by Labour tab. */
  dimensionsNote?: string;
}) {
  /**
   * Quick entry lives here rather than in each tab because both tabs render
   * this component — and the case Sheet2 describes ("kalau data ga lengkap
   * munculin quick entry") happens in exactly this field: you are typing a
   * price and the vendor who quoted it was never entered.
   *
   * The created party gets SERVICE_VENDOR and nothing else. That is the only
   * thing being picked here proves about them.
   */
  const vendorEntry = useQuickEntry<ServiceVendorData, { name: string }>({
    serverRows: vendors,
    action: quickCreateWorkVendorAction,
    input: (name) => ({ name }),
    toRow: (created) =>
      ({ id: created.id, name: created.name, trade: null } as ServiceVendorData),
    onCreated: (id) => setForm((prev) => ({ ...prev, service_vendor_id: id })),
    label: "Vendor",
  });

  const set = <K extends keyof WorkPriceInput>(key: K, value: WorkPriceInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* BQ code removed per Sheet2 — assigned by the BQ app, not entered in masterdata */}
      <UnitField
        value={form.unit}
        onChange={(next) => set("unit", next)}
        options={unitOptions}
        editable={editable}
      />

      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label className={UI_ENGINE_TYPE_META}>Work name</Label>
        {editable ? <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Penarikan kabel CAT" className={UI_ENGINE_RADIUS_CONTROL} />
          : <ReadValue>{form.name}</ReadValue>}
      </div>

      {/* Two-level category per Sheet2: "Category dibuat jadi category dan subcategory"
          Level 1 (Vendor Category) = peran di pekerjaan: MEP, Furniture, Sipil …
          Level 2 (Category) = jenis barang/jasa: Lighting, Screeding, dst.
          Stored as vendor_category + category — same columns, now two separate inputs. */}
      <div className="flex flex-col gap-1.5">
        <Label className={UI_ENGINE_TYPE_META}>Category (group)</Label>
        {editable ? (
          <select
            value={form.vendor_category}
            onChange={e => set("vendor_category", e.target.value)}
            className={cn("border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-[var(--ui-border-focus)]", UI_ENGINE_RADIUS_CONTROL)}
          >
            <option value="">— Select group —</option>
            {WORK_LEVEL1.map((l1) => <option key={l1} value={l1}>{l1}</option>)}
          </select>
        ) : (
          <ReadValue>{form.vendor_category || "—"}</ReadValue>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className={UI_ENGINE_TYPE_META}>Subcategory</Label>
        {editable ? (
          <Input
            value={form.category}
            onChange={e => set("category", e.target.value)}
            placeholder={form.vendor_category ? `e.g. Lighting, Floor Works…` : "Select a group first"}
            disabled={!form.vendor_category}
            className={UI_ENGINE_RADIUS_CONTROL}
          />
        ) : (
          <ReadValue>{form.category || "—"}</ReadValue>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className={UI_ENGINE_TYPE_META}>{priceLabel}</Label>
        {editable ? <Input type="number" value={String(form.price ?? "")} onChange={e => set("price", e.target.value)} placeholder="0" className={UI_ENGINE_RADIUS_CONTROL} />
          : <ReadValue>{fmt(Number(form.price))}</ReadValue>}
        {editable && <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>{priceHint}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className={UI_ENGINE_TYPE_META}>Trade / Vendor (optional)</Label>
        {editable ? (
          <WorkVendorPicker
            vendors={vendorEntry.options}
            value={form.service_vendor_id}
            clearLabel="— Internal price —"
            onSelect={(id) => set("service_vendor_id", id)}
            onQuickCreate={vendorEntry.create}
          />
        ) : (
          <ReadValue>{vendorEntry.options.find(v => v.id === form.service_vendor_id)?.name ?? "Internal price"}</ReadValue>
        )}
      </div>

      {/* Dynamic specifications — Sheet2: "Specification bisa di tambah on the go".
          DB stores spec_1 and spec_2; specs[0]→spec_1, specs[1]→spec_2 (max 2 for now). */}
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <div className="flex items-center justify-between">
          <Label className={UI_ENGINE_TYPE_META}>Specifications</Label>
          {editable && form.specification_1 !== "" && form.specification_2 === "" && (
            <button
              type="button"
              onClick={() => set("specification_2", " ")}
              className={cn("flex items-center gap-1 text-xs text-[var(--ui-action-bg)] hover:underline")}
            >
              <Plus className="size-3" /> Add spec
            </button>
          )}
          {editable && form.specification_1 === "" && (
            <button
              type="button"
              onClick={() => set("specification_1", " ")}
              className={cn("flex items-center gap-1 text-xs text-[var(--ui-action-bg)] hover:underline")}
            >
              <Plus className="size-3" /> Add spec
            </button>
          )}
        </div>
        {editable ? (
          <div className="flex flex-col gap-2">
            <Input
              value={form.specification_1}
              onChange={e => set("specification_1", e.target.value)}
              placeholder="e.g. CAT 6"
              className={UI_ENGINE_RADIUS_CONTROL}
            />
            {(form.specification_1 !== "" || form.specification_2 !== "") && (
              <div className="flex items-center gap-2">
                <Input
                  value={form.specification_2}
                  onChange={e => set("specification_2", e.target.value)}
                  placeholder="e.g. H 20-50"
                  className={cn("flex-1", UI_ENGINE_RADIUS_CONTROL)}
                />
                {form.specification_2 !== "" && (
                  <button
                    type="button"
                    onClick={() => set("specification_2", "")}
                    title="Remove"
                    className="shrink-0 text-slate-300 hover:text-red-400"
                  >
                    ×
                  </button>
                )}
              </div>
            )}
            {form.specification_1 !== "" && form.specification_2 === "" && (
              <button
                type="button"
                onClick={() => set("specification_2", "")}
                className={cn("self-start flex items-center gap-1 text-xs text-[var(--ui-action-bg)] hover:underline")}
              >
                <Plus className="size-3" /> Add another spec
              </button>
            )}
          </div>
        ) : (
          <ReadValue>
            {[form.specification_1, form.specification_2].filter(Boolean).join(" / ") || undefined}
          </ReadValue>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className={UI_ENGINE_TYPE_META}>Dimensions</Label>
        {editable ? <Input value={form.dimensions} onChange={e => set("dimensions", e.target.value)} placeholder="1220 x 2440 mm" className={UI_ENGINE_RADIUS_CONTROL} />
          : <ReadValue>{form.dimensions}</ReadValue>}
        {editable && dimensionsNote && (
          <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>{dimensionsNote}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label className={UI_ENGINE_TYPE_META}>Scope — what the price includes</Label>
        {editable ? <textarea value={form.scope_note} onChange={e => set("scope_note", e.target.value)}
          className={cn("min-h-[4rem] resize-y border border-slate-200 bg-white p-3 outline-none focus:border-[var(--ui-border-focus)]", UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_BODY)} />
          : <ReadValue>{form.scope_note}</ReadValue>}
      </div>
      <div className="flex flex-col gap-1.5 md:col-span-2">
        <Label className={UI_ENGINE_TYPE_META}>Notes</Label>
        {editable ? <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
          className={cn("min-h-[3rem] resize-y border border-slate-200 bg-white p-3 outline-none focus:border-[var(--ui-border-focus)]", UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_BODY)} />
          : <ReadValue>{form.notes}</ReadValue>}
      </div>
    </div>
  );
}

// ===========================================================================
// TAB 1 — Material Prices (MaterialPrice)
// ===========================================================================

type MaterialPriceDialogState = { open: boolean; mode: "CREATE" | "EDIT"; row: MaterialPriceData | null };
const EMPTY_MP: MaterialPriceInput = {
  brand_id: "", sku_id: null, supplier_party_id: null, item_description: "", unit: "",
  price: null, valid_from: null, notes: "",
  usage_unit: "", conversion: null,
  dim_display: null, category_names: [],
};

type SkuOption = { id: string; sku: string; productName: string; brandId: string | null; brandName: string | null };
type SupplierOption = { id: string; name: string };

function HargaMaterialTab({
  initialPage, brands, skuOptions, suppliers, unitOptions, canManage, userName, onCountChange,
}: {
  initialPage: MaterialPricePageData;
  brands: { id: string; brand_name: string }[];
  skuOptions: SkuOption[];
  suppliers: SupplierOption[];
  unitOptions: string[];
  canManage: boolean;
  userName: string;
  /**
   * Reports the live row count up to `PricingClient` (2026-08-18, owner
   * feedback item 4). The tab badge ("Material Prices N") used to read
   * straight from the page-load prop, so it stayed frozen at whatever count
   * the server sent — add, edit or delete a price here and the TABLE updated
   * immediately (`setRows` below always did), but the badge next to the tab
   * label did not, until a full page reload re-fetched it.
   */
  onCountChange?: (count: number) => void;
}) {
  const [rows, setRows] = React.useState(initialPage.rows);
  const [total, setTotal] = React.useState(initialPage.total);
  const [allTotal, setAllTotal] = React.useState(initialPage.allTotal);
  const [page, setPage] = React.useState(initialPage.page);
  const [isLoading, setIsLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebounce(query, 300);
  const searchMounted = React.useRef(false);
  const requestSequence = React.useRef(0);
  const [dialog, setDialog] = React.useState<MaterialPriceDialogState>({ open: false, mode: "CREATE", row: null });
  const [form, setForm] = React.useState<MaterialPriceInput>(EMPTY_MP);
  const [isSaving, setIsSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<MaterialPriceData | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [viewerSkuId, setViewerSkuId] = React.useState<string | null>(null);

  // ---------- Dimension calculator local state (UI-only, not sent to server) ----------
  // TO_M: faktor konversi ke meter. Units: mm=0.001, cm=0.01, m=1.
  const DIM_UNITS = ["mm", "cm", "m"] as const;
  type DimUnit = typeof DIM_UNITS[number];
  const TO_M: Record<DimUnit, number> = { mm: 0.001, cm: 0.01, m: 1 };

  const [dimType, setDimType] = React.useState<"area" | "linear">("area");
  const [dimUnit, setDimUnit] = React.useState<DimUnit>("mm");
  const [dimW, setDimW] = React.useState("");
  const [dimL, setDimL] = React.useState("");

  /** Recalculate usage_unit, conversion, and dim_display whenever dim inputs change. */
  React.useEffect(() => {
    const factor = TO_M[dimUnit];
    const l = parseFloat(dimL);
    if (!dimL.trim() || isNaN(l) || l <= 0) return;
    if (dimType === "linear") {
      const conv = parseFloat((l * factor).toFixed(6));
      const display = `${dimL} ${dimUnit}`;
      setForm(p => ({ ...p, usage_unit: "m", conversion: conv, dim_display: display }));
    } else {
      const w = parseFloat(dimW);
      if (!dimW.trim() || isNaN(w) || w <= 0) return;
      const conv = parseFloat((w * factor * l * factor).toFixed(6));
      const display = `${dimW} × ${dimL} ${dimUnit}`;
      setForm(p => ({ ...p, usage_unit: "m2", conversion: conv, dim_display: display }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimType, dimUnit, dimW, dimL]);

  // ---------- Brand categories — fetched when brand changes ----------
  const [brandCategories, setBrandCategories] = React.useState<{ id: string; name: string }[]>([]);
  React.useEffect(() => {
    if (!form.brand_id) { setBrandCategories([]); return; }
    void getBrandProductCategoriesAction({ brandId: form.brand_id }).then((result) => {
      if (result.success) setBrandCategories(result.data);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.brand_id]);
  // ------------------------------------------------------------------

  React.useEffect(() => { onCountChange?.(allTotal); }, [allTotal, onCountChange]);

  const loadPage = React.useCallback(async (targetPage: number, search: string) => {
    const request = ++requestSequence.current;
    setIsLoading(true);
    try {
      const result = unwrapActionResult(await getMaterialPricesAction({
        page: targetPage,
        pageSize: initialPage.pageSize,
        search: search || undefined,
      }));
      if (request !== requestSequence.current) return;
      setRows(result.rows);
      setTotal(result.total);
      setAllTotal(result.allTotal);
      setPage(result.page);
    } catch (error) {
      if (request === requestSequence.current) {
        toast.error(error instanceof Error ? error.message : "Could not load material prices");
      }
    } finally {
      if (request === requestSequence.current) setIsLoading(false);
    }
  }, [initialPage.pageSize]);

  React.useEffect(() => {
    if (!searchMounted.current) {
      searchMounted.current = true;
      return;
    }
    void loadPage(1, debouncedQuery);
  }, [debouncedQuery, loadPage]);

  /**
   * Sheet2 marks SKU `**` too — quick entry allowed for managers. A SKU
   * created here gets `base_unit: "pcs"` and no category; the Materials page
   * is where the rest of the fields live.
   *
   * `useQuickEntry` requires `T extends { id; name }`. `SkuOption` uses `sku`
   * and `productName` instead, so we add a `name` field (= sku code or product
   * name) when mapping the server rows. The extra field is inert for display;
   * the picker reads `sku` and `productName` directly.
   */
  type SkuEntryRow = SkuOption & { name: string };
  const skuOptionsNamed = React.useMemo<SkuEntryRow[]>(
    () => skuOptions.map((s) => ({ ...s, name: s.sku || s.productName })),
    [skuOptions]
  );
  const skuEntry = useQuickEntry<SkuEntryRow, { brand_id: string; sku_code: string }>({
    serverRows: skuOptionsNamed,
    action: quickCreateSkuAction,
    input: (name) => ({ brand_id: form.brand_id, sku_code: name }),
    toRow: (created) => ({
      id: created.id,
      name: created.name,
      sku: created.name,
      productName: created.name,
      brandId: form.brand_id,
      brandName: null,
    }),
    onCreated: (id) => setForm((p) => ({ ...p, sku_id: id })),
    label: "SKU",
  });

  // Show brand SKUs first, then all others — this way TH231AC (for example)
  // is still findable even if it exists under a different brand or was created
  // in a previous session before this page's server data was refreshed.
  const skusForBrand = React.useMemo(() => {
    const brandSkus = skuEntry.options.filter((s) => s.brandId === form.brand_id);
    if (brandSkus.length > 0) return brandSkus;
    // Fallback: show all SKUs when the selected brand has none yet,
    // so existing codes typed by the user can still be found.
    return skuEntry.options;
  }, [skuEntry.options, form.brand_id]);

  /**
   * Sheet2 marks Supplier `**` — quick entry required.
   *
   * The role written is SUPPLIER, because being picked here is a claim that
   * this party supplies material, and nothing more. Ace Hardware and Informa
   * are Retail in Excel's own examples and will keep that role too if they
   * already have it — `quickCreatePartyAction` tops roles up rather than
   * replacing them.
   */
  const supplierEntry = useQuickEntry<SupplierOption, { name: string; roles: PartyRoleKind[] }>({
    serverRows: suppliers,
    action: quickCreatePartyAction,
    input: (name) => ({ name, roles: ["SUPPLIER"] }),
    toRow: (created) => ({ id: created.id, name: created.name }),
    onCreated: (id) => setForm((p) => ({ ...p, supplier_party_id: id })),
    label: "Supplier",
  });

  /** Sheet2 marks Brand `**` too. A brand created here has no owner yet — the
      Party behind it is a separate fact, filled in on the Supplier page. */
  const brandEntry = useQuickEntry<
    { id: string; name: string; brand_name: string },
    { name: string; owner_party_id: string | null }
  >({
    serverRows: React.useMemo(
      () => brands.map((b) => ({ id: b.id, name: b.brand_name, brand_name: b.brand_name })),
      [brands]
    ),
    action: quickCreateBrandAction,
    input: (name) => ({ name, owner_party_id: null }),
    toRow: (created) => ({ id: created.id, name: created.name, brand_name: created.name }),
    onCreated: (id) => setForm((p) => ({ ...p, brand_id: id, sku_id: null })),
    label: "Brand",
  });

  /**
   * `markPristine` dipanggil di sini, bukan di sebuah efek: form disusun secara
   * sinkron tepat di titik ini, jadi inilah satu-satunya tempat yang punya
   * nilai barunya sebelum React sempat me-render ulang.
   */
  function resetDimState() {
    setDimType("area");
    setDimUnit("mm");
    setDimW("");
    setDimL("");
  }

  function openCreate() {
    setForm(EMPTY_MP);
    guard.markPristine(EMPTY_MP);
    resetDimState();
    setDialog({ open: true, mode: "CREATE", row: null });
  }
  function openEdit(row: MaterialPriceData) {
    const next: MaterialPriceInput = {
      brand_id: row.brand_id, sku_id: row.sku_id, supplier_party_id: row.supplier_party_id,
      item_description: row.item_description,
      unit: row.unit ?? "", price: row.price,
      valid_from: row.valid_from ? new Date(row.valid_from).toISOString().slice(0, 10) : null,
      notes: row.notes ?? "",
      usage_unit: row.sku_usage_unit ?? "",
      conversion: row.sku_conversion ?? null,
      dim_display: row.sku_dim_display ?? null,
      category_names: row.sku_categories ?? [],
    };
    setForm(next);
    guard.markPristine(next);
    resetDimState();
    setDialog({ open: true, mode: "EDIT", row });
  }

  async function save() {
    setIsSaving(true);
    try {
      if (dialog.mode === "CREATE") {
        unwrapActionResult(await createMaterialPriceAction(form));
        toast.success("Price added");
      } else if (dialog.row) {
        unwrapActionResult(await updateMaterialPriceAction({ id: dialog.row.id, data: form, updatedByName: userName }));
        toast.success("Price updated");
      }
      guard.closeAfterSave();
      await loadPage(1, debouncedQuery);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setIsSaving(false); }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      unwrapActionResult(await deleteMaterialPriceAction({ id: deleteTarget.id }));
      toast.success("Price removed from the current list. Its history is kept.");
      const nextLastPage = Math.max(1, Math.ceil(Math.max(0, total - 1) / initialPage.pageSize));
      await loadPage(Math.min(page, nextLastPage), debouncedQuery);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not remove"); }
    finally { setIsDeleting(false); setDeleteTarget(null); }
  }

  // A price row exists to say what something costs, so the amount has to be
  // there. Brand is not required — generic stock has none (Q7) — and the SKU
  // carries the description.
  const hasAmount = form.price !== null && String(form.price) !== "";
  const canSave = Boolean(form.sku_id) && hasAmount;

  /**
   * Bisa disunting = punya izin. Gatekeeper "Edit" dihapus 2026-08-14 —
   * lihat `hooks/use-unsaved-changes-guard.tsx` untuk penggantinya.
   */
  const editable = canManage;

  const guard = useUnsavedChangesGuard({
    open: dialog.open,
    value: form,
    onOpenChange: (open) => setDialog(d => ({ ...d, open })),
    enabled: editable,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search brand, supplier or item…" className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)} />
        </div>
        <span className={cn("shrink-0 tabular-nums text-slate-400", UI_ENGINE_TYPE_META)}>{total} prices</span>
        {canManage && (
          <Button onClick={openCreate} className={cn("bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]", UI_ENGINE_RADIUS_ACTION)}>
            <Plus className="size-4" /> Add Price
          </Button>
        )}
      </div>

      <TableCard layout="fixed" minWidth="var(--ui-pricing-material-table-min-width)">
        <TableCardHeader>
          <TableCardHead style={{ width: "var(--ui-pricing-material-col-brand)" }}>Brand</TableCardHead>
          <TableCardHead style={{ width: "var(--ui-pricing-material-col-supplier)" }}>Supplier</TableCardHead>
          <TableCardHead style={{ width: "var(--ui-pricing-material-col-code)" }}>Code</TableCardHead>
          <TableCardHead style={{ width: "var(--ui-pricing-material-col-item)" }}>Item</TableCardHead>
          <TableCardHead style={{ width: "var(--ui-pricing-material-col-unit)" }}>Unit</TableCardHead>
          {/* Satu kolom harga sejak 2026-08-14 (item 8) — "List price" dan
              "Net price" digabung menjadi harga yang berlaku. */}
          <TableCardHead style={{ width: "var(--ui-pricing-material-col-price)" }}>Price</TableCardHead>
          {/* Item 6: nama saja tidak cukup untuk menilai apakah harga ini masih
              relevan; tanggalnya ikut ditampilkan di bawah nama. */}
          <TableCardHead style={{ width: "var(--ui-pricing-material-col-updated)" }}>Last updated</TableCardHead>
          {canManage && <TableCardHead style={{ width: "var(--ui-pricing-material-col-actions)" }} />}
        </TableCardHeader>
        <TableCardBody>
          {rows.length === 0 ? (
            <TableCardRow><TableCardCell colSpan={canManage ? 8 : 7}>
              <EmptyState
                icon={Receipt}
                message={debouncedQuery ? "No material prices match your search." : "No material prices yet. Use Add Price to start."}
              />
            </TableCardCell></TableCardRow>
          ) : rows.map(row => (
            <TableCardRow
              key={row.id}
              className="cursor-pointer hover:bg-slate-50"
              tabIndex={0}
              onClick={() => setViewerSkuId(row.sku_id)}
              onKeyDown={(event) => {
                if (event.currentTarget !== event.target) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setViewerSkuId(row.sku_id);
                }
              }}
            >
              <TableCardCell className="font-medium">{row.brand?.brand_name ?? "—"}</TableCardCell>
              <TableCardCell>
                {/* No supplier is a fact, not a gap: it is the manufacturer's
                    own list price. Saying so beats an em dash that reads as
                    missing data. */}
                {row.supplier
                  ? row.supplier.name
                  : <span className="italic text-slate-400">List price</span>}
              </TableCardCell>
              <TableCardCell className={cn("font-mono text-xs", UI_ENGINE_TYPE_META)}>
                {row.sku?.catalog_sku ?? <span className="text-slate-300">—</span>}
              </TableCardCell>
              <TableCardCell>{row.item_description}</TableCardCell>
              <TableCardCell className="text-slate-500">{row.unit ?? "—"}</TableCardCell>
              <TableCardCell className="tabular-nums font-medium">{fmt(row.price)}</TableCardCell>
              <TableCardCell className={cn("text-xs text-slate-400", UI_ENGINE_TYPE_META)}>
                <div className="flex flex-col">
                  <span>{row.updated_by_name ?? "—"}</span>
                  <span className="tabular-nums">
                    {fmtDate(row.updated_at ?? row.created_at) ?? "—"}
                  </span>
                </div>
              </TableCardCell>
              {canManage && (
                <TableCardCell>
                  <div className="flex items-center justify-end gap-[calc(var(--ui-section-gap)/4)]">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit price for ${row.item_description}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEdit(row);
                      }}
                      className={UI_ENGINE_RADIUS_ACTION}
                    >
                      <Pencil className="size-[var(--ui-icon-size-sm)]" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove price for ${row.item_description}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleteTarget(row);
                      }}
                      className={cn(
                        "text-[var(--ui-text-tertiary)] hover:text-[var(--ui-change-before)]",
                        UI_ENGINE_RADIUS_ACTION
                      )}
                    >
                      <Trash2 className="size-[var(--ui-icon-size-sm)]" />
                    </Button>
                  </div>
                </TableCardCell>
              )}
            </TableCardRow>
          ))}
        </TableCardBody>
      </TableCard>

      <div className="flex items-center justify-between">
        <span className={cn("text-[var(--ui-text-tertiary)]", UI_ENGINE_TYPE_META)}>
          {isLoading
            ? "Loading prices…"
            : total === 0
              ? "No results"
              : `Page ${page} of ${Math.max(1, Math.ceil(total / initialPage.pageSize))}`}
        </span>
        <div className="flex items-center gap-[calc(var(--ui-section-gap)/4)]">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => void loadPage(page - 1, debouncedQuery)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= Math.ceil(total / initialPage.pageSize) || isLoading}
            onClick={() => void loadPage(page + 1, debouncedQuery)}
          >
            Next
          </Button>
        </div>
      </div>

      <Dialog open={dialog.open} onOpenChange={guard.handleOpenChange}>
        <DialogContent className={cn("max-h-[90vh] max-w-2xl overflow-y-auto border bg-white p-6", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
          <DialogHeader>
            {/* `pr-12` menyisakan ruang untuk tombol X yang diposisikan
                `absolute right-4` oleh DialogContent. Sebelum ini judul dan
                tombol Edit menabraknya. */}
            <div className="flex items-center justify-between pr-12">
              <DialogTitle className={UI_ENGINE_TYPE_H3}>
                {dialog.mode === "CREATE" ? "Add Material Price" : "Material Price"}
              </DialogTitle>
            </div>
          </DialogHeader>

          {dialog.mode === "EDIT" && editable && (
            <p className={cn("rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800", UI_ENGINE_TYPE_META)}>
              Changing an amount, unit or supplier records a <strong>new</strong> price
              and retires this one. The figure quoted before stays on record.
              Editing only the note amends this row in place.
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className={UI_ENGINE_TYPE_META}>Brand</Label>
              {editable ? (
                <CreatableSearch
                  options={brandEntry.options.map(b => ({ id: b.id, name: b.brand_name }))}
                  value={form.brand_id}
                  placeholder="Search brand…"
                  aria-label="Brand"
                  allowClear
                  clearLabel="— No brand (generic stock) —"
                  emptyLabel="Brand not found."
                  createLabel={'Add brand "{q}"'}
                  onSelect={(id: string) => setForm(p => ({ ...p, brand_id: id, sku_id: null }))}
                  onCreate={canManage ? brandEntry.create : undefined}
                />
              ) : <ReadValue>{brandEntry.options.find(b => b.id === form.brand_id)?.brand_name}</ReadValue>}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className={UI_ENGINE_TYPE_META}>Supplier</Label>
              {editable ? (
                <CreatableSearch
                  options={supplierEntry.options}
                  value={form.supplier_party_id ?? ""}
                  placeholder="Search supplier…"
                  aria-label="Supplier"
                  allowClear
                  clearLabel="— Manufacturer list price —"
                  emptyLabel="Supplier not found."
                  createLabel={'Add supplier "{q}"'}
                  onSelect={(id: string) => setForm(p => ({ ...p, supplier_party_id: id || null }))}
                  onCreate={canManage ? supplierEntry.create : undefined}
                />
              ) : (
                <ReadValue>
                  {supplierEntry.options.find(s => s.id === form.supplier_party_id)?.name ?? "Manufacturer list price"}
                </ReadValue>
              )}
              {editable && (
                <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                  One current price per supplier. Saving replaces this supplier&apos;s
                  previous quote only — other suppliers keep theirs.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label className={UI_ENGINE_TYPE_META}>SKU / Material</Label>
              {editable ? (
                <SkuPicker
                  skus={skusForBrand}
                  value={form.sku_id}
                  disabled={!form.brand_id || skuEntry.isCreating}
                  onCreate={canManage ? skuEntry.create : undefined}
                  isCreating={skuEntry.isCreating}
                  onSelect={(skuId) => {
                    const picked = skuEntry.options.find(s => s.id === skuId);
                    setForm(p => ({
                      ...p,
                      sku_id: skuId,
                      item_description:
                        p.item_description.trim() === "" && picked
                          ? `${picked.sku} — ${picked.productName}`
                          : p.item_description,
                    }));
                  }}
                />
              ) : (
                <ReadValue>
                  {form.sku_id
                    ? (() => { const s = skuOptions.find(o => o.id === form.sku_id); return s ? `${s.sku} — ${s.productName}` : form.sku_id; })()
                    : "Not linked to a SKU"}
                </ReadValue>
              )}
              {editable && !form.brand_id && <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>Select a brand first.</p>}
              {editable && form.brand_id && skusForBrand.length === 0 && !canManage && <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>This brand has no SKU in the material catalog yet.</p>}
            </div>

            {/* Category tags — inherit from brand, creatable search, propagates back to brand */}
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label className={UI_ENGINE_TYPE_META}>
                Kategori produk
                <span className={cn("ml-1 font-normal", UI_ENGINE_TYPE_META)}>(pilih satu atau lebih)</span>
              </Label>
              {editable ? (
                <>
                  <CreatableChecklist
                    value={form.category_names}
                    onChange={(next) => setForm(p => ({ ...p, category_names: next }))}
                    options={brandCategories.map(c => c.name)}
                    aria-label="Kategori produk"
                    placeholder="Kategori baru…"
                    addLabel="Tambah"
                  />
                  <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                    Pilih dari kategori brand, atau ketik untuk tambah kategori baru. Kategori baru otomatis ditambahkan ke brand juga.
                  </p>
                </>
              ) : (
                <ReadValue>
                  {form.category_names.length > 0 ? form.category_names.join(", ") : "—"}
                </ReadValue>
              )}
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label className={UI_ENGINE_TYPE_META}>Item description / spec</Label>
              {editable ? <Input value={form.item_description} onChange={e => setForm(p => ({ ...p, item_description: e.target.value }))} placeholder="e.g. TACO HPL Marble Carrara 1.2mm" className={UI_ENGINE_RADIUS_CONTROL} />
                : <ReadValue>{form.item_description}</ReadValue>}
            </div>
            <UnitField
              value={form.unit}
              onChange={(next) => setForm(p => ({ ...p, unit: next }))}
              options={unitOptions}
              editable={editable}
            />
            {/* Costing profile — dimension calculator.
                Mengisi usage_unit & conversion ke Sku supaya BQ bisa konversi qty otomatis.
                Input dimensi bersifat lokal (UI helper); hanya usage_unit & conversion yang disimpan. */}
            <div className="md:col-span-2 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className={cn("font-medium text-slate-600", UI_ENGINE_TYPE_META)}>
                  Kalkulator dimensi
                </span>
                {editable && (
                  <div className="flex gap-1">
                    {(["area", "linear"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setDimType(t)}
                        className={cn(
                          "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                          dimType === t
                            ? "bg-slate-700 text-white"
                            : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-100"
                        )}
                      >
                        {t === "area" ? "Area (W × L)" : "Linear (L)"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {editable ? (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    {dimType === "area" && (
                      <>
                        <Input
                          type="number"
                          value={dimW}
                          onChange={e => setDimW(e.target.value)}
                          placeholder="W"
                          className={cn("w-24", UI_ENGINE_RADIUS_CONTROL)}
                        />
                        <span className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>×</span>
                      </>
                    )}
                    <Input
                      type="number"
                      value={dimL}
                      onChange={e => setDimL(e.target.value)}
                      placeholder={dimType === "area" ? "L" : "Panjang"}
                      className={cn("w-24", UI_ENGINE_RADIUS_CONTROL)}
                    />
                    <select
                      value={dimUnit}
                      onChange={e => setDimUnit(e.target.value as DimUnit)}
                      className={cn(
                        "h-9 rounded border border-slate-200 bg-white px-2 text-sm text-slate-700",
                        UI_ENGINE_RADIUS_CONTROL
                      )}
                    >
                      {DIM_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>

                  {/* Auto-preview */}
                  {form.conversion != null && (
                    <p className="text-xs text-emerald-600 font-medium">
                      → 1 {form.unit || "unit"} = {form.conversion} {form.usage_unit}
                    </p>
                  )}
                  {!form.conversion && (
                    <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                      Isi dimensi di atas → usage unit &amp; konversi terisi otomatis.
                    </p>
                  )}
                </>
              ) : (
                /* Read-only view */
                <p className={cn("text-slate-600", UI_ENGINE_TYPE_META)}>
                  {form.conversion != null
                    ? `1 ${form.unit || "unit"} = ${form.conversion} ${form.usage_unit}`
                    : "—"}
                </p>
              )}

              {/* Result fields — auto-filled, always visible so user can see/verify */}
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>Usage unit</span>
                  <span className={cn("text-slate-700", UI_ENGINE_TYPE_META)}>
                    {form.usage_unit || "—"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                    {form.unit ? `1 ${form.unit} =` : "Konversi"}
                  </span>
                  <span className={cn("text-slate-700", UI_ENGINE_TYPE_META)}>
                    {form.conversion != null
                      ? `${form.conversion} ${form.usage_unit || ""}`.trim()
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* valid_from removed per Sheet2: always auto-set to entry/update timestamp */}
            {/* Satu harga (item 8, 2026-08-14). Sebelumnya dua field — "list"
                dan "net" — yang memaksa dua keputusan pada setiap entri padahal
                yang dicatat studio cuma satu: harga yang benar-benar berlaku. */}
            <div className="flex flex-col gap-1.5">
              <Label className={UI_ENGINE_TYPE_META}>Price</Label>
              {editable ? <Input type="number" value={form.price ?? ""} onChange={e => setForm(p => ({ ...p, price: e.target.value ? Number(e.target.value) : null }))} placeholder="0" className={UI_ENGINE_RADIUS_CONTROL} />
                : <ReadValue>{fmt(form.price as number | null)}</ReadValue>}
              {editable && (
                <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                  The current price from this supplier, including any discount.
                  Blank does not mean zero: a row without a price will not be saved.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label className={UI_ENGINE_TYPE_META}>Notes</Label>
              {editable ? <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                className={cn("min-h-[4rem] resize-y border border-slate-200 bg-white p-3 outline-none focus:border-[var(--ui-border-focus)]", UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_BODY)} />
                : <ReadValue>{form.notes}</ReadValue>}
            </div>
          </div>

          {editable && (
            <DialogFooter>
              <div className="flex flex-col gap-1 w-full">
                <Button onClick={() => void save()} disabled={!canSave || isSaving}
                  className={cn("bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]", UI_ENGINE_RADIUS_ACTION)}>
                  {isSaving ? <Loader2 className="size-4 animate-spin" /> : null} Save New Price
                </Button>
                <p className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                  Saving creates a new price entry. The current price will be archived.
                </p>
                {!canSave && (
                  <span className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                    {!form.sku_id ? "Select an SKU first" : "Enter a price"}
                  </span>
                )}
              </div>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this price?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.item_description}
              {deleteTarget?.supplier ? ` — ${deleteTarget.supplier.name}` : " — manufacturer list price"}
              {" "}will stop being the current price. It stays in the price history,
              so past quotes remain answerable.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction asChild>
              <Button type="button" variant="destructive" onClick={() => void doDelete()} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null} Remove
              </Button>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SkuDetailDrawer skuId={viewerSkuId} onClose={() => setViewerSkuId(null)} />

      <UnsavedChangesPrompt guard={guard} />
    </div>
  );
}

// ===========================================================================
// TAB 2 — Material Prices + Upah (MaterialLaborPrice)
// ===========================================================================

function HargaMaterialUpahTab({
  rows: initial, vendors, unitOptions, canManage, userName, onCountChange,
}: {
  rows: MaterialLaborPriceData[];
  vendors: ServiceVendorData[];
  unitOptions: string[];
  canManage: boolean;
  userName: string;
  /** See `HargaMaterialTab`'s `onCountChange` — same fix, same reason. */
  onCountChange?: (count: number) => void;
}) {
  const [rows, setRows] = React.useState(initial);
  React.useEffect(() => { onCountChange?.(rows.length); }, [rows.length, onCountChange]);
  const [query, setQuery] = React.useState("");
  const [dialog, setDialog] = React.useState<{ open: boolean; mode: "CREATE" | "EDIT"; row: MaterialLaborPriceData | null }>({ open: false, mode: "CREATE", row: null });
  const [form, setForm] = React.useState<MaterialLaborPriceInput>(EMPTY_WORK_PRICE);
  const [isSaving, setIsSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<MaterialLaborPriceData | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const visible = React.useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(r => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [rows, query]);

  function openCreate() {
    setForm(EMPTY_WORK_PRICE);
    guard.markPristine(EMPTY_WORK_PRICE);
    setDialog({ open: true, mode: "CREATE", row: null });
  }
  function openEdit(row: MaterialLaborPriceData) {
    const next = workPriceToForm(row);
    setForm(next);
    guard.markPristine(next);
    setDialog({ open: true, mode: "EDIT", row });
  }

  async function save() {
    setIsSaving(true);
    try {
      if (dialog.mode === "CREATE") {
        const saved = unwrapActionResult(await createMaterialLaborPriceAction(form));
        setRows(prev => [saved, ...prev]);
        toast.success("Price added");
      } else if (dialog.row) {
        const saved = unwrapActionResult(await updateMaterialLaborPriceAction({ id: dialog.row.id, data: form, updatedByName: userName }));
        setRows(prev => prev.map(r => r.id === saved.id ? saved : r));
        toast.success("Price updated");
      }
      guard.closeAfterSave();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setIsSaving(false); }
  }

  async function doDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      unwrapActionResult(await deleteMaterialLaborPriceAction({ id: deleteTarget.id }));
      setRows(prev => prev.filter(r => r.id !== deleteTarget.id));
      toast.success("Price removed");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete"); }
    finally { setIsDeleting(false); setDeleteTarget(null); }
  }

  const canSave = Boolean(form.name.trim() && form.category.trim() && form.unit.trim());
  const editable = canManage;

  const guard = useUnsavedChangesGuard({
    open: dialog.open,
    value: form,
    onOpenChange: (open) => setDialog(d => ({ ...d, open })),
    enabled: editable,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or code…" className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)} />
        </div>
        <span className={cn("shrink-0 tabular-nums text-slate-400", UI_ENGINE_TYPE_META)}>{rows.length} packages</span>
        {canManage && (
          <Button onClick={openCreate} className={cn("bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]", UI_ENGINE_RADIUS_ACTION)}>
            <Plus className="size-4" /> Add Package
          </Button>
        )}
      </div>

      <TableCard layout="auto">
        <TableCardHeader>
          <TableCardHead style={{ width: "35%" }}>Name / Trade</TableCardHead>
          <TableCardHead style={{ width: "18%" }}>Category</TableCardHead>
          <TableCardHead style={{ width: "9%" }}>Unit</TableCardHead>
          <TableCardHead style={{ width: "16%" }}>Vendor</TableCardHead>
          <TableCardHead style={{ width: "16%" }}>Price</TableCardHead>
          {canManage && <TableCardHead style={{ width: "6%" }} />}
        </TableCardHeader>
        <TableCardBody>
          {visible.length === 0 ? (
            <TableCardRow><TableCardCell colSpan={canManage ? 6 : 5}>
              <EmptyState icon={Wrench} message="No material + labour packages yet." />
            </TableCardCell></TableCardRow>
          ) : visible.map(row => (
            <TableCardRow key={row.id} className="cursor-pointer hover:bg-slate-50" onClick={() => openEdit(row)}>
              <TableCardCell className="font-medium">{row.name}</TableCardCell>
              <TableCardCell className="text-slate-500">{row.category}</TableCardCell>
              <TableCardCell className="text-slate-500">{row.unit}</TableCardCell>
              <TableCardCell className="text-slate-500">{row.service_vendor?.name ?? "—"}</TableCardCell>
              <TableCardCell className="tabular-nums font-semibold">{fmt(row.price)}</TableCardCell>
              {canManage && (
                <TableCardCell>
                  <Button variant="ghost" size="icon-sm" onClick={e => { e.stopPropagation(); setDeleteTarget(row); }} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="size-4" />
                  </Button>
                </TableCardCell>
              )}
            </TableCardRow>
          ))}
        </TableCardBody>
      </TableCard>

      <Dialog open={dialog.open} onOpenChange={guard.handleOpenChange}>
        <DialogContent className={cn("max-h-[90vh] max-w-2xl overflow-y-auto border bg-white p-6", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
          <DialogHeader>
            <div className="flex items-center justify-between pr-12">
              <DialogTitle className={UI_ENGINE_TYPE_H3}>
                {dialog.mode === "CREATE" ? "Add Material + Labour Price" : dialog.row?.name}
              </DialogTitle>
            </div>
          </DialogHeader>

          <WorkPriceFields
            form={form}
            setForm={setForm}
            editable={editable}
            vendors={vendors}
            unitOptions={unitOptions}
            priceLabel="Price (material + labour)"
            priceHint="One figure covering both, as Excel Table 3 has it."
          />

          {editable && (
            <DialogFooter>
              <Button onClick={() => void save()} disabled={!canSave || isSaving}
                className={cn("bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]", UI_ENGINE_RADIUS_ACTION)}>
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : null} Save
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this price package?</AlertDialogTitle>
            <AlertDialogDescription>{deleteTarget?.name} ({deleteTarget?.code}) will be deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doDelete()} disabled={isDeleting} className="bg-red-600 text-white hover:bg-red-700">
              {isDeleting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesPrompt guard={guard} />
    </div>
  );
}

// ===========================================================================
// TAB 3 — Labour Prices (ServicePrice only — vendor management moved to Tab 4)
// ===========================================================================

function HargaUpahTab({
  prices: initialPrices, vendors, unitOptions, canManage, onCountChange,
}: {
  prices: ServicePriceData[];
  vendors: ServiceVendorData[];
  unitOptions: string[];
  canManage: boolean;
  /** See `HargaMaterialTab`'s `onCountChange` — same fix, same reason. */
  onCountChange?: (count: number) => void;
}) {
  const [prices, setPrices] = React.useState(initialPrices);
  React.useEffect(() => { onCountChange?.(prices.length); }, [prices.length, onCountChange]);
  const [query, setQuery] = React.useState("");

  const [spDialog, setSpDialog] = React.useState<{ open: boolean; mode: "CREATE" | "EDIT"; row: ServicePriceData | null }>({ open: false, mode: "CREATE", row: null });
  const [spForm, setSpForm] = React.useState<ServicePriceInput>(EMPTY_WORK_PRICE);
  const [spSaving, setSpSaving] = React.useState(false);
  const [spDeleteTarget, setSpDeleteTarget] = React.useState<ServicePriceData | null>(null);
  const [spDeleting, setSpDeleting] = React.useState(false);

  const visiblePrices = React.useMemo(() => {
    if (!query.trim()) return prices;
    const q = query.toLowerCase();
    return prices.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [prices, query]);

  async function saveSp() {
    setSpSaving(true);
    try {
      if (spDialog.mode === "CREATE") {
        const saved = unwrapActionResult(await createServicePriceAction(spForm));
        setPrices(prev => [saved, ...prev]);
        toast.success("Price added");
      } else if (spDialog.row) {
        const saved = unwrapActionResult(await updateServicePriceAction({ id: spDialog.row.id, data: spForm }));
        setPrices(prev => prev.map(p => p.id === saved.id ? saved : p));
        toast.success("Price updated");
      }
      spGuard.closeAfterSave();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); }
    finally { setSpSaving(false); }
  }

  async function doDeleteSp() {
    if (!spDeleteTarget) return;
    setSpDeleting(true);
    try {
      unwrapActionResult(await deleteServicePriceAction({ id: spDeleteTarget.id }));
      setPrices(prev => prev.filter(p => p.id !== spDeleteTarget.id));
      toast.success("Price removed");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not delete"); }
    finally { setSpDeleting(false); setSpDeleteTarget(null); }
  }

  const spCanSave = Boolean(spForm.name.trim() && spForm.category.trim() && spForm.unit.trim() && spForm.price !== "" && Number(spForm.price) >= 0);
  const spEditable = canManage;

  const spGuard = useUnsavedChangesGuard({
    open: spDialog.open,
    value: spForm,
    onOpenChange: (open) => setSpDialog(d => ({ ...d, open })),
    enabled: spEditable,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name or code…" className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)} />
        </div>
        <span className={cn("shrink-0 tabular-nums text-slate-400", UI_ENGINE_TYPE_META)}>{prices.length} prices</span>
        {canManage && (
          <Button onClick={() => { setSpForm(EMPTY_WORK_PRICE); spGuard.markPristine(EMPTY_WORK_PRICE); setSpDialog({ open: true, mode: "CREATE", row: null }); }}
            className={cn("bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]", UI_ENGINE_RADIUS_ACTION)}>
            <Plus className="size-4" /> Add Labour Price
          </Button>
        )}
      </div>

      <TableCard layout="auto">
        <TableCardHeader>
          <TableCardHead style={{ width: "36%" }}>Work name</TableCardHead>
          <TableCardHead style={{ width: "18%" }}>Category</TableCardHead>
          <TableCardHead style={{ width: "8%" }}>Unit</TableCardHead>
          <TableCardHead style={{ width: "18%" }}>Price</TableCardHead>
          <TableCardHead style={{ width: "14%" }}>Vendor</TableCardHead>
          {canManage && <TableCardHead style={{ width: "6%" }} />}
        </TableCardHeader>
        <TableCardBody>
          {visiblePrices.length === 0 ? (
            <TableCardRow><TableCardCell colSpan={canManage ? 6 : 5}>
              <EmptyState icon={Wrench} message="No labour prices yet. Use Add Labour Price to start." />
            </TableCardCell></TableCardRow>
          ) : visiblePrices.map(row => (
            <TableCardRow key={row.id} className="cursor-pointer hover:bg-slate-50"
              onClick={() => {
                const next = workPriceToForm(row);
                setSpForm(next);
                spGuard.markPristine(next);
                setSpDialog({ open: true, mode: "EDIT", row });
              }}>
              <TableCardCell className="font-medium">{row.name}</TableCardCell>
              <TableCardCell className="text-slate-500">{row.category}</TableCardCell>
              <TableCardCell className="text-slate-500">{row.unit}</TableCardCell>
              <TableCardCell className="tabular-nums font-semibold">{fmt(row.price)}</TableCardCell>
              <TableCardCell className="text-slate-500">{row.service_vendor?.name ?? "—"}</TableCardCell>
              {canManage && (
                <TableCardCell>
                  <Button variant="ghost" size="icon-sm" onClick={e => { e.stopPropagation(); setSpDeleteTarget(row); }} className="text-slate-400 hover:text-red-500">
                    <Trash2 className="size-4" />
                  </Button>
                </TableCardCell>
              )}
            </TableCardRow>
          ))}
        </TableCardBody>
      </TableCard>

      {/* ServicePrice Dialog */}
      <Dialog open={spDialog.open} onOpenChange={spGuard.handleOpenChange}>
        <DialogContent className={cn("max-h-[90vh] max-w-2xl overflow-y-auto border bg-white p-6", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
          <DialogHeader>
            <div className="flex items-center justify-between pr-12">
              <DialogTitle className={UI_ENGINE_TYPE_H3}>{spDialog.mode === "CREATE" ? "Add Labour Price" : "Labour Price"}</DialogTitle>
            </div>
          </DialogHeader>
          <WorkPriceFields
            form={spForm}
            setForm={setSpForm}
            editable={spEditable}
            vendors={vendors}
            unitOptions={unitOptions}
            priceLabel="Price (labour only)"
            priceHint="Labour without material, as Excel Table 4 has it."
            dimensionsNote="Record dimensions if relevant to this work (e.g. wall area, linear metre). Leave blank if not applicable."
          />

          {spEditable && (
            <DialogFooter>
              <Button onClick={() => void saveSp()} disabled={!spCanSave || spSaving}
                className={cn("bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]", UI_ENGINE_RADIUS_ACTION)}>
                {spSaving ? <Loader2 className="size-4 animate-spin" /> : null} Save
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!spDeleteTarget} onOpenChange={open => { if (!open) setSpDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete this labour price?</AlertDialogTitle>
            <AlertDialogDescription>{spDeleteTarget?.name} ({spDeleteTarget?.code}) will be deleted.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doDeleteSp()} disabled={spDeleting} className="bg-red-600 text-white hover:bg-red-700">
              {spDeleting ? <Loader2 className="mr-1 size-4 animate-spin" /> : null} Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesPrompt guard={spGuard} />
    </div>
  );
}

// ===========================================================================
// Main PricingClient
// ===========================================================================

export function PricingClient({
  materialPrices, materialPriceUnits, materialLaborPrices, servicePrices, serviceVendors,
  brands, skuOptions, suppliers, canManage, userName,
}: {
  materialPrices: MaterialPricePageData;
  materialPriceUnits: string[];
  materialLaborPrices: MaterialLaborPriceData[];
  servicePrices: ServicePriceData[];
  serviceVendors: ServiceVendorData[];
  brands: { id: string; brand_name: string }[];
  skuOptions: SkuOption[];
  suppliers: SupplierOption[];
  canManage: boolean;
  userName: string;
}) {
  const [tab, setTab] = React.useState<Tab>("material");

  /**
   * Live counts for the tab badges, mirrored from each tab's own row state
   * (2026-08-18, owner feedback item 4 — see `HargaMaterialTab`'s
   * `onCountChange` doc). Seeded from the page-load props so the first paint
   * is correct before any tab has mounted / reported back.
   */
  const [materialCount, setMaterialCount] = React.useState(materialPrices.allTotal);
  const [materialUpahCount, setMaterialUpahCount] = React.useState(materialLaborPrices.length);
  const [upahCount, setUpahCount] = React.useState(servicePrices.length);

  /**
   * Satu kolam saran satuan untuk ketiga tab. Sengaja tidak dipisah per tab:
   * "lembar" yang diketik di harga material adalah satuan yang sama ketika
   * dipakai di paket supply-and-install, dan memisahkannya hanya membuat orang
   * mengetik ulang kata yang sudah ada di sistem.
   */
  const unitOptions = React.useMemo(
    () => collectUnits(
      materialPriceUnits.map((unit) => ({ unit })),
      materialLaborPrices,
      servicePrices
    ),
    [materialPriceUnits, materialLaborPrices, servicePrices]
  );

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: "material", label: "Material Prices", count: materialCount },
    { key: "material-upah", label: "Material + Service", count: materialUpahCount },
    { key: "upah", label: "Work / Service", count: upahCount },
  ];

  return (
    <DashboardTemplate
      header={
        <PageHeader
          eyebrow="Master Data"
          title="Pricing"
          description="Three pricing schemes for BQ: material per supplier, supply-and-install packages, and labour-only rates. Manage trades and vendors on the Suppliers page."
        />
      }
      content={
        <>
          <div className="mb-6 flex gap-1 border-b border-[var(--ui-border-subtle)]">
            {TABS.map(({ key, label, count }) => (
              <button key={key} type="button" onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 font-sans text-sm font-medium transition-colors",
                  tab === key ? "border-b-2 border-slate-900 text-slate-900" : "text-slate-400 hover:text-slate-600"
                )}>
                {label}
                <span className={cn("tabular-nums text-xs", tab === key ? "text-slate-600" : "text-slate-300")}>
                  {count}
                </span>
              </button>
            ))}
          </div>

          <div className={tab === "material" ? undefined : "hidden"}>
            <HargaMaterialTab initialPage={materialPrices} brands={brands} skuOptions={skuOptions} suppliers={suppliers} unitOptions={unitOptions} canManage={canManage} userName={userName} onCountChange={setMaterialCount} />
          </div>
          <div className={tab === "material-upah" ? undefined : "hidden"}>
            <HargaMaterialUpahTab rows={materialLaborPrices} vendors={serviceVendors} unitOptions={unitOptions} canManage={canManage} userName={userName} onCountChange={setMaterialUpahCount} />
          </div>
          <div className={tab === "upah" ? undefined : "hidden"}>
            <HargaUpahTab prices={servicePrices} vendors={serviceVendors} unitOptions={unitOptions} canManage={canManage} onCountChange={setUpahCount} />
          </div>
        </>
      }
    />
  );
}
