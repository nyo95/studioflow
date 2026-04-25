"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { LibraryVendor } from "../types";
import { Button } from "@/components/ui/button";
import { deleteVendorAction } from "../actions/library-actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import {
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_BORDER_SUBTLE,
  UI_ENGINE_RADIUS_CARD,
  UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import { cn } from "@/lib/utils";

interface VendorTableProps {
  vendors: LibraryVendor[];
  onEdit: (vendor: LibraryVendor) => void;
}

export function VendorTable({ vendors, onEdit }: VendorTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this vendor? This will only work if the vendor has no items.")) return;
    setDeletingId(id);
    try {
      unwrapActionResult(await deleteVendorAction({ id }));
      toast.success("Vendor deleted successfully");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete vendor");
    } finally {
      setDeletingId(null);
    }
  }

  if (vendors.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 font-inter text-sm">
        No vendors found.
      </div>
    );
  }

  return (
    <div className={cn("border bg-white overflow-hidden shadow-sm", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
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
              <TableCell className="font-lora font-medium text-slate-900">
                {vendor.brand_name}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <div className={cn("flex items-center gap-1.5 text-slate-700", UI_ENGINE_TYPE_BODY)}>
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <div className="flex flex-col">
                      <span>{vendor.company_name || "-"}</span>
                      {vendor.company_pt && (
                        <span className={cn("text-slate-400 leading-tight", UI_ENGINE_TYPE_META)}>
                          PT: {vendor.company_pt}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={cn("flex items-center gap-1.5 text-slate-400", UI_ENGINE_TYPE_META)}>
                    <UserCircle className="h-3 w-3" />
                    {vendor.contacts?.[0] 
                      ? `${vendor.contacts[0].contact_person} (${vendor.contacts[0].contact_role})`
                      : "-"}
                    {vendor.contacts && vendor.contacts.length > 1 && (
                      <span className={cn("ml-1 px-1 text-slate-500", UI_ENGINE_BG_SUBTLE, UI_ENGINE_TYPE_META, UI_ENGINE_RADIUS_CONTROL)}>
                        +{vendor.contacts.length - 1} more
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {vendor.contacts?.[0]?.phone_number && (
                    <div className={cn("flex items-center gap-1.5 text-slate-600", UI_ENGINE_TYPE_BODY)}>
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {vendor.contacts[0].phone_number}
                    </div>
                  )}
                  {vendor.address && (
                    <div className={cn("flex items-center gap-1.5 text-slate-400", UI_ENGINE_TYPE_META)}>
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[200px]">{vendor.address}</span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end items-center gap-1">
                  <div className={cn("flex gap-1 mr-2 border-r pr-2", UI_ENGINE_BORDER_SUBTLE)}>
                    {vendor.website_url && (
                      <a
                        href={vendor.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all font-inter"
                        title="Website"
                      >
                        <Globe className="h-4 w-4" />
                      </a>
                    )}
                    {vendor.instagram_url && (
                      <a
                        href={vendor.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn("p-1.5 border hover:bg-white text-slate-400 hover:text-slate-900 transition-all font-inter", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_BG_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}
                        title="Instagram"
                      >
                        <AtSign className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  
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
                      onClick={() => handleDelete(vendor.id)}
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
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
