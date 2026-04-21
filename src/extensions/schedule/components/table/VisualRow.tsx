"use client";

import React from "react";
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

interface VisualRowProps {
  entry: any;
  onEdit?: (entry: any) => void;
  onDelete?: (id: string) => void;
  onUpdateLocation?: (entryId: string, location: string) => Promise<void>;
  onUpdateQty?: (entryId: string, qty: number) => Promise<void>;
  onAddAlternative?: () => void;
  section?: "MATERIAL" | "FIXTURE";
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
  section = "MATERIAL",
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

  const isFixture = section === "FIXTURE";

  return (
    <tr 
      ref={setNodeRef} 
      style={style} 
      onClick={onClick}
      className={cn(
        "group transition-all duration-300 cursor-default",
        isSelected ? "bg-slate-900/5 ring-1 ring-inset ring-slate-900/10" : "hover:bg-slate-50/50",
        isDragging && "bg-white shadow-2xl z-50 ring-1 ring-slate-200"
      )}
    >
      {/* Code & Drag */}
      <td className="px-6 py-5 align-top">
        <div className="flex items-center gap-3">
          <div 
            {...attributes} 
            {...listeners}
            className="p-1.5 -ml-2 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-900 rounded-lg transition-colors"
          >
            <GripVertical size={16} />
          </div>
          <Badge variant="outline" className="font-inter text-[10px] font-black tracking-[0.1em] uppercase px-2 py-0.5 border-slate-200 bg-white text-slate-900 shadow-sm">
            {entry.schedule_code}
          </Badge>
        </div>
      </td>

      {/* Main Spec Card */}
      <td className="px-6 py-5">
        <div className="flex items-start gap-6">
          <div
            className="relative flex-shrink-0 w-24 h-24 rounded-3xl overflow-hidden bg-slate-50 border border-slate-200/60 shadow-inner group/img cursor-zoom-in"
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

          <div className="flex-1 min-w-0 py-1">
            <h4 className="font-lora text-lg font-medium text-slate-900 truncate leading-tight">
              {snapshot?.catalog_product_name || "Untitled Specification"}
            </h4>
            <div className="flex items-center gap-2 mt-1.5 font-inter text-xs text-slate-400">
               <span className="font-bold text-slate-900">{snapshot?.catalog_brand || "No Brand"}</span>
               <div className="h-1 w-1 rounded-full bg-slate-200" />
               <span className="uppercase tracking-widest text-[10px] font-medium">{entry.schedule_category}</span>
            </div>
            
            {/* Extended Tags/Meta */}
            <div className="mt-3 flex flex-wrap gap-1.5">
               {snapshot?.specs?.catalog_color && (
                 <span className="px-2 py-0.5 rounded-full bg-slate-100/80 text-[9px] font-bold uppercase tracking-widest text-slate-500">
                   {snapshot.specs.catalog_color}
                 </span>
               )}
               {snapshot?.specs?.catalog_sku && (
                  <span className="px-2 py-0.5 rounded-full bg-slate-50 text-[9px] font-bold uppercase tracking-widest text-slate-400 border border-slate-100">
                    {snapshot.specs.catalog_sku}
                  </span>
                )}
            </div>

            {/* Alternatives Navigation */}
            <div className="mt-3 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
               {(hasMultipleOptions || activeOption?.is_final) && (
                 <div className="inline-flex items-center bg-white rounded-xl px-2 py-1.5 shadow-lg shadow-slate-100/50 border border-slate-100 group/nav">
                    <button
                      onClick={handlePrevOption}
                      disabled={activeOptionIndex === 0}
                      className="p-1 rounded-lg text-slate-300 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-0 transition-all"
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </button>
                    <div className="px-2 flex flex-col items-center min-w-[32px]">
                       <span className="text-[6px] font-black uppercase tracking-[0.15em] text-slate-300 leading-none">Opt</span>
                       <span className="font-inter text-xs font-black text-slate-900 leading-none -mt-0.5">
                         {activeOptionIndex + 1}
                       </span>
                    </div>
                    <button
                      onClick={handleNextOption}
                      disabled={activeOptionIndex === entry.options.length - 1}
                      className="p-1 rounded-lg text-slate-300 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-0 transition-all"
                    >
                      <ChevronRight className="h-3 w-3" />
                    </button>
                 </div>
               )}
               <button
                 onClick={(e) => { e.stopPropagation(); onAddAlternative?.(); }}
                 className="h-9 px-3 rounded-xl bg-slate-50 hover:bg-slate-900 hover:text-white text-slate-400 transition-all flex items-center gap-1.5 group/add"
               >
                 <Plus className="h-3 w-3 transition-transform group-hover/add:rotate-90" />
                 <span className="text-[9px] font-black uppercase tracking-widest">Alt</span>
               </button>
            </div>
          </div>
        </div>
      </td>

      {/* Location */}
      <td className="px-6 py-5 align-top">
        {editingLocation ? (
          <div className="flex flex-col gap-2" onClick={e => e.stopPropagation()}>
            <input
              ref={locationInputRef}
              value={locationValue}
              onChange={(e) => setLocationValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveLocation()}
              className="h-10 text-xs font-bold text-slate-900 bg-white border-2 border-slate-100 rounded-xl px-3 outline-none focus:border-slate-900 transition-all w-48"
              placeholder="Room/Area..."
            />
            <div className="flex gap-1 justify-end">
               <button onClick={handleSaveLocation} className="p-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors">
                 {isSavingLocation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
               </button>
               <button onClick={() => setEditingLocation(false)} className="p-2 bg-slate-100 text-slate-400 rounded-lg hover:bg-slate-200 transition-colors">
                 <X className="h-3.5 w-3.5" />
               </button>
            </div>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setEditingLocation(true); }}
            className="flex items-start gap-2.5 group/loc p-2 -ml-2 rounded-xl border border-transparent hover:border-slate-100 hover:bg-white transition-all text-left"
          >
            <div className="mt-0.5 p-1.5 rounded-lg bg-slate-50 text-slate-300 group-hover/loc:bg-slate-900 group-hover/loc:text-white transition-all">
              <MapPin size={12} className="transition-transform group-hover/loc:scale-110" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 group-hover/loc:text-slate-400 mb-1">Room / Location</span>
              <span className="text-xs font-bold text-slate-900 block truncate max-w-[140px]">
                {entry.schedule_location || <span className="text-slate-200 font-normal italic">Unset</span>}
              </span>
            </div>
          </button>
        )}
      </td>

