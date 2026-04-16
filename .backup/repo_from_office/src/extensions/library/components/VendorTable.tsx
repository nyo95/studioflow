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
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";

interface VendorTableProps {
  vendors: LibraryVendor[];
  onEdit: (vendor: LibraryVendor) => void;
}

export function VendorTable({ vendors, onEdit }: VendorTableProps) {
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this vendor? This will only work if the vendor has no items.")) return;
    setDeletingId(id);
    try {
      unwrapActionResult(await deleteVendorAction({ id }));
      toast.success("Vendor deleted successfully");
      window.location.reload();
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
    <div className="rounded-md border border-slate-100 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
            <TableHead className="font-inter font-semibold text-slate-900">Brand</TableHead>
            <TableHead className="font-inter font-semibold text-slate-900">Company / Role</TableHead>
            <TableHead className="font-inter font-semibold text-slate-900">Contact</TableHead>
            <TableHead className="font-inter font-semibold text-slate-900 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vendors.map((vendor) => (
            <TableRow key={vendor.id} className="hover:bg-slate-50/30 group">
              <TableCell className="font-lora font-medium text-slate-900">
                {vendor.brand_name}
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-sm text-slate-700">
                    <Building2 className="h-3.5 w-3.5 text-slate-400" />
                    <div className="flex flex-col">
                      <span>{vendor.company_name || "-"}</span>
                      {vendor.company_pt && (
                        <span className="text-[10px] text-slate-400 leading-tight">
                          PT: {vendor.company_pt}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <UserCircle className="h-3 w-3" />
                    {vendor.contacts?.[0] 
                      ? `${vendor.contacts[0].contact_person} (${vendor.contacts[0].contact_role})`
                      : "-"}
                    {vendor.contacts && vendor.contacts.length > 1 && (
                      <span className="ml-1 text-[10px] bg-slate-100 px-1 rounded text-slate-500">
                        +{vendor.contacts.length - 1} more
                      </span>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  {vendor.contacts?.[0]?.phone_number && (
                    <div className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      {vendor.contacts[0].phone_number}
                    </div>
                  )}
                  {vendor.address && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate max-w-[200px]">{vendor.address}</span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end items-center gap-1">
                  <div className="flex gap-1 mr-2 border-r border-slate-100 pr-2">
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
                        className="p-1.5 rounded-md border border-slate-100 hover:bg-slate-50 text-slate-400 hover:text-slate-600 transition-all font-inter"
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
