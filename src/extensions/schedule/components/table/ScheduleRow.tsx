"use client";

import React from "react";
import { ProductType } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { Edit3, Trash2, Image as ImageIcon, MapPin, Check, X, Loader2, ZoomIn, ChevronLeft, ChevronRight, Package, Plus, MoreHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VisualAsset } from "@/components/ui/visual-asset";
import { ScheduleSampleRequestModal } from "../ScheduleSampleRequestModal";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { deleteScheduleEntryAction, deleteScheduleOptionAction } from "@/extensions/schedule/actions/schedule-actions";
import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectScheduleEntryWithRelations } from "../../types";
import { 
  UI_ENGINE_RADIUS_CONTROL,
  UI_ENGINE_RADIUS_CARD,
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_RADIUS_IMAGE
} from "@/ui_engine/tokens/layout";
import {
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_META,
  UI_ENGINE_TYPE_TITLE
} from "@/ui_engine/tokens/typography";
import {
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_BORDER_SUBTLE
} from "@/ui_engine/tokens/colors";


interface ScheduleRowProps {
  entry: ProjectScheduleEntryWithRelations;
  onEdit?: (entry: ProjectScheduleEntryWithRelations) => void;
  onDelete?: (id: string) => void;
  onUpdateLocation?: (entryId: string, location: string) => Promise<void>;
  onUpdateQty?: (entryId: string, qty: number) => Promise<void>;
  onAddAlternative?: () => void;
  section?: ProductType;
}

