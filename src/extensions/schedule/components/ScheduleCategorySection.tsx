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
  openEditor: (optionId: string, snapshot: any) => void;
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
  const [isBulkDeleting, setIsBulkDeleting] = React.useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = React.useState(false);


  const categorySelectedIds = React.useMemo(() => {
    return Array.from(selectedIds).filter(id => entries.some(e => e.id === id));
  }, [selectedIds, entries]);

  const handleBulkDelete = async () => {
    if (categorySelectedIds.length === 0) {
      setShowConfirmDelete(false);
      return;
    }

    setIsBulkDeleting(true);
    try {
      unwrapActionResult(await bulkDeleteScheduleEntriesAction({
        projectId,
        section,
        category,
        entryIds: categorySelectedIds
      }));
      toast.success(`Deleted ${categorySelectedIds.length} items from ${category}`);
      onClearSelection();
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
        <TableRow className="bg-white hover:bg-white border-b border-slate-200 z-20 sticky top-[49px]">
          <TableCell colSpan={5} className="px-4 py-6 align-middle">

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6 cursor-pointer group/title" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-white shadow-sm border border-slate-100 text-slate-400 group-hover/title:text-slate-900 group-hover/title:border-slate-300 transition-all">
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
                <div className="flex items-center gap-4">
                  <h4 className="font-serif text-lg font-bold text-slate-900 tracking-tight uppercase">{category}</h4>
                  <div className="h-1 w-1 rounded-full bg-slate-300" />
                  <span className="font-sans text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {entries.length} items
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {categorySelectedIds.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowConfirmDelete(true);
                    }}
                    className="h-8 rounded-lg px-3 text-[10px] font-medium uppercase tracking-widest text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-2" />
                    Delete {categorySelectedIds.length}
                  </Button>
                )}
              </div>
            </div>

            {/* HYDRATION FIX: AlertDialog inside TableCell */}
            <AlertDialog open={showConfirmDelete} onOpenChange={setShowConfirmDelete}>
              <AlertDialogContent className="rounded-3xl border-slate-100 bg-white p-6 shadow-2xl">
                <AlertDialogHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <AlertDialogTitle className="font-serif text-2xl font-medium text-slate-900">
                    Delete Selected Items?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="font-sans text-sm text-slate-500">
                    This will permanently remove {categorySelectedIds.length} items from the {category} category. 
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