      {/* Qty */}
      {isFixture && (
        <td className="px-6 py-5 align-top text-center">
            <button 
              onClick={(e) => { e.stopPropagation(); setEditingQty(true); }}
              className="inline-flex flex-col items-center group/qty p-2 rounded-xl hover:bg-white border border-transparent hover:border-slate-100 transition-all"
            >
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 mb-1">Quantity</span>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-slate-900 tracking-tighter">
                  {entry.schedule_qty ?? 0}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{entry.schedule_unit || "unit"}</span>
              </div>
            </button>
        </td>
      )}

      {/* Action Drawer */}
      <td className="px-6 py-5 align-top">
        <div className="flex flex-col items-end gap-1.5 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
           <button
             onClick={(e) => { e.stopPropagation(); onEdit?.(entry); }}
             className="h-9 w-9 rounded-xl flex items-center justify-center bg-white border border-slate-100 text-slate-400 hover:text-slate-900 hover:border-slate-300 shadow-sm transition-all"
           >
             <Edit3 size={14} />
           </button>
           <button
             onClick={(e) => { e.stopPropagation(); setSampleModalOpen(true); }}
             className="h-9 w-9 rounded-xl flex items-center justify-center bg-white border border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-100 shadow-sm transition-all"
           >
             <Package size={14} />
           </button>
           <button
             onClick={handleDelete}
             className="h-9 w-9 rounded-xl flex items-center justify-center bg-white border border-slate-100 text-slate-400 hover:text-red-500 hover:border-red-100 shadow-sm transition-all"
           >
             <Trash2 size={14} />
           </button>
        </div>
      </td>

      {/* Overlays */}
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
        productNameFallback={snapshot?.catalog_product_name || "Unspecified Material"}
        productCatalogId={activeOption?.product_catalog_id || undefined}
      />
    </tr>
  );
}
