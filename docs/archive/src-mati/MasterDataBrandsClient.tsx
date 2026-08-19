"use client";

/**
 * MASTER DATA — Brand (Vendor) table.
 *
 * UX improvements applied 2026-08-06:
 *  - Optimistic local state update after save (setara PartyClient).
 *  - Compact 4-kolom: Brand | Supplier (Company.name + legal_name stacked) |
 *    Link (icon-only) | Contacts (first + "+N more").
 *  - Inline Company picker di cell "—" — klik langsung assign tanpa buka dialog
 *    (backfill 392 brand ke Company tanpa 5 langkah per baris).
 */

import * as React from "react";
import {
  Loader2,
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
  Input,
  DashboardPageShell,
  PageHeader,
  TableCard,
  TableCardBody,
  TableCardCell,
  TableCardHead,
  TableCardHeader,
  TableCardRow,
} from "@/ui_engine";
import { UI_ENGINE_RADIUS_ACTION, UI_ENGINE_RADIUS_CONTROL } from "@/ui_engine/tokens";
import {
  deleteVendorAction,
  updateVendorAction,
} from "@/extensions/library/actions/library-actions";
import type {
  LibraryAccess,
  LibraryVendor,
} from "@/extensions/library/types";
import type { CompanyData } from "../types/company";
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import { MasterDataBrandDialog } from "./MasterDataBrandDialog";
import { PartyPicker } from "./PartyPicker";
import { LinkIcons, ContactCell } from "./SupplierSharedCells";