export function ScheduleRow({ entry, onEdit, onDelete, onUpdateLocation, onUpdateQty, onAddAlternative, section = ProductType.material }: ScheduleRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto",
    position: isDragging ? "relative" as const : "static" as const,
  };

  const [activeOptionIndex, setActiveOptionIndex] = React.useState(() => {

    const finalIndex = entry.options.findIndex((o) => o.is_final);
    return finalIndex >= 0 ? finalIndex : 0;
  });

  const activeOption = entry.options[activeOptionIndex] || entry.options[0];
  const snapshot = activeOption?.data_snapshot as unknown as ScheduleSnapshot | null;
  const hasMultipleOptions = entry.options.length > 1;

  const handleNextOption = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeOptionIndex < entry.options.length - 1) setActiveOptionIndex(activeOptionIndex + 1);
  };
  const handlePrevOption = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeOptionIndex > 0) setActiveOptionIndex(activeOptionIndex - 1);
  };

  const [sampleModalOpen, setSampleModalOpen] = React.useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (entry.options.length > 1) {
        // Delete only the active alternative option
        unwrapActionResult(await deleteScheduleOptionAction({
          projectId: entry.project_id,
          optionId: activeOption?.id || ''
        }));
        toast.success("Deleted alternative");
      } else {
        // Only one option – delete the whole entry
        if (!window.confirm("Are you sure you want to delete this item?")) return;
        unwrapActionResult(await deleteScheduleEntryAction({
          projectId: entry.project_id,
          entryId: entry.id
        }));
        toast.success(`Deleted ${entry.schedule_code}`);
      }
      // Call the parent onDelete to refresh the list
      onDelete?.(entry.id);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  // Inline location edit state
  const [editingLocation, setEditingLocation] = React.useState(false);
  const [locationValue, setLocationValue] = React.useState(entry.schedule_location || "");
  const [isSavingLocation, setIsSavingLocation] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const locationInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingLocation) locationInputRef.current?.focus();
  }, [editingLocation]);

  const handleSaveLocation = async () => {
    if (!onUpdateLocation) { setEditingLocation(false); return; }
    setIsSavingLocation(true);
    try {
      await onUpdateLocation(entry.id, locationValue);
    } finally {
      setIsSavingLocation(false);
      setEditingLocation(false);
    }
  };

  const handleLocationKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveLocation();
    if (e.key === "Escape") { setLocationValue(entry.schedule_location || ""); setEditingLocation(false); }
  };

  // Inline Qty edit state
  const [editingQty, setEditingQty] = React.useState(false);
  const [qtyValue, setQtyValue] = React.useState(String(entry.schedule_qty ?? 0));
  const [isSavingQty, setIsSavingQty] = React.useState(false);
  const qtyInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editingQty) qtyInputRef.current?.focus();
  }, [editingQty]);

  const handleSaveQty = async () => {
    if (!onUpdateQty) { setEditingQty(false); return; }
    const num = parseFloat(qtyValue);
    if (isNaN(num)) {
      toast.error("Invalid quantity");
      setQtyValue(String(entry.schedule_qty ?? 0));
      setEditingQty(false);
      return;
    }
    setIsSavingQty(true);
    try {
      await onUpdateQty(entry.id, num);
    } finally {
      setIsSavingQty(false);
      setEditingQty(false);
    }
  };

  const handleQtyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSaveQty();
    if (e.key === "Escape") { setQtyValue(String(entry.schedule_qty ?? 0)); setEditingQty(false); }
  };

  const isFixture = section === ProductType.fixture;

  return (
    <tr 
      ref={setNodeRef} 
      style={style}
      className={cn(
        "group border-b border-slate-100 hover:bg-slate-50/60 transition-colors",
        isDragging && "bg-slate-50 shadow-sm"
      )}
    >
      {/* Drag Handle & Code */}
      <td className="px-5 py-2">
        <div className="flex items-center gap-2">
          <div 
            {...attributes} 
            {...listeners}
            className={cn("p-1 -ml-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition-colors", UI_ENGINE_RADIUS_CONTROL)}
          >
            <GripVertical size={14} />
          </div>
          <Badge variant="outline" className="font-sans text-[10px] font-bold tracking-tighter uppercase px-1.5 py-0 border-slate-200 bg-slate-50 text-slate-500">
            {entry.schedule_code}
          </Badge>
        </div>
      </td>

      {/* Product Details – with prominent image */}
      <td className="px-5 py-2">
        <div className="flex items-center gap-4">
          <div 
            className={cn("w-14 h-14 bg-white border border-slate-200 overflow-hidden shrink-0 group/img relative cursor-zoom-in", UI_ENGINE_RADIUS_IMAGE)}
            onClick={() => { if (activeOption?.data_snapshot) setLightboxOpen(true); }}
          >
            <VisualAsset 
              src={snapshot?.catalog_image_url} 
              alt={snapshot?.catalog_product_name || ""} 
              iconSize={20}
              className="transition-transform duration-700 group-hover/img:scale-110"
            />
            <div className="absolute inset-0 bg-slate-900/0 group-hover/img:bg-slate-900/10 transition-colors flex items-center justify-center">
              <ZoomIn className="text-white opacity-0 group-hover/img:opacity-100 scale-90 group-hover/img:scale-100 transition-all duration-300 w-4 h-4" />
            </div>
            {/* Finalized indicator */}
            {activeOption?.is_final && (
              <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-400 shadow-sm ring-2 ring-white" />
            )}
          </div>

          <div className="min-w-0">
            <div className={cn("font-serif text-sm font-semibold text-slate-900 leading-tight truncate max-w-[240px]")}>
              {snapshot?.catalog_product_name || "Unspecified Product"}
            </div>
            <div className={cn("font-sans text-[11px] font-medium uppercase tracking-widest text-slate-400 mt-0.5 truncate max-w-[240px]", UI_ENGINE_TYPE_META)}>
              {snapshot?.catalog_brand ? (
                <span>{snapshot.catalog_brand}</span>
              ) : null}
              {snapshot?.catalog_brand && entry.schedule_category ? " · " : null}
              <span>{entry.schedule_category}</span>
            </div>
            {snapshot?.specs?.catalog_color && (
              <div className={cn("mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-widest", UI_ENGINE_RADIUS_CONTROL)}>
                {snapshot.specs.catalog_color}
              </div>
            )}
            
            {/* Option C Pill Navigation */}
            <div className="mt-2.5 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
              {(hasMultipleOptions || activeOption?.is_final) ? (
                <div className="inline-flex items-center bg-slate-100/80 rounded-full p-0.5 shadow-sm border border-slate-200/50">
                  <button
                    onClick={handlePrevOption}
                    disabled={activeOptionIndex === 0}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <span className={cn("px-2 text-[10px] font-bold text-slate-700 tracking-wider", UI_ENGINE_TYPE_META)}>
                    Option {activeOptionIndex + 1}
                    {activeOption?.is_final && <span className="text-emerald-600 ml-1">(Approved)</span>}
                  </span>
                  <button
                    onClick={handleNextOption}
                    disabled={activeOptionIndex === entry.options.length - 1}
                    className="p-1 rounded-full text-slate-400 hover:text-slate-900 hover:bg-white disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              ) : null}

              {/* Add Alternative Trigger */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddAlternative?.();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50/50 hover:bg-slate-100 text-slate-900 transition-colors border border-slate-200/50"
              >
                <Plus className="h-3 w-3" />
                <span className="font-sans text-[9px] font-bold uppercase tracking-wider">Add Alternative</span>
              </button>
            </div>
          </div>
        </div>
      </td>

      {/* Location – inline editable, tied to the code/entry */}
      <td className="px-5 py-2 min-w-[130px]">
        {editingLocation ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={locationInputRef}
              value={locationValue}
              onChange={(e) => setLocationValue(e.target.value)}
              onKeyDown={handleLocationKeyDown}
              placeholder="e.g. Front wall"
              className={cn("h-7 text-xs font-medium text-slate-900 bg-white border border-slate-300 px-2 flex-1 outline-none focus:ring-1 focus:ring-slate-900 w-24", UI_ENGINE_RADIUS_CONTROL)}
            />
            {isSavingLocation ? (
              <Loader2 size={12} className="animate-spin text-slate-400 flex-shrink-0" />
            ) : (
              <>
                <button onClick={handleSaveLocation} className="p-0.5 hover:bg-emerald-50 rounded text-emerald-500"><Check size={12} /></button>
                <button onClick={() => { setLocationValue(entry.schedule_location || ""); setEditingLocation(false); }} className="p-0.5 hover:bg-red-50 rounded text-red-400"><X size={12} /></button>
              </>
            )}
          </div>
        ) : (
          <button
            onClick={() => { setLocationValue(entry.schedule_location || ""); setEditingLocation(true); }}
            className={cn("group/loc flex items-center gap-1.5 text-left px-2 py-1 hover:bg-slate-100 transition-colors max-w-[150px]", UI_ENGINE_RADIUS_CONTROL)}
          >
            <MapPin size={10} className="text-slate-300 group-hover/loc:text-slate-500 flex-shrink-0 transition-colors" />
            <span className={cn("text-[10px] font-medium text-slate-500 uppercase tracking-wider truncate group-hover/loc:text-slate-700 transition-colors", UI_ENGINE_TYPE_META)}>
              {entry.schedule_location || <span className="text-slate-300 italic normal-case">Add location...</span>}
            </span>
          </button>
        )}
      </td>

      {/* Qty (fixture only) */}
      {isFixture && (
        <td className="px-5 py-2 text-center">
          {editingQty ? (
            <div className="flex items-center justify-center gap-1">
              <input
                ref={qtyInputRef}
                type="number"
                step="any"
                value={qtyValue}
                onChange={(e) => setQtyValue(e.target.value)}
                onKeyDown={handleQtyKeyDown}
                className={cn("h-7 w-16 text-xs font-bold text-center text-slate-900 bg-white border border-slate-300 outline-none focus:ring-1 focus:ring-slate-900", UI_ENGINE_RADIUS_CONTROL)}
              />
              {isSavingQty ? (
                <Loader2 size={12} className="animate-spin text-slate-400" />
              ) : (
                <div className="flex flex-col gap-0.5">
                  <button onClick={handleSaveQty} className="p-0.5 hover:bg-emerald-50 rounded text-emerald-500"><Check size={10} /></button>
                  <button onClick={() => { setQtyValue(String(entry.schedule_qty ?? 0)); setEditingQty(false); }} className="p-0.5 hover:bg-red-50 rounded text-red-400"><X size={10} /></button>
                </div>
              )}
            </div>
          ) : (
            <button 
              onClick={() => { setQtyValue(String(entry.schedule_qty ?? 0)); setEditingQty(true); }}
              className={cn("group/qty px-3 py-1 hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5", UI_ENGINE_RADIUS_CONTROL)}
            >
              <span className="font-sans text-sm font-bold text-slate-700 group-hover/qty:text-slate-900 transition-colors">
                {entry.schedule_qty ?? 0}
              </span>
              {entry.schedule_unit && (
                <span className="font-sans text-[10px] text-slate-400 group-hover/qty:text-slate-500 transition-colors">{entry.schedule_unit}</span>
              )}
            </button>
          )}
        </td>
      )}

      {/* Actions */}
      <td className="px-5 py-2 text-right">
        <div className="flex items-center justify-end gap-2">
          {/* Sample Request - Persistent visibility if product linked */}
          {activeOption && (() => {
            const latestRequest = activeOption?.product_catalog?.product_requests?.[0];
            const hasActiveRequest = latestRequest && latestRequest.status !== "CANCELLED";
            
            return (
              <div className="flex flex-row items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSampleModalOpen(true);
                  }}
                  title="Request sample"
                  className={cn(
                    "p-1.5 transition-colors shadow-sm",
                    UI_ENGINE_RADIUS_CONTROL,
                    hasActiveRequest
                      ? latestRequest.status === "RECEIVED"
                        ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                        : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                      : "bg-slate-50 text-slate-900 hover:bg-slate-100"
                  )}
                >
                  <Package size={13} strokeWidth={2.5} />
                </button>
                {latestRequest && (
                  <span className={cn(
                    "text-[10px] font-black uppercase tracking-widest px-1.5 py-0.5 whitespace-nowrap",
                    UI_ENGINE_RADIUS_CONTROL,
                    latestRequest.status === "RECEIVED" 
                      ? "bg-emerald-50 text-emerald-600"
                      : latestRequest.status === "CANCELLED" || latestRequest.status === "UNAVAILABLE"
                      ? "bg-rose-50 text-rose-500"
                      : "bg-amber-50 text-amber-600"
                  )}>
                    {latestRequest.status === "RECEIVED" ? "✓ Diterima" 
                     : latestRequest.status === "ORDERED" ? "Dipesan"
                     : latestRequest.status === "SHIPPED" ? "Dikirim"
                     : latestRequest.status === "UNAVAILABLE" ? "N/A"
                     : "Diminta"}
                  </span>
                )}
              </div>
            );
          })()}

          {/* Destructive/Edit Actions - Hover only */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
            <button
              onClick={() => onEdit?.(entry)}
              title="Edit specification"
              className={cn("p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors", UI_ENGINE_RADIUS_CONTROL)}
            >
              <Edit3 size={13} />
            </button>
            <button
              onClick={handleDelete}
              title="Delete alternative or entry"
              className={cn("p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors", UI_ENGINE_RADIUS_CONTROL)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </td>

      {/* Image Lightbox */}
      {snapshot?.catalog_image_url && (
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className={cn("p-0 border-none bg-transparent shadow-none max-w-[90vw] w-auto overflow-visible", UI_ENGINE_RADIUS_CARD)}>
             <div className="relative">
                <div className={cn("max-h-[85vh] shadow-2xl border-4 border-white/20 overflow-hidden", UI_ENGINE_RADIUS_CARD)} style={{ borderRadius: "2rem" }}>
                  <VisualAsset 
                    src={snapshot?.catalog_image_url} 
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  onClick={() => setLightboxOpen(false)}
                  className="absolute -top-4 -right-4 h-12 w-12 rounded-full bg-white text-slate-900 shadow-2xl flex items-center justify-center hover:scale-110 transition-transform z-[100]"
                >
                  <X size={20} strokeWidth={3} />
                </button>
             </div>
          </DialogContent>
        </Dialog>
      )}
      <ScheduleSampleRequestModal
        isOpen={sampleModalOpen}
        onOpenChange={setSampleModalOpen}
        projectId={entry.project_id}
        scheduleEntryId={entry.id}
        scheduleOptionId={activeOption?.id}
        productNameFallback={snapshot?.catalog_product_name || "Unspecified Product"}
        productCatalogId={activeOption?.product_catalog_id || undefined}
      />
    </tr>
  );
}
