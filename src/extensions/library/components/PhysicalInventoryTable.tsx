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
  Box, 
  MapPin, 
  Pencil, 
  Trash2, 
  Loader2 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MaterialCatalogWithRelations } from "../types";
import { deleteMaterialAction } from "../actions/library-actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unwrapActionResult } from "@/lib/result";
import { useRouter } from "next/navigation";

interface PhysicalInventoryTableProps {
  materials: MaterialCatalogWithRelations[];
  onEdit: (material: MaterialCatalogWithRelations) => void;
}

type FlattenedSampleRow = {
  id: string;
  location_rak: string;
  container_box: string;
  notes: string;
  material: MaterialCatalogWithRelations;
};

export function PhysicalInventoryTable({ materials, onEdit }: PhysicalInventoryTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  // Flattened view for auditing
  const flattenedSamples = React.useMemo(() => {
    return materials.map(m => {
      // Prioritize top-level fields if filled, otherwise fallback to physical_samples
      if (m.catalog_rak_location || m.catalog_box_number) {
        return { 
          id: `flat-${m.id}`, 
          location_rak: m.catalog_rak_location || "-", 
          container_box: m.catalog_box_number || "-", 
          notes: m.physical_samples?.[0]?.notes || "-", 
          material: m 
        };
      }
      
      const sample = m.physical_samples?.[0];
      return {
        id: sample?.id || `no-sample-${m.id}`,
        location_rak: sample?.location_rak || "-",
        container_box: sample?.container_box || "-",
        notes: sample?.notes || "-",
        material: m
      };
    });
  }, [materials]);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this material?")) return;
    setDeletingId(id);
    try {
      unwrapActionResult(await deleteMaterialAction({ id }));
      toast.success("Material deleted successfully");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete material");
    } finally {
      setDeletingId(null);
    }
  }

  if (materials.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 font-inter text-sm">
        No physical samples in inventory.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-100 bg-white overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
            <TableHead className="font-inter font-semibold text-slate-900">Rak / Box</TableHead>
            <TableHead className="font-inter font-semibold text-slate-900">Material Info</TableHead>
            <TableHead className="font-inter font-semibold text-slate-900">Vendor</TableHead>
            <TableHead className="font-inter font-semibold text-slate-900">Notes</TableHead>
            <TableHead className="font-inter font-semibold text-slate-900 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flattenedSamples.map((row: FlattenedSampleRow) => (
            <TableRow key={row.id} className="hover:bg-slate-50/30 group h-12">
              <TableCell className="w-[200px]">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded font-bold font-inter">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    <span>Rak {row.location_rak}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100 px-2 py-1 rounded font-bold font-inter">
                    <Box className="h-3 w-3 text-slate-400" />
                    <span>Box {row.container_box}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <div className="font-lora font-medium text-slate-900 text-sm">
                    {row.material.catalog_sku}
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                    {row.material.catalog_category} {row.material.catalog_sub_category ? `// ${row.material.catalog_sub_category}` : ""}
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm font-medium text-slate-500 font-inter">
                 {row.material.vendor.brand_name}
              </TableCell>
              <TableCell className="text-xs text-slate-400 italic max-w-[200px] truncate">
                {row.notes}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(row.material)}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(row.material.id)}
                    disabled={deletingId === row.material.id}
                    className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                  >
                    {deletingId === row.material.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
