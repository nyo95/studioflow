"use client";

import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MoveHorizontal, Trash2, Edit3, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { deleteScheduleEntryAction, deleteScheduleOptionAction } from "@/actions/schedule-actions";
import type { ProjectScheduleEntry, ProjectScheduleOption } from "@/generated/prisma";
import type { ProjectScheduleEntryWithRelations } from "../../types";
import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";

interface ScheduleCardProps {
  entry: ProjectScheduleEntryWithRelations;
  onEdit?: (entry: ProjectScheduleEntryWithRelations) => void;
  onDelete?: (id: string) => void;
}

export function ScheduleCard({ entry, onEdit, onDelete }: ScheduleCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const finalOption = entry.options.find((o: ProjectScheduleOption) => o.is_final) || entry.options[0];
  const snapshot = finalOption?.data_snapshot as unknown as ScheduleSnapshot | null;

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (entry.options.length > 1) {
        // Delete only the active option (final or first)
        unwrapActionResult(await deleteScheduleOptionAction({
          projectId: entry.project_id,
          optionId: finalOption?.id || ''
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
      onDelete?.(entry.id);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative mb-4 transition-all",
        isDragging && "z-50 opacity-50 scale-105"
      )}
    >
      <Card className="overflow-hidden border-subtle bg-white/70 backdrop-blur-md shadow-sm transition-all hover:shadow-md hover:border-slate-300">
        <div className="flex p-3 gap-3">
          {/* Draggable Handle Area (Lateral) or whole card */}
          <div 
            {...attributes} 
            {...listeners}
            className="flex-shrink-0 w-24 h-24 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 cursor-grab active:cursor-grabbing"
          >
            {snapshot?.catalog_image_url ? (
               // eslint-disable-next-line @next/next/no-img-element
               <img 
                 src={snapshot.catalog_image_url} 
                 alt={snapshot.catalog_product_name} 
                 className="w-full h-full object-cover"
               />
            ) : (
              <ImageIcon className="text-slate-300 w-8 h-8" />
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <Badge variant="outline" className="font-sans text-[10px] font-bold tracking-tighter uppercase px-1.5 py-0 border-slate-200 bg-slate-50 text-slate-500">
                  {entry.schedule_code}
                </Badge>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                  <button 
                    onClick={() => onEdit?.(entry)}
                    className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button 
                    onClick={handleDelete}
                    className="p-1 hover:bg-red-50 rounded text-slate-400 hover:text-red-500"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h4 className="font-serif text-sm font-semibold text-slate-900 leading-tight truncate">
                {(snapshot?.catalog_product_name && snapshot.catalog_product_name !== "[RESERVED]") 
                  ? snapshot.catalog_product_name 
                  : (snapshot?.catalog_initials_type || "Reserved Slot")}
              </h4>
              <p className="font-sans text-[11px] text-slate-500 truncate mt-0.5">
                {snapshot?.catalog_brand || "No Brand"}
              </p>
            </div>

            <div className="flex items-center justify-between mt-2">
               <span className="font-sans text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                 {entry.schedule_location || "Global"}
               </span>
               <div className="flex items-center gap-1.5">
                 <span className="font-sans text-[11px] font-bold text-slate-700">
                    {entry.schedule_qty ?? 0} {entry.schedule_unit || "unit"}
                 </span>
               </div>
            </div>
          </div>
        </div>
        
        {/* Visual indicator for "Finalized" */}
        {finalOption?.is_final && (
          <div className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-accent-primary m-2" />
        )}
      </Card>
    </div>
  );
}
