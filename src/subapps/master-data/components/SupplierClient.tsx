"use client";

/**
 * MASTER DATA — unified Party table for suppliers and service vendors.
 */

import * as React from "react";
import {
  Building2,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  PageHeader,
  TableCard,
  TableCardBody,
  TableCardCell,
  TableCardHead,
  TableCardHeader,
  TableCardRow,
} from "@/ui_engine";
import {
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_TYPE_META,
} from "@/ui_engine/tokens";
import { deleteCompanyAction } from "../actions/party-actions";
import { getPartyContactsAction, type PartyContactRow } from "../actions/party-actions";
import { getPartyBrandsAction, type PartyBrandRow } from "../actions/masterdata-actions";
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import type { PartyData } from "../types/party";
import { PARTY_ROLE_LABEL, PARTY_ROLE_ORDER } from "../types/party";
import type { PartyRoleKind } from "@/generated/prisma";
import { PartyDialog } from "./PartyDialog";
import {
  SupplierDetailContent,
  type SupplierDetailTab,
  type SupplierPartyInfo,
} from "./SupplierDetailClient";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------
/**
 * Excel §Halaman baris 39–43: *"Halaman Supplier — kategorinya dibagi-bagi"*,
 * listing Supplier / Subcon / Vendor / Retail Store / Manufacture.
 *
 * Implemented as a filter over the existing table rather than as five separate
 * screens. Five screens would have meant five copies of the same brand table,
 * and a party carrying two categories (Ace Hardware is both Retail and
 * Supplier) would have had to appear on two of them.
 */
type RoleFilter = "__all__" | PartyRoleKind;

// ---------------------------------------------------------------------------
// SupplierClient
// ---------------------------------------------------------------------------
type PartyDialogState = { open: boolean; mode: "CREATE" | "EDIT"; company: PartyData | null };

