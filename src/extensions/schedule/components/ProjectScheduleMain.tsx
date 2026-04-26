"use client";

import * as React from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unwrapActionResult } from "@/lib/result";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductType } from "@/generated/prisma";
import { 
  getProjectScheduleAction, 
  importScheduleAction,
  reorderScheduleEntriesAction,
  moveEntryToCategoryAction,
  bulkDeleteScheduleEntriesAction,
  updateScheduleEntryAction,
} from "@/extensions/schedule/actions/schedule-actions";
import { ScheduleBoard } from "./board/ScheduleBoard";
import { VisualTable } from "./table/VisualTable";
import { ScheduleSearchBar } from "./ScheduleSearchBar";
import { ScheduleProductPickerModal } from "./ScheduleProductPickerModal";
import { ScheduleSpecEditorModal } from "./ScheduleSpecEditorModal";
import type { ProjectScheduleSheetPayload, ScheduleGroupedByCategory, ProjectScheduleEntryWithRelations, ScheduleOptionSnapshot } from "../types";
import { ProjectScheduleProvider } from "../context/ProjectScheduleContext";
import { useRouter } from "next/navigation";
import { PageHeader, UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_RADIUS_ACTION } from "@/ui_engine";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/shared/page-skeleton";

import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";

interface ProjectScheduleMainProps {
  projectId: string;
  userRole?: string;
}

