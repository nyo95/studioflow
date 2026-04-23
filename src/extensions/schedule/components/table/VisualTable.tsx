"use client";

import React from "react";
import { ChevronDown, ChevronRight, List, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectScheduleSheetPayload } from "../../types";
import { ProductType } from "@/generated/prisma";
import { 
  SortableContext, 
  verticalListSortingStrategy 
} from "@dnd-kit/sortable";
import { UI_ENGINE_RADIUS_CARD, UI_ENGINE_RADIUS_CONTROL } from "@/ui_engine";
import { VisualRow } from "./VisualRow";

interface VisualTableProps {
  sheet: ProjectScheduleSheetPayload;
  section?: ProductType;
  onEditEntry?: (entry: any) => void;
  onDeleteEntry?: (id: string) => void;
  onUpdateLocation?: (entryId: string, location: string) => Promise<void>;
  onUpdateQty?: (entryId: string, qty: number) => Promise<void>;
  onAddAlternative?: (entryId: string, category: string) => void;
  selectedIds?: Set<string>;
  onRowClick?: (id: string, event: React.MouseEvent) => void;
}

export function VisualTable({ 
  sheet, 
  section, 
  onEditEntry, 
  onDeleteEntry, 
  onUpdateLocation, 
  onUpdateQty, 
  onAddAlternative,
  selectedIds = new Set(),
  onRowClick
}: VisualTableProps) {
  const isFixture = section === ProductType.fixture;
  const [collapsedCategories, setCollapsedCategories] = React.useState<Set<string>>(new Set());

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  return (
    <div className="w-full space-y-12 pb-20">
      {sheet.groups.map((group) => {
        const isCollapsed = collapsedCategories.has(group.schedule_category);

        return (
          <div 
            key={group.schedule_category}
            className={cn(
              "group/category-section transition-all duration-500",
              isCollapsed ? "opacity-60" : "opacity-100"
            )}
          >
            {/* Premium Category Header (Kanban Style) */}
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => toggleCategory(group.schedule_category)}
                  className="flex items-center justify-center w-6 h-6 rounded-md bg-white border border-slate-200 text-slate-400 hover:text-slate-900 transition-colors"
                >
                  <div className={cn("transition-transform duration-300", isCollapsed ? "-rotate-90" : "rotate-0")}>
                    <ChevronDown size={14} />
                  </div>
                </button>
                <h3 className="font-serif text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
                  {group.schedule_category}
                  <span className="font-sans text-[10px] font-black bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full">
                    {group.entries.length}
                  </span>
                </h3>
              </div>
            </div>

            {!isCollapsed && (
              <div className={cn("bg-slate-100/50 p-3 transition-colors", UI_ENGINE_RADIUS_CARD)}>
                <div className="space-y-3">
                  <SortableContext 
                    items={group.entries.map(e => e.id)} 
                    strategy={verticalListSortingStrategy}
                  >
                    {group.entries.length > 0 ? (
                      group.entries.map((entry) => (
                        <VisualRow
                          key={entry.id}
                          entry={entry}
                          section={isFixture ? ProductType.fixture : ProductType.material}
                          onEdit={onEditEntry}
                          onDelete={onDeleteEntry}
                          onUpdateLocation={onUpdateLocation}
                          onUpdateQty={onUpdateQty}
                          onAddAlternative={() => onAddAlternative?.(entry.id, group.schedule_category)}
                          isSelected={selectedIds.has(entry.id)}
                          onClick={(e) => onRowClick?.(entry.id, e)}
                        />
                      ))
                    ) : (
                      <div className={cn("py-12 flex flex-col items-center gap-2 bg-white/50 border border-dashed border-slate-200", UI_ENGINE_RADIUS_CONTROL)}>
                        <span className="font-sans text-[10px] uppercase font-bold tracking-widest text-slate-400">Empty Category</span>
                      </div>
                    )}
                  </SortableContext>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {sheet.groups.length === 0 && (
        <div className={cn("py-24 text-center bg-slate-50/50 border border-dashed border-slate-200", UI_ENGINE_RADIUS_CARD)}>
          <div className="max-w-xs mx-auto flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-white shadow-sm flex items-center justify-center text-slate-200 border border-slate-100">
              <List className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-serif text-xl font-medium text-slate-800">No specifications yet</h4>
              <p className="font-sans text-xs text-slate-400 leading-relaxed">
                Start building your project schedule by adding products or importing from CSV.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
