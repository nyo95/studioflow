"use client";

import * as React from "react";
import { Loader2, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_BORDER_SUBTLE,
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_RADIUS_CARD,
  UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_H3,
  UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import {
  createProductAction,
  updateProductAction,
} from "@/subapps/master-data/actions/catalog-mutation-actions";
import type {
  BrandCategoryCoverage,
  LibraryAccess,
  LibraryVendor,
  ProductCatalogInput,
  ProductCatalogWithRelations,
} from "@/subapps/master-data/contracts/catalog";
import { ProductType } from "@/generated/prisma";
import { LibraryItemStatus } from "@/subapps/master-data/contracts/catalog";
import { unwrapActionResult } from "@/lib/result";
import { deleteSkuAction } from "@/subapps/master-data/actions/masterdata-actions";
import { normalizeSearchText } from "@/core/utilities/normalize";
import {
  UnsavedChangesPrompt,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { cn } from "@/lib/utils";
import { PRODUCT_LEVEL1 } from "@/subapps/master-data/services/category-tree-rules";
import { MasterDataBrandDialog } from "./MasterDataBrandDialog";
import { MasterDataBrandPicker } from "./MasterDataBrandPicker";

type ProductDialogMode = "CREATE" | "EDIT";

// Dimension unit options — Select dropdown (replaces free-text input)
const DIMENSION_UNITS = ["cm", "mm", "m", "inch", "feet"] as const;

type MaterialForm = {
  brand_id: string;
  catalog_brand: string;
  catalog_type: ProductType;
  catalog_status: LibraryItemStatus;
  catalog_tags: string[];
  catalog_sku: string;
  catalog_product_name: string;
  catalog_color: string;
  catalog_motif: string;
  catalog_finishing: string;
  catalog_dimension_p: string;
  catalog_dimension_l: string;
  catalog_dimension_t: string;
  catalog_dimension_unit: string;
  catalog_reference_url: string;
  catalog_folder_url: string;
  // NOTE: catalog_image_url intentionally removed — per MASTERDATA_UIUX_REVISION.md
  // Visual references live in Google Drive URL at the Brand level.
  /** Satu harga yang berlaku. Pasangan list/net dihapus 2026-08-14. */
  price: string;
  price_unit: string;
  supplier_party_id: string;
  // BQ costing fields
  usage_unit: string;
  purchase_unit: string;
  conversion: string;
  default_waste_pct: string;
  minimum_order: string;
  rounding_increment: string;
};

const EMPTY_MATERIAL: MaterialForm = {
  brand_id: "",
  catalog_brand: "",
  catalog_type: ProductType.material,
  catalog_status: LibraryItemStatus.PENDING,
  catalog_tags: [],
  catalog_sku: "",
  catalog_product_name: "",
  catalog_color: "",
  catalog_motif: "",
  catalog_finishing: "",
  catalog_dimension_p: "",
  catalog_dimension_l: "",
  catalog_dimension_t: "",
  catalog_dimension_unit: "cm",
  catalog_reference_url: "",
  catalog_folder_url: "",
  price: "",
  price_unit: "",
  supplier_party_id: "",
  usage_unit: "",
  purchase_unit: "",
  conversion: "",
  default_waste_pct: "",
  minimum_order: "",
  rounding_increment: "",
};

function numberInput(value: number | null) {
  return value === null ? "" : String(value);
}

type InitialPrice = {
  price: number | null;
  unit: string | null;
  supplierId?: string | null;
};

function toMaterialForm(
  product?: ProductCatalogWithRelations | null,
  initialPrice?: InitialPrice
): MaterialForm {
  if (!product) return { ...EMPTY_MATERIAL, catalog_tags: [] };
  const priceFrom = initialPrice ?? {
    price: product.catalog_price ?? null,
    unit: product.catalog_price_unit ?? null,
    supplierId: product.catalog_price_supplier_id ?? null,
  };
  return {
    brand_id: product.brand_id ?? "",
    catalog_brand: product.catalog_brand,
    catalog_type: product.catalog_type,
    catalog_status: product.catalog_status,
    catalog_tags: product.catalog_tags,
    catalog_sku: product.catalog_sku,
    catalog_product_name: product.catalog_product_name,
    catalog_color: product.catalog_color ?? "",
    catalog_motif: product.catalog_motif ?? "",
    catalog_finishing: product.catalog_finishing ?? "",
    catalog_dimension_p: product.catalog_dimension_p ?? "",
    catalog_dimension_l: product.catalog_dimension_l ?? "",
    catalog_dimension_t: product.catalog_dimension_t ?? "",
    catalog_dimension_unit: product.catalog_dimension_unit ?? "cm",
    catalog_reference_url: product.catalog_reference_url ?? "",
    catalog_folder_url: product.catalog_folder_url ?? "",
    price: numberInput(priceFrom.price),
    price_unit: priceFrom.unit ?? "",
    supplier_party_id: priceFrom.supplierId ?? "",
    usage_unit: product.usage_unit ?? "",
    purchase_unit: product.purchase_unit ?? "",
    conversion: numberInput(product.conversion != null ? Number(product.conversion) : null),
    default_waste_pct: numberInput(product.default_waste_pct != null ? Number(product.default_waste_pct) : null),
    minimum_order: numberInput(product.minimum_order != null ? Number(product.minimum_order) : null),
    rounding_increment: numberInput(product.rounding_increment != null ? Number(product.rounding_increment) : null),
  };
}

function ReadValue({ children }: { children?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "whitespace-pre-wrap px-[calc(var(--ui-section-px)/2)] py-[calc(var(--ui-section-py)/2)] text-slate-950",
        UI_ENGINE_BG_SUBTLE,
        UI_ENGINE_RADIUS_CONTROL,
        UI_ENGINE_TYPE_BODY
      )}
    >
      {children || "—"}
    </div>
  );
}