// ---------------------------------------------------------------------------
// InlineCompanyCell — klik "— assign —" → searchable picker → auto-save
// ---------------------------------------------------------------------------
function InlineCompanyCell({
  vendor,
  companies,
  onSaved,
}: {
  vendor: LibraryVendor;
  companies: CompanyData[];
  onSaved: (updated: LibraryVendor) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const assign = async (companyId: string | null) => {
    if (!companyId) return; // "— None —" di picker tidak memerlukan save ulang
    setSaving(true);
    try {
      const updated = unwrapActionResult(
        await updateVendorAction({
          id: vendor.id,
          data: {
            brand_name: vendor.name,
            legal_name: vendor.owner?.legal_name ?? "",
            address: vendor.owner?.address ?? "",
            notes: vendor.notes ?? "",
            company_id: companyId,
            links: (vendor.links ?? []).map((l) => ({
              id: l.id, kind: l.kind, url: l.url, label: l.label ?? "",
            })),
            contacts: (vendor.scoped_contacts ?? []).map((c) => ({
              id: c.id,
              contact_person: c.person_name ?? "",
              contact_role: c.job_title ?? "",
              phone_number: c.phone ?? "",
              email: c.email ?? "",
            })),
          },
        })
      );
      onSaved(updated);
      setOpen(false);
      toast.success("Party assigned");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        title="Click to assign a party"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        disabled={saving}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-200 px-2 py-1 text-xs text-slate-400 transition-colors hover:border-slate-400 hover:text-slate-600 disabled:cursor-wait disabled:opacity-50"
      >
        {saving ? <Loader2 className="size-3 animate-spin" /> : null}
        — assign —
      </button>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-52"
      onClick={(e) => e.stopPropagation()}
    >
      <PartyPicker
        companies={companies}
        value={null}
        onSelect={(id) => { void assign(id); }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// MasterDataBrandsClient
// ---------------------------------------------------------------------------
export function MasterDataBrandsClient({
  vendors: initialVendors,
  access,
  companies = [],
  embedded = false,
}: {
  vendors: LibraryVendor[];
  access: LibraryAccess;
  companies?: CompanyData[];
  embedded?: boolean;
}) {
  const router = useRouter();

  // Local state untuk optimistic update (setara PartyClient)
  const [vendors, setVendors] = React.useState<LibraryVendor[]>(initialVendors);

  const [query, setQuery] = React.useState("");
  const [dialog, setDialog] = React.useState<{
    open: boolean;
    mode: "CREATE" | "EDIT";
    vendor: LibraryVendor | null;
  }>({ open: false, mode: "CREATE", vendor: null });
  const [pendingDelete, setPendingDelete] = React.useState<LibraryVendor | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const visibleVendors = React.useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    if (!normalized) return vendors;
    return vendors.filter((v) =>
      [v.name, v.owner?.legal_name, v.owner?.name]
        .filter(Boolean)
        .some((val) => val?.toLocaleLowerCase("id-ID").includes(normalized))
    );
  }, [query, vendors]);

  // Optimistic update setelah dialog save atau inline assign
  const handleSaved = (saved: LibraryVendor) => {
    setVendors((prev) => {
      const idx = prev.findIndex((v) => v.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    router.refresh();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      unwrapActionResult(await deleteVendorAction({ id: pendingDelete.id }));
      toast.success("Brand deleted");
      setVendors((prev) => prev.filter((v) => v.id !== pendingDelete.id));
      setPendingDelete(null);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Brand could not be deleted");
    } finally {
      setDeleting(false);
    }
  };

  const createButton = access.canManageVendors ? (
    <Button
      type="button"
      onClick={() => setDialog({ open: true, mode: "CREATE", vendor: null })}
      className={cn(
        "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
        UI_ENGINE_RADIUS_ACTION
      )}
    >
      <Plus className="size-[var(--ui-icon-size-sm)]" />
      Add Brand
    </Button>
  ) : undefined;

  const Shell = embedded ? React.Fragment : DashboardPageShell;

  return (
    <Shell>
      {embedded ? (
        createButton ? <div className="mb-4 flex justify-end">{createButton}</div> : null
      ) : (
        <PageHeader
          eyebrow="Master Data"
          title="Brand"
          description="Brands that supply materials. Linked to a Party as the trading entity."
          action={createButton}
        />
      )}

      <div className="relative mb-6 max-w-[42rem]">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-[var(--ui-icon-size-sm)] -translate-y-1/2 text-slate-400"
        />
        <Input
          aria-label="Search brand or party"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search brand or party…"
          className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)}
        />
      </div>

      <TableCard>
        <TableCardHeader>
          <TableCardHead>Brand</TableCardHead>
          <TableCardHead>Supplier</TableCardHead>
          <TableCardHead>Link</TableCardHead>
          <TableCardHead>Contacts</TableCardHead>
          {access.canManageVendors ? <TableCardHead align="right">Actions</TableCardHead> : null}
        </TableCardHeader>
        <TableCardBody>
          {visibleVendors.map((vendor) => (
            <TableCardRow
              key={vendor.id}
              className="cursor-pointer"
              onClick={() => setDialog({ open: true, mode: "EDIT", vendor })}
            >
              {/* Brand */}
              <TableCardCell className="font-serif font-semibold text-slate-950">
                {vendor.name}
              </TableCardCell>

              {/* Supplier — Company.name + legal_name stacked, atau inline picker */}
              <TableCardCell>
                {vendor.owner_party_id ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-slate-800">{vendor.owner?.name}</span>
                    {vendor.owner?.legal_name ? (
                      <span className="text-xs text-slate-400">{vendor.owner?.legal_name}</span>
                    ) : null}
                  </div>
                ) : access.canManageVendors ? (
                  <InlineCompanyCell
                    vendor={vendor}
                    companies={companies}
                    onSaved={handleSaved}
                  />
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </TableCardCell>

              {/* Link — icon only */}
              <TableCardCell>
                <LinkIcons links={vendor.links ?? []} />
              </TableCardCell>

              {/* Contacts — first + N more */}
              <TableCardCell>
                <ContactCell contacts={vendor.scoped_contacts ?? []} />
              </TableCardCell>

              {/* Actions */}
              {access.canManageVendors ? (
                <TableCardCell align="right">
                  <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setDialog({ open: true, mode: "EDIT", vendor })}
                      className={UI_ENGINE_RADIUS_ACTION}
                    >
                      <Pencil aria-label="Edit brand" className="size-[var(--ui-icon-size-sm)]" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setPendingDelete(vendor)}
                      className={cn("text-[var(--ui-change-before)]", UI_ENGINE_RADIUS_ACTION)}
                    >
                      <Trash2 aria-label="Delete brand" className="size-[var(--ui-icon-size-sm)]" />
                    </Button>
                  </div>
                </TableCardCell>
              ) : null}
            </TableCardRow>
          ))}
        </TableCardBody>
      </TableCard>

      {visibleVendors.length === 0 ? (
        <div className="p-10 text-center font-sans text-sm text-slate-400">
          {query
            ? "No brands match."
            : "No brands yet. Use Add Brand to start."}
        </div>
      ) : null}

      <MasterDataBrandDialog
        open={dialog.open}
        mode={dialog.mode}
        vendor={dialog.vendor}
        canManage={access.canManageVendors}
        companies={companies}
        onOpenChange={(open) => setDialog((cur) => ({ ...cur, open }))}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => { if (!open && !deleting) setPendingDelete(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this brand?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> hanya dapat dihapus bila tidak lagi mempunyai produk aktif.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); void confirmDelete(); }}
              className="bg-[var(--ui-change-before)] text-white"
            >
              {deleting ? <Loader2 className="size-[var(--ui-icon-size-sm)] animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}
