"use client";

import * as React from "react";
import { CheckCircle2, Package, Clock, XCircle, Plus, Sparkles } from "lucide-react";
import { ProjectScheduleOptionWithProduct, ScheduleOptionSnapshot } from "../types";
import { getEffectiveTitle } from "../lib/display-utils";
import { approveScheduleOptionAction } from "@/actions/schedule-actions";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { ImageLightbox } from "@/components/ui/image-lightbox";

interface ScheduleOptionCardProps {
  option: ProjectScheduleOptionWithProduct;
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
      <div className={`absolute top-2 left-2 z-20 h-7 w-7 rounded-lg flex items-center justify-center font-lora text-xs font-black shadow-lg transition-all duration-500 ${option.is_final ? "bg-slate-950 text-white scale-110" : "bg-white/90 backdrop-blur-md text-slate-400 group-hover/opt:text-slate-950 group-hover/opt:scale-110 border border-slate-100"}`}>
        {option.option_label}
      </div>

      {option.product_catalog_id && (
        <div 
          className="absolute top-2 right-6 z-20 h-4 w-4 rounded-full bg-slate-900 border-2 border-white flex items-center justify-center shadow-lg transform transition-transform group-hover/opt:scale-110"
          title="Gold Standard Library Item"
        >
          <Sparkles className="h-2 w-2 text-white" />
        </div>
      )}

      {/* Sample Ready Indicator (Loose Coupling Bridge - Live Catalog Tracking) */}
      {option.product_catalog?.product_requests?.some(r => r.status === 'RECEIVED') && (
        <div 
          className="absolute top-7 right-2 z-20 flex items-center gap-1 bg-emerald-500 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full shadow-lg border-2 border-white animate-in zoom-in duration-500"
          title="Physical Sample Ready (Live Library Status)"
        >
          <div className="h-1 w-1 rounded-full bg-white animate-pulse" />
          <CheckCircle2 className="h-2 w-2" />
          <span className="pr-0.5">LIVE READY</span>
        </div>
      )}


      {/* Content */}
      <div className="w-full h-full flex flex-col items-center justify-center">
        {snapshot?.catalog_image_url ? (
          <div className="relative w-full h-full group/img">
            <img 
              src={snapshot.catalog_image_url} 
              alt={option.option_label} 
              className="w-full h-full object-cover transition-transform group-hover/opt:scale-110"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(snapshot.catalog_image_url || undefined);
              }}
              className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 flex items-center justify-center transition-colors opacity-0 group-hover/img:opacity-100"
            >
               <div className="bg-white/90 backdrop-blur p-1.5 rounded-full shadow-lg transform scale-75 group-hover/img:scale-100 transition-transform">
                  <Plus className="h-3 w-3 text-slate-900" />
               </div>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 transition-colors group-hover/opt:text-slate-900 text-slate-300 p-2 pt-4">
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
           <CheckCircle2 className="h-4 w-4 text-slate-900 bg-white rounded-full shadow-sm" />
        </div>
      ) : option.status === "DRAFT" ? (
        <div className="absolute top-1 right-1 z-20">
           <Clock className="h-3.5 w-3.5 text-slate-300 bg-white rounded-full" />
        </div>
      ) : option.status === "NOT_USED" ? (
        <div className="absolute top-1 right-1 z-20">
           <XCircle className="h-3.5 w-3.5 text-rose-300 bg-white rounded-full" />
        </div>
      ) : null}
      
      <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-white/95 to-transparent flex justify-center opacity-0 group-hover/opt:opacity-100 transition-opacity">
        <span className="text-[7px] font-black uppercase text-slate-500 line-clamp-1 truncate w-full text-center px-1">
          {getEffectiveTitle(snapshot)}
        </span>
      </div>

      <ImageLightbox 
        src={previewImage || null} 
        onClose={() => setPreviewImage(undefined)} 
      />
    </div>
  );
}
