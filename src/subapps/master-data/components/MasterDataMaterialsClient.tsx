"use client";

import * as React from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink, Eye, Loader2, MoreHorizontal, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { deleteVendorAction, getSkuDetailAction, updateVendorAction } from "@/extensions/library/actions/library-actions";
import {
  getBrandDetailAction,
  type BrandDetail,
} from "@/subapps/master-data/actions/masterdata-actions";
import { isBrandComplete, isBrandLandingView } from "@/subapps/master-data/lib/brand-view-rules";
import { unwrapActionResult } from "@/lib/result";
import type { BrandLinkInput, ProductCatalogWithRelations } from "@/extensions/library/types";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Button, DashboardTemplate, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, PageHeader, TableCard, TableCardBody, TableCardCell, TableCardHead, TableCardHeader, TableCardRow, UI_ENGINE_RADIUS_ACTION, UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_META } from "@/ui_engine";
import type {
  BrandCategoryCoverage,
  LibraryAccess,
  LibraryVendor,
} from "@/extensions/library/types";
import { cn } from "@/lib/utils";
import type {
  BrandRow,
  MaterialRow,
  MaterialViewResult,
} from "@/subapps/master-data/services/material-view-service";
import { MasterDataProductDialog } from "./MasterDataProductDialog";
import { MasterDataBrandDialog } from "./MasterDataBrandDialog";
import {
  BrandDetailContent,
  type BrandDetailTab,
} from "./BrandDetailClient";
import type { PartyData } from "../types/party";
import {
  UnsavedChangesPrompt,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import {
  BrandLinksEditor,
  BrandLinksReadView,
} from "@/components/shared/brand-links-editor";

type BrandLinksDraft = {
  brandId: string;
  brandName: string;
  links: BrandLinkInput[];
};

const EMPTY_BRAND_LINKS_DRAFT: BrandLinksDraft = {
  brandId: "",
  brandName: "",
  links: [],
};

function externalHref(value: string) {
  return /^https?:\/\//i.test(value)
    ? value
    : `https://${value.replace(/^@/, "")}`;
}

function LinkCell({ value, label }: { value: string | null; label: string }) {
  if (!value) return null;
  return (
    <a
      href={externalHref(value)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={value}
      onClick={(event) => event.stopPropagation()}
      className="inline-flex text-slate-500 hover:text-slate-950"
    >
      <ExternalLink className="size-[var(--ui-icon-size-sm)]" />
    </a>
  );
}


function money(value: number) {
  return value.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

/**
 * Penanda asal harga.
 *
 * Harga material bisa masuk lewat dua pintu yang masih sama-sama aktif: tabel
 * `MaterialPrice` (tab Material Prices) dan kolom inline `Sku.catalog_price*`
 * (dialog Material). Tanpa penanda ini staff tidak punya cara tahu baris mana
 * yang masih memakai jalur legacy dan perlu dipindahkan.
 *
 * Sumber MaterialPrice per-SKU adalah kondisi normal, jadi tidak diberi badge —
 * hanya yang menyimpang yang ditandai, supaya tabel tidak penuh label.
 */
// Master Data v2 collapsed pricing into one source (SkuPrice), so there is no
// longer a "legacy vs normal" distinction to badge. Kept as a no-op so call
// sites don't need to change.
function PriceSourceBadge(_props: { source: MaterialRow["priceSource"] }) {
  void _props;
  return null;
}

/**
 * Single-line label for the merged SKU/Produk column.
 *   1. Both present and genuinely different -> "SKU Produk" (space-joined,
 *      one line).
 *   2. Only one meaningfully present (the other missing, or identical to the
 *      first once trimmed/case-folded) -> that one value alone.
 * Case-insensitive compare so "Cronos Grey" vs "cronos grey" still counts as
 * the same value and collapses to one line instead of two.
 */
function skuProductLabel(sku: string, productName: string) {
  const skuTrimmed = sku.trim();
  const nameTrimmed = productName.trim();
  if (skuTrimmed && nameTrimmed) {
    return skuTrimmed.toLocaleLowerCase("id-ID") ===
      nameTrimmed.toLocaleLowerCase("id-ID")
      ? skuTrimmed
      : `${skuTrimmed} ${nameTrimmed}`;
  }
  return skuTrimmed || nameTrimmed || "—";
}

function compactBrandValues(values: string[], emptyLabel: string) {
  if (values.length === 0) return emptyLabel;
  if (values.length === 1) return values[0];
  const remaining = values.length - 1;
  return `${values[0]} and ${remaining} ${remaining === 1 ? "other" : "others"}`;
}

export function MasterDataMaterialsClient({
  rows,
  totals,
  total,
  page,
  pageSize,
  categories,
  vendors,
  suppliers = [],
  access,
  materialsCategories,
  fixturesCategories,
  brandCategoryOptions,
  finishings,
  tags,
  brandCoverage,
  canSeePrices,
  companies = [],
  brandRows,
  brandTotals,
  brandTotal,
  initialFilters,
}: {
  rows: MaterialRow[];
  totals: MaterialViewResult["totals"];
  /** Rows matching the current filters. `rows.length` is just this page of them. */
  total: number;
  page: number;
  pageSize: number;
  categories: string[];
  vendors: LibraryVendor[];
  /** Parties carrying the SUPPLIER role, for the price section's picker. */
  suppliers?: { id: string; name: string }[];
  access: LibraryAccess;
  materialsCategories: string[];
  fixturesCategories: string[];
  /** Defaults plus categories already attached to a Brand. Kept out of SKU suggestions. */
  brandCategoryOptions: string[];
  finishings: string[];
  tags: string[];
  brandCoverage: BrandCategoryCoverage;
  canSeePrices: boolean;
  /** Brand-grain rows for the landing table (Phase 2.1). */
  /** Parties available in the Company picker of the Brand dialog. */
  companies?: PartyData[];
  brandRows: BrandRow[];
  /** Whole-catalogue brand counts (unfiltered). */
  brandTotals: { all: number; complete: number; incomplete: number };
  /** Total brands matching current filters. */
  brandTotal: number;
  initialFilters: {
    search: string;
    vendorId: string;
    category: string;
    price: string;
    sort: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = React.useState(initialFilters.search);
  const [visibleBrandRows, setVisibleBrandRows] = React.useState(brandRows);
  const [visibleVendors, setVisibleVendors] = React.useState(vendors);
  const [brandLinksOpen, setBrandLinksOpen] = React.useState(false);
  const [brandLinksDraft, setBrandLinksDraft] = React.useState<BrandLinksDraft | null>(null);
  const [brandLinksSaving, setBrandLinksSaving] = React.useState(false);

  React.useEffect(() => setVisibleBrandRows(brandRows), [brandRows]);
  React.useEffect(() => setVisibleVendors(vendors), [vendors]);
  const brandLinksById = React.useMemo(
    () => new Map(visibleVendors.map((vendor) => [vendor.id, vendor.links ?? []])),
    [visibleVendors]
  );

  const closeBrandLinks = React.useCallback((open: boolean) => {
    setBrandLinksOpen(open);
    if (!open) setBrandLinksDraft(null);
  }, []);

  const brandLinksGuard = useUnsavedChangesGuard({
    open: brandLinksOpen,
    value: brandLinksDraft ?? EMPTY_BRAND_LINKS_DRAFT,
    onOpenChange: closeBrandLinks,
    enabled: access.canEdit,
  });

  const openBrandLinks = React.useCallback(
    (brand: BrandRow) => {
      const vendor = visibleVendors.find((candidate) => candidate.id === brand.id);
      if (!vendor) {
        toast.error("Brand links could not be loaded.");
        return;
      }
      const next: BrandLinksDraft = {
        brandId: vendor.id,
        brandName: vendor.name,
        links: (vendor.links ?? []).map((link) => ({
          id: link.id,
          kind: link.kind,
          url: link.url,
          label: link.label ?? undefined,
        })),
      };
      setBrandLinksDraft(next);
      setBrandLinksOpen(true);
      brandLinksGuard.markPristine(next);
    },
    [brandLinksGuard, visibleVendors]
  );

  const saveBrandLinks = async () => {
    if (!brandLinksDraft || !brandLinksGuard.isDirty) return;
    setBrandLinksSaving(true);
    try {
      const saved = unwrapActionResult(
        await updateVendorAction({
          id: brandLinksDraft.brandId,
          data: { links: brandLinksDraft.links },
        })
      );
      setVisibleVendors((current) =>
        current.map((vendor) => (vendor.id === saved.id ? saved : vendor))
      );
      brandLinksGuard.closeAfterSave();
      toast.success("Brand links updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Brand links could not be saved.");
    } finally {
      setBrandLinksSaving(false);
    }
  };

  const [dialog, setDialog] = React.useState<{
    open: boolean;
    mode: "CREATE" | "EDIT";
    row: MaterialRow | null;
  }>({ open: false, mode: "CREATE", row: null });
  /**
   * Brand dialog state — CREATE from the header CTA, EDIT from a row's ⋯ menu.
   *
   * Item 2 (feedback 2026-08-14): the brands table only had Create and Read.
   * Update and Delete now live in the Aksi column so a wrong brand name or a
   * duplicate entry can be fixed where it is seen, not only via the SKU page.
   */
  const [brandDialog, setBrandDialog] = React.useState<{
    open: boolean;
    mode: "CREATE" | "EDIT";
    vendor: LibraryVendor | null;
  }>({ open: false, mode: "CREATE", vendor: null });
  const [deleteBrand, setDeleteBrand] = React.useState<BrandRow | null>(null);
  const [isDeletingBrand, setIsDeletingBrand] = React.useState(false);

  const doDeleteBrand = React.useCallback(async () => {
    if (!deleteBrand) return;
    setIsDeletingBrand(true);
    try {
      unwrapActionResult(await deleteVendorAction({ id: deleteBrand.id }));
      toast.success(`Brand "${deleteBrand.name}" deleted.`);
      setDeleteBrand(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Brand could not be deleted.");
    } finally {
      setIsDeletingBrand(false);
    }
  }, [deleteBrand, router]);

  /**
   * The dialog's full SKU object, fetched on open.
   *
   * Rows carry scalars only now (see `material-view-service.ts`), so the detail
   * that `MasterDataProductDialog` edits is loaded by id at the moment a row is
   * clicked rather than shipped with all 50 rows on every page load.
   *
   * `null` while loading — the dialog treats that as "no product yet", which is
   * the same state it already handles for CREATE.
   */
  const [detail, setDetail] = React.useState<ProductCatalogWithRelations | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const [brandDetailDialog, setBrandDetailDialog] = React.useState<{
    open: boolean;
    row: BrandRow | null;
    detail: BrandDetail | null;
    loading: boolean;
    initialTab: BrandDetailTab;
  }>({
    open: false,
    row: null,
    detail: null,
    loading: false,
    initialTab: "overview",
  });

  const openBrandDetail = React.useCallback(
    (row: BrandRow, initialTab: BrandDetailTab = "overview") => {
      setBrandDetailDialog({ open: true, row, detail: null, loading: true, initialTab });
      void getBrandDetailAction({ brandId: row.id })
        .then((result) => {
          if (!result.success || !result.data) {
            toast.error(result.success ? "Brand not found" : result.error);
            setBrandDetailDialog((current) => ({ ...current, loading: false }));
            return;
          }
          setBrandDetailDialog((current) => ({
            ...current,
            detail: result.data,
            loading: false,
          }));
        })
        .catch(() => {
          toast.error("Brand details could not be loaded");
          setBrandDetailDialog((current) => ({ ...current, loading: false }));
        });
    },
    []
  );

  const openRow = React.useCallback((row: MaterialRow) => {
    setDialog({ open: true, mode: "EDIT", row });
    setDetail(null);
    setDetailLoading(true);
    void getSkuDetailAction({ id: row.id })
      .then((result) => {
        setDetail(result.success ? result.data : null);
        if (!result.success) toast.error("Material details could not be loaded.");
      })
      .finally(() => setDetailLoading(false));
  }, []);

  /**
   * Brand landing: render the brand table instead of the SKU table. Fulfils R1 —
   * the default state of the page is "all brands", not "all SKUs from all
   * brands".
   *
   * Same function the server uses to pick which query runs. It used to be a
   * second hand-written copy of that condition, and the two drifted: both
   * counted `search` as a breakout, so the brand table's own search box emptied
   * the brand table.
   */
  const showBrandLanding = isBrandLandingView({
    vendorId: initialFilters.vendorId,
    category: initialFilters.category,
    price: initialFilters.price,
  });
  const summaryDescription = showBrandLanding
    ? [
        "Material brands used by the company. Open a count or the action menu for details.",
        `${brandTotals.all.toLocaleString("id-ID")} brands`,
        `${brandTotals.complete.toLocaleString("id-ID")} complete`,
        `${brandTotals.incomplete.toLocaleString("id-ID")} incomplete`,
      ].join(" · ")
    : [
        "Material SKUs used by the company.",
        `${totals.all.toLocaleString("id-ID")} materials`,
        ...(canSeePrices
          ? [
              `${totals.bqReady.toLocaleString("id-ID")} BQ ready`,
              `${totals.incompletePrice.toLocaleString("id-ID")} price incomplete`,
            ]
          : []),
      ].join(" · ");

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, total);
  // Brand pager. Derived from the `pageSize` prop, which the server now sets to
  // BRAND_PAGE_SIZE on the landing — the literal `50` this replaces was correct
  // only for as long as the two page sizes happened to be equal.
  const brandTotalPages = Math.max(1, Math.ceil(brandTotal / pageSize));

  const navigate = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (!value || value === "ALL" || value === "all") params.delete(key);
      else params.set(key, value);
    });
    // Any filter change invalidates the current page number — page 7 of the old
    // result set is meaningless against the new one, and landing on an empty
    // page looks like "no results" when there are plenty.
    if (!("page" in patch)) params.delete("page");
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <>
      <DashboardTemplate
        header={
          <PageHeader
            eyebrow="Master Data"
            title="Brands"
            description={summaryDescription}
            action={
              <div className="flex items-center gap-2">
                {access.canCreate ? (
                  showBrandLanding ? (
                    <Button
                      type="button"
                      onClick={() => setBrandDialog({ open: true, mode: "CREATE", vendor: null })}
                      className={cn(
                        "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                        UI_ENGINE_RADIUS_ACTION
                      )}
                    >
                      <Plus className="size-[var(--ui-icon-size-sm)]" />
                      Add Brand
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      onClick={() =>
                        setDialog({ open: true, mode: "CREATE", row: null })
                      }
                      className={cn(
                        "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                        UI_ENGINE_RADIUS_ACTION
                      )}
                    >
                      <Plus className="size-[var(--ui-icon-size-sm)]" />
                      Add Material
                    </Button>
                  )
                ) : null}
              </div>
            }
          />
        }
        content={
          showBrandLanding ? (
        <div>
          {/* Brand search + sort. Both stay at brand grain: search matches the
              brand name, its owner, its categories, or a SKU it carries, and
              still returns Brand rows. Sort is applied in SQL by `getBrandView`,
              so it holds across pages. */}
          <div className="mb-[var(--ui-section-gap)] flex flex-wrap items-center gap-[var(--ui-control-gap,0.5rem)]">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                navigate({ search: search.trim() || null });
              }}
            >
              <div className="relative w-full max-w-sm sm:w-80">
                {/* Item 3 (feedback 2026-08-14): ikon dan placeholder bertabrakan.
                    `pl-[var(--ui-section-px)]` = 20px, sementara ikon mulai di
                    10px dan selebar 16px — jadi berakhir di 26px, DI ATAS huruf
                    pertama. Padding kiri sekarang `pl-9` (36px), sama dengan
                    kotak pencarian di halaman Pricing yang memang sudah benar. */}
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
                />
                <Input
                  aria-label="Search brands"
                  placeholder="Search brand, category, hashtag, supplier, or SKU…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)}
                />
              </div>
            </form>

            <Select
              value={initialFilters.sort || "brand"}
              onValueChange={(value) => navigate({ sort: value === "brand" ? null : value })}
            >
              <SelectTrigger className={cn("w-52", UI_ENGINE_RADIUS_CONTROL)} aria-label="Sort brands">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="brand">Sort: Brand name</SelectItem>
                <SelectItem value="sku">Sort: SKU count</SelectItem>
                <SelectItem value="newest">Sort: Newest</SelectItem>
              </SelectContent>
            </Select>

            {initialFilters.search ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  navigate({ search: null });
                }}
              >
                Reset search
              </Button>
            ) : null}
          </div>

          <TableCard layout="fixed" minWidth="var(--ui-brand-table-min-width)">
            <TableCardHeader>
              <TableCardHead style={{ width: "var(--ui-brand-table-col-brand)" }}>Brand</TableCardHead>
              <TableCardHead style={{ width: "var(--ui-brand-table-col-category)" }}>Category</TableCardHead>
              <TableCardHead style={{ width: "var(--ui-brand-table-col-hashtag)" }}>Hashtag</TableCardHead>
              <TableCardHead style={{ width: "var(--ui-brand-table-col-links)" }}>Catalog &amp; Links</TableCardHead>
              <TableCardHead align="right" style={{ width: "var(--ui-brand-table-col-count)" }}>SKU</TableCardHead>
              <TableCardHead align="right" style={{ width: "var(--ui-brand-table-col-count)" }}>Supplier</TableCardHead>
              <TableCardHead align="right" style={{ width: "var(--ui-brand-table-col-actions)" }}>Actions</TableCardHead>
            </TableCardHeader>
            <TableCardBody>
              {visibleBrandRows.map((brand) => (
                  <TableCardRow
                    key={brand.id}
                    className={cn(
                      "group",
                      !brand.isComplete && "bg-[var(--ui-change-pending-bg)]"
                    )}
                  >
                    <TableCardCell>
                      <button
                        type="button"
                        className="flex flex-col text-left"
                        onClick={() => openBrandDetail(brand)}
                      >
                        <span className="font-medium text-[var(--ui-text-primary)]">
                          {brand.name}
                        </span>
                        {brand.legalName ? (
                          <span
                            className={cn(
                              UI_ENGINE_TYPE_META,
                              "text-[var(--ui-text-tertiary)]"
                            )}
                          >
                            {brand.legalName}
                          </span>
                        ) : null}
                      </button>
                    </TableCardCell>
                    {/* Item 4: chip per tag diganti satu kalimat miring
                        dipisah koma. Lima chip berbingkai untuk lima kata
                        pendek menciptakan lima kotak yang harus dipindai satu
                        per satu; sebagai frasa, mata membacanya sekali. */}
                    <TableCardCell>
                      <span
                        className={cn(
                          "block italic",
                          brand.categoryTags.length > 0
                            ? "text-[var(--ui-text-secondary)]"
                            : "text-[var(--ui-change-pending)]"
                        )}
                        title={brand.categoryTags.join(", ")}
                      >
                        {compactBrandValues(brand.categoryTags, "No categories")}
                      </span>
                    </TableCardCell>
                    <TableCardCell>
                      <span
                        className={cn(
                          "block italic",
                          brand.tags.length > 0
                            ? "text-[var(--ui-text-secondary)]"
                            : "text-[var(--ui-text-tertiary)]"
                        )}
                        title={brand.tags.join(", ")}
                      >
                        {compactBrandValues(brand.tags, "No hashtags")}
                      </span>
                    </TableCardCell>
                    <TableCardCell>
                      <div className="flex items-start justify-between gap-[calc(var(--ui-section-gap)/2)]">
                        <BrandLinksReadView links={brandLinksById.get(brand.id) ?? []} />
                        {access.canEdit ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit catalog and links for ${brand.name}`}
                            title="Edit catalog and links"
                            onClick={() => openBrandLinks(brand)}
                            className={cn("shrink-0", UI_ENGINE_RADIUS_ACTION)}
                          >
                            <Pencil aria-hidden className="size-[var(--ui-icon-size-sm)]" />
                          </Button>
                        ) : null}
                      </div>
                    </TableCardCell>
                    <TableCardCell align="right" className="tabular-nums">
                      <button
                        type="button"
                        className="font-semibold text-slate-700 hover:text-slate-950 hover:underline"
                        onClick={() => openBrandDetail(brand, "skus")}
                        aria-label={`View ${brand.skuCount} SKUs for ${brand.name}`}
                      >
                        {brand.skuCount.toLocaleString("id-ID")}
                      </button>
                    </TableCardCell>
                    <TableCardCell align="right" className="tabular-nums">
                      <button
                        type="button"
                        className="font-semibold text-slate-700 hover:text-slate-950 hover:underline"
                        onClick={() => openBrandDetail(brand, "suppliers")}
                        aria-label={`View ${brand.supplierCount} suppliers for ${brand.name}`}
                      >
                        {brand.supplierCount.toLocaleString("id-ID")}
                      </button>
                    </TableCardCell>
                    {/* BR6/BR11: menu tetap dapat difokuskan lewat keyboard dan
                        menjadi satu-satunya pintu edit setelah inline edit dihapus. */}
                    <TableCardCell align="right">
                      <div className="flex items-center justify-end gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              aria-label={`Open actions for ${brand.name}`}
                              title="Open brand actions"
                              className={cn(
                                "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100",
                                UI_ENGINE_RADIUS_ACTION
                              )}
                            >
                              <MoreHorizontal
                                aria-hidden
                                className="size-[var(--ui-icon-size-sm)]"
                              />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onSelect={() => openBrandDetail(brand)}
                            >
                              <Eye aria-hidden />
                              View details
                            </DropdownMenuItem>
                            {access.canEdit ? (
                              <>
                                <DropdownMenuItem
                                  onSelect={() => {
                                    const full = visibleVendors.find(
                                      (vendor) => vendor.id === brand.id
                                    );
                                    if (!full) {
                                      toast.error("Brand details were not found.");
                                      return;
                                    }
                                    setBrandDialog({
                                      open: true,
                                      mode: "EDIT",
                                      vendor: full,
                                    });
                                  }}
                                >
                                  <Pencil aria-hidden />
                                  Edit full details
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => setDeleteBrand(brand)}
                                >
                                  <Trash2 aria-hidden />
                                  Delete brand
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCardCell>
                  </TableCardRow>
              ))}
            </TableCardBody>
          </TableCard>

          {visibleBrandRows.length === 0 ? (
            <div className="p-[var(--ui-section-py)] text-center font-sans text-sm text-slate-400">
              {initialFilters.search
                ? `No brands match "${initialFilters.search}".`
                : "No brands yet."}
            </div>
          ) : null}

          {/* Brand pagination */}
          {brandTotal > 0 ? (
            <div className="mt-[calc(var(--ui-section-gap)/2)] flex flex-wrap items-center justify-between gap-[calc(var(--ui-section-gap)/2)]">
              <span className="font-sans text-xs text-slate-500 tabular-nums">
                Showing {((page - 1) * pageSize + 1).toLocaleString("id-ID")}–
                {Math.min(page * pageSize, brandTotal).toLocaleString("id-ID")} of{" "}
                {brandTotal.toLocaleString("id-ID")}
                {brandTotal !== brandTotals.all
                  ? ` (filtered from ${brandTotals.all.toLocaleString("id-ID")})`
                  : ""}
              </span>
              {brandTotalPages > 1 ? (
                <div className="flex items-center gap-[calc(var(--ui-section-gap)/4)]">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => navigate({ page: String(page - 1) })}
                    className={UI_ENGINE_RADIUS_CONTROL}
                  >
                    <ChevronLeft className="size-[var(--ui-icon-size-sm)]" />
                    Previous
                  </Button>
                  <span className="font-sans text-xs text-slate-500 tabular-nums">
                    {page} / {brandTotalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={page >= brandTotalPages}
                    onClick={() => navigate({ page: String(page + 1) })}
                    className={UI_ENGINE_RADIUS_CONTROL}
                  >
                    Next
                    <ChevronRight className="size-[var(--ui-icon-size-sm)]" />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <>
      {/* ── Back button when a brand/filter is active ──────────────────────── */}
      {initialFilters.vendorId ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => navigate({ vendor: null, page: null })}
          className={cn("mb-[calc(var(--ui-section-gap)/2)] -ml-1", UI_ENGINE_RADIUS_CONTROL)}
        >
          <ArrowLeft className="size-[var(--ui-icon-size-sm)]" />
          All brands
        </Button>
      ) : null}

      <form
        className="mb-[var(--ui-section-gap)] grid gap-[calc(var(--ui-section-gap)/2)] md:grid-cols-3 lg:grid-cols-6"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ search: search.trim() || null });
        }}
      >
        <div className="relative lg:col-span-2">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <Input
            aria-label="Search brand, category, SKU, or product"
            placeholder="Search…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)}
          />
        </div>

        <Select
          value={initialFilters.price || "ALL"}
          onValueChange={(value) => navigate({ price: value })}
        >
          <SelectTrigger className={UI_ENGINE_RADIUS_CONTROL}>
            <SelectValue placeholder="All prices" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All prices</SelectItem>
            <SelectItem value="READY">BQ ready</SelectItem>
            <SelectItem value="INCOMPLETE">Price incomplete</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={initialFilters.vendorId || "all"}
          onValueChange={(value) => navigate({ vendor: value })}
        >
          <SelectTrigger className={UI_ENGINE_RADIUS_CONTROL}>
            <SelectValue placeholder="All brands" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All brands</SelectItem>
            {visibleVendors.map((vendor) => (
              <SelectItem key={vendor.id} value={vendor.id}>
                {vendor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={initialFilters.category || "all"}
          onValueChange={(value) => navigate({ category: value })}
        >
          <SelectTrigger className={UI_ENGINE_RADIUS_CONTROL}>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={initialFilters.sort || "brand"}
          onValueChange={(value) => navigate({ sort: value })}
        >
          <SelectTrigger className={UI_ENGINE_RADIUS_CONTROL}>
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="brand">Sort: Brand</SelectItem>
            <SelectItem value="vendor">Sort: Brand owner</SelectItem>
            {/* "Sort: Category" dihapus 2026-08-11. Sorting sekarang dijalankan
                di SQL, dan "kategori pertama dari sekian kategori sebuah SKU"
                tidak punya padanan ORDER BY tanpa kolom denormalisasi di Sku.
                Filter kategori di sebelah kiri menjawab kebutuhan yang sama.
                Lihat roadmap kalau mau dikembalikan. */}
            <SelectItem value="sku">Sort: SKU</SelectItem>
            <SelectItem value="newest">Sort: Newest</SelectItem>
          </SelectContent>
        </Select>
      </form>

      {/* D5: `TableCard` has `overflow-x-auto`, but it only does anything when
          the table is given a minimum width. Without one, percentage column
          widths resolve against the container and the columns squeeze instead
          of the table scrolling — five columns of brand names and SKU codes
          compressed to unreadable slivers on a laptop. */}
      <TableCard layout="fixed" minWidth="56rem">
        <TableCardHeader>
          {/* Satu kolom Brand, bukan Vendor + Brand. Untuk Material entitas
              relasionalnya memang brand (model Prisma-nya bernama `Brand`);
              `catalog_brand` hanyalah salinan denormalisasi nama itu dan pada
              seluruh 172 Material hasil seed isinya identik. Istilah "Vendor"
              dicadangkan untuk penyedia jasa. */}
          <TableCardHead style={{ width: "18%" }}>Brand</TableCardHead>
          <TableCardHead style={{ width: "24%" }}>Category tags</TableCardHead>
          {/* SKU dan nama produk digabung jadi satu kolom. Keduanya kolom
              bersebelahan pada baris `master_data.Material` yang sama
              (`catalog_sku`, `catalog_product_name`) dan untuk 95 dari 172
              material hasil seed isinya string identik — sumbernya menyatukan
              seri dan varian di satu sel, jadi menampilkannya sebagai dua kolom
              hanya mengulang teks yang sama persis. Sekarang: SKU sebagai
              identitas utama, nama produk ditampilkan di bawahnya HANYA bila
              memang berbeda. */}
          <TableCardHead style={{ width: canSeePrices ? "36%" : "48%" }}>SKU / Produk</TableCardHead>
          {/* Kolom "Spesifikasi" (warna · motif · finishing + dimensi) sengaja
              tidak ditampilkan di tabel: untuk data hasil seed workbook nilainya
              hampir selalu kosong atau hanya mengulang potongan SKU, jadi hanya
              menambah lebar tabel. Datanya TIDAK dihapus — masih ada di row dan
              tetap tampil/diedit lewat dialog Material. */}
          {canSeePrices ? <TableCardHead align="right" style={{ width: "12%" }}>Price</TableCardHead> : null}
          <TableCardHead style={{ width: "10%" }}>Link</TableCardHead>
        </TableCardHeader>
        <TableCardBody>
          {rows.map((row) => (
            <TableCardRow
              key={row.id}
              className="cursor-pointer"
              onClick={() => openRow(row)}
            >
              <TableCardCell>
                <div className="flex min-w-[10rem] flex-col">
                  <span className="font-serif font-semibold text-slate-950">
                    {row.vendorName || row.brand}
                  </span>
                  {/* Legal entity ("PT Cipta Sani Lestari") tetap ditampilkan —
                      itulah perusahaan di balik brand, dan satu-satunya bagian
                      dari kolom Vendor lama yang benar-benar menambah informasi. */}
                  {row.vendorLegalName ? (
                    <span className="text-slate-400">
                      {row.vendorLegalName}
                    </span>
                  ) : null}
                  {/* `catalog_brand` adalah salinan denormalisasi dari
                      `Brand.brand_name`, bukan field mandiri — semua jalur tulis
                      menurunkannya dari relasi Brand. Kalau keduanya berbeda itu
                      artinya data lama yang belum tersentuh, bukan variasi yang
                      sah. Ditandai supaya terlihat; membuka lalu menyimpan lewat
                      dialog Material akan menyelaraskannya otomatis. */}
                  {row.brand &&
                  row.vendorName &&
                  row.brand.trim().toLocaleLowerCase("id-ID") !==
                    row.vendorName.trim().toLocaleLowerCase("id-ID") ? (
                    <span
                      className="text-amber-700"
                      title={`The brand name stored on this material ("${row.brand}") differs from its related Brand ("${row.vendorName}"). Open and save to bring them back in line.`}
                    >
                      ⚠ perlu diselaraskan: {row.brand}
                    </span>
                  ) : null}
                </div>
              </TableCardCell>
              <TableCardCell>
                <div className="flex min-w-[9rem] flex-wrap gap-[calc(var(--ui-section-gap)/4)]">
                  {row.categoryTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-[var(--ui-radius-pill)] bg-[var(--ui-surface-subtle)] px-[calc(var(--ui-section-px)/3)] py-[calc(var(--ui-section-py)/4)] text-xs text-slate-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </TableCardCell>
              <TableCardCell>
                <span className="font-mono text-xs text-slate-950">
                  {skuProductLabel(row.sku, row.productName)}
                </span>
              </TableCardCell>
              {canSeePrices ? (
                <TableCardCell align="right" className="tabular-nums">
                  {row.bqReady ? (
                    /* Satu harga sejak 2026-08-14 — tidak ada lagi angka
                       tercoret di atasnya. */
                    <div className="flex min-w-[10rem] flex-col items-end">
                      <span className="font-semibold text-slate-950">
                        {money(row.price!)}
                      </span>
                      <span className="text-slate-400">
                        / {row.priceUnit}
                      </span>
                      <PriceSourceBadge source={row.priceSource} />
                    </div>
                  ) : (
                    /* Simbol, bukan kalimat. "Not BQ-ready" terulang di setiap
                       baris tanpa harga (saat ini 172 dari 172) dan mendominasi
                       tabel padahal artinya cuma "no price yet". Angka
                       agregatnya sudah ada di subtitle "price incomplete".
                       `title` menjaga makna tetap terbaca saat hover dan
                       oleh screen reader. */
                    <span
                      className="text-amber-700"
                      title="Not BQ ready—price and unit are required"
                    >
                      —
                    </span>
                  )}
                </TableCardCell>
              ) : null}
              <TableCardCell>
                <div className="flex gap-[calc(var(--ui-section-gap)/2)]">
                  <LinkCell value={row.referenceUrl} label="Open product link" />
                  <LinkCell value={row.folderUrl} label="Open Drive folder" />
                </div>
              </TableCardCell>
            </TableCardRow>
          ))}
        </TableCardBody>
      </TableCard>

      {rows.length === 0 ? (
        <div className="p-[var(--ui-section-py)] text-center font-sans text-sm text-slate-400">
          No materials match these filters.
        </div>
      ) : null}

      {/* Row count + pager.
          The count is the point as much as the pager is: without it, a capped
          list is indistinguishable from a short one, and "TACO punya 200 SKU"
          silently looks like 50. */}
      {total > 0 ? (
        <div className="mt-[calc(var(--ui-section-gap)/2)] flex flex-wrap items-center justify-between gap-[calc(var(--ui-section-gap)/2)]">
          <span className="font-sans text-xs text-slate-500 tabular-nums">
            Showing {rangeFrom.toLocaleString("id-ID")}–
            {rangeTo.toLocaleString("id-ID")} of{" "}
            {total.toLocaleString("id-ID")}
            {total !== totals.all
              ? ` (filtered from ${totals.all.toLocaleString("id-ID")})`
              : ""}
          </span>

          {totalPages > 1 ? (
            <div className="flex items-center gap-[calc(var(--ui-section-gap)/4)]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => navigate({ page: String(page - 1) })}
                className={UI_ENGINE_RADIUS_CONTROL}
              >
                <ChevronLeft className="size-[var(--ui-icon-size-sm)]" />
                Previous
              </Button>
              <span className="font-sans text-xs text-slate-500 tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => navigate({ page: String(page + 1) })}
                className={UI_ENGINE_RADIUS_CONTROL}
              >
                Next
                <ChevronRight className="size-[var(--ui-icon-size-sm)]" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
        </>
        )
        }
      />

      <Dialog open={brandLinksOpen} onOpenChange={brandLinksGuard.handleOpenChange}>
        <DialogContent className="max-h-[var(--ui-dialog-max-height)] overflow-y-auto sm:max-w-[var(--ui-dialog-width-full)]">
          <DialogHeader className="pr-[var(--ui-dialog-header-close-clearance)]">
            <DialogTitle>{brandLinksDraft?.brandName ?? "Catalog & Links"}</DialogTitle>
            <DialogDescription>
              Maintain official catalogs, websites, social profiles, and archive links.
            </DialogDescription>
          </DialogHeader>
          <BrandLinksEditor
            value={brandLinksDraft?.links ?? []}
            onChange={(links) =>
              setBrandLinksDraft((current) => (current ? { ...current, links } : current))
            }
            readOnly={!access.canEdit}
          />
          {access.canEdit ? (
            <DialogFooter>
              <Button
                type="button"
                disabled={brandLinksSaving || !brandLinksGuard.isDirty}
                onClick={() => void saveBrandLinks()}
                className={UI_ENGINE_RADIUS_ACTION}
              >
                {brandLinksSaving ? (
                  <Loader2
                    aria-hidden
                    className="size-[var(--ui-icon-size-sm)] animate-spin"
                  />
                ) : (
                  <Save aria-hidden className="size-[var(--ui-icon-size-sm)]" />
                )}
                Save links
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>

      <UnsavedChangesPrompt
        guard={brandLinksGuard}
        description="These catalog and link changes have not been saved. Closing the editor will discard them."
      />

      <Dialog
        open={brandDetailDialog.open}
        onOpenChange={(open) => {
          setBrandDetailDialog((current) => ({ ...current, open }));
          if (!open) router.refresh();
        }}
      >
        <DialogContent className="max-h-[var(--ui-dialog-max-height)] overflow-y-auto sm:max-w-[var(--ui-dialog-width-full)]">
          <DialogHeader className="pr-[var(--ui-dialog-header-close-clearance)]">
            <DialogTitle>{brandDetailDialog.row?.name ?? "Brand details"}</DialogTitle>
            <DialogDescription>
              Review the brand, open its SKU list, or manage assigned suppliers.
            </DialogDescription>
          </DialogHeader>
          {brandDetailDialog.loading ? (
            <div className="flex items-center gap-[calc(var(--ui-section-gap)/2)] py-[var(--ui-section-py)] text-sm text-slate-400">
              <Loader2 className="size-[var(--ui-icon-size-sm)] animate-spin" />
              Loading brand details…
            </div>
          ) : brandDetailDialog.detail ? (
            <BrandDetailContent
              brand={brandDetailDialog.detail}
              companies={companies}
              canManage={access.canEdit}
              access={access}
              vendors={visibleVendors}
              suppliers={suppliers}
              categories={categories}
              finishings={finishings}
              tags={tags}
              initialTab={brandDetailDialog.initialTab}
            />
          ) : (
            <p className="py-[var(--ui-section-py)] text-sm text-slate-400">
              Brand details are unavailable.
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Brand dialog — CREATE dari CTA header, EDIT dari menu ⋯ per baris. */}
      <MasterDataBrandDialog
        open={brandDialog.open}
        mode={brandDialog.mode}
        vendor={brandDialog.vendor}
        canManage={brandDialog.mode === "CREATE" ? access.canCreate : access.canEdit}
        companies={companies}
        categoryOptions={brandCategoryOptions}
        tagOptions={tags}
        onOpenChange={(open) => setBrandDialog((prev) => ({ ...prev, open }))}
        onSaved={(saved) => {
          const categoryTags = (saved.seed_categories ?? []).map((category) => category.name);
          setVisibleVendors((current) =>
            current.map((vendor) => (vendor.id === saved.id ? saved : vendor))
          );
          setVisibleBrandRows((current) =>
            current.map((row) =>
              row.id === saved.id
                ? {
                    ...row,
                    name: saved.name,
                    categoryTags,
                    tags: saved.tags,
                    isComplete: isBrandComplete({
                      categoryCount: categoryTags.length,
                      supplierCount: row.supplierCount,
                    }),
                  }
                : row
            )
          );
          router.refresh();
        }}
      />

      {/* Hapus brand — konfirmasi terpisah karena ini satu-satunya aksi di
          halaman ini yang tidak bisa dibatalkan dengan klik berikutnya. */}
      <AlertDialog
        open={!!deleteBrand}
        onOpenChange={(open) => { if (!open) setDeleteBrand(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this brand?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteBrand?.name}</strong> will be deleted from Master Data.
              {deleteBrand && deleteBrand.skuCount > 0
                ? ` This brand still has ${deleteBrand.skuCount.toLocaleString("id-ID")} SKUs. Delete or move them first if the server rejects this request.`
                : " Recorded price history will be preserved."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingBrand}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeletingBrand}
              onClick={(event) => { event.preventDefault(); void doDeleteBrand(); }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeletingBrand ? (
                <Loader2 className="mr-1 size-[var(--ui-icon-size-sm)] animate-spin" />
              ) : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* SKU dialog — create/edit material from the SKU table. */}
      <MasterDataProductDialog
        open={dialog.open}
        mode={dialog.mode}
        product={detail ?? undefined}
        detailLoading={detailLoading}
        initialPrice={dialog.row ? {
          price: dialog.row.price,
          unit: dialog.row.priceUnit,
          supplierId: dialog.row.priceSupplierId,
        } : undefined}
        access={access}
        vendors={visibleVendors}
        suppliers={suppliers}
        categories={categories}
        materialsCategories={materialsCategories}
        fixturesCategories={fixturesCategories}
        finishings={finishings}
        tags={tags}
        brandCoverage={brandCoverage}
        onOpenChange={(open) =>
          setDialog((current) => ({ ...current, open }))
        }
      />
    </>
  );
}
