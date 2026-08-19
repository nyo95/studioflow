"use client";

import * as React from "react";
import { Loader2, Plus, MoreHorizontal, Trash2 } from "lucide-react";
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
  DashboardPageShell,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  PageBackLink,
  PageHeader,
  SectionCard,
  TableCard,
  TableCardBody,
  TableCardCell,
  TableCardHead,
  TableCardHeader,
  TableCardRow,
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_TYPE_H3,
  UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import { cn } from "@/lib/utils";
import { unwrapActionResult } from "@/lib/result";
import { useDebounce } from "@/hooks/use-debounce";
import type { BrandDetail, BrandSkuRow, BrandSupplierRow } from "@/subapps/master-data/actions/masterdata-actions";
import {
  getBrandSkusAction,
  getBrandSuppliersAction,
  assignSupplierToBrandAction,
  unassignSupplierFromBrandAction,
} from "@/subapps/master-data/actions/masterdata-actions";
import type { PartyData } from "@/subapps/master-data/types/party";
import { PARTY_ROLE_LABEL } from "@/subapps/master-data/types/party";
import { getSkuDetailAction } from "@/extensions/library/actions/library-actions";
import type {
  LibraryAccess,
  LibraryVendor,
  ProductCatalogWithRelations,
} from "@/extensions/library/types";
import { MasterDataProductDialog } from "./MasterDataProductDialog";

/**
 * Tab "Prices" dihapus 2026-08-14 (feedback item 4).
 *
 * Isinya hanya satu kalimat dan satu tautan ke /masterdata/prices — sebuah tab
 * yang berjanji menampilkan harga lalu tidak menampilkan harga apa pun. Angka
 * "Active prices" di stat row di atas sudah menjawab pertanyaan yang sama, dan
 * navigasi ke halaman Prices sudah tersedia di nav Master Data.
 */
export type BrandDetailTab = "overview" | "skus" | "suppliers";

const BRAND_DETAIL_TABS: { key: BrandDetailTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "skus", label: "SKUs" },
  { key: "suppliers", label: "Suppliers" },
];

function money(value: number) {
  return value.toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });
}

