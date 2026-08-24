"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
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
  DetailTemplate,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { useUnsavedChangesGuard, UnsavedChangesPrompt } from "@/hooks/use-unsaved-changes-guard";
import { PARTY_ROLE_LABEL } from "@/subapps/master-data/types/party";
import type { BrandSkuRow, PartyBrandRow } from "@/subapps/master-data/actions/masterdata-actions";
import { getBrandSkusAction } from "@/subapps/master-data/actions/masterdata-actions";
import type { PartyContactRow } from "@/subapps/master-data/actions/party-actions";
import {
  createPartyContactAction,
  updatePartyContactAction,
  deletePartyContactAction,
} from "@/subapps/master-data/actions/party-actions";
import { formatDate } from "@/core/utilities/datetime";
import { getMaterialPricesAction } from "@/subapps/master-data/actions/pricing-actions";
import type { MaterialPricePageData } from "@/subapps/master-data/types/pricing";
import type { PartyRoleKind } from "@/generated/prisma";

export type SupplierPartyInfo = {
  id: string;
  name: string;
  legal_name: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  roles: PartyRoleKind[];
};

export type SupplierDetailTab = "overview" | "brands" | "prices" | "contacts";

const SUPPLIER_DETAIL_TABS: { key: SupplierDetailTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "brands", label: "Brands" },
  { key: "prices", label: "Prices" },
  { key: "contacts", label: "Contacts" },
];

export function SupplierDetailClient({
  party,
  brands,
  contacts: initialContacts,
  canManage,
  canViewPrices,
}: {
  party: SupplierPartyInfo;
  brands: PartyBrandRow[];
  contacts: PartyContactRow[];
  canManage: boolean;
  canViewPrices: boolean;
}) {
  return (
    <DetailTemplate
      header={
        <>
          <PageBackLink href="/masterdata/suppliers" label="Suppliers & Vendors" />
          <PageHeader
            eyebrow="Master Data"
            title={party.name}
            description={party.legal_name ?? undefined}
          />
        </>
      }
      content={
        <SupplierDetailContent
          party={party}
          brands={brands}
          contacts={initialContacts}
          canManage={canManage}
          canViewPrices={canViewPrices}
        />
      }
    />
  );
}