function Field({
  id,
  label,
  value,
  editable,
  list,
  type = "text",
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  editable: boolean;
  list?: string;
  type?: React.HTMLInputTypeAttribute;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
      <Label htmlFor={id} className={UI_ENGINE_TYPE_META}>
        {label}
      </Label>
      {editable ? (
        <Input
          id={id}
          list={list}
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={UI_ENGINE_RADIUS_CONTROL}
        />
      ) : (
        <ReadValue>{value}</ReadValue>
      )}
    </div>
  );
}

/** P × L × T inline group with unit Select dropdown */
function DimensionGroup({
  p, l, t, unit,
  editable,
  onP, onL, onT, onUnit,
}: {
  p: string; l: string; t: string; unit: string;
  editable: boolean;
  onP: (v: string) => void;
  onL: (v: string) => void;
  onT: (v: string) => void;
  onUnit: (v: string) => void;
}) {
  if (!editable) {
    const display = [p, l, t].filter(Boolean).join(" × ");
    return (
      <ReadValue>
        {display ? `${display} ${unit}` : undefined}
      </ReadValue>
    );
  }
  return (
    <div className="flex items-center gap-[calc(var(--ui-section-gap)/3)]">
      <Input
        aria-label="Panjang"
        value={p}
        onChange={(e) => onP(e.target.value)}
        placeholder="P"
        type="text"
        className={cn(UI_ENGINE_RADIUS_CONTROL, "flex-1 min-w-0 text-center")}
      />
      <span className={cn("shrink-0 select-none", UI_ENGINE_TYPE_META)}>×</span>
      <Input
        aria-label="Lebar"
        value={l}
        onChange={(e) => onL(e.target.value)}
        placeholder="L"
        type="text"
        className={cn(UI_ENGINE_RADIUS_CONTROL, "flex-1 min-w-0 text-center")}
      />
      <span className={cn("shrink-0 select-none", UI_ENGINE_TYPE_META)}>×</span>
      <Input
        aria-label="Tinggi"
        value={t}
        onChange={(e) => onT(e.target.value)}
        placeholder="T"
        type="text"
        className={cn(UI_ENGINE_RADIUS_CONTROL, "flex-1 min-w-0 text-center")}
      />
      <Select value={unit || "cm"} onValueChange={onUnit}>
        <SelectTrigger className={cn(UI_ENGINE_RADIUS_CONTROL, "w-20 shrink-0")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DIMENSION_UNITS.map((u) => (
            <SelectItem key={u} value={u}>{u}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function nullableNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function MasterDataProductDialog({
  open,
  mode,
  product,
  detailLoading = false,
  initialPrice,
  access,
  vendors,
  suppliers = [],
  categories,
  finishings,
  tags,
  onOpenChange,
}: {
  open: boolean;
  mode: ProductDialogMode;
  product?: ProductCatalogWithRelations | null;
  /**
   * True while the caller is fetching `product` by id.
   * Opens before data arrives to avoid the blank-then-repopulate flicker.
   */
  detailLoading?: boolean;
  /** Current price for this SKU, read from `SkuPrice` via material-view-service. */
  initialPrice?: InitialPrice;
  access: LibraryAccess;
  vendors: LibraryVendor[];
  /**
   * Parties carrying the SUPPLIER role. Defaults to empty so callers that
   * haven't been updated still render — the picker then only offers
   * "manufacturer list price", the pre-existing behaviour.
   */
  suppliers?: { id: string; name: string }[];
  categories: string[];
  materialsCategories?: string[];
  fixturesCategories?: string[];
  subCategories?: string[];
  finishings: string[];
  tags: string[];
  brandCoverage?: BrandCategoryCoverage;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState<MaterialForm>(EMPTY_MATERIAL);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showDelete, setShowDelete] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [createdVendors, setCreatedVendors] = React.useState<LibraryVendor[]>([]);
  const [vendorDialog, setVendorDialog] = React.useState({
    open: false,
    initialName: "",
  });

  /**
   * Bisa disunting = punya izin. Gatekeeper "Modify" dihapus 2026-08-14 atas
   * permintaan owner: *"saat diklik lgsg aja ada inline edit"*. Berkas inilah
   * satu-satunya di Master Data yang tombolnya benar-benar tampil — di dialog
   * Brand dan Party ia sudah lama jadi kode mati.
   *
   * Penggantinya bukan "tidak ada pengaman", melainkan `useUnsavedChangesGuard`
   * di bawah: bertanya di pintu keluar, dan hanya kepada orang yang benar-benar
   * mengubah sesuatu.
   */
  const editable = mode === "CREATE" ? access.canCreate : access.canEdit;

  // Scalar decomposition prevents object-identity thrash in the effect deps
  const priceInitial = initialPrice?.price ?? null;
  const priceUnitInitial = initialPrice?.unit ?? null;

  /**
   * Raw text for the category tags field — keeps commas visible while typing.
   * Parsed to string[] only at the point of use/save.
   */
  const [categoryText, setCategoryText] = React.useState("");

  const parsedTags = React.useMemo(
    () =>
      categoryText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [categoryText]
  );

  /**
   * `categoryText` ikut dinilai bersama `form` karena ia adalah field form yang
   * kebetulan disimpan di state terpisah (teks mentah dipertahankan supaya koma
   * tetap terlihat sambil mengetik). Menilai `form` saja akan membuat perubahan
   * pada kategori luput dari pengaman — persis satu-satunya field yang paling
   * sering disunting sendirian.
   */
  const guardValue = React.useMemo(
    () => ({ form, categoryText }),
    [form, categoryText]
  );
  const guard = useUnsavedChangesGuard({
    open,
    value: guardValue,
    onOpenChange,
    enabled: editable && !detailLoading,
  });

  React.useEffect(() => {
    if (!open) return;
    const nextForm = toMaterialForm(product, { price: priceInitial, unit: priceUnitInitial });
    const nextTags = (product?.catalog_tags ?? []).join(", ");
    setForm(nextForm);
    setCategoryText(nextTags);
    setShowDelete(false);
    setCreatedVendors([]);
    setVendorDialog({ open: false, initialName: "" });
    /**
     * Baseline dipasang ulang SETIAP kali efek ini jalan, bukan hanya saat
     * dialog dibuka. Berkas inilah alasan `markPristine` harus eksplisit:
     * `product` datang belakangan (dialog terbuka lebih dulu, `getSkuDetail`
     * menyusul), jadi form terisi dua kali. Baseline yang dipotret sekali di
     * awal akan merekam form KOSONG, dan setiap SKU yang sekadar dilihat lalu
     * ditutup akan dituduh punya perubahan.
     */
    guard.markPristine({ form: nextForm, categoryText: nextTags });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, open, product, priceInitial, priceUnitInitial]);

  /**
   * Bisa disunting = punya izin. Gatekeeper "Modify" dihapus 2026-08-14 atas
   * permintaan owner: *"saat diklik lgsg aja ada inline edit"*. Berkas inilah
   * satu-satunya di Master Data yang tombolnya benar-benar tampil — di dialog
   * Brand dan Party ia sudah lama jadi kode mati.
   *
   * Penggantinya bukan "tidak ada pengaman", melainkan `useUnsavedChangesGuard`
   * di bawah: bertanya di pintu keluar, dan hanya kepada orang yang benar-benar
   * mengubah sesuatu.
   */



  const availableVendors = React.useMemo(() => {
    const byId = new Map(vendors.map((vendor) => [vendor.id, vendor]));
    createdVendors.forEach((vendor) => byId.set(vendor.id, vendor));
    return Array.from(byId.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "id-ID")
    );
  }, [createdVendors, vendors]);

  const selectedVendor = availableVendors.find(
    (vendor) => vendor.id === form.brand_id
  );

  const categorySuggestions = Array.from(
    new Set([...PRODUCT_LEVEL1, ...categories, ...tags])
  ).sort((a, b) => a.localeCompare(b, "id-ID"));

  const setField = <K extends keyof MaterialForm>(
    field: K,
    value: MaterialForm[K]
  ) => setForm((current) => ({ ...current, [field]: value }));

  /** `catalog_brand` is a denormalised copy derived from the selected Brand. */
  const resolvedBrandName =
    selectedVendor?.name.trim() || form.catalog_brand.trim();

  const identityValid = Boolean(
    parsedTags.length > 0 &&
      form.catalog_sku.trim() &&
      form.catalog_product_name.trim()
  );
  const netPrice = nullableNumber(form.price);
  const pricesValid = netPrice === null || netPrice >= 0;
  const bqReady =
    netPrice !== null && Boolean(form.price_unit.trim());
  const canSave = identityValid && pricesValid;

  const save = async () => {
    if (!canSave) return;
    setIsSaving(true);
    const payload: ProductCatalogInput = {
      brand_id: form.brand_id,
      catalog_brand: resolvedBrandName,
      catalog_category: parsedTags[0],
      catalog_tags: parsedTags,
      catalog_sku: form.catalog_sku.trim(),
      catalog_product_name: form.catalog_product_name.trim(),
      catalog_color: form.catalog_color.trim(),
      catalog_motif: form.catalog_motif.trim(),
      catalog_finishing: form.catalog_finishing.trim(),
      catalog_dimension_p: form.catalog_dimension_p.trim(),
      catalog_dimension_l: form.catalog_dimension_l.trim(),
      catalog_dimension_t: form.catalog_dimension_t.trim(),
      catalog_dimension_unit: form.catalog_dimension_unit.trim(),
      catalog_reference_url: form.catalog_reference_url.trim(),
      catalog_folder_url: form.catalog_folder_url.trim(),
      // catalog_image_url removed — visual references live in Brand's Drive URL
      catalog_price: netPrice,
      catalog_price_unit: form.price_unit.trim() || null,
      supplier_party_id: form.supplier_party_id || null,
      // BQ costing fields
      usage_unit: form.usage_unit.trim() || null,
      purchase_unit: form.purchase_unit.trim() || null,
      conversion: nullableNumber(form.conversion),
      default_waste_pct: nullableNumber(form.default_waste_pct),
      minimum_order: nullableNumber(form.minimum_order),
      rounding_increment: nullableNumber(form.rounding_increment),
      catalog_status:
        mode === "CREATE" ? LibraryItemStatus.PENDING : form.catalog_status,
      ...(mode === "CREATE" ? { catalog_type: form.catalog_type } : {}),
    };

    try {
      if (mode === "CREATE") {
        unwrapActionResult(await createProductAction(payload));
        toast.success("Material added");
      } else {
        if (!product?.id) throw new Error("Material not found");
        unwrapActionResult(
          await updateProductAction({ id: product.id, data: payload })
        );
        toast.success("Material updated");
      }
      guard.closeAfterSave();
      router.refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Material could not be saved"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    if (!product?.id) return;
    setIsDeleting(true);
    try {
      unwrapActionResult(await deleteSkuAction({ id: product.id }));
      toast.success("Material deleted");
      setShowDelete(false);
      guard.closeAfterSave();
      router.refresh();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Material could not be deleted"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          // Dialog Brand yang dibuka DARI dalam dialog ini menutup dirinya
          // sendiri; tanpa penjaga ini, penutupan itu ikut menutup induknya.
          if (!nextOpen && vendorDialog.open) return;
          guard.handleOpenChange(nextOpen);
        }}
      >
        <DialogContent
          className={cn(
            "max-h-[90vh] max-w-[var(--ui-dialog-width-xl)] overflow-y-auto border bg-[var(--ui-surface-bg)] p-[var(--ui-section-py)]",
            UI_ENGINE_BORDER_SUBTLE,
            UI_ENGINE_RADIUS_CARD
          )}
        >
          <DialogHeader>
            <div className="flex items-center justify-between gap-[var(--ui-section-gap)]">
              <DialogTitle className={UI_ENGINE_TYPE_H3}>
                {mode === "CREATE"
                  ? "Add SKU / Material"
                  : form.catalog_product_name || form.catalog_sku}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-[var(--ui-section-gap)]">

            {/* ── Section 1: Spesifikasi Visual ─────────────────────── */}
            <section
              className={cn(
                "grid gap-[calc(var(--ui-section-gap)/2)] rounded-[var(--ui-radius-card)] border p-[calc(var(--ui-section-px)/1.5)]",
                UI_ENGINE_BORDER_SUBTLE
              )}
            >
              <h3 className={cn(UI_ENGINE_TYPE_H3, "text-slate-500 text-sm")}>
                Visual Specifications
              </h3>

              {/* Brand — full width */}
              <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
                <Label className={UI_ENGINE_TYPE_META}>Brand</Label>
                {editable ? (
                  <MasterDataBrandPicker
                    vendors={availableVendors}
                    value={form.brand_id}
                    canCreateVendor={access.canManageVendors}
                    allowClear
                    clearLabel="— No brand (generic stock) —"
                    onSelect={(vendorId) => {
                      setForm((current) => ({
                        ...current,
                        brand_id: vendorId,
                        catalog_brand:
                          availableVendors.find((v) => v.id === vendorId)
                            ?.name ?? current.catalog_brand,
                      }));
                    }}
                    onCreateVendor={(initialName) =>
                      setVendorDialog({ open: true, initialName })
                    }
                  />
                ) : (
                  <ReadValue>
                    {selectedVendor?.name || form.catalog_brand}
                  </ReadValue>
                )}
                {selectedVendor &&
                  form.catalog_brand.trim() &&
                  normalizeSearchText(form.catalog_brand) !==
                    normalizeSearchText(selectedVendor.name) ? (
                  <p className="text-xs text-amber-700">
                    Previously stored brand: &ldquo;{form.catalog_brand}&rdquo;.
                    Saving will align it with &ldquo;{selectedVendor.name}&rdquo;.
                  </p>
                ) : null}
              </div>

              {/* Row: Category | SKU | Produk */}
              <div className="grid gap-[calc(var(--ui-section-gap)/2)] sm:grid-cols-3">
                <Field
                  id="material-categories"
                  label="Category tags * (comma separated)"
                  value={categoryText}
                  editable={editable}
                  list="masterdata-category-options"
                  onChange={setCategoryText}
                />
                <Field
                  id="material-sku"
                  label="SKU *"
                  value={form.catalog_sku}
                  editable={editable}
                  onChange={(value) => setField("catalog_sku", value)}
                />
                <Field
                  id="material-product"
                  label="Product Name *"
                  value={form.catalog_product_name}
                  editable={editable}
                  onChange={(value) => setField("catalog_product_name", value)}
                />
              </div>

              {/* Row: Warna | Motif | Finishing */}
              <div className="grid gap-[calc(var(--ui-section-gap)/2)] sm:grid-cols-3">
                <Field
                  id="material-color"
                  label="Color"
                  value={form.catalog_color}
                  editable={editable}
                  onChange={(value) => setField("catalog_color", value)}
                />
                <Field
                  id="material-motif"
                  label="Motif"
                  value={form.catalog_motif}
                  editable={editable}
                  onChange={(value) => setField("catalog_motif", value)}
                />
                <Field
                  id="material-finishing"
                  label="Finishing"
                  value={form.catalog_finishing}
                  editable={editable}
                  list="masterdata-finishing-options"
                  onChange={(value) => setField("catalog_finishing", value)}
                />
              </div>
            </section>

            {/* ── Section 2: Dimensi Fisik ───────────────────────────── */}
            <section
              className={cn(
                "grid gap-[calc(var(--ui-section-gap)/2)] rounded-[var(--ui-radius-card)] border p-[calc(var(--ui-section-px)/1.5)]",
                UI_ENGINE_BORDER_SUBTLE
              )}
            >
              <h3 className={cn(UI_ENGINE_TYPE_H3, "text-slate-500 text-sm")}>
                Physical Dimensions
              </h3>
              <div className="flex flex-col gap-[calc(var(--ui-section-gap)/4)]">
                <Label className={UI_ENGINE_TYPE_META}>
                  P × L × T
                  <span className={cn("ml-1 font-normal", UI_ENGINE_TYPE_META)}>(optional)</span>
                </Label>
                <DimensionGroup
                  p={form.catalog_dimension_p}
                  l={form.catalog_dimension_l}
                  t={form.catalog_dimension_t}
                  unit={form.catalog_dimension_unit}
                  editable={editable}
                  onP={(v) => setField("catalog_dimension_p", v)}
                  onL={(v) => setField("catalog_dimension_l", v)}
                  onT={(v) => setField("catalog_dimension_t", v)}
                  onUnit={(v) => setField("catalog_dimension_unit", v)}
                />
              </div>

              {/* Reference & Drive links */}
              <div className="grid gap-[calc(var(--ui-section-gap)/2)] sm:grid-cols-2">
                <Field
                  id="material-link"
                  label="Product link"
                  value={form.catalog_reference_url}
                  editable={editable}
                  placeholder="https://…"
                  onChange={(value) => setField("catalog_reference_url", value)}
                />
                <Field
                  id="material-folder"
                  label="Drive folder"
                  value={form.catalog_folder_url}
                  editable={editable}
                  placeholder="https://drive.google.com/…"
                  onChange={(value) => setField("catalog_folder_url", value)}
                />
              </div>
            </section>

            {/* ── Section 3: Initial Sourcing (opsional) ────────────── */}
            <section
              className={cn(
                "grid gap-[calc(var(--ui-section-gap)/2)] rounded-[var(--ui-radius-card)] border p-[calc(var(--ui-section-px)/1.5)]",
                UI_ENGINE_BORDER_SUBTLE
              )}
            >
              <div>
                <h3 className={cn(UI_ENGINE_TYPE_H3, "text-slate-500 text-sm")}>
                  Initial Sourcing
                  <span className={cn("ml-2 font-normal", UI_ENGINE_TYPE_META)}>
                    (optional — full pricing is managed on the Pricing page)
                  </span>
                </h3>
              </div>

              <div className="grid gap-[calc(var(--ui-section-gap)/2)] sm:grid-cols-3">
                {/* Supplier */}
                <div className="flex flex-col gap-[calc(var(--ui-section-gap)/4)]">
                  <Label htmlFor="material-price-supplier" className={UI_ENGINE_TYPE_META}>
                    Supplier
                  </Label>
                  {editable ? (
                    <select
                      id="material-price-supplier"
                      value={form.supplier_party_id}
                      onChange={(event) => setField("supplier_party_id", event.target.value)}
                      className={cn(
                        "border bg-[var(--ui-canvas-bg)] px-3 py-2 outline-none focus:border-[var(--ui-border-focus)]",
                        UI_ENGINE_BORDER_SUBTLE,
                        UI_ENGINE_RADIUS_CONTROL,
                        UI_ENGINE_TYPE_BODY
                      )}
                    >
                      <option value="">— Manufacturer list price —</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <ReadValue>
                      {suppliers.find((s) => s.id === form.supplier_party_id)?.name ??
                        "Manufacturer list price"}
                    </ReadValue>
                  )}
                </div>

                {/* Net Price */}
                <Field
                  id="material-price"
                  label="Price"
                  value={form.price}
                  editable={editable}
                  type="number"
                  placeholder="0"
                  onChange={(value) => setField("price", value)}
                />

                {/* Price Unit */}
                <Field
                  id="material-price-unit"
                  label="Price Unit"
                  value={form.price_unit}
                  editable={editable}
                  placeholder="e.g. m², pcs, sheet"
                  onChange={(value) => setField("price_unit", value)}
                />
              </div>

              {!pricesValid ? (
                <p className={cn("text-[var(--ui-change-before)]", UI_ENGINE_TYPE_BODY)}>
                  Price cannot be negative.
                </p>
              ) : bqReady ? (
                <p className={cn("text-[var(--ui-change-after)]", UI_ENGINE_TYPE_BODY)}>
                  BQ: price is ready to use.
                </p>
              ) : (
                <p className={cn("text-amber-700", UI_ENGINE_TYPE_BODY)}>
                  BQ: incomplete—enter a price and unit, or leave both blank and add
                  them later on the Pricing page.
                </p>
              )}
            </section>

            {/* ── Section 4: BQ Costing (opsional) ─────────────────── */}
            <section
              className={cn(
                "grid gap-[calc(var(--ui-section-gap)/2)] rounded-[var(--ui-radius-card)] border p-[calc(var(--ui-section-px)/1.5)]",
                UI_ENGINE_BORDER_SUBTLE
              )}
            >
              <div>
                <h3 className={cn(UI_ENGINE_TYPE_H3, "text-slate-500 text-sm")}>
                  BQ Costing
                  <span className={cn("ml-2 font-normal", UI_ENGINE_TYPE_META)}>
                    (optional — used by BQ estimation)
                  </span>
                </h3>
              </div>

              <div className="grid gap-[calc(var(--ui-section-gap)/2)] sm:grid-cols-3">
                <Field
                  id="usage-unit"
                  label="Usage unit"
                  value={form.usage_unit}
                  editable={editable}
                  placeholder="e.g. m², pcs"
                  onChange={(value) => setField("usage_unit", value)}
                />
                <Field
                  id="purchase-unit"
                  label="Purchase unit"
                  value={form.purchase_unit}
                  editable={editable}
                  placeholder="e.g. sheet, box"
                  onChange={(value) => setField("purchase_unit", value)}
                />
                <Field
                  id="conversion"
                  label="Conversion (purchase → usage)"
                  value={form.conversion}
                  editable={editable}
                  type="number"
                  placeholder="e.g. 2.88"
                  onChange={(value) => setField("conversion", value)}
                />
              </div>

              <div className="grid gap-[calc(var(--ui-section-gap)/2)] sm:grid-cols-3">
                <Field
                  id="default-waste-pct"
                  label="Default waste %"
                  value={form.default_waste_pct}
                  editable={editable}
                  type="number"
                  placeholder="e.g. 10"
                  onChange={(value) => setField("default_waste_pct", value)}
                />
                <Field
                  id="minimum-order"
                  label="Minimum order"
                  value={form.minimum_order}
                  editable={editable}
                  type="number"
                  placeholder="e.g. 5"
                  onChange={(value) => setField("minimum_order", value)}
                />
                <Field
                  id="rounding-increment"
                  label="Rounding increment"
                  value={form.rounding_increment}
                  editable={editable}
                  type="number"
                  placeholder="e.g. 1"
                  onChange={(value) => setField("rounding_increment", value)}
                />
              </div>

            </section>

            {/* ── Curation status ───────────────────────────────────── */}
            <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
              <Label className={UI_ENGINE_TYPE_META}>Curation status</Label>
              {mode === "EDIT" && editable && access.canApproveMaterial ? (
                <Select
                  value={form.catalog_status}
                  onValueChange={(value) =>
                    setField("catalog_status", value as LibraryItemStatus)
                  }
                >
                  <SelectTrigger className={UI_ENGINE_RADIUS_CONTROL}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={LibraryItemStatus.PENDING}>Pending</SelectItem>
                    <SelectItem value={LibraryItemStatus.APPROVED}>Approved</SelectItem>
                    <SelectItem value={LibraryItemStatus.REJECTED}>Rejected</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <ReadValue>
                  {mode === "CREATE" ? "Pending" : form.catalog_status}
                </ReadValue>
              )}
              <p className={cn("text-slate-500", UI_ENGINE_TYPE_BODY)}>
                {mode === "CREATE"
                  ? "Pending—still available in the Library and Project Schedule."
                  : form.catalog_status === LibraryItemStatus.REJECTED
                    ? "Rejected—not available for new work."
                    : `${form.catalog_status}—still available in the Library and Project Schedule.`}
              </p>
            </div>

          </div>

          <datalist id="masterdata-category-options">
            {categorySuggestions.map((category) => (
              <option key={category} value={category} />
            ))}
          </datalist>
          <datalist id="masterdata-finishing-options">
            {finishings.map((finishing) => (
              <option key={finishing} value={finishing} />
            ))}
          </datalist>

          <DialogFooter className="flex justify-between gap-[var(--ui-section-gap)] sm:justify-between">
            {mode === "EDIT" && access.canDelete ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowDelete(true)}
                className={cn("text-[var(--ui-change-before)]", UI_ENGINE_RADIUS_ACTION)}
              >
                <Trash2 className="size-[var(--ui-icon-size-sm)]" />
                Delete
              </Button>
            ) : (
              <span />
            )}
            {editable ? (
              <Button
                type="button"
                disabled={!canSave || isSaving}
                onClick={() => void save()}
                className={cn(
                  "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                  UI_ENGINE_RADIUS_ACTION
                )}
              >
                {isSaving ? (
                  <Loader2 className="size-[var(--ui-icon-size-sm)] animate-spin" />
                ) : (
                  <Save className="size-[var(--ui-icon-size-sm)]" />
                )}
                Save
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent className={cn(UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this material?</AlertDialogTitle>
            <AlertDialogDescription>
              The material is soft-deleted and stops appearing in the active list.
              Existing project snapshots remain unchanged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
              className="bg-[var(--ui-change-before)] text-white"
            >
              {isDeleting ? "Menghapus…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MasterDataBrandDialog
        open={vendorDialog.open}
        mode="CREATE"
        initialName={vendorDialog.initialName}
        canManage={access.canManageVendors}
        onOpenChange={(vendorOpen) =>
          setVendorDialog((current) => ({ ...current, open: vendorOpen }))
        }
        onSaved={(vendor) => {
          setCreatedVendors((current) => [
            ...current.filter((candidate) => candidate.id !== vendor.id),
            vendor,
          ]);
          setForm((current) => ({
            ...current,
            brand_id: vendor.id,
            catalog_brand: vendor.name,
          }));
          router.refresh();
        }}
      />

      <UnsavedChangesPrompt guard={guard} />
    </>
  );
}