export function SupplierClient({
  companies: initialCompanies,
  canManageCompanies,
  canViewPrices,
}: {
  companies: PartyData[];
  canManageCompanies: boolean;
  canViewPrices: boolean;
}) {
  const router = useRouter();
  const [companies, setCompanies] = React.useState<PartyData[]>(initialCompanies);

  // ---- filter state ----
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>("__all__");

  // ---- dialog state ----
  const [partyDialog, setPartyDialog] = React.useState<PartyDialogState>(
    { open: false, mode: "CREATE", company: null }
  );
  const [supplierDetail, setSupplierDetail] = React.useState<{
    open: boolean;
    company: PartyData | null;
    brands: PartyBrandRow[];
    contacts: PartyContactRow[];
    initialTab: SupplierDetailTab;
    loading: boolean;
  }>({
    open: false,
    company: null,
    brands: [],
    contacts: [],
    initialTab: "overview",
    loading: false,
  });
  const [pendingDeleteCompany, setPendingDeleteCompany] = React.useState<PartyData | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => setCompanies(initialCompanies), [initialCompanies]);

  const openSupplierDetail = React.useCallback(
    (company: PartyData, initialTab: SupplierDetailTab = "overview") => {
      setSupplierDetail({
        open: true,
        company,
        brands: [],
        contacts: [],
        initialTab,
        loading: true,
      });
      void Promise.all([
        getPartyBrandsAction({ partyId: company.id }).then(unwrapActionResult),
        getPartyContactsAction({ partyId: company.id }).then(unwrapActionResult),
      ])
        .then(([brands, contacts]) => {
          setSupplierDetail((current) =>
            current.company?.id === company.id
              ? { ...current, brands, contacts, loading: false }
              : current
          );
        })
        .catch((error) => {
          toast.error(error instanceof Error ? error.message : "Supplier details could not be loaded.");
          setSupplierDetail((current) =>
            current.company?.id === company.id ? { ...current, loading: false } : current
          );
        });
    },
    []
  );

  // Unified companies table — filters for the new unified view
  const visibleCompanies = React.useMemo(() => {
    const q = query.trim().toLocaleLowerCase("id-ID");
    let rows = companies;
    if (q) {
      rows = rows.filter((c) =>
        [c.name, c.legal_name]
          .filter(Boolean)
          .some((s) => s!.toLocaleLowerCase("id-ID").includes(q))
      );
    }
    if (roleFilter !== "__all__") {
      rows = rows.filter((c) => (c.roles ?? []).some((r) => r === roleFilter));
    }
    return [...rows].sort((a, b) => a.name.localeCompare(b.name, "id-ID"));
  }, [companies, query, roleFilter]);
  const assignedBrandCount = React.useMemo(
    () => companies.reduce((sum, company) => sum + (company._count?.brands ?? 0), 0),
    [companies]
  );
  const serviceVendorCount = React.useMemo(
    () => companies.filter((company) =>
      (company.roles ?? []).some((role) => role === "SERVICE_VENDOR" || role === "SUBCON")
    ).length,
    [companies]
  );
  const pageDescription = [
    "Companies, suppliers, subcontractors and service providers.",
    `${companies.length.toLocaleString("id-ID")} ${companies.length === 1 ? "party" : "parties"}`,
    `${assignedBrandCount.toLocaleString("id-ID")} brand ${assignedBrandCount === 1 ? "assignment" : "assignments"}`,
    `${serviceVendorCount.toLocaleString("id-ID")} service ${serviceVendorCount === 1 ? "vendor" : "vendors"}`,
  ].join(" · ");

  const handleCompanySaved = (saved: PartyData) => {
    setCompanies((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    router.refresh();
  };

  // ---- delete company ----
  const confirmDeleteCompany = async () => {
    if (!pendingDeleteCompany) return;
    setDeleting(true);
    try {
      unwrapActionResult(await deleteCompanyAction({ id: pendingDeleteCompany.id }));
      toast.success("Party deleted");
      setCompanies((prev) => prev.filter((c) => c.id !== pendingDeleteCompany.id));
      setPendingDeleteCompany(null);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Party could not be deleted");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardPageShell>
      <PageHeader
        eyebrow="Master Data"
        title="Suppliers & Vendors"
        description={pageDescription}
        action={
          canManageCompanies ? (
            <Button
              type="button"
              onClick={() => setPartyDialog({ open: true, mode: "CREATE", company: null })}
              className={cn(
                "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
                UI_ENGINE_RADIUS_ACTION
              )}
            >
              <Plus className="size-[var(--ui-icon-size-sm)]" />
              Add supplier / vendor
            </Button>
          ) : undefined
        }
      />

      {/* Unified search filter */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label="Search company"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search company or legal name…"
            className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)}
          />
        </div>
        <select
          aria-label="Filter by category"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
          className={cn(
            "h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-300",
            UI_ENGINE_RADIUS_CONTROL
          )}
        >
          <option value="__all__">All categories</option>
          {PARTY_ROLE_ORDER.map((role) => (
            <option key={role} value={role}>{PARTY_ROLE_LABEL[role]}</option>
          ))}
        </select>
      </div>

      {/* Unified table — companies as rows */}
      <TableCard layout="fixed" minWidth="var(--ui-supplier-table-min-width)">
        <TableCardHeader>
          <TableCardHead style={{ width: "var(--ui-supplier-table-col-company)" }}>Company</TableCardHead>
          <TableCardHead style={{ width: "var(--ui-supplier-table-col-roles)" }}>Roles</TableCardHead>
          <TableCardHead style={{ width: "var(--ui-supplier-table-col-count)" }}>Brands</TableCardHead>
          <TableCardHead style={{ width: "var(--ui-supplier-table-col-count)" }}>Contacts</TableCardHead>
          {/* Selalu tampil, bukan hanya untuk yang bisa mengelola (2026-08-18,
              owner feedback item 3) — tabel Brand punya tombol mata (Eye) yang
              selalu tampil di sini; tabel Supplier sebelumnya hanya
              menampilkan kolom Actions (Pencil/Trash) untuk yang punya izin
              kelola, jadi viewer-only tidak melihat afordansi "lihat" apa pun
              meski baris tetap bisa diklik. */}
          <TableCardHead align="right" style={{ width: "var(--ui-supplier-table-col-actions)" }}>Actions</TableCardHead>
        </TableCardHeader>
        <TableCardBody>
          {visibleCompanies.map((company) => (
            <TableCardRow
              key={company.id}
              className={cn(
                "group",
                (company.roles ?? []).length === 0 && "bg-[var(--ui-change-pending-bg)]"
              )}
            >
              <TableCardCell>
                <button
                  type="button"
                  className="flex flex-col text-left"
                  onClick={() => openSupplierDetail(company)}
                >
                  <span className="font-medium text-[var(--ui-text-primary)]">
                    {company.name}
                  </span>
                  {company.legal_name && (
                    <span
                      className={cn(
                        UI_ENGINE_TYPE_META,
                        "text-[var(--ui-text-tertiary)]"
                      )}
                    >
                      {company.legal_name}
                    </span>
                  )}
                </button>
              </TableCardCell>
              <TableCardCell>
                <div className="flex flex-wrap gap-1">
                  {(company.roles ?? []).map((role) => (
                    <span key={role} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                      {PARTY_ROLE_LABEL[role]}
                    </span>
                  ))}
                  {(company.roles ?? []).length === 0 && (
                    <span className="text-xs text-slate-300">—</span>
                  )}
                </div>
              </TableCardCell>
              <TableCardCell className="tabular-nums text-sm text-slate-600">
                <button
                  type="button"
                  className="font-semibold text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:underline"
                  onClick={() => openSupplierDetail(company, "brands")}
                  aria-label={`View ${company._count?.brands ?? 0} brands for ${company.name}`}
                >
                  {company._count?.brands ?? 0}
                </button>
              </TableCardCell>
              <TableCardCell className="tabular-nums text-sm text-slate-600">
                <button
                  type="button"
                  className="font-semibold text-[var(--ui-text-secondary)] hover:text-[var(--ui-text-primary)] hover:underline"
                  onClick={() => openSupplierDetail(company, "contacts")}
                  aria-label={`View ${company.contacts?.length ?? 0} contacts for ${company.name}`}
                >
                  {company.contacts?.length ?? 0}
                </button>
              </TableCardCell>
              <TableCardCell align="right">
                <div className="flex justify-end gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Open actions for ${company.name}`}
                        title="Open supplier actions"
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
                        onSelect={() => openSupplierDetail(company)}
                      >
                        <Eye aria-hidden />
                        View details
                      </DropdownMenuItem>
                      {canManageCompanies ? (
                        <>
                          <DropdownMenuItem
                            onSelect={() =>
                              setPartyDialog({ open: true, mode: "EDIT", company })
                            }
                          >
                            <Pencil aria-hidden />
                            Edit supplier
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setPendingDeleteCompany(company)}
                          >
                            <Trash2 aria-hidden />
                            Delete supplier
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

      {visibleCompanies.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-14 text-center">
          <Building2 className="size-8 text-slate-300" />
          <p className="text-sm text-slate-400">
            {query || roleFilter !== "__all__"
              ? "No companies match these filters."
              : "No suppliers yet. Use + Add supplier / vendor to start."}
          </p>
        </div>
      )}

      <Dialog
        open={supplierDetail.open}
        onOpenChange={(open) => {
          setSupplierDetail((current) => ({ ...current, open }));
          if (!open) router.refresh();
        }}
      >
        <DialogContent className="max-h-[var(--ui-dialog-max-height)] overflow-y-auto sm:max-w-[var(--ui-dialog-width-full)]">
          <DialogHeader className="pr-[var(--ui-dialog-header-close-clearance)]">
            <DialogTitle>{supplierDetail.company?.name ?? "Supplier details"}</DialogTitle>
            <DialogDescription>
              Review company information, assigned brands{canViewPrices ? ", prices" : ""}, and contacts.
            </DialogDescription>
          </DialogHeader>
          {supplierDetail.loading ? (
            <div className="flex items-center gap-[calc(var(--ui-section-gap)/2)] py-[var(--ui-section-py)] text-slate-400">
              <Loader2 className="size-[var(--ui-icon-size-sm)] animate-spin" />
              Loading supplier details…
            </div>
          ) : supplierDetail.company ? (
            <SupplierDetailContent
              party={
                {
                  id: supplierDetail.company.id,
                  name: supplierDetail.company.name,
                  legal_name: supplierDetail.company.legal_name,
                  address: supplierDetail.company.address,
                  notes: supplierDetail.company.notes,
                  is_active: supplierDetail.company.is_active,
                  roles: supplierDetail.company.roles ?? [],
                } satisfies SupplierPartyInfo
              }
              brands={supplierDetail.brands}
              contacts={supplierDetail.contacts}
              canManage={canManageCompanies}
              canViewPrices={canViewPrices}
              initialTab={supplierDetail.initialTab}
            />
          ) : (
            <p className="py-[var(--ui-section-py)] text-slate-400">
              Supplier details are unavailable.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <PartyDialog
        open={partyDialog.open}
        mode={partyDialog.mode}
        company={partyDialog.company}
        canManage={canManageCompanies}
        onOpenChange={(open) => setPartyDialog((cur) => ({ ...cur, open }))}
        onSaved={handleCompanySaved}
      />

      {/* Delete company */}
      <AlertDialog
        open={Boolean(pendingDeleteCompany)}
        onOpenChange={(o) => { if (!o && !deleting) setPendingDeleteCompany(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this party?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDeleteCompany?.name}</strong> will be deleted. Brands linked to it become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); void confirmDeleteCompany(); }}
              variant="destructive"
            >
              {deleting && <Loader2 className="size-[var(--ui-icon-size-sm)] animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardPageShell>
  );
}