/** Shared by the legacy route and the BR7 modal on the Suppliers directory. */
export function SupplierDetailContent({
  party,
  brands,
  contacts: initialContacts,
  canManage,
  canViewPrices,
  initialTab = "overview",
}: {
  party: SupplierPartyInfo;
  brands: PartyBrandRow[];
  contacts: PartyContactRow[];
  canManage: boolean;
  canViewPrices: boolean;
  initialTab?: SupplierDetailTab;
}) {
  const [tab, setTab] = React.useState<SupplierDetailTab>(initialTab);
  const [contacts, setContacts] = React.useState(initialContacts);
  const tabs = React.useMemo(
    () => canViewPrices
      ? SUPPLIER_DETAIL_TABS
      : SUPPLIER_DETAIL_TABS.filter(({ key }) => key !== "prices"),
    [canViewPrices]
  );

  React.useEffect(() => {
    setTab(initialTab === "prices" && !canViewPrices ? "overview" : initialTab);
    setContacts(initialContacts);
  }, [canViewPrices, initialContacts, initialTab, party.id]);

  return (
    <>
      <SectionCard padding="sm" className="mb-4">
        <div className="flex flex-wrap gap-6 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Brands</span>
            <span className={cn("text-slate-950 tabular-nums", UI_ENGINE_TYPE_H3)}>{brands.length}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contacts</span>
            <span className={cn("text-slate-950 tabular-nums", UI_ENGINE_TYPE_H3)}>{contacts.length}</span>
          </div>
        </div>
      </SectionCard>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 border-b border-[var(--ui-border-subtle)]">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-2 px-5 py-3 font-sans text-sm font-medium transition-colors",
              tab === key
                ? "border-b-2 border-slate-900 text-slate-900"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "overview" ? <OverviewTab party={party} /> : null}
      {tab === "brands" ? <BrandsTab brands={brands} /> : null}
      {tab === "prices" && canViewPrices ? <PricesTab party={party} /> : null}
      {tab === "contacts" ? (
        <ContactsTab
          partyId={party.id}
          contacts={contacts}
          setContacts={setContacts}
          canManage={canManage}
        />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------
function OverviewTab({ party }: { party: SupplierPartyInfo }) {
  return (
    <SectionCard padding="md">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className={UI_ENGINE_TYPE_META}>Trading Name</Label>
          <div className="text-sm text-slate-950">{party.name}</div>
        </div>
        <div className="flex flex-col gap-1">
          <Label className={UI_ENGINE_TYPE_META}>Legal Name</Label>
          <div className="text-sm text-slate-700">{party.legal_name ?? "—"}</div>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label className={UI_ENGINE_TYPE_META}>Roles</Label>
          <div className="flex flex-wrap gap-1.5">
            {party.roles.length > 0
              ? party.roles.map((role) => (
                  <span key={role} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    {PARTY_ROLE_LABEL[role] ?? role}
                  </span>
                ))
              : <span className="text-sm text-slate-400">—</span>}
          </div>
        </div>
        <div className="flex flex-col gap-1 md:col-span-2">
          <Label className={UI_ENGINE_TYPE_META}>Address</Label>
          <div className="text-sm text-slate-700">{party.address ?? "—"}</div>
        </div>
        {party.notes && (
          <div className="flex flex-col gap-1 md:col-span-2">
            <Label className={UI_ENGINE_TYPE_META}>Notes</Label>
            <div className="text-sm text-slate-700">{party.notes}</div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Brands tab
// ---------------------------------------------------------------------------
function BrandsTab({ brands }: { brands: PartyBrandRow[] }) {
  const [skuDialog, setSkuDialog] = React.useState<{
    open: boolean;
    brand: PartyBrandRow | null;
    rows: BrandSkuRow[];
    total: number;
    page: number;
    loading: boolean;
  }>({ open: false, brand: null, rows: [], total: 0, page: 1, loading: false });

  const loadSkus = React.useCallback(async (brand: PartyBrandRow, page: number) => {
    setSkuDialog((current) => ({
      ...current,
      open: true,
      brand,
      page,
      loading: true,
    }));
    try {
      const result = unwrapActionResult(
        await getBrandSkusAction({ brandId: brand.brandId, page })
      );
      setSkuDialog((current) => ({
        ...current,
        rows: result.rows,
        total: result.total,
        loading: false,
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Brand SKUs could not be loaded.");
      setSkuDialog((current) => ({ ...current, loading: false }));
    }
  }, []);

  if (brands.length === 0) {
    return (
      <div className="py-14 text-center text-sm text-slate-400">
        No brands associated with this supplier.
      </div>
    );
  }
  const totalPages = Math.max(1, Math.ceil(skuDialog.total / 20));

  return (
    <>
      <TableCard layout="fixed" minWidth="var(--ui-supplier-brands-table-min-width)">
        <TableCardHeader>
          <TableCardHead>Brand</TableCardHead>
          <TableCardHead align="right">SKUs</TableCardHead>
          <TableCardHead align="right">Prices</TableCardHead>
        </TableCardHeader>
        <TableCardBody>
          {brands.map((brand) => (
            <TableCardRow key={brand.brandId}>
              <TableCardCell>
                <Link
                  href={`/masterdata/materials/${brand.brandId}`}
                  className="font-medium text-slate-950 hover:underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  {brand.brandName}
                </Link>
              </TableCardCell>
              <TableCardCell align="right" className="tabular-nums">
                <button
                  type="button"
                  className="font-semibold text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:underline"
                  onClick={() => void loadSkus(brand, 1)}
                  aria-label={`View ${brand.skuCount} SKUs for ${brand.brandName}`}
                >
                  {brand.skuCount.toLocaleString("id-ID")}
                </button>
              </TableCardCell>
              <TableCardCell align="right" className="tabular-nums">
                {brand.priceCount.toLocaleString("id-ID")}
              </TableCardCell>
            </TableCardRow>
          ))}
        </TableCardBody>
      </TableCard>

      <Dialog
        open={skuDialog.open}
        onOpenChange={(open) => setSkuDialog((current) => ({ ...current, open }))}
      >
        <DialogContent className="max-h-[var(--ui-dialog-max-height)] overflow-y-auto sm:max-w-[var(--ui-dialog-width-full)]">
          <DialogHeader className="pr-[var(--ui-dialog-header-close-clearance)]">
            <DialogTitle>{skuDialog.brand?.brandName ?? "Brand SKUs"}</DialogTitle>
            <DialogDescription>
              SKUs carried by this assigned brand. Prices may come from this supplier or another source.
            </DialogDescription>
          </DialogHeader>
          <TableCard layout="fixed" minWidth="var(--ui-supplier-brand-sku-table-min-width)">
            <TableCardHeader>
              <TableCardHead>SKU Code</TableCardHead>
              <TableCardHead>Product Name</TableCardHead>
              <TableCardHead align="right">Current Price</TableCardHead>
              <TableCardHead>Suppliers</TableCardHead>
            </TableCardHeader>
            <TableCardBody>
              {skuDialog.loading ? (
                <TableCardRow>
                  <TableCardCell colSpan={4}>
                    <div className="flex items-center gap-[calc(var(--ui-section-gap)/2)] py-[var(--ui-section-py)] text-slate-400">
                      <Loader2 className="size-[var(--ui-icon-size-sm)] animate-spin" />
                      Loading SKUs…
                    </div>
                  </TableCardCell>
                </TableCardRow>
              ) : skuDialog.rows.length === 0 ? (
                <TableCardRow>
                  <TableCardCell colSpan={4} className="text-center text-slate-400">
                    No active SKUs for this brand.
                  </TableCardCell>
                </TableCardRow>
              ) : (
                skuDialog.rows.map((row) => (
                  <TableCardRow key={row.id}>
                    <TableCardCell className="font-mono text-xs">{row.sku || "—"}</TableCardCell>
                    <TableCardCell>{row.product_name}</TableCardCell>
                    <TableCardCell align="right" className="tabular-nums">
                      {row.price === null
                        ? "—"
                        : row.price.toLocaleString("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            maximumFractionDigits: 0,
                          })}
                    </TableCardCell>
                    <TableCardCell>
                      {row.suppliers.length > 0
                        ? row.suppliers.map((supplier) => supplier.name).join(", ")
                        : "No current price"}
                    </TableCardCell>
                  </TableCardRow>
                ))
              )}
            </TableCardBody>
          </TableCard>
          {totalPages > 1 ? (
            <div className="flex items-center justify-end gap-[calc(var(--ui-section-gap)/2)]">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={skuDialog.loading || skuDialog.page <= 1 || !skuDialog.brand}
                onClick={() => {
                  if (skuDialog.brand) void loadSkus(skuDialog.brand, skuDialog.page - 1);
                }}
                className={UI_ENGINE_RADIUS_CONTROL}
              >
                <ChevronLeft className="size-[var(--ui-icon-size-sm)]" />
                Previous
              </Button>
              <span className="text-xs text-slate-500 tabular-nums">
                {skuDialog.page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={skuDialog.loading || skuDialog.page >= totalPages || !skuDialog.brand}
                onClick={() => {
                  if (skuDialog.brand) void loadSkus(skuDialog.brand, skuDialog.page + 1);
                }}
                className={UI_ENGINE_RADIUS_CONTROL}
              >
                Next
                <ChevronRight className="size-[var(--ui-icon-size-sm)]" />
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Prices tab
// ---------------------------------------------------------------------------
function PricesTab({ party }: { party: SupplierPartyInfo }) {
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [data, setData] = React.useState<MaterialPricePageData>({
    rows: [],
    total: 0,
    allTotal: 0,
    page: 1,
    pageSize: 50,
  });
  const [loading, setLoading] = React.useState(true);
  const requestSequence = React.useRef(0);

  const loadPrices = React.useCallback(async (page: number, search: string) => {
    const request = ++requestSequence.current;
    setLoading(true);
    try {
      const result = unwrapActionResult(await getMaterialPricesAction({
        supplierId: party.id,
        page,
        search: search || undefined,
      }));
      if (request === requestSequence.current) setData(result);
    } catch (error) {
      if (request === requestSequence.current) {
        toast.error(error instanceof Error ? error.message : "Supplier prices could not be loaded.");
      }
    } finally {
      if (request === requestSequence.current) setLoading(false);
    }
  }, [party.id]);

  React.useEffect(() => {
    void loadPrices(1, debouncedQuery);
  }, [debouncedQuery, loadPrices]);

  const pageCount = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="flex flex-col gap-[var(--ui-section-gap)]">
      <div className="flex flex-wrap items-center justify-between gap-[calc(var(--ui-section-gap)/2)]">
        <div className="flex flex-col gap-[calc(var(--ui-section-gap)/4)]">
          <p className={cn("text-[var(--ui-text-secondary)]", UI_ENGINE_TYPE_META)}>
            {data.allTotal.toLocaleString("id-ID")} current prices from {party.name}
          </p>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search brand, SKU, or item…"
            className={cn("max-w-[var(--ui-filter-secondary-width)]", UI_ENGINE_RADIUS_CONTROL)}
          />
        </div>
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href="/masterdata/prices">Manage all prices</Link>
        </Button>
      </div>

      <TableCard layout="fixed" minWidth="var(--ui-supplier-prices-table-min-width)">
        <TableCardHeader>
          <TableCardHead>Brand</TableCardHead>
          <TableCardHead>SKU Code</TableCardHead>
          <TableCardHead>Item</TableCardHead>
          <TableCardHead>Unit</TableCardHead>
          <TableCardHead align="right">Price</TableCardHead>
          <TableCardHead>Last updated</TableCardHead>
        </TableCardHeader>
        <TableCardBody>
          {loading ? (
            <TableCardRow>
              <TableCardCell colSpan={6}>
                <div className="flex items-center gap-[calc(var(--ui-section-gap)/2)] py-[var(--ui-section-py)] text-[var(--ui-text-tertiary)]">
                  <Loader2 className="size-[var(--ui-icon-size-sm)] animate-spin" />
                  Loading prices…
                </div>
              </TableCardCell>
            </TableCardRow>
          ) : data.rows.length === 0 ? (
            <TableCardRow>
              <TableCardCell colSpan={6} className="text-center text-[var(--ui-text-tertiary)]">
                {debouncedQuery
                  ? "No prices match your search."
                  : "No current material prices from this supplier."}
              </TableCardCell>
            </TableCardRow>
          ) : data.rows.map((row) => (
            <TableCardRow key={row.id}>
              <TableCardCell className="font-medium">{row.brand?.brand_name ?? "—"}</TableCardCell>
              <TableCardCell className="font-mono">{row.sku?.catalog_sku || "—"}</TableCardCell>
              <TableCardCell>{row.item_description}</TableCardCell>
              <TableCardCell>{row.unit ?? "—"}</TableCardCell>
              <TableCardCell align="right" className="tabular-nums font-medium">
                {row.price === null
                  ? "—"
                  : row.price.toLocaleString("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      maximumFractionDigits: 0,
                    })}
              </TableCardCell>
              <TableCardCell className={cn("text-[var(--ui-text-tertiary)]", UI_ENGINE_TYPE_META)}>
                {formatDate(row.updated_at ?? row.created_at)}
              </TableCardCell>
            </TableCardRow>
          ))}
        </TableCardBody>
      </TableCard>

      <div className="flex items-center justify-end gap-[calc(var(--ui-section-gap)/2)]">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || data.page <= 1}
          onClick={() => void loadPrices(data.page - 1, debouncedQuery)}
        >
          <ChevronLeft className="size-[var(--ui-icon-size-sm)]" />
          Previous
        </Button>
        <span className={cn("tabular-nums text-[var(--ui-text-secondary)]", UI_ENGINE_TYPE_META)}>
          {data.total === 0 ? "No results" : `${data.page} / ${pageCount}`}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || data.page >= pageCount}
          onClick={() => void loadPrices(data.page + 1, debouncedQuery)}
        >
          Next
          <ChevronRight className="size-[var(--ui-icon-size-sm)]" />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contacts tab
// ---------------------------------------------------------------------------
type ContactForm = {
  contact_person: string;
  contact_role: string;
  phone: string;
  email: string;
};

const EMPTY_FORM: ContactForm = {
  contact_person: "",
  contact_role: "",
  phone: "",
  email: "",
};

function ContactsTab({
  partyId,
  contacts,
  setContacts,
  canManage,
}: {
  partyId: string;
  contacts: PartyContactRow[];
  setContacts: React.Dispatch<React.SetStateAction<PartyContactRow[]>>;
  canManage: boolean;
}) {
  const [dialog, setDialog] = React.useState<{ open: boolean; mode: "CREATE" | "EDIT"; row: PartyContactRow | null }>({
    open: false, mode: "CREATE", row: null,
  });
  const [form, setForm] = React.useState<ContactForm>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<PartyContactRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const guard = useUnsavedChangesGuard({
    open: dialog.open,
    value: form,
    onOpenChange: (o) => setDialog((d) => ({ ...d, open: o })),
    enabled: canManage,
  });

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialog({ open: true, mode: "CREATE", row: null });
    guard.markPristine(EMPTY_FORM);
  };

  const openEdit = (row: PartyContactRow) => {
    const next = {
      contact_person: row.contact_person,
      contact_role: row.contact_role ?? "",
      phone: row.phone ?? "",
      email: row.email ?? "",
    };
    setForm(next);
    setDialog({ open: true, mode: "EDIT", row });
    guard.markPristine(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (dialog.mode === "CREATE") {
        const saved = unwrapActionResult(
          await createPartyContactAction({
            partyId,
            contact_person: form.contact_person,
            contact_role: form.contact_role || undefined,
            phone: form.phone || undefined,
            email: form.email || undefined,
          })
        );
        setContacts((prev) => [...prev, saved]);
        toast.success("Contact added");
      } else if (dialog.row) {
        const saved = unwrapActionResult(
          await updatePartyContactAction({
            id: dialog.row.id,
            partyId,
            contact_person: form.contact_person,
            contact_role: form.contact_role || undefined,
            phone: form.phone || undefined,
            email: form.email || undefined,
          })
        );
        setContacts((prev) => prev.map((c) => c.id === saved.id ? saved : c));
        toast.success("Contact updated");
      }
      guard.closeAfterSave();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      unwrapActionResult(await deletePartyContactAction({ id: deleteTarget.id, partyId }));
      setContacts((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Contact deleted");
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  };

  const canSave = Boolean(form.contact_person.trim());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className={cn("text-slate-500", UI_ENGINE_TYPE_META)}>{contacts.length} contacts</span>
        {canManage && (
          <Button
            type="button"
            onClick={openCreate}
            className={cn("bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]", UI_ENGINE_RADIUS_ACTION)}
          >
            <Plus className="size-4" /> Add Contact
          </Button>
        )}
      </div>

      {contacts.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400">No contacts yet.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-[var(--ui-border-subtle)] bg-white px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium text-slate-950">{c.contact_person}</span>
                {c.contact_role && <span className="text-xs text-slate-500">{c.contact_role}</span>}
                <div className="flex flex-wrap gap-3 text-xs text-slate-400">
                  {c.phone && <span>{c.phone}</span>}
                  {c.email && <span>{c.email}</span>}
                </div>
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => openEdit(c)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => setDeleteTarget(c)}
                    className="text-red-400 hover:text-red-600">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Contact dialog */}
      <Dialog open={dialog.open} onOpenChange={guard.handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{dialog.mode === "CREATE" ? "Add Contact" : "Edit Contact"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            {(
              [
                ["contact_person", "Name"],
                ["contact_role", "Role"],
                ["phone", "Phone"],
                ["email", "Email"],
              ] as const
            ).map(([field, label]) => (
              <div key={field} className="flex flex-col gap-1.5">
                <Label className={UI_ENGINE_TYPE_META}>{label}</Label>
                <Input
                  value={form[field]}
                  onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                  className={UI_ENGINE_RADIUS_CONTROL}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              onClick={() => void handleSave()}
              disabled={!canSave || saving}
              className={cn("bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]", UI_ENGINE_RADIUS_ACTION)}
            >
              {saving && <Loader2 className="mr-1 size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete contact?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.contact_person} will be removed from this supplier.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
              variant="destructive"
            >
              {deleting && <Loader2 className="mr-1 size-4 animate-spin" />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <UnsavedChangesPrompt guard={guard} />
    </div>
  );
}
