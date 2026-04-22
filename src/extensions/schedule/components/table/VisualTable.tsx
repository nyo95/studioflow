"use client";

import React from "react";
import { ChevronDown, ChevronRight, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectScheduleSheetPayload } from "../../types";
import { ProductType } from "@/generated/prisma";
import { 
  SortableContext, 
  verticalListSortingStrategy 
} from "@dnd-kit/sortable";
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
    <div className="w-full bg-white rounded-[2rem] border border-slate-200/60 overflow-hidden shadow-2xl shadow-slate-200/50">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="px-6 py-5 text-left">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Code</span>
              </th>
              <th className="px-6 py-5 text-left">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Product Specification</span>
              </th>
              <th className="px-6 py-5 text-left">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Location</span>
              </th>
              {isFixture && (
                <th className="px-6 py-5 text-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Qty</span>
                </th>
              )}
              <th className="px-6 py-5 text-right sr-only">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {sheet.groups.map((group) => {
              const isCollapsed = collapsedCategories.has(group.schedule_category);

              return (
                <React.Fragment key={group.schedule_category}>
                  {/* Category Header */}
                  <tr 
                    className="group/category bg-slate-50/30 hover:bg-slate-50 cursor-pointer transition-all sticky top-0 z-10 backdrop-blur-md"
                    onClick={() => toggleCategory(group.schedule_category)}
                  >
                    <td colSpan={isFixture ? 5 : 4} className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "flex items-center justify-center w-6 h-6 rounded-lg bg-white border border-slate-200 shadow-sm text-slate-400 group-hover/category:text-slate-900 transition-all",
                          !isCollapsed && "rotate-0",
                          isCollapsed && "-rotate-0"
                        )}>
                          {isCollapsed ? <ChevronRight size={14} strokeWidth={3} /> : <ChevronDown size={14} strokeWidth={3} />}
                        </div>
                        <h3 className="font-lora text-sm font-bold text-slate-900 tracking-tight">
                          {group.schedule_category}
                        </h3>
                        <div className="h-px flex-1 bg-slate-100" />
                        <span className="font-inter text-[10px] font-black bg-slate-900 text-white px-2 py-0.5 rounded-full leading-none shadow-lg shadow-slate-200">
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
                        <tr>
                          <td colSpan={isFixture ? 5 : 4} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-2 opacity-40">
                              <List className="h-8 w-8 text-slate-200" />
                              <span className="font-inter text-[10px] uppercase font-bold tracking-widest text-slate-400">Empty Category</span>
                            </div>
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
                <td colSpan={isFixture ? 5 : 4} className="px-6 py-32 text-center">
                  <div className="max-w-xs mx-auto flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-3xl bg-slate-50 flex items-center justify-center text-slate-200">
                      <List className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="font-lora text-xl font-medium text-slate-900">No specifications yet</h4>
                      <p className="font-inter text-xs text-slate-400 leading-relaxed">
                        Start building your project schedule by adding products or importing from CSV.
                      </p>
                    </div>
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
