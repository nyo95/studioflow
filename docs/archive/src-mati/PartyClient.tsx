"use client";

import * as React from "react";
import {
  ArrowUpDown,
  Building2,
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
  DashboardPageShell,
  Input,
  PageHeader,
  SectionCard,
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
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import { deleteCompanyAction } from "../actions/company-actions";
import type { CompanyData } from "../types/company";
import { PartyDialog } from "./PartyDialog";

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------
type SortKey = "name" | "legal_name" | "brands";
type SortDir = "asc" | "desc";

function sortCompanies(
  rows: CompanyData[],
  key: SortKey,
  dir: SortDir
): CompanyData[] {
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (key === "brands") {
      cmp = (a._count?.brands ?? 0) - (b._count?.brands ?? 0);
    } else {
      cmp = (a[key] ?? "").localeCompare(b[key] ?? "", "id-ID");
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

function SortButton({
  label,
  sortKey,
  current,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: () => void;
}) {
  const active = current === sortKey;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors",
        active ? "text-slate-950" : "text-slate-400 hover:text-slate-600"
      )}
    >
      {label}
      <ArrowUpDown
        className={cn(
          "size-3 transition-transform",
          active && dir === "desc" && "rotate-180"
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// PartyClient
// ---------------------------------------------------------------------------
export function PartyClient({
  initialCompanies,
  canManage,
  /**
   * When rendered inside the merged Supplier page, the tabbed parent already
   * provides DashboardPageShell + PageHeader. Skip both here so the page does
   * not get a nested shell or a second title, and surface the create button
   * as a plain toolbar action instead.
   */
  embedded = false,
}: {
  initialCompanies: CompanyData[];
  canManage: boolean;
  embedded?: boolean;
}) {
  const router = useRouter();
  const [companies, setCompanies] = React.useState<CompanyData[]>(initialCompanies);
  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  const [dialog, setDialog] = React.useState<{
    open: boolean;
    mode: "CREATE" | "EDIT";
    company: CompanyData | null;
  }>({ open: false, mode: "CREATE", company: null });

  const [pendingDelete, setPendingDelete] = React.useState<CompanyData | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const refresh = () => router.refresh();

  // ---- filter + sort ----
  const visible = React.useMemo(() => {
    const q = query.trim().toLocaleLowerCase("id-ID");
    const filtered = q
      ? companies.filter((c) =>
          [c.name, c.legal_name, c.address]
            .filter(Boolean)
            .some((v) => v!.toLocaleLowerCase("id-ID").includes(q))
        )
      : companies;
    return sortCompanies(filtered, sortKey, sortDir);
  }, [companies, query, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // ---- optimistic update after save ----
  const handleSaved = (saved: CompanyData) => {
    setCompanies((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    refresh();
  };

  // ---- delete ----
  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      unwrapActionResult(await deleteCompanyAction({ id: pendingDelete.id }));
      toast.success("Party deleted");
      setCompanies((prev) => prev.filter((c) => c.id !== pendingDelete.id));
      setPendingDelete(null);
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not delete");
    } finally {
      setDeleting(false);
    }
  };

  const createButton = canManage ? (
    <Button
      onClick={() => setDialog({ open: true, mode: "CREATE", company: null })}
      className={cn(
        "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]",
        UI_ENGINE_RADIUS_ACTION
      )}
    >
      <Plus className="size-[var(--ui-icon-size-sm)]" />
      Add Party
    </Button>
  ) : undefined;

  const Shell = embedded ? React.Fragment : DashboardPageShell;

  return (
    <Shell>
      {embedded ? (
        createButton ? (
          <div className="mb-4 flex justify-end">{createButton}</div>
        ) : null
      ) : (
        <PageHeader
          eyebrow="Master Data"
          title="Parties"
          description="Parties that own one or more brands."
          action={createButton}
        />
      )}

      <SectionCard padding="none">
        {/* Toolbar */}
        <div className="flex items-center gap-3 border-b border-[var(--ui-border-subtle)] px-[var(--ui-section-px)] py-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search party name, legal name, or address…"
              className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)}
            />
          </div>
          <span className={cn("shrink-0 tabular-nums text-slate-400", UI_ENGINE_TYPE_META)}>
            {visible.length} perusahaan
          </span>
        </div>

        {/* Table */}
        <TableCard layout="auto">
          <TableCardHeader>
            <TableCardHead style={{ width: "30%" }}>
              <SortButton label="Party" sortKey="name" current={sortKey} dir={sortDir} onClick={() => toggleSort("name")} />
            </TableCardHead>
            <TableCardHead style={{ width: "28%" }}>
              <SortButton label="PT / CV" sortKey="legal_name" current={sortKey} dir={sortDir} onClick={() => toggleSort("legal_name")} />
            </TableCardHead>
            <TableCardHead style={{ width: "10%" }}>
              <SortButton label="Brand" sortKey="brands" current={sortKey} dir={sortDir} onClick={() => toggleSort("brands")} />
            </TableCardHead>
            <TableCardHead style={{ width: "24%" }}>Contacts</TableCardHead>
            <TableCardHead style={{ width: "8%" }} />
          </TableCardHeader>

          <TableCardBody>
            {visible.length === 0 ? (
              <TableCardRow>
                <TableCardCell colSpan={5}>
                  <div className="flex flex-col items-center gap-2 py-12 text-center">
                    <Building2 className="size-8 text-slate-300" />
                    <p className="text-sm text-slate-400">
                      {query ? "No parties match." : "No parties yet. Use Add Party to start."}
                    </p>
                  </div>
                </TableCardCell>
              </TableCardRow>
            ) : (
              visible.map((company) => {
                const firstContact = company.contacts?.[0];
                return (
                  <TableCardRow
                    key={company.id}
                    className="cursor-pointer hover:bg-[var(--ui-bg-subtle)] transition-colors"
                    onClick={() => setDialog({ open: true, mode: "EDIT", company })}
                  >
                    {/* Name */}
                    <TableCardCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-slate-950">{company.name}</span>
                        {company.links?.length ? (
                          <span className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                            {company.links.length} link
                          </span>
                        ) : null}
                      </div>
                    </TableCardCell>

                    {/* PT */}
                    <TableCardCell>
                      <span className="text-slate-600">
                        {company.legal_name || <span className="text-slate-300">—</span>}
                      </span>
                    </TableCardCell>

                    {/* Brand count */}
                    <TableCardCell>
                      <span className="tabular-nums text-slate-700">
                        {company._count?.brands ?? 0}
                      </span>
                    </TableCardCell>

                    {/* First contact */}
                    <TableCardCell>
                      {firstContact ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-700">{firstContact.contact_person}</span>
                          {firstContact.phone_number && (
                            <span className={cn("text-slate-400", UI_ENGINE_TYPE_META)}>
                              {firstContact.phone_number}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCardCell>

                    {/* Actions */}
                    <TableCardCell>
                      {canManage && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDialog({ open: true, mode: "EDIT", company });
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Delete"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingDelete(company);
                            }}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      )}
                    </TableCardCell>
                  </TableCardRow>
                );
              })
            )}
          </TableCardBody>
        </TableCard>
      </SectionCard>

      {/* Create / Edit dialog */}
      <PartyDialog
        open={dialog.open}
        mode={dialog.mode}
        company={dialog.company}
        canManage={canManage}
        onOpenChange={(open) => setDialog((prev) => ({ ...prev, open }))}
        onSaved={handleSaved}
      />

      {/* Delete confirmation */}
      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this party?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDelete?.name}</strong> akan dihapus. Pastikan tidak ada brand yang masih terhubung.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Shell>
  );
}
