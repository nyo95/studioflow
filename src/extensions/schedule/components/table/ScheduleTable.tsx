"use client";

import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ScheduleTableHeader } from "./ScheduleTableHeader";
import { ScheduleRow } from "./ScheduleRow";
import { cn } from "@/lib/utils";
import type { ProjectScheduleEntryWithRelations, ProjectScheduleSheetPayload } from "../../types";
import { ProductType } from "@/generated/prisma";
import { 
  SortableContext, 
  verticalListSortingStrategy 
} from "@dnd-kit/sortable";
import { 
  UI_ENGINE_RADIUS_CARD,
  UI_ENGINE_RADIUS_CONTROL
} from "@/ui_engine/tokens/layout";

interface ScheduleTableProps {
  sheet: ProjectScheduleSheetPayload;
  section?: ProductType;
  onEditEntry?: (entry: ProjectScheduleEntryWithRelations) => void;
  onDeleteEntry?: (id: string) => void;
  onUpdateLocation?: (entryId: string, location: string) => Promise<void>;
  onUpdateQty?: (entryId: string, qty: number) => Promise<void>;
  onAddAlternative?: (entryId: string, category: string) => void;
}

export function ScheduleTable({ sheet, section, onEditEntry, onDeleteEntry, onUpdateLocation, onUpdateQty, onAddAlternative }: ScheduleTableProps) {
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
    <div className={cn("w-full bg-white border border-slate-200 overflow-hidden shadow-sm", UI_ENGINE_RADIUS_CARD)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <ScheduleTableHeader isFixture={isFixture} />
          <tbody>
            {sheet.groups.map((group) => {
              const isCollapsed = collapsedCategories.has(group.schedule_category);

              return (
                <React.Fragment key={group.schedule_category}>
                  {/* Category Divider Row */}
                  <tr 
                    className="group/category bg-slate-50/50 hover:bg-slate-50 border-b border-slate-200/80 cursor-pointer transition-colors"
                    onClick={() => toggleCategory(group.schedule_category)}
                  >
                    <td colSpan={isFixture ? 5 : 4} className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className={cn("flex items-center justify-center w-5 h-5 bg-white border border-slate-200 text-slate-400 group-hover/category:text-slate-600 transition-colors", UI_ENGINE_RADIUS_CONTROL)}>
                          {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                        </div>
                        <span className="font-lora text-xs font-bold text-slate-700 uppercase tracking-[0.18em]">
                          {group.schedule_category}
                        </span>
                        <span className="font-sans text-[10px] font-black bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded-full leading-none">
                          {group.entries.length}
                        </span>
                      </div>
                    </td>
                  </tr>

                  {!isCollapsed && (
                    <SortableContext 
                      items={group.entries.map(e => e.id)} 
                      strategy={verticalListSortingStrategy}
                    >
                      {group.entries.length > 0 ? (
                        group.entries.map((entry) => (
                          <ScheduleRow
                            key={entry.id}
                            entry={entry}
                            section={isFixture ? ProductType.fixture : ProductType.material}
                            onEdit={onEditEntry}
                            onDelete={onDeleteEntry}
                            onUpdateLocation={onUpdateLocation}
                            onUpdateQty={onUpdateQty}
                            onAddAlternative={() => onAddAlternative?.(entry.id, group.schedule_category)}
                          />
                        ))
                      ) : (
                        <tr>
                          <td colSpan={isFixture ? 5 : 4} className="px-5 py-8 text-center text-slate-400 font-sans text-xs italic">
                            No items in this category
                          </td>
                        </tr>
                      )}
                    </SortableContext>
                  )}
                </React.Fragment>
              );
            })}

            {sheet.groups.length === 0 && (
              <tr>
                <td colSpan={isFixture ? 5 : 4} className="px-6 py-24 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="font-lora text-lg text-slate-400">No entries found</p>
                    <p className="font-sans text-sm text-slate-400">Start by adding a product or importing CSV data.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
