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
}

export function ScheduleCategorySection({ 
  projectId, 
  category, 
  section,
  entries,
  onRefresh 
}: ScheduleCategorySectionProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = React.useState<string | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);

  const handleRowClick = (id: string, event: React.MouseEvent) => {
    const isShift = event.shiftKey;
    const isCtrl = event.ctrlKey || event.metaKey;

    if (isShift && lastClickedId && lastClickedId !== id) {
      const ids = entries.map(e => e.id);
      const start = ids.indexOf(lastClickedId);
      const end = ids.indexOf(id);
      const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1);
      
      const next = new Set(isCtrl ? selectedIds : []);
      range.forEach(rid => next.add(rid));
      setSelectedIds(next);
    } else if (isCtrl) {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);
      setLastClickedId(id);
    } else {
      setSelectedIds(new Set([id]));
      setLastClickedId(id);
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    try {
      unwrapActionResult(await bulkDeleteScheduleEntriesAction({
        projectId,
        section,
        category,
        entryIds: Array.from(selectedIds)
      }));
      toast.success(`Deleted ${selectedIds.size} items`);
      setSelectedIds(new Set());
      onRefresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete items");
    } finally {
      setIsBulkDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  return (
    <>
      <TableBody className="group/section">
        <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 border-y border-slate-200 shadow-sm z-20 sticky top-[49px]">
          <TableCell colSpan={11} className="px-5 py-4 h-16 align-middle border-r border-slate-200/60">
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
                {selectedIds.size > 0 && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowConfirmDelete(true);
                    }}
                    className="h-9 rounded-xl px-4 text-[10px] font-bold uppercase tracking-widest text-white bg-slate-900 hover:bg-slate-800 shadow-lg transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete {selectedIds.size}
                  </Button>
                )}
              </div>
            </div>

            <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
              <AlertDialogContent className="rounded-3xl border-slate-100 bg-white p-6 shadow-2xl">
                <AlertDialogHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <AlertDialogTitle className="font-lora text-2xl font-medium text-slate-900">
                    Delete Selected Items?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-inter text-sm text-slate-500">
                    This will permanently remove {selectedIds.size} items from the {category} category. 
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-6 gap-3">
                  <AlertDialogCancel className="rounded-2xl border-slate-100 text-xs font-bold uppercase tracking-widest text-slate-400 hover:bg-slate-50">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    className="rounded-2xl bg-rose-500 px-6 text-xs font-bold uppercase tracking-widest text-white hover:bg-rose-600"
                    disabled={isBulkDeleting}
                  >
                    {isBulkDeleting ? "Deleting..." : "Delete Permanently"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
                onSelect={(e) => handleRowClick(entry.id, e)}
              />
            ))}
          </SortableContext>
        )}
      </TableBody>
    </>
  );
}
