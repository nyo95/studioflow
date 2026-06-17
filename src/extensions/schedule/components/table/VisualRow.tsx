"use client";

import React from "react";
import { ProductType } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { 
  Edit3, Trash2, Image as ImageIcon, MapPin, Check, X, Loader2, ZoomIn, 
  ChevronLeft, ChevronRight, GripVertical, Plus, Package, CheckCircle2
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisualAsset } from "@/components/ui/visual-asset";
import { ScheduleSampleRequestModal } from "../ScheduleSampleRequestModal";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { deleteScheduleEntryAction, deleteScheduleOptionAction } from "@/extensions/schedule/actions/schedule-actions";
import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { 
  UI_ENGINE_RADIUS_CONTROL, 
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_RADIUS_CARD,
  UI_ENGINE_RADIUS_IMAGE
} from "@/ui_engine/tokens/layout";
import {
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_META,
  UI_ENGINE_TYPE_TITLE
} from "@/ui_engine/tokens/typography";
import {
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_BORDER_SUBTLE,
  
} from "@/ui_engine/tokens/colors";

import type { ProjectScheduleEntryWithRelations } from "../../types";
import { getEffectiveTitle, isPlaceholder } from "../../lib/display-utils";

interface VisualRowProps {
  entry: ProjectScheduleEntryWithRelations;
  onEdit?: (entry: ProjectScheduleEntryWithRelations) => void;
  onDelete?: (id: string) => void;
  onUpdateLocation?: (entryId: string, location: string) => Promise<void>;
  onUpdateQty?: (entryId: string, qty: number) => Promise<void>;
  onAddAlternative?: () => void;
  section?: ProductType;
  isSelected?: boolean;
  isInspected?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}

