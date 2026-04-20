"use client";

import * as React from "react";
import { ScheduleSection } from "@/generated/prisma";
import { 
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Button } from "@/components/ui/button";
import { ProjectScheduleEntryWithRelations } from "../types";
import { ScheduleEntryRow } from "./ScheduleEntryRow";
import { addScheduleEntryInstantAction, bulkDeleteScheduleEntriesAction } from "@/actions/schedule-actions";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { 
  TableBody, 
  TableCell, 
  TableRow 
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Trash2, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ScheduleCategorySectionProps {
  projectId: string;
  category: string;
  section: ScheduleSection;
  entries: ProjectScheduleEntryWithRelations[];
  onRefresh: () => void;
  selectedIds: Set<string>;
  onRowClick: (id: string, event: React.MouseEvent) => void;
  onClearSelection: () => void;
  openPicker: (entryId: string) => void;
  openEditor: (optionId: string, snapshot: import("../types").ScheduleOptionSnapshot) => void;
}

export function ScheduleCategorySection({ 
  projectId, 
  category, 
  section,
  entries,
  onRefresh,
  selectedIds,
  onRowClick,
  onClearSelection,
  openPicker,
  openEditor
}: ScheduleCategorySectionProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  return (
    <>
      <TableBody className="group/section">
        <TableRow className="bg-white hover:bg-white border-b border-slate-200 z-20 sticky top-[49px]">
          <TableCell colSpan={5} className="px-4 py-6 align-middle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 cursor-pointer group/title" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-400 group-hover/title:text-slate-900 group-hover/title:border-slate-300 transition-all">
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
                <div className="flex items-center gap-4">
                  <h4 className="font-lora text-lg font-bold text-slate-900 tracking-tight uppercase">{category}</h4>
                  <div className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="font-inter text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {entries.length} items
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
              </div>
            </div>
          </TableCell>
        </TableRow>

        {!isCollapsed && (
          <SortableContext 
            items={entries.map(e => e.id)}
            strategy={verticalListSortingStrategy}
          >
            {entries.map((entry) => (
              <ScheduleEntryRow 
                key={entry.id} 
                entry={entry} 
                onRefresh={onRefresh}
                isSelected={selectedIds.has(entry.id)}
                onSelect={(e) => onRowClick(entry.id, e)}
                openPicker={openPicker}
                openEditor={openEditor}
              />
            ))}
          </SortableContext>
        )}
      </TableBody>
    </>
  );
}
