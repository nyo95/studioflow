"use client";

import * as React from "react";
import { CheckCircle2, Package, Clock, XCircle, Plus, Sparkles } from "lucide-react";
import { ProjectScheduleOptionWithMaterial, ScheduleOptionSnapshot } from "../types";
import { approveScheduleOptionAction } from "@/actions/schedule-actions";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { ImageLightbox } from "@/components/ui/image-lightbox";

// UI Engine Schedule Option Tokens (Pillar 2) - design.md compliant
const UI_ENGINE_OPTION_FINAL_BADGE_CLASS = "absolute top-2 left-2 z-20 h-7 w-7 rounded-lg flex items-center justify-center font-serif text-xs font-black shadow-lg transition-all duration-500";
const UI_ENGINE_OPTION_FINAL_ACTIVE = "bg-slate-950 text-white scale-110";
const UI_ENGINE_OPTION_FINAL_INACTIVE = "bg-white/90 backdrop-blur-md text-slate-400 group-hover/opt:text-slate-900 group-hover/opt:scale-110 border border-slate-100";
const UI_ENGINE_OPTION_ICON_CLASS = "h-3 w-3 text-slate-900";
const UI_ENGINE_OPTION_PLUS_ICON_CLASS = "flex flex-col items-center gap-1.5 transition-colors group-hover/opt:text-slate-900 text-slate-300 p-2 pt-4";
const UI_ENGINE_OPTION_STATUS_ICON_CLASS = "h-4 w-4 text-slate-900 bg-white rounded-full shadow-sm";
const UI_ENGINE_OPTION_CLOCK_ICON_CLASS = "h-3.5 w-3.5 text-slate-300 bg-white rounded-full";
const UI_ENGINE_OPTION_LABEL_CLASS = "text-[7px] font-black uppercase text-slate-500 line-clamp-1 truncate w-full text-center px-1";

interface ScheduleOptionCardProps {
  option: ProjectScheduleOptionWithMaterial;
  entryId: string;
  onRefresh: () => void;
}

export function ScheduleOptionCard({ option, entryId, onRefresh }: ScheduleOptionCardProps) {
  const [previewImage, setPreviewImage] = React.useState<string | undefined>(undefined);
  const snapshot = option.data_snapshot as ScheduleOptionSnapshot | null | undefined;

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (option.is_final) return;

    try {
      unwrapActionResult(await approveScheduleOptionAction({ 
        optionId: option.id,
        entryId,
      }));
      toast.success(`Option ${option.option_label} has been approved`);
      onRefresh();
    } catch {
      toast.error("Failed to approve option");
    }
  };

  const getStatusStyle = () => {
    if (option.is_final) return "border-slate-950 ring-4 ring-slate-950/5 bg-white scale-[1.05] z-10 shadow-2xl";
    if (option.status === "NOT_USED") return "opacity-40 grayscale border-slate-100 bg-slate-50/50";
    if (option.status === "DRAFT") return "border-dashed border-slate-200 bg-slate-50/10";
    return "border-slate-100 bg-white hover:border-slate-400 shadow-sm";
  };

  return (
    <div 
      onClick={handleApprove}
      className={`relative w-24 h-24 rounded-2xl border-2 transition-all cursor-pointer group/opt overflow-hidden ${getStatusStyle()}`}
    >
      {/* Label Badge */}
      <div className={`${UI_ENGINE_OPTION_FINAL_BADGE_CLASS} ${option.is_final ? UI_ENGINE_OPTION_FINAL_ACTIVE : UI_ENGINE_OPTION_FINAL_INACTIVE}`}>
        {option.option_label}
      </div>

      {option.material_catalog_id && (
        <div 
          className="absolute top-2 right-6 z-20 h-4 w-4 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center shadow-lg transform transition-transform group-hover/opt:scale-110"
          title="Gold Standard Library Item"
        >
          <Sparkles className="h-2 w-2 text-white" />
        </div>
      )}

      {/* Sample Ready Indicator (Loose Coupling Bridge) */}
      {option.material_catalog?.material_requests?.some(r => r.status === 'RECEIVED') && (
        <div 
          className="absolute top-7 right-2 z-20 flex items-center gap-1 bg-emerald-500 text-white text-[7px] font-black px-1 py-0.5 rounded-full shadow-lg border-2 border-white animate-in zoom-in duration-500"
          title="Physical Sample Ready"
        >
          <CheckCircle2 className="h-2 w-2" />
          <span className="pr-0.5">READY</span>
        </div>
      )}

      {/* Content */}
      <div className="w-full h-full flex flex-col items-center justify-center">
        {snapshot?.image_url ? (
          <div className="relative w-full h-full group/img">
            <img 
              src={snapshot.image_url} 
              alt={option.option_label} 
              className="w-full h-full object-cover transition-transform group-hover/opt:scale-110"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(snapshot.image_url || undefined);
              }}
              className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 flex items-center justify-center transition-colors opacity-0 group-hover/img:opacity-100"
            >
               <div className="bg-white/90 backdrop-blur p-1.5 rounded-full shadow-lg transform scale-75 group-hover/img:scale-100 transition-transform">
                  <Plus className={UI_ENGINE_OPTION_ICON_CLASS} />
               </div>
            </button>
          </div>
        ) : (
          <div className={UI_ENGINE_OPTION_PLUS_ICON_CLASS}>
             <Package className="h-6 w-6" />
             <span className="text-[8px] font-black uppercase tracking-widest leading-none">
               {option.status}
             </span>
          </div>
        )}
      </div>

      {/* Status Indicators */}
      {option.is_final ? (
        <div className="absolute top-1 right-1 z-20">
           <CheckCircle2 className={UI_ENGINE_OPTION_STATUS_ICON_CLASS} />
        </div>
      ) : option.status === "DRAFT" ? (
        <div className="absolute top-1 right-1 z-20">
           <Clock className={UI_ENGINE_OPTION_CLOCK_ICON_CLASS} />
        </div>
      ) : option.status === "NOT_USED" ? (
        <div className="absolute top-1 right-1 z-20">
           <XCircle className="h-3.5 w-3.5 text-rose-300 bg-white rounded-full" />
        </div>
      ) : null}
      
      <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-white/95 to-transparent flex justify-center opacity-0 group-hover/opt:opacity-100 transition-opacity">
         <span className={UI_ENGINE_OPTION_LABEL_CLASS}>
           {snapshot?.name || snapshot?.specs?.product_type || "Empty Varian"}
         </span>
      </div>

      <ImageLightbox 
        src={previewImage || null} 
        onClose={() => setPreviewImage(undefined)} 
      />
    </div>
  );
}

