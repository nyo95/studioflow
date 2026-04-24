"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ScheduleCard } from "./ScheduleCard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Plus, MoreVertical } from "lucide-react";

import type { ProjectScheduleEntryWithRelations } from "../../types";

interface ScheduleColumnProps {
  id: string; // The category name
  title: string;
  items: ProjectScheduleEntryWithRelations[];
  onEditEntry?: (entry: ProjectScheduleEntryWithRelations) => void;
  onDeleteEntry?: (id: string) => void;
}

export function ScheduleColumn({ id, title, items, onEditEntry, onDeleteEntry }: ScheduleColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col h-full min-w-[300px] max-w-[350px] bg-slate-100/50 rounded-[var(--radius-premium)] p-3 transition-colors">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="font-serif text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
          {title}
          <span className="font-sans text-[10px] font-black bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">
            {items.length}
          </span>
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" className="h-7 w-7 text-slate-400">
            <MoreVertical size={14} />
          </Button>
        </div>
      </div>

      <div 
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto no-scrollbar rounded-xl transition-all p-1",
          isOver && "bg-slate-200/50"
        )}
      >
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((entry) => (
            <ScheduleCard 
              key={entry.id} 
              entry={entry} 
              onEdit={onEditEntry}
              onDelete={onDeleteEntry}
            />
          ))}
        </SortableContext>
        
        {items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-slate-200 rounded-xl text-slate-300">
             <p className="text-xs font-sans italic">Drop here</p>
          </div>
        )}
      </div>
    </div>
  );
}