export function ProjectScheduleMain({
  projectId,
  userRole = "STAFF",
}: ProjectScheduleMainProps) {
  const router = useRouter();
  const [sheet, setSheet] = React.useState<ProjectScheduleSheetPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeSection, setActiveSection] = React.useState<ProductType>(ProductType.material);
  const [viewMode, setViewMode] = React.useState<"board" | "table">("table");
  const [importing, setImporting] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [selectionAnchorId, setSelectionAnchorId] = React.useState<string | null>(null);
  
  const containerRef = React.useRef<HTMLDivElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Modal Hosting State
  const [pickerModal, setPickerModal] = React.useState<{ 
    isOpen: boolean; 
    entryId?: string;
    category?: string;
    section?: ProductType;
  }>({ 
    isOpen: false 
  });

  const [editorModal, setEditorModal] = React.useState<{ 
    isOpen: boolean; 
    optionId: string; 
    initialSnapshot: import("../types").ScheduleOptionSnapshot;
  } | null>(null);

  const fetchSchedule = React.useCallback(async (section: ProductType) => {
    setLoading(true);
    try {
      const result = unwrapActionResult(await getProjectScheduleAction({
        projectId,
        section,
      }));
      setSheet(result as ProjectScheduleSheetPayload);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to fetch schedule");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Click away to deselect & ESC key
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const isOutside = !containerRef.current.contains(e.target as Node);
        const isModal = (e.target as HTMLElement).closest('[role="dialog"]');
        const isAction = (e.target as HTMLElement).closest('[data-selection-ignore="true"]');
        
        if (isOutside && !isModal && !isAction) {
          setSelectedIds(new Set());
          setSelectionAnchorId(null);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedIds(new Set());
        setSelectionAnchorId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleRowClick = (id: string, event: React.MouseEvent) => {
    const isShift = event.shiftKey;
    const isCtrl = event.ctrlKey || event.metaKey;

    if (!sheet) return;

    const allEntries = sheet.groups.flatMap(g => g.entries);
    const ids = allEntries.map(e => e.id);

    if (isShift && selectionAnchorId) {
      const start = ids.indexOf(selectionAnchorId);
      const end = ids.indexOf(id);
      
      if (start === -1 || end === -1) {
        setSelectedIds(new Set([id]));
        setSelectionAnchorId(id);
        return;
      }

      const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1);
      const next = new Set(isCtrl ? selectedIds : []);
      range.forEach(rid => next.add(rid));
      setSelectedIds(next);
    } else if (isCtrl) {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
        if (id === selectionAnchorId) {
          setSelectionAnchorId(Array.from(next).pop() || null);
        }
      } else {
        next.add(id);
        setSelectionAnchorId(id);
      }
      setSelectedIds(next);
    } else {
      setSelectedIds(new Set([id]));
      setSelectionAnchorId(id);
    }
  };

  const handleRefresh = React.useCallback(() => {
    fetchSchedule(activeSection);
    router.refresh();
  }, [fetchSchedule, activeSection, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleReorder = async (category: string, items: { id: string; schedule_sort_order: number }[]) => {
    if (!sheet) return;
    try {
      unwrapActionResult(await reorderScheduleEntriesAction({
        projectId,
        section: activeSection,
        schedule_category: category,
        items
      }));
      fetchSchedule(activeSection);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reorder items");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !sheet) return;

    let sourceGroup: ScheduleGroupedByCategory | null = null;
    let targetGroup: ScheduleGroupedByCategory | null = null;
    let activeEntry: ProjectScheduleEntryWithRelations | null = null;

    for (const group of sheet.groups) {
      const entry = group.entries.find(e => e.id === active.id);
      if (entry) {
        sourceGroup = group;
        activeEntry = entry;
      }
      if (group.entries.some(e => e.id === over.id)) {
        targetGroup = group;
      }
    }

    if (!sourceGroup || !targetGroup) return;

    if (sourceGroup.schedule_category === targetGroup.schedule_category) {
      const oldIndex = sourceGroup.entries.findIndex((e) => e.id === active.id);
      const newIndex = targetGroup.entries.findIndex((e) => e.id === over.id);

      const newEntries = arrayMove(sourceGroup.entries, oldIndex, newIndex) as typeof sourceGroup.entries;
      const reorderItems = newEntries.map((e, idx: number) => ({
        id: e.id,
        schedule_sort_order: idx + 1
      }));

      const updatedGroups = sheet.groups.map(g => 
        g.schedule_category === sourceGroup.schedule_category 
          ? { ...g, entries: newEntries } 
          : g
      );
      setSheet({ ...sheet, groups: updatedGroups });

      await handleReorder(sourceGroup.schedule_category, reorderItems);
    } else {
      toast.error("Memindahkan item antar kategori tidak diizinkan.");
      return;
    }
  };

  const handleUpdateLocation = async (entryId: string, location: string) => {
    try {
      unwrapActionResult(await updateScheduleEntryAction({
        projectId,
        entryId,
        data: { schedule_location: location || null }
      }));
      fetchSchedule(activeSection);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update location");
    }
  };

  const handleMoveBetweenCategories = async (entryId: string, fromCategory: string, toCategory: string, newIndex: number) => {
    try {
      unwrapActionResult(await moveEntryToCategoryAction({
        projectId,
        entryId,
        fromCategory,
        toCategory,
        newIndex
      }));
      fetchSchedule(activeSection);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to move item");
    }
  };

  const handleBulkDelete = async () => {
    if (!sheet || selectedIds.size === 0) return;
    
    const confirm = window.confirm(`Are you sure you want to delete ${selectedIds.size} selected items?`);
    if (!confirm) return;

    const toastId = toast.loading(`Deleting ${selectedIds.size} items...`);
    setLoading(true);
    try {
      const entriesByGroup: Record<string, string[]> = {};
      sheet.groups.forEach(g => {
        const idsInGroup = g.entries
          .filter(e => selectedIds.has(e.id))
          .map(e => e.id);
        if (idsInGroup.length > 0) {
          entriesByGroup[g.schedule_category] = idsInGroup;
        }
      });

      for (const [category, ids] of Object.entries(entriesByGroup)) {
        unwrapActionResult(await bulkDeleteScheduleEntriesAction({
          projectId,
          section: activeSection,
          schedule_category: category,
          entryIds: ids
        }));
      }

      toast.success(`Deleted ${selectedIds.size} items`, { id: toastId });
      setSelectedIds(new Set());
      fetchSchedule(activeSection);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Bulk delete failed");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSchedule(activeSection);
  }, [fetchSchedule, activeSection]);

  const handleImport = React.useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    try {
      const content = await file.text();
      const result = unwrapActionResult(await importScheduleAction({
        projectId,
        section: activeSection,
        csvContent: content,
        source: "gsheets",
      })) as { created: number; updated: number };
      
      toast.success(`Imported ${result.created} new rows, updated ${result.updated} existing rows`);
      fetchSchedule(activeSection);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to import CSV");
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, [projectId, activeSection, fetchSchedule]);

  if (loading && !sheet) {
    return <PageSkeleton type="list" className="p-0 py-0" />;
  }

  return (
    <>
      <PageHeader
        eyebrow="Schedule"
        title="Project Schedule"
        description="Manage specifications and procurement for this project."
        action={
          <div className="flex items-center gap-3 relative">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImport}
              disabled={importing}
            />
            
            {selectedIds.size > 0 && (
              <Button
                variant="ghost"
                data-selection-ignore="true"
                onMouseDown={(e) => e.stopPropagation()}
                className={cn("h-11 text-xs font-bold text-red-600 bg-transparent hover:bg-red-50 px-4 transition-all", UI_ENGINE_RADIUS_CONTROL)}
                onClick={handleBulkDelete}
              >
                Delete Selected ({selectedIds.size})
              </Button>
            )}

            <div className={cn("flex items-center bg-slate-100 p-1 border border-slate-200 mr-2", UI_ENGINE_RADIUS_CONTROL)}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 px-3 text-[10px] font-bold uppercase tracking-wider transition-all",
                  viewMode === "table" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600",
                  UI_ENGINE_RADIUS_ACTION
                )}
                onClick={() => setViewMode("table")}
              >
                <List className="h-3.5 w-3.5 mr-2" />
                Table
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-9 px-3 text-[10px] font-bold uppercase tracking-wider transition-all",
                  viewMode === "board" ? "bg-white text-slate-900 shadow-sm" : "text-slate-400 hover:text-slate-600",
                  UI_ENGINE_RADIUS_ACTION
                )}
                onClick={() => setViewMode("board")}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-2" />
                Board
              </Button>
            </div>

            <Button
              variant="outline"
              data-selection-ignore="true"
              onMouseDown={(e) => e.stopPropagation()}
              className={cn("h-11 border-slate-200 text-xs font-semibold text-slate-600", UI_ENGINE_RADIUS_CONTROL)}
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
              Import CSV
            </Button>
          </div>
        }
      />

      <Tabs
        defaultValue={ProductType.material}
        value={activeSection}
        onValueChange={(value) => setActiveSection(value as ProductType)}
        className="w-full"
      >
        <TabsList className={cn("h-12 w-full max-w-lg border border-slate-200/60 bg-slate-100/50 p-1", UI_ENGINE_RADIUS_CONTROL)}>
          <TabsTrigger
            value={ProductType.material}
            className={cn(
              "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm",
              UI_ENGINE_RADIUS_ACTION
            )}
          >
            Materials
          </TabsTrigger>
          <TabsTrigger
            value={ProductType.fixture}
            className={cn(
              "flex-1 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm",
              UI_ENGINE_RADIUS_ACTION
            )}
          >
            Fixtures
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <ScheduleSearchBar 
            projectId={projectId}
            section={activeSection}
            onSuccess={handleRefresh}
          />
        </div>

        <div ref={containerRef} className="mt-8">
          {sheet && (
            viewMode === "board" ? (
              <ScheduleBoard 
                sheet={sheet}
                section={activeSection}
                onReorder={handleReorder}
                onMoveBetweenCategories={handleMoveBetweenCategories}
                onEditEntry={(entry: ProjectScheduleEntryWithRelations) => {
                  const finalOption = entry.options.find((o) => o.is_final) || entry.options[0];
                  if (finalOption) {
                    setEditorModal({ 
                      isOpen: true, 
                      optionId: finalOption.id, 
                      initialSnapshot: finalOption.data_snapshot as unknown as import("../types").ScheduleOptionSnapshot
                    });
                  }
                }}
                onDeleteEntry={() => fetchSchedule(activeSection)}
              />
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <VisualTable 
                  sheet={sheet}
                  section={activeSection}
                  onUpdateLocation={handleUpdateLocation}
                  onEditEntry={(entry: ProjectScheduleEntryWithRelations) => {
                    const finalOption = entry.options.find((o) => o.is_final) || entry.options[0];
                    if (finalOption) {
                      setEditorModal({ 
                        isOpen: true, 
                        optionId: finalOption.id, 
                        initialSnapshot: finalOption.data_snapshot as unknown as ScheduleOptionSnapshot
                      });
                    }
                  }}
                  onDeleteEntry={() => fetchSchedule(activeSection)}
                  onAddAlternative={(entryId, category) => setPickerModal({
                    isOpen: true,
                    entryId,
                    category,
                    section: activeSection
                  })}
                  selectedIds={selectedIds}
                  onRowClick={handleRowClick}
                />
              </DndContext>
            )
          )}
        </div>
      </Tabs>

      {/* Hoisted Modals */}
      {pickerModal.isOpen && pickerModal.category && pickerModal.section && (
        <ProjectScheduleProvider
          value={{
            projectId,
            category: pickerModal.category,
            section: pickerModal.section,
            userRole,
            onSuccess: handleRefresh
          }}
        >
          <ScheduleProductPickerModal
            entryId={pickerModal.entryId}
            isOpen={pickerModal.isOpen}
            onOpenChange={(open) => setPickerModal({ ...pickerModal, isOpen: open })}
          />
        </ProjectScheduleProvider>
      )}

      {editorModal && (
        <ScheduleSpecEditorModal
          optionId={editorModal.optionId}
          initialSnapshot={editorModal.initialSnapshot}
          isOpen={editorModal.isOpen}
          onOpenChange={(open) => setEditorModal(open ? editorModal : null)}
          onRefresh={handleRefresh}
          userRole={userRole}
          projectId={projectId}
        />
      )}
    </>
  );
}
