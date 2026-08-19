"use client";

import * as React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Button, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD, UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_BODY, UI_ENGINE_TYPE_META } from "@/ui_engine";
import { 
  Globe, 
  AtSign, 
  Phone, 
  MapPin, 
  Building2, 
  UserCircle,
  Pencil,
  Trash2,
  Loader2
} from "lucide-react";
import { LibraryVendor, BrandCategoryCoverage } from "../types";
import { BRAND_LINK_KIND_LABEL } from "@/components/shared/brand-links-editor";
import { deleteVendorAction } from "../actions/library-actions";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";

interface VendorTableProps {
  vendors: LibraryVendor[];
  onEdit: (vendor: LibraryVendor) => void;
  /** Resolved from the permission matrix; hides edit/remove for read-only roles. */
  canManage?: boolean;
  /**
   * Categories each brand carries. A brand is not bound to one — Taco supplies HPL
   * and SPC alike — so its coverage is worth showing on the brand row.
   */
  brandCoverage?: BrandCategoryCoverage;
  onRefresh?: () => void;
}

export function VendorTable({
  vendors,
  onEdit,
  canManage,
  brandCoverage = {},
  onRefresh,
}: VendorTableProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<LibraryVendor | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete.id);
    try {
      unwrapActionResult(await deleteVendorAction({ id: pendingDelete.id }));
      toast.success("Vendor deleted successfully");
      setPendingDelete(null);
      onRefresh?.();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete vendor");
    } finally {
      setDeletingId(null);
    }
  }

  if (vendors.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 font-sans text-sm">
        No vendors found.
      </div>
    );
  }

  return (
    <div className={cn("border bg-white overflow-x-auto shadow-sm", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
      <Table>
        <TableHeader>
          <TableRow className={cn("hover:bg-transparent h-12 border-b", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE)}>
            <TableHead className={cn("font-bold uppercase tracking-wider text-slate-400 pl-8", UI_ENGINE_TYPE_META)}>Brand</TableHead>
            <TableHead className={cn("font-bold uppercase tracking-wider text-slate-400", UI_ENGINE_TYPE_META)}>Company / Role</TableHead>
            <TableHead className={cn("font-bold uppercase tracking-wider text-slate-400", UI_ENGINE_TYPE_META)}>Contact</TableHead>
            <TableHead className={cn("font-bold uppercase tracking-wider text-slate-400 text-right pr-4", UI_ENGINE_TYPE_META)}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id} className={cn("group h-16 border-b transition-colors", UI_ENGINE_BORDER_SUBTLE)}>
              <TableCell className="font-serif font-medium text-slate-900 pl-8">
                <div className="flex flex-col gap-1">
                  <span>{vendor.name}</span>
                  {/* Which categories this brand actually carries. */}
                  {(brandCoverage[vendor.id]?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {brandCoverage[vendor.id].slice(0, 4).map((c) => (
                        <span
                          key={`${c.category}-${c.section}`}
                          title={`${c.count} item${c.count > 1 ? "s" : ""} · ${c.section}`}
                          className={cn(
                            "px-1.5 py-0.5 font-sans font-bold uppercase tracking-wider text-slate-500",
                            UI_ENGINE_BG_SUBTLE,
                            UI_ENGINE_RADIUS_CONTROL,
                            UI_ENGINE_TYPE_META
                          )}
                        >
                          {c.category}
                        </span>
                      ))}
                      {brandCoverage[vendor.id].length > 4 && (
                        <span className={cn("px-1 text-slate-400", UI_ENGINE_TYPE_META)}>
                          +{brandCoverage[vendor.id].length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <div className={cn("flex items-center gap-1.5 text-slate-700", UI_ENGINE_TYPE_BODY)}>
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <div className="flex flex-col">
                      <span>{vendor.owner?.legal_name || "-"}</span>
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-1.5 text-slate-400", UI_ENGINE_TYPE_META)}>
                    <UserCircle className="h-3 w-3" />
                    {vendor.scoped_contacts?.[0]
                      ? `${vendor.scoped_contacts[0].person_name} (${vendor.scoped_contacts[0].job_title})`
                      : "-"}
                    {vendor.scoped_contacts && vendor.scoped_contacts.length > 1 && (
                      <span className={cn("ml-1 px-1 text-slate-500", UI_ENGINE_BG_SUBTLE, UI_ENGINE_TYPE_META, UI_ENGINE_RADIUS_CONTROL)}>
                        +{vendor.scoped_contacts.length - 1} more
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {vendor.scoped_contacts?.[0]?.phone && (
                    <div className={cn("flex items-center gap-1.5 text-slate-600", UI_ENGINE_TYPE_BODY)}>
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {vendor.scoped_contacts[0].phone}
                    </div>
                  )}
                  {vendor.owner?.address && (
                    <div className={cn("flex items-center gap-1.5 text-slate-400", UI_ENGINE_TYPE_META)}>
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[200px]">{vendor.owner.address}</span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end items-center gap-1">
                  <div className={cn("flex gap-1 mr-2 border-r pr-2", UI_ENGINE_BORDER_SUBTLE)}>
                    {/* Every link the brand has, not just the two that used to
                        have a column of their own. */}
                    {(vendor.links ?? []).map((link) => {
                      const Icon = link.kind === "INSTAGRAM" ? AtSign : Globe;
                      return (
                        <a
                          key={link.id}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn("p-1.5 border hover:bg-white text-slate-400 hover:text-slate-900 transition-all font-sans", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}
                          title={link.label?.trim() || BRAND_LINK_KIND_LABEL[link.kind]}
                        >
                          <Icon className="h-4 w-4" />
                        </a>
                      );
                    })}
                  </div>
                  
                  {canManage && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(vendor)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPendingDelete(vendor)}
                        disabled={deletingId === vendor.id}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                      >
                        {deletingId === vendor.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `"${pendingDelete.name}" will be removed. This only succeeds if the vendor still has no products — move or remove its products first.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!deletingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={!!deletingId}
              className="bg-rose-600 hover:bg-rose-700"
            >
              {deletingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
