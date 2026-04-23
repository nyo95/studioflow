"use client";

import React from "react";
import { ProductType } from "@/generated/prisma";
import { Badge } from "@/components/ui/badge";
import { 
  Edit3, Trash2, Image as ImageIcon, MapPin, Check, X, Loader2, ZoomIn, 
  ChevronLeft, ChevronRight, Package, GripVertical, MoreHorizontal, Plus
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScheduleSampleRequestModal } from "../ScheduleSampleRequestModal";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { deleteScheduleEntryAction, deleteScheduleOptionAction } from "@/actions/schedule-actions";
import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { UI_ENGINE_RADIUS_CARD, UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_RADIUS_ACTION } from "@/ui_engine";
import type { ProjectScheduleEntryWithRelations } from "../../types";

interface VisualRowProps {
  entry: ProjectScheduleEntryWithRelations;
  onEdit?: (entry: ProjectScheduleEntryWithRelations) => void;
  onDelete?: (id: string) => void;
  onUpdateLocation?: (entryId: string, location: string) => Promise<void>;
  onUpdateQty?: (entryId: string, qty: number) => Promise<void>;
  onAddAlternative?: () => void;
  section?: ProductType;
  isSelected?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}

export function VisualRow({ 
  entry, 
  onEdit, 
  onDelete, 
  onUpdateLocation, 
  onUpdateQty, 
  onAddAlternative, 
  section = ProductType.material,
  isSelected,
  onClick
}: VisualRowProps) {
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
    const finalIndex = entry.options.findIndex((o: any) => o.is_final);
    return finalIndex >= 0 ? finalIndex : 0;
  });

  const activeOption = entry.options[activeOptionIndex] || entry.options[0];
  const snapshot = activeOption?.data_snapshot as unknown as ScheduleSnapshot | null;
  const hasMultipleOptions = entry.options.length > 1;

  const [sampleModalOpen, setSampleModalOpen] = React.useState(false);
  const [editingLocation, setEditingLocation] = React.useState(false);
  const [locationValue, setLocationValue] = React.useState(entry.schedule_location || "");
  const [isSavingLocation, setIsSavingLocation] = React.useState(false);
  const [lightboxOpen, setLightboxOpen] = React.useState(false);
  const locationInputRef = React.useRef<HTMLInputElement>(null);

  const [editingQty, setEditingQty] = React.useState(false);
  const [qtyValue, setQtyValue] = React.useState(String(entry.schedule_qty ?? 0));
  const [isSavingQty, setIsSavingQty] = React.useState(false);
  const qtyInputRef = React.useRef<HTMLInputElement>(null);

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
    }
  };

  const handleSaveQty = async () => {
    if (!onUpdateQty) { setEditingQty(false); return; }
    const num = parseFloat(qtyValue);
    if (isNaN(num)) {
      toast.error("Invalid quantity");
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

  const isFixture = section === ProductType.fixture;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      onClick={onClick}
      className={cn(
        "group relative flex items-center gap-6 p-2 border transition-all duration-300",
        UI_ENGINE_RADIUS_CONTROL,
        isSelected 
          ? "bg-slate-50 border-slate-900 ring-1 ring-slate-900 shadow-xl z-10 scale-[1.01]" 
          : "bg-white/80 backdrop-blur-md border-slate-200/60 hover:border-slate-300 shadow-sm hover:shadow-md",
        isDragging && "opacity-50 scale-105 z-50 shadow-2xl ring-2 ring-slate-900"
      )}
    >
      {/* 1. Code & Drag Handle */}
      <div className="flex items-center gap-3 w-32 flex-shrink-0">
        <div 
          {...attributes} 
          {...listeners}
          className={cn(
            "p-2 rounded-lg transition-colors cursor-grab active:cursor-grabbing",
            isSelected ? "text-white/40 hover:text-white" : "text-slate-300 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <GripVertical size={18} />
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "font-inter text-[10px] font-black tracking-[0.1em] uppercase px-2.5 py-1 transition-colors",
            isSelected ? "border-white/20 bg-white/10 text-white" : "border-slate-200 bg-slate-50 text-slate-900 shadow-sm"
          )}
        >
          {entry.schedule_code}
        </Badge>
      </div>

      {/* 2. Product Visual & Main Specs */}
      <div className="flex-1 flex items-center gap-4 min-w-0">
        <div 
          className={cn("w-20 h-20 bg-white border border-slate-200 overflow-hidden group/img relative cursor-zoom-in", UI_ENGINE_RADIUS_ACTION)}
          onClick={(e) => { e.stopPropagation(); snapshot?.catalog_image_url && setLightboxOpen(true); }}
        >
          {snapshot?.catalog_image_url ? (
            <img
              src={snapshot.catalog_image_url}
              alt={snapshot.catalog_product_name || ""}
              className="w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2">
              <ImageIcon className="text-slate-200 w-8 h-8" />
              <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">No Image</span>
            </div>
          )}
          <div className="absolute inset-0 bg-slate-900/0 group-hover/img:bg-slate-900/20 transition-all flex items-center justify-center">
            <ZoomIn className="text-white opacity-0 group-hover/img:opacity-100 scale-90 group-hover/img:scale-100 transition-all duration-300 w-6 h-6" />
          </div>
          {activeOption?.is_final && (
            <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-emerald-500 shadow-lg ring-4 ring-white" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={cn(
            "font-serif text-sm font-semibold truncate transition-colors leading-tight",
            isSelected ? "text-slate-900" : "text-slate-900"
          )}>
            {snapshot?.catalog_product_name || "Unspecified Product"}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
             <span className={cn("font-sans text-[11px]", isSelected ? "text-slate-600" : "text-slate-500")}>
               {snapshot?.catalog_brand || "No Brand"}
             </span>
             <div className={cn("h-1 w-1 rounded-full", isSelected ? "bg-slate-300" : "bg-slate-200")} />
             <span className={cn("font-sans text-[10px] font-medium uppercase tracking-widest opacity-60", isSelected ? "text-slate-900" : "text-slate-400")}>
               {entry.schedule_category}
             </span>
          </div>
          
          <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
             {(hasMultipleOptions || activeOption?.is_final) && (
               <div className={cn(
                 "inline-flex items-center rounded-lg px-2 py-1 shadow-lg border transition-all",
                 isSelected ? "bg-white/10 border-white/10 shadow-black/10" : "bg-white border-slate-100 shadow-slate-100/50"
               )}>
                  <button
                    onClick={handlePrevOption}
                    disabled={activeOptionIndex === 0}
                    className={cn(
                      "p-1 rounded-lg transition-all",
                      isSelected ? "text-white/40 hover:text-white" : "text-slate-300 hover:text-slate-900"
                    )}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <div className="px-2 flex flex-col items-center min-w-[32px]">
                     <span className={cn("text-[6px] font-black uppercase tracking-[0.15em] leading-none", isSelected ? "text-slate-400" : "text-slate-300")}>Opt</span>
                     <span className={cn("font-inter text-xs font-black leading-none -mt-0.5", isSelected ? "text-slate-900" : "text-slate-900")}>
                       {activeOptionIndex + 1}
                     </span>
                  </div>
                  <button
                    onClick={handleNextOption}
                    disabled={activeOptionIndex === entry.options.length - 1}
                    className={cn(
                      "p-1 rounded-lg transition-all",
                      isSelected ? "text-white/40 hover:text-white" : "text-slate-300 hover:text-slate-900"
                    )}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
               </div>
             )}
             <button
               onClick={(e) => { e.stopPropagation(); onAddAlternative?.(); }}
               className={cn(
                 "h-7 px-3 rounded-md transition-all flex items-center gap-1.5 group/add",
                 isSelected ? "bg-white/10 text-white/60 hover:text-white" : "bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white"
               )}
             >
               <Plus className="h-3 w-3 transition-transform group-hover/add:rotate-90" />
               <span className="text-[10px] font-black uppercase tracking-widest">Alt</span>
             </button>
          </div>
        </div>
      </div>

      {/* 3. Metadata & Actions (Location, Qty, Menu) */}
      <div className="flex items-center gap-8 pl-6 border-l border-slate-100 transition-colors">
        {/* Location */}
        <div className="w-40">
          {editingLocation ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <input
                ref={locationInputRef}
                value={locationValue}
                onChange={(e) => setLocationValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveLocation()}
                className={cn("h-9 text-xs font-bold text-slate-900 bg-white border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-900 transition-all w-full", UI_ENGINE_RADIUS_CONTROL)}
                placeholder="Loc..."
                autoFocus
              />
              <button onClick={handleSaveLocation} className="p-2 bg-slate-900 text-white rounded-xl">
                {isSavingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              </button>
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); setEditingLocation(true); }}
              className="flex items-start gap-2.5 group/loc p-1.5 rounded-lg transition-all text-left"
            >
              <div className={cn(
                "mt-0.5 p-1.5 rounded-lg transition-all",
                isSelected ? "bg-white/10 text-white" : "bg-slate-50 text-slate-300 group-hover/loc:bg-slate-900 group-hover/loc:text-white"
              )}>
                <MapPin size={12} />
              </div>
              <div className="flex flex-col">
                <span className={cn("text-[8px] font-black uppercase tracking-widest mb-0.5", isSelected ? "text-white/40" : "text-slate-300")}>Location</span>
                <span className={cn("text-xs font-bold truncate max-w-[120px]", isSelected ? "text-white" : "text-slate-900")}>
                  {entry.schedule_location || <span className="opacity-30 italic font-medium">Global</span>}
                </span>
              </div>
            </button>
          )}
        </div>

        {/* Qty */}
        {isFixture && (
          <div className="w-24 flex flex-col items-center">
            <span className={cn("text-[8px] font-black uppercase tracking-widest mb-0.5", isSelected ? "text-white/40" : "text-slate-300")}>Qty</span>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-xl font-black tracking-tighter", isSelected ? "text-white" : "text-slate-900")}>
                {entry.schedule_qty ?? 0}
              </span>
              <span className={cn("text-[9px] font-bold uppercase tracking-widest opacity-60", isSelected ? "text-white" : "text-slate-400")}>
                {entry.schedule_unit || "unit"}
              </span>
            </div>
          </div>
        )}

        {/* Actions Menu */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
           <button
             onClick={(e) => { e.stopPropagation(); onEdit?.(entry); }}
             className={cn(
               "h-8 w-8 rounded-md flex items-center justify-center transition-all",
               isSelected ? "bg-white/10 hover:bg-white text-white hover:text-slate-900" : "hover:bg-slate-100 text-slate-400 hover:text-slate-600"
             )}
           >
             <Edit3 size={14} />
           </button>
           <button
             onClick={handleDelete}
             className={cn(
               "h-8 w-8 rounded-md flex items-center justify-center transition-all",
               isSelected ? "bg-white/10 hover:bg-red-500 text-white" : "hover:bg-red-50 text-slate-400 hover:text-red-500"
             )}
           >
             <Trash2 size={14} />
           </button>
        </div>
      </div>

      {/* Lightbox & Sample Request Modals */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent className="p-0 border-none bg-transparent shadow-none max-w-[90vw] w-auto overflow-visible rounded-3xl">
             <div className="relative">
                <img
                  src={snapshot?.catalog_image_url || ""}
                  className="max-h-[85vh] rounded-[2rem] shadow-2xl border-4 border-white/20"
                  alt="Full size preview"
                />
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
      />
    </div>
  );
}
