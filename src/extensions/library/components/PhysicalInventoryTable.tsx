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
  Loader2,
  ArrowUpRight,
  MapPin, 
  Pencil, 
  Trash2, 
  ArrowDownLeft,
  MessageSquarePlus,
  Warehouse
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProductCatalogWithRelations } from "../types";
import { deleteProductAction, recordSampleMovementAction } from "../actions/library-actions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { unwrapActionResult } from "@/lib/result";
import { useRouter } from "next/navigation";
import { SampleAction } from "@/generated/prisma";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PhysicalInventoryTableProps {
  products: ProductCatalogWithRelations[];
  onEdit?: (product: ProductCatalogWithRelations) => void;
  userRole?: string;
}

type FlattenedSampleRow = {
  id: string;
  sampleId: string;
  rack_number: string;
  box_number: string;
  notes: string;
  product: ProductCatalogWithRelations;
};

export function PhysicalInventoryTable({ products, onEdit, userRole }: PhysicalInventoryTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [processingId, setProcessingId] = React.useState<string | null>(null);

  // Flattened view for auditing
  const flattenedSamples = React.useMemo(() => {
    return products.map(p => {
      const sample = p.physical_samples?.[0];
      return {
        id: `row-${p.id}`,
        sampleId: sample?.id || "",
        rack_number: sample?.rack_number || "-",
        box_number: sample?.box_number || "-",
        notes: sample?.notes || "-",
        product: p
      };
    });
  }, [products]);

  async function handleMovement(sampleId: string, action: SampleAction) {
    if (!sampleId) {
      toast.error("No physical sample record found for this item.");
      return;
    }

    const notes = window.prompt(`Add descriptive notes for this ${action.replace('_', ' ')} (optional):`);
    if (notes === null) return; // Cancelled

    setProcessingId(sampleId);
    try {
      unwrapActionResult(await recordSampleMovementAction({ sampleId, action, notes }));
      toast.success(`Inventory action recorded: ${action}`);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to record movement");
    } finally {
      setProcessingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to remove this product from catalog?")) return;
    setDeletingId(id);
    try {
      unwrapActionResult(await deleteProductAction({ id }));
      toast.success("Product removed successfullly");
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete product");
    } finally {
      setDeletingId(null);
    }
  }

  if (products.length === 0) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/cd158293-dca0-40ab-802e-0d83dd59ba8f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({runId:'pre-fix',hypothesisId:'H1',location:'src/extensions/library/components/PhysicalInventoryTable.tsx:109',message:'PhysicalInventoryTable empty state rendered',data:{productsCount:products.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion agent log
    return (
      <div className="py-24 text-center animate-in fade-in duration-700">
        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
          <Warehouse className="h-6 w-6 text-slate-200" />
        </div>
        <h3 className="font-lora text-lg text-slate-900 mb-1">Inventory Empty</h3>
        <p className="text-sm text-slate-400 font-inter font-medium tracking-tight">No physical samples currently tracked in system.</p>
      </div>
    );
  }

  const isAdmin = userRole === "ADMIN";

  return (
    <TooltipProvider delayDuration={0}>
      <div className="rounded-[2rem] border border-slate-100 bg-white overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 h-14">
              <TableHead className="font-inter font-black text-[10px] uppercase tracking-widest text-slate-400 pl-8 w-[180px]">Rak / Box</TableHead>
              <TableHead className="font-inter font-black text-[10px] uppercase tracking-widest text-slate-400">Product Specification</TableHead>
              <TableHead className="font-inter font-black text-[10px] uppercase tracking-widest text-slate-400">Brand Provider</TableHead>
              <TableHead className="font-inter font-black text-[10px] uppercase tracking-widest text-slate-400">Sample History</TableHead>
              <TableHead className="font-inter font-black text-[10px] uppercase tracking-widest text-slate-400 text-right pr-8">Audit Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flattenedSamples.map((row: any) => (
              <TableRow key={row.id} className="hover:bg-slate-50/30 group border-slate-50/50 h-[80px] transition-colors">
                <TableCell className="pl-8">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-1.5">
                       <span className="flex items-center gap-2 text-[10px] font-black text-slate-900 font-inter uppercase tracking-tight bg-slate-100/50 px-2.5 py-1 rounded-full w-fit">
                          <MapPin className="h-2.5 w-2.5 text-slate-400" /> Rak {row.rack_number}
                       </span>
                       <span className="flex items-center gap-2 text-[10px] font-black text-slate-900 font-inter uppercase tracking-tight bg-slate-100/50 px-2.5 py-1 rounded-full w-fit">
                          <Box className="h-2.5 w-2.5 text-slate-400" /> Box {row.box_number}
                       </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <div className="font-lora font-medium text-slate-900 text-base leading-tight">
                      {row.product.catalog_sku}
                    </div>
                    <div className="text-[10px] text-slate-400 font-inter font-bold uppercase tracking-widest">
                      {row.product.catalog_category} {row.product.catalog_sub_category ? `• ${row.product.catalog_sub_category}` : ""}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-inter font-bold text-xs text-slate-500 uppercase tracking-wider">
                   {row.product.vendor?.brand_name || row.product.catalog_brand || "Standard Source"}
                </TableCell>
                <TableCell>
                  <p className="text-[11px] text-slate-400 italic max-w-[200px] truncate leading-tight font-inter">
                    {row.notes !== "-" ? row.notes : "No recent activity notes recorded."}
                  </p>
                </TableCell>
                <TableCell className="text-right pr-8">
                  <div className="flex justify-end gap-2">
                    {/* Log Actions (Check-out / Check-in) */}
                    <div className="flex gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                       <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMovement(row.sampleId, SampleAction.CHECK_OUT)}
                              disabled={!row.sampleId || processingId === row.sampleId}
                              className="h-8 w-8 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50"
                            >
                               {processingId === row.sampleId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="font-inter text-[10px] font-bold uppercase">Log Check-out</p></TooltipContent>
                       </Tooltip>
                       <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMovement(row.sampleId, SampleAction.CHECK_IN)}
                              disabled={!row.sampleId || processingId === row.sampleId}
                              className="h-8 w-8 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50"
                            >
                               <ArrowDownLeft className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p className="font-inter text-[10px] font-bold uppercase">Log Return</p></TooltipContent>
                       </Tooltip>
                    </div>

                     {/* Standard Actions */}
                    <div className="flex gap-1 ml-4 border-l border-slate-100 pl-4 items-center">
                       {onEdit && (
                         <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(row.product)}
                          className="h-8 w-8 text-slate-300 hover:text-slate-900"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                       )}
                       {isAdmin && (
                         <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(row.product.id)}
                          disabled={deletingId === row.product.id}
                          className="h-8 w-8 text-slate-300 hover:text-rose-600"
                        >
                          {deletingId === row.product.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                       )}
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TooltipProvider>
  );
}