export function BrandDetailClient({
  brand,
  companies,
  canManage,
  access,
  vendors,
  suppliers,
  categories,
  finishings,
  tags,
}: {
  brand: BrandDetail;
  companies: PartyData[];
  canManage: boolean;
  /**
   * Prop-prop di bawah ini semata untuk `MasterDataProductDialog`, yang sejak
   * 2026-08-14 dibuka dari tab SKUs (dulu `SkuDetailDrawer` yang read-only).
   * Bentuknya persis seperti yang diberikan halaman Brands ke dialog yang sama.
   */
  access: LibraryAccess;
  vendors: LibraryVendor[];
  suppliers: { id: string; name: string }[];
  categories: string[];
  finishings: string[];
  tags: string[];
}) {
  const router = useRouter();

  return (
    <DashboardPageShell>
      <PageBackLink href="/masterdata/materials" label="Brands" />
      <PageHeader
        eyebrow="Master Data"
        title={brand.name}
        action={
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/masterdata/materials`)}
            className={UI_ENGINE_RADIUS_ACTION}
          >
            Back to Brands
          </Button>
        }
      />

      <BrandDetailContent
        brand={brand}
        companies={companies}
        canManage={canManage}
        access={access}
        vendors={vendors}
        suppliers={suppliers}
        categories={categories}
        finishings={finishings}
        tags={tags}
      />
    </DashboardPageShell>
  );
}

/** Shared by the legacy route and the BR4 modal on the Brands landing table. */
export function BrandDetailContent({
  brand,
  companies,
  canManage,
  access,
  vendors,
  suppliers,
  categories,
  finishings,
  tags,
  initialTab = "overview",
}: {
  brand: BrandDetail;
  companies: PartyData[];
  canManage: boolean;
  access: LibraryAccess;
  vendors: LibraryVendor[];
  suppliers: { id: string; name: string }[];
  categories: string[];
  finishings: string[];
  tags: string[];
  initialTab?: BrandDetailTab;
}) {
  const [tab, setTab] = React.useState<BrandDetailTab>(initialTab);

  React.useEffect(() => setTab(initialTab), [brand.id, initialTab]);

  return (
    <>
      <SectionCard padding="sm" className="mb-[var(--ui-section-gap)]">
        <div className="flex flex-wrap gap-[var(--ui-section-gap)] px-[var(--ui-section-px)] py-[var(--ui-section-py)]">
          <div className="flex flex-col">
            <span className={UI_ENGINE_TYPE_META}>SKUs</span>
            <span className={cn("text-slate-950 tabular-nums", UI_ENGINE_TYPE_H3)}>
              {brand.skuCount}
            </span>
          </div>
          <div className="flex flex-col">
            <span className={UI_ENGINE_TYPE_META}>Suppliers</span>
            <span className={cn("text-slate-950 tabular-nums", UI_ENGINE_TYPE_H3)}>
              {brand.supplierCount}
            </span>
          </div>
          <div className="flex flex-col">
            <span className={UI_ENGINE_TYPE_META}>Active prices</span>
            <span className={cn("text-slate-950 tabular-nums", UI_ENGINE_TYPE_H3)}>
              {brand.priceCount}
            </span>
          </div>
        </div>
      </SectionCard>

      <div className="mb-[var(--ui-section-gap)] flex gap-[calc(var(--ui-section-gap)/4)] border-b border-[var(--ui-border-subtle)]">
        {BRAND_DETAIL_TABS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-[calc(var(--ui-section-gap)/2)] px-[var(--ui-section-px)] py-[calc(var(--ui-section-py)/2)] font-sans text-sm font-medium transition-colors",
              tab === key
                ? "border-b-[var(--ui-outline-width)] border-slate-900 text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? <OverviewTab brand={brand} /> : null}
      {tab === "skus" ? (
        <SkusTab
          brandId={brand.id}
          access={access}
          vendors={vendors}
          suppliers={suppliers}
          categories={categories}
          finishings={finishings}
          tags={tags}
        />
      ) : null}
      {tab === "suppliers" ? (
        <SuppliersTab brandId={brand.id} companies={companies} canManage={canManage} />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------
function OverviewTab({ brand }: { brand: BrandDetail }) {
  const completeness = [
    { label: "Owner", ok: !!brand.owner },
    { label: "Category", ok: brand.categories.length > 0 },
  ];

  return (
    <SectionCard padding="md">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className={UI_ENGINE_TYPE_META}>Brand Name</Label>
          <div className="text-sm font-semibold text-slate-950">{brand.name}</div>
        </div>
        <div className="flex flex-col gap-1">
          <Label className={UI_ENGINE_TYPE_META}>Owner</Label>
          <div className="text-sm text-slate-700">{brand.owner?.name ?? "—"}</div>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label className={UI_ENGINE_TYPE_META}>Categories</Label>
          {/* Koma + miring, sama seperti tabel Brands (item 4, 2026-08-14). */}
          {brand.categories.length > 0 ? (
            <span className="text-sm italic text-slate-500">
              {brand.categories.map((c) => c.name).join(", ")}
            </span>
          ) : (
            <span className="text-sm text-slate-400">—</span>
          )}
        </div>
        {brand.notes && (
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label className={UI_ENGINE_TYPE_META}>Notes</Label>
            <div className="text-sm text-slate-700">{brand.notes}</div>
          </div>
        )}
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label className={UI_ENGINE_TYPE_META}>Completeness</Label>
          <div className="flex flex-wrap gap-3">
            {completeness.map(({ label, ok }) => (
              <span key={label} className={cn("text-xs font-medium", ok ? "text-emerald-600" : "text-amber-600")}>
                {ok ? "✓" : "⚠"} {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// SKUs tab
// ---------------------------------------------------------------------------
function SkusTab({
  brandId, access, vendors, suppliers, categories, finishings, tags,
}: {
  brandId: string;
  access: LibraryAccess;
  vendors: LibraryVendor[];
  suppliers: { id: string; name: string }[];
  categories: string[];
  finishings: string[];
  tags: string[];
}) {
  const [rows, setRows] = React.useState<BrandSkuRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [search, setSearch] = React.useState("");
  // §22 (2026-08-18): `search` diketik per-karakter dan sebelumnya langsung
  // masuk dependency effect di bawah, jadi setiap ketikan memicu server
  // action sendiri-sendiri. Efek sekarang mengikuti nilai yang di-debounce;
  // submit form (tombol "Cari") tetap memakai `search` mentah agar Enter /
  // klik langsung terasa instan, bukan menunggu jeda debounce.
  const debouncedSearch = useDebounce(search, 300);
  const [loading, setLoading] = React.useState(true);

  /**
   * Dialog SKU — menggantikan `SkuDetailDrawer` yang read-only (2026-08-14).
   *
   * Sebelumnya ada DUA jalan ke SKU sebuah brand: tab ini (lihat saja) dan
   * tombol "Lihat SKU" di tabel Brands (bisa edit). Keduanya menjawab
   * pertanyaan yang sama, dan bedanya tidak terbaca dari labelnya — tidak ada
   * yang menduga tombol bernama "Lihat" justru yang bisa menyunting. Sekarang
   * satu jalan, dan jalan itu bisa menyunting.
   */
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [detail, setDetail] = React.useState<ProductCatalogWithRelations | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  const load = React.useCallback(async (s: string, p: number) => {
    setLoading(true);
    try {
      const result = unwrapActionResult(
        await getBrandSkusAction({ brandId, search: s || undefined, page: p })
      );
      setRows(result.rows);
      setTotal(result.total);
    } catch {
      toast.error("Failed to load the SKU list.");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  React.useEffect(() => { void load(debouncedSearch, page); }, [load, debouncedSearch, page]);

  const openRow = React.useCallback((skuId: string) => {
    setDialogOpen(true);
    setDetail(null);
    setDetailLoading(true);
    void getSkuDetailAction({ id: skuId })
      .then((result) => {
        setDetail(result.success ? result.data : null);
        if (!result.success) toast.error("Failed to load material details.");
      })
      .finally(() => setDetailLoading(false));
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={(e) => { e.preventDefault(); setPage(1); void load(search, 1); }}
        className="flex gap-2"
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by SKU code or product name…"
          className={cn("max-w-sm", UI_ENGINE_RADIUS_CONTROL)}
        />
        <Button type="submit" variant="outline" className={UI_ENGINE_RADIUS_ACTION}>Search</Button>
      </form>

      <TableCard layout="fixed" minWidth="48rem">
        <TableCardHeader>
          <TableCardHead style={{ width: "18%" }}>SKU Code</TableCardHead>
          <TableCardHead style={{ width: "28%" }}>Product Name</TableCardHead>
          <TableCardHead style={{ width: "16%" }}>Dimension</TableCardHead>
          <TableCardHead style={{ width: "8%" }}>Unit</TableCardHead>
          {/* Harga + supplier ikut pindah ke sini bersama penyatuan jalur:
              tabel terfilter yang digantikan tab ini menampilkan keduanya, dan
              menyatukan dua jalur tidak boleh berarti kehilangan kolom. */}
          <TableCardHead align="right" style={{ width: "16%" }}>Price</TableCardHead>
          <TableCardHead style={{ width: "14%" }}>Supplier</TableCardHead>
        </TableCardHeader>
        <TableCardBody>
          {loading ? (
            <TableCardRow>
              <TableCardCell colSpan={6}>
                <div className="flex items-center gap-2 py-8 text-slate-400">
                  <Loader2 className="size-4 animate-spin" /> Loading…
                </div>
              </TableCardCell>
            </TableCardRow>
          ) : rows.length === 0 ? (
            <TableCardRow>
              <TableCardCell colSpan={6}>
                <div className="py-8 text-center text-sm text-slate-400">
                  This brand does not have any SKUs yet.
                </div>
              </TableCardCell>
            </TableCardRow>
          ) : (
            rows.map((row) => (
              <TableCardRow
                key={row.id}
                className="cursor-pointer"
                onClick={() => openRow(row.id)}
              >
                <TableCardCell className="font-mono text-xs">{row.sku || "—"}</TableCardCell>
                <TableCardCell className="text-sm">{row.product_name}</TableCardCell>
                <TableCardCell className="text-sm tabular-nums">
                  {row.dimension_w && row.dimension_h
                    ? `${row.dimension_w} × ${row.dimension_h}`
                    : "—"}
                </TableCardCell>
                <TableCardCell className="text-sm">{row.unit || "—"}</TableCardCell>
                <TableCardCell align="right" className="text-sm tabular-nums">
                  {row.price !== null ? (
                    <span className="font-medium text-slate-950">
                      {money(row.price)}
                      {row.price_unit ? (
                        <span className="text-slate-400"> / {row.price_unit}</span>
                      ) : null}
                    </span>
                  ) : (
                    /* Simbol, bukan kalimat: "belum ada harga" terulang di
                       setiap baris pada brand yang baru dibuat. */
                    <span className="text-amber-700" title="No current price">—</span>
                  )}
                </TableCardCell>
                <TableCardCell className="text-sm text-slate-500">
                  {/* Semua supplier dengan harga berlaku, bukan cuma yang
                      termurah (2026-08-18, owner feedback item 1) — brand
                      dengan dua penawaran aktif sebelumnya hanya pernah
                      menampilkan satu nama di sini. */}
                  {row.suppliers.length === 0 ? (
                    <span className="italic text-slate-400">No current price</span>
                  ) : row.suppliers.length === 1 ? (
                    row.suppliers[0].name
                  ) : (
                    <span title={row.suppliers.map((s) => s.name).join(", ")}>
                      {row.suppliers[0].name}{" "}
                      <span className="text-slate-400">+{row.suppliers.length - 1}</span>
                    </span>
                  )}
                </TableCardCell>
              </TableCardRow>
            ))
          )}
        </TableCardBody>
      </TableCard>

      {total > 0 && (
        <div className="flex items-center justify-between gap-3">
          <span className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>{total} SKU total</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className={UI_ENGINE_RADIUS_CONTROL}
              >
                Previous
              </Button>
              <span className={cn("tabular-nums", UI_ENGINE_TYPE_META)}>{page} / {totalPages}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className={UI_ENGINE_RADIUS_CONTROL}
              >
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      <MasterDataProductDialog
        open={dialogOpen}
        mode="EDIT"
        product={detail ?? undefined}
        detailLoading={detailLoading}
        access={access}
        vendors={vendors}
        suppliers={suppliers}
        categories={categories}
        finishings={finishings}
        tags={tags}
        onOpenChange={(open) => {
          setDialogOpen(open);
          // Muat ulang setelah dialog ditutup — nama, dimensi, atau harga bisa
          // saja berubah, dan tabel yang masih menampilkan nilai lama membuat
          // orang menyimpan dua kali.
          if (!open) void load(search, page);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suppliers tab
// ---------------------------------------------------------------------------
function SuppliersTab({
  brandId,
  companies,
  canManage,
}: {
  brandId: string;
  companies: PartyData[];
  canManage: boolean;
}) {
  const [rows, setRows] = React.useState<BrandSupplierRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [assignOpen, setAssignOpen] = React.useState(false);
  const [assignSearch, setAssignSearch] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<BrandSupplierRow | null>(null);
  const [removing, setRemoving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = unwrapActionResult(await getBrandSuppliersAction({ brandId }));
      setRows(result);
    } catch {
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  React.useEffect(() => { void load(); }, [load]);

  const assignedIds = new Set(rows.map((r) => r.partyId));
  const filteredCompanies = companies.filter((c) => {
    if (assignedIds.has(c.id)) return false;
    if (!assignSearch.trim()) return true;
    const q = assignSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.legal_name ?? "").toLowerCase().includes(q);
  });

  const handleAssign = async (partyId: string) => {
    setAssigning(true);
    try {
      unwrapActionResult(await assignSupplierToBrandAction({ brandId, partyId }));
      toast.success("Supplier assigned");
      setAssignOpen(false);
      setAssignSearch("");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not assign");
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      unwrapActionResult(await unassignSupplierFromBrandAction({ brandId, partyId: removeTarget.partyId }));
      toast.success("Relationship removed");
      setRemoveTarget(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className={cn("text-slate-500", UI_ENGINE_TYPE_META)}>{rows.length} suppliers</span>
        {canManage && (
          <Button
            type="button"
            onClick={() => setAssignOpen(true)}
            className={cn("bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]", UI_ENGINE_RADIUS_ACTION)}
          >
            <Plus className="size-4" /> Assign Supplier
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-slate-400">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">No suppliers assigned to this brand.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div key={row.partyId} className="flex items-center justify-between rounded-lg border border-[var(--ui-border-subtle)] bg-white px-4 py-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-slate-950">{row.partyName}</span>
                <div className="flex flex-wrap gap-1.5">
                  {row.roles.map((role) => (
                    <span key={role} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      {PARTY_ROLE_LABEL[role as keyof typeof PARTY_ROLE_LABEL] ?? role}
                    </span>
                  ))}
                  <span className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                    {row.priceCount} price record{row.priceCount !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="ghost" size="icon">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="text-red-600"
                      onClick={() => setRemoveTarget(row)}
                    >
                      <Trash2 className="mr-2 size-4" /> Remove relationship
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Assign Supplier dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Supplier</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              value={assignSearch}
              onChange={(e) => setAssignSearch(e.target.value)}
              placeholder="Search company…"
              className={UI_ENGINE_RADIUS_CONTROL}
            />
            <div className="max-h-60 overflow-y-auto">
              {filteredCompanies.length === 0 ? (
                <div className="py-4 text-center text-sm text-slate-400">No companies found.</div>
              ) : (
                filteredCompanies.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => void handleAssign(c.id)}
                    disabled={assigning}
                    className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-50 disabled:opacity-50"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900">{c.name}</span>
                      {c.legal_name && <span className="text-xs text-slate-400">{c.legal_name}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove supplier relationship?</AlertDialogTitle>
            <AlertDialogDescription>
              Removing will not delete price history. {removeTarget?.partyName} will no longer appear as a supplier for this brand.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              onClick={(e) => { e.preventDefault(); void handleRemove(); }}
              className="bg-red-600 text-white"
            >
              {removing && <Loader2 className="mr-1 size-4 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