export function VisualRow({ 
  entry, 
  onEdit, 
  onDelete, 
  onUpdateLocation, 
  onAddAlternative, 
  section = ProductType.material,
  isSelected,
  isInspected,
  onClick
}: VisualRowProps) {
  const router = useRouter();
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

  // Keep activeOptionIndex in sync with entry props (e.g. after approval refresh)
  React.useEffect(() => {
    const finalIndex = entry.options.findIndex((o) => o.is_final);
    if (finalIndex >= 0 && finalIndex !== activeOptionIndex) {
      setActiveOptionIndex(finalIndex);
    }
  }, [entry.id, entry.options, activeOptionIndex]);

  const activeOption = entry.options[activeOptionIndex] || entry.options[0];
  const snapshot = activeOption?.data_snapshot as unknown as ScheduleSnapshot | null;
  const hasMultipleOptions = entry.options.length > 1;

  const effectiveTitle = getEffectiveTitle(snapshot);
  const primaryMissing = isPlaceholder(snapshot?.catalog_product_name) && isPlaceholder(snapshot?.specs?.catalog_sku);


  const [sampleModalOpen, setSampleModalOpen] = React.useState(false);
  const [editingLocation, setEditingLocation] = React.useState(false);
  const [locationValue, setLocationValue] = React.useState(entry.schedule_location || "");
  const [isSavingLocation, setIsSavingLocation] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const locationInputRef = React.useRef<HTMLInputElement>(null);


  const handleNextOption = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeOptionIndex < entry.options.length - 1) setActiveOptionIndex(activeOptionIndex + 1);
  };
  
  const handlePrevOption = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (activeOptionIndex > 0) setActiveOptionIndex(activeOptionIndex - 1);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (entry.options.length > 1) {
        unwrapActionResult(await deleteScheduleOptionAction({
          projectId: entry.project_id,
          optionId: activeOption?.id || ''
        }));
        toast.success("Deleted alternative");
      } else {
        if (!window.confirm("Are you sure you want to delete this item?")) return;
        unwrapActionResult(await deleteScheduleEntryAction({
          projectId: entry.project_id,
          entryId: entry.id
        }));
        toast.success(`Deleted ${entry.schedule_code}`);
      }
      onDelete?.(entry.id);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  const handleSaveLocation = async () => {
    if (!onUpdateLocation) { setEditingLocation(false); return; }
    setIsSavingLocation(true);
    try {
      await onUpdateLocation(entry.id, locationValue);
    } finally {
      setIsSavingLocation(false);
      setEditingLocation(false);
      router.refresh();
    }
  };


  const isFixture = section === ProductType.fixture;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      onClick={onClick}
      data-schedule-row="true"
      className={cn(
        "group relative grid grid-cols-12 gap-4 p-2.5 items-center transition-all duration-150 border-b border-slate-100/70",
        isSelected || isInspected
          ? "bg-indigo-50/30 border-l-4 border-l-indigo-500 pl-1 z-10" 
          : "bg-transparent hover:bg-slate-50/50 border-l-4 border-l-transparent",
        isDragging && "opacity-50 scale-102 z-50 shadow-lg ring-1 ring-indigo-100 bg-white"
      )}
    >
      {/* 1. Left Block: Drag, Thumbnail, Code (col-span-3) */}
      <div className="col-span-3 flex items-center gap-4 min-w-0">
        {/* Drag Handle */}
        <div 
          {...attributes} 
          {...listeners}
          className={cn(
            "p-1 transition-colors cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-900 hover:bg-slate-100 shrink-0",
            UI_ENGINE_RADIUS_CONTROL
          )}
        >
          <GripVertical size={16} />
        </div>

        {/* Thumbnail (w-12 h-12) */}
        <div 
          className={cn("w-12 h-12 bg-white border border-slate-200 overflow-hidden group/img relative cursor-zoom-in shrink-0", UI_ENGINE_RADIUS_IMAGE)}
          onClick={(e) => { e.stopPropagation(); if (snapshot?.catalog_image_url) setLightboxOpen(true); }}
        >
          <VisualAsset 
            src={snapshot?.catalog_image_url} 
            alt={snapshot?.catalog_product_name || ""} 
            iconSize={18}
            className="transition-transform duration-700 group-hover/img:scale-110"
          />
          <div className="absolute inset-0 bg-slate-900/0 group-hover/img:bg-slate-900/20 transition-all flex items-center justify-center">
            <ZoomIn className="text-white opacity-0 group-hover/img:opacity-100 scale-90 group-hover/img:scale-100 transition-all duration-300 w-3 h-3" />
          </div>
          {activeOption?.is_final && (
            <div className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-lg ring-1 ring-white" />
          )}
        </div>

        {/* Code Badge */}
        <span 
          className={cn(
            "font-sans text-[10px] font-black tracking-[0.1em] uppercase px-2 py-0.5 w-20 shrink-0 text-center justify-center rounded-[var(--ui-radius-control)] transition-colors",
            isSelected || isInspected ? "bg-indigo-100/50 text-indigo-700" : "bg-slate-100 text-slate-700"
          )}
        >
          {entry.schedule_code}
        </span>
      </div>

      {/* 2. Specification / Brand (col-span-3) */}
      <div className="col-span-3 flex flex-col min-w-0 pr-2 py-0.5">
        <h4 className="text-[13px] font-semibold truncate leading-normal tracking-wide font-serif text-slate-900">
          {effectiveTitle}
        </h4>
        <span className="text-[10px] font-medium uppercase tracking-widest text-slate-400 mt-0.5 truncate font-sans">
          {snapshot?.catalog_brand || "No Brand"}
        </span>
      </div>

      {/* 3. Status Badge (col-span-1) */}
      <div className="col-span-1 flex items-center justify-center gap-1.5 shrink-0">
        <div 
          className={cn(
            "w-1.5 h-1.5 rounded-full shrink-0",
            activeOption?.status === "APPROVED" ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.3)]" :
            activeOption?.status === "NOT_USED" ? "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.3)]" :
            "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.3)]"
          )}
        />
        <span 
          className={cn(
            "font-black text-[9px] uppercase tracking-widest leading-none whitespace-nowrap font-sans",
            activeOption?.status === "APPROVED" ? "text-emerald-700" :
            activeOption?.status === "NOT_USED" ? "text-rose-600" :
            "text-amber-700"
          )}
        >
          {activeOption?.status || "DRAFT"}
        </span>
      </div>

      {/* 4. Location & Qty (col-span-2) */}
      <div className="col-span-2 flex items-center gap-4 min-w-0">
        {/* Location - Clean text with map icon, no background box */}
        <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
          {editingLocation ? (
            <div className="flex items-center gap-1">
              <input
                ref={locationInputRef}
                value={locationValue}
                onChange={(e) => setLocationValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveLocation()}
                className={cn("h-8 text-xs font-bold text-slate-900 bg-white border border-slate-200 px-2 outline-none focus:ring-1 focus:ring-slate-900 transition-all w-full", UI_ENGINE_RADIUS_CONTROL)}
                placeholder="Loc..."
                autoFocus
              />
              <button onClick={handleSaveLocation} className={cn("p-1.5 bg-slate-900 text-white shadow-md flex items-center justify-center transition-all hover:scale-105 shrink-0", UI_ENGINE_RADIUS_CONTROL)}>
                {isSavingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingLocation(true)}
              className="flex items-center gap-1.5 group/loc p-0.5 transition-all text-left w-full hover:bg-slate-50 rounded"
            >
              <MapPin size={11} className="text-slate-400 group-hover/loc:text-slate-900 transition-colors shrink-0" />
              <span className="text-[11px] font-medium truncate text-slate-700">
                {entry.schedule_location || <span className="opacity-30 italic font-normal text-slate-400">Global</span>}
              </span>
            </button>
          )}
        </div>

        {/* Qty - Simple number, no background card */}
        {isFixture && (
          <div className="flex items-baseline gap-0.5 shrink-0 leading-none">
            <span className="text-sm font-bold tracking-tighter text-slate-900">
              {entry.schedule_qty ?? 0}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {entry.schedule_unit || "u"}
            </span>
          </div>
        )}
      </div>

      {/* 5. Alternatives / Option Switcher (col-span-2) */}
      <div className="col-span-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <div className={cn(
          "inline-flex items-center gap-1 p-0.5 bg-slate-50 border border-slate-200/60 shadow-xs",
          UI_ENGINE_RADIUS_CONTROL
        )}>
          {entry.options.length > 1 && (
            <>
              <button
                onClick={handlePrevOption}
                disabled={activeOptionIndex === 0}
                className={cn(
                  "p-1 transition-all disabled:opacity-20",
                  activeOptionIndex > 0 ? "text-slate-900 hover:bg-white hover:shadow-xs" : "text-slate-300",
                  UI_ENGINE_RADIUS_ACTION
                )}
              >
                <ChevronLeft size={12} />
              </button>
              <div className="px-1 flex flex-col items-center min-w-[28px]">
                 <span className="font-sans text-[10px] font-bold text-slate-900 tabular-nums leading-none">
                   {activeOptionIndex + 1}/{entry.options.length}
                 </span>
              </div>
              <button
                onClick={handleNextOption}
                disabled={activeOptionIndex === entry.options.length - 1}
                className={cn(
                  "p-1 transition-all disabled:opacity-20",
                  activeOptionIndex < entry.options.length - 1 ? "text-slate-900 hover:bg-white hover:shadow-xs" : "text-slate-300",
                  UI_ENGINE_RADIUS_ACTION
                )}
              >
                <ChevronRight size={12} />
              </button>
              <div className="w-px h-3 bg-slate-200 mx-0.5" />
            </>
          )}

          {/* Approve Button (Only for non-final options) */}
          {activeOption && !activeOption.is_final && (
            <button
              onClick={async () => {
                const toastId = toast.loading(`Approving ${activeOption.option_label}...`);
                try {
                  const { approveScheduleOptionAction } = await import("@/extensions/schedule/actions/schedule-actions");
                  unwrapActionResult(await approveScheduleOptionAction({ 
                    optionId: activeOption.id,
                    entryId: entry.id
                  }));
                  toast.success(`Option ${activeOption.option_label} approved!`, { id: toastId });
                  router.refresh();
                } catch (err: any) {
                  toast.error(err.message || "Failed to approve", { id: toastId });
                }
              }}
              title="Approve this option"
              className={cn(
                "flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all group/approve",
                UI_ENGINE_RADIUS_ACTION
              )}
            >
              <CheckCircle2 size={10} strokeWidth={3} className="transition-transform group-hover/approve:scale-110" />
              <span className="text-[8px] font-black uppercase tracking-widest">Approve</span>
            </button>
          )}

          <button
            onClick={() => onAddAlternative?.()}
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 text-slate-500 hover:text-slate-900 transition-all group/add",
              UI_ENGINE_RADIUS_ACTION,
              "hover:bg-white hover:shadow-xs"
            )}
          >
            <Plus size={12} className="transition-transform group-hover/add:rotate-90" />
            <span className="text-[8px] font-black uppercase tracking-widest">Add Alt</span>
          </button>
        </div>
      </div>

      {/* 6. Actions (col-span-1) */}
      <div className="col-span-1 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
        {activeOption && (() => {
          const latestRequest = 
            activeOption?.product_requests?.[0] ||
            activeOption?.product_catalog?.product_requests?.[0];
          const hasActiveRequest = latestRequest && latestRequest.status !== "UNAVAILABLE";

          return (
            <div className="flex flex-row items-center gap-1 shrink-0">
              <button
                onClick={() => setSampleModalOpen(true)}
                title="Request sample"
                className={cn(
                  "h-7 w-7 flex items-center justify-center transition-all shadow-xs",
                  UI_ENGINE_RADIUS_CONTROL,
                  hasActiveRequest
                    ? latestRequest.status === "RECEIVED"
                      ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                      : "bg-amber-50 text-amber-600 hover:bg-amber-100"
                    : "bg-slate-50 text-slate-900 hover:bg-slate-100"
                )}
              >
                <Package size={12} strokeWidth={2.5} />
              </button>
              {latestRequest && (
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-widest px-1 py-0.5 whitespace-nowrap",
                  UI_ENGINE_RADIUS_CONTROL,
                  latestRequest.status === "RECEIVED"
                    ? "bg-emerald-50 text-emerald-600"
                    : latestRequest.status === "UNAVAILABLE"
                    ? "bg-rose-50 text-rose-500"
                    : "bg-amber-50 text-amber-600"
                )}>
                  {latestRequest.status === "RECEIVED" ? "✓"
                   : latestRequest.status === "IN_PROGRESS" ? "P"
                   : latestRequest.status === "UNAVAILABLE" ? "N/A"
                   : "R"}
                </span>
              )}
            </div>
          );
        })()}

        {/* Edit/Delete Buttons (Visible on hover, selected, or inspected) */}
        <div 
          className={cn(
            "flex items-center gap-0.5 transition-all duration-150 shrink-0",
            isSelected || isInspected
              ? "opacity-100 translate-x-0" 
              : "opacity-0 group-hover:opacity-100 translate-x-1 group-hover:translate-x-0"
          )}
        >
           <button
             onClick={() => onEdit?.(entry)}
             className={cn(
               "h-7 w-7 flex items-center justify-center transition-all duration-100 hover:bg-slate-100 text-slate-400 hover:text-slate-600",
               UI_ENGINE_RADIUS_CONTROL
             )}
           >
             <Edit3 size={12} />
           </button>
           <button
             onClick={handleDelete}
             className={cn(
               "h-7 w-7 flex items-center justify-center transition-all duration-100 hover:bg-red-50 text-slate-400 hover:text-red-500",
               UI_ENGINE_RADIUS_CONTROL
             )}
           >
             <Trash2 size={12} />
           </button>
        </div>
      </div>

      {/* Lightbox & Sample Request Modals */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className={cn("p-0 border-none bg-transparent shadow-none max-w-[90vw] w-auto overflow-visible", UI_ENGINE_RADIUS_CARD)}>
             <DialogTitle className="sr-only">Image Preview</DialogTitle>
             <DialogDescription className="sr-only">Large preview of the product image.</DialogDescription>
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

      <ScheduleSampleRequestModal
        isOpen={sampleModalOpen}
        onOpenChange={setSampleModalOpen}
        projectId={entry.project_id}
        scheduleEntryId={entry.id}
        scheduleOptionId={activeOption?.id}
        productNameFallback={snapshot?.catalog_product_name || "Reserved Slot"}
        productCatalogId={activeOption?.product_catalog_id || undefined}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
