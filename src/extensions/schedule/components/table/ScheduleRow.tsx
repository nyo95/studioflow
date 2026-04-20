"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Edit3, Trash2, Image as ImageIcon, MapPin, Check, X, Loader2, ZoomIn, ChevronLeft, ChevronRight, Package, Plus, MoreHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScheduleSampleRequestModal } from "../ScheduleSampleRequestModal";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { deleteScheduleEntryAction, deleteScheduleOptionAction } from "@/actions/schedule-actions";
import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";

interface ScheduleRowProps {
  entry: any;
  onEdit?: (entry: any) => void;
  onDelete?: (id: string) => void;
  onUpdateLocation?: (entryId: string, location: string) => Promise<void>;
  onAddAlternative?: () => void;
  section?: "MATERIAL" | "FIXTURE";
}

export function ScheduleRow({ entry, onEdit, onDelete, onUpdateLocation, onAddAlternative, section = "MATERIAL" }: ScheduleRowProps) {
  const [activeOptionIndex, setActiveOptionIndex] = React.useState(() => {
    const finalIndex = entry.options.findIndex((o: any) => o.is_final);
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

  const isFixture = section === "FIXTURE";

  return (
    <tr className="group border-b border-slate-100 hover:bg-slate-50/60 transition-colors">
      {/* Code */}
      <td className="px-5 py-3">
        <Badge variant="outline" className="font-sans text-[10px] font-bold tracking-tighter uppercase px-1.5 py-0 border-slate-200 bg-slate-50 text-slate-500">
          {entry.schedule_code}
        </Badge>
      </td>

      {/* Product Details – with prominent image */}
      <td className="px-5 py-3">
        <div className="flex items-center gap-4">
          {/* Visual anchor: larger, elevated image */}
          <div
            className="relative flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white group/img cursor-pointer"
            onClick={() => snapshot?.catalog_image_url && setLightboxOpen(true)}
            title={snapshot?.catalog_image_url ? "Click to enlarge" : undefined}
          >
            {snapshot?.catalog_image_url ? (
              <img
                src={snapshot.catalog_image_url}
                alt={snapshot.catalog_product_name || ""}
                className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-slate-50 to-slate-100">
                <ImageIcon className="text-slate-300 w-5 h-5" />
                <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">No img</span>
              </div>
            )}
            {/* Zoom hint overlay */}
            {snapshot?.catalog_image_url && (
              <div className="absolute inset-0 bg-slate-900/0 group-hover/img:bg-slate-900/30 transition-colors duration-200 flex items-center justify-center">
                <ZoomIn className="text-white opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 w-5 h-5 drop-shadow" />
              </div>
            )}
            {/* Finalized indicator */}
            {activeOption?.is_final && (
              <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-400 shadow-sm ring-2 ring-white" />
            )}
          </div>

          <div className="min-w-0">
            <div className="font-serif text-sm font-semibold text-slate-900 leading-tight truncate max-w-[240px]">
              {snapshot?.catalog_product_name || "Unspecified Material"}
            </div>
            <div className="font-sans text-[11px] text-slate-400 mt-0.5 truncate max-w-[240px]">
              {snapshot?.catalog_brand ? (
                <span className="font-medium">{snapshot.catalog_brand}</span>
              ) : null}
              {snapshot?.catalog_brand && entry.schedule_category ? " · " : null}
              <span className="uppercase tracking-wide">{entry.schedule_category}</span>
            </div>
            {snapshot?.specs?.catalog_color && (
              <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-widest">
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
                  <span className="px-2 font-inter text-[10px] font-bold text-slate-700 tracking-wider">
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
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50/50 hover:bg-blue-100 text-blue-600 transition-colors border border-blue-100/50"
              >
                <Plus className="h-3 w-3" />
                <span className="font-inter text-[9px] font-bold uppercase tracking-wider">Add Alternative</span>
              </button>
            </div>
          </div>
        </div>
      </td>

      {/* Location – inline editable, tied to the code/entry */}
      <td className="px-5 py-3 min-w-[130px]">
        {editingLocation ? (
          <div className="flex items-center gap-1.5">
            <input
              ref={locationInputRef}
              value={locationValue}
              onChange={(e) => setLocationValue(e.target.value)}
              onKeyDown={handleLocationKeyDown}
              placeholder="e.g. Front wall"
              className="h-7 text-xs font-medium text-slate-900 bg-white border border-slate-300 rounded-lg px-2 flex-1 outline-none focus:ring-1 focus:ring-slate-900 w-24"
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
            className="group/loc flex items-center gap-1.5 text-left rounded-lg px-2 py-1 hover:bg-slate-100 transition-colors max-w-[150px]"
          >
            <MapPin size={10} className="text-slate-300 group-hover/loc:text-slate-500 flex-shrink-0 transition-colors" />
            <span className="font-sans text-[10px] font-medium text-slate-500 uppercase tracking-wider truncate group-hover/loc:text-slate-700 transition-colors">
              {entry.schedule_location || <span className="text-slate-300 italic normal-case">Add location...</span>}
            </span>
          </button>
        )}
      </td>

      {/* Qty (fixture only) */}
      {isFixture && (
        <td className="px-5 py-3 text-center">
          <span className="font-sans text-sm font-bold text-slate-700">
            {entry.schedule_qty ?? 0}
          </span>
          {entry.schedule_unit && (
            <span className="ml-1 font-sans text-[10px] text-slate-400">{entry.schedule_unit}</span>
          )}
        </td>
      )}

      {/* Actions */}
      <td className="px-5 py-3 text-right">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-end gap-1">
          <button
            onClick={() => onEdit?.(entry)}
            title="Edit specification"
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={handleDelete}
            title="Delete alternative or entry"
            className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSampleModalOpen(true);
            }}
            title="Request sample"
            className="p-1.5 hover:bg-blue-50 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
          >
            <Package size={13} />
          </button>
        </div>
      </td>

      {/* Image Lightbox */}
      {snapshot?.catalog_image_url && (
        <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
          <DialogContent
            className="p-0 border-none bg-transparent shadow-none max-w-[90vw] w-auto"
            onKeyDown={(e) => e.key === "Escape" && setLightboxOpen(false)}
            showCloseButton={false}
          >
            <DialogTitle className="sr-only">
              {snapshot.catalog_product_name || "Material image"}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Full size image preview of {snapshot.catalog_product_name || "the material"}
            </DialogDescription>
            <div className="relative group/lbox">
              <img
                src={snapshot.catalog_image_url}
                alt={snapshot.catalog_product_name || "Material image"}
                className="max-h-[85vh] max-w-[85vw] w-auto h-auto rounded-2xl shadow-2xl object-contain"
              />
              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 px-6 py-4 bg-gradient-to-t from-black/60 to-transparent rounded-b-2xl opacity-0 group-hover/lbox:opacity-100 transition-opacity">
                <p className="font-serif text-white text-base font-semibold truncate">
                  {snapshot.catalog_product_name || "Unnamed Material"}
                </p>
                {snapshot.catalog_brand && (
                  <p className="font-sans text-white/70 text-xs mt-0.5">{snapshot.catalog_brand}</p>
                )}
              </div>
              {/* Close button */}
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white transition-colors"
              >
                <X size={14} />
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
        materialNameFallback={snapshot?.catalog_product_name || "Unspecified Material"}
        materialCatalogId={activeOption?.library_item_id || undefined}
      />
    </tr>
  );
}
