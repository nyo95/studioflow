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
import dynamic from "next/dynamic";

const ScheduleProductPickerModal = dynamic(
  () => import("./ScheduleProductPickerModal").then((mod) => mod.ScheduleProductPickerModal),
  { ssr: false }
);

import { ScheduleWorkspaceInspector } from "./ScheduleWorkspaceInspector";
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

  const [inspectedItem, setInspectedItem] = React.useState<{ 
    entryId: string;
    optionId: string; 
    initialSnapshot: ScheduleOptionSnapshot;
  } | null>(null);

  const [activeInspectorTab, setActiveInspectorTab] = React.useState<string>("identity");

  const allEntries = React.useMemo(() => sheet ? sheet.groups.flatMap(g => g.entries) : [], [sheet]);
  const currentIdx = inspectedItem ? allEntries.findIndex(e => e.id === inspectedItem.entryId) : -1;
  const hasNext = currentIdx >= 0 && currentIdx < allEntries.length - 1;
  const hasPrev = currentIdx > 0;

  const handleNavigateNext = React.useCallback(() => {
    if (hasNext) {
      const nextEntry = allEntries[currentIdx + 1];
      const finalOption = nextEntry.options.find((o) => o.is_final) || nextEntry.options[0];
      if (finalOption) {
        setInspectedItem({
          entryId: nextEntry.id,
          optionId: finalOption.id,
          initialSnapshot: finalOption.data_snapshot as unknown as ScheduleOptionSnapshot
        });
        setSelectedIds(new Set([nextEntry.id]));
        setSelectionAnchorId(nextEntry.id);
      }
    }
  }, [hasNext, allEntries, currentIdx]);

  const handleNavigatePrev = React.useCallback(() => {
    if (hasPrev) {
      const prevEntry = allEntries[currentIdx - 1];
      const finalOption = prevEntry.options.find((o) => o.is_final) || prevEntry.options[0];
      if (finalOption) {
        setInspectedItem({
          entryId: prevEntry.id,
          optionId: finalOption.id,
          initialSnapshot: finalOption.data_snapshot as unknown as ScheduleOptionSnapshot
        });
        setSelectedIds(new Set([prevEntry.id]));
        setSelectionAnchorId(prevEntry.id);
      }
    }
  }, [hasPrev, allEntries, currentIdx]);

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

  // Click away to deselect and close inspector, ignoring inspector/modal/row/action clicks
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      const isInspector = target.closest('[data-workspace-inspector="true"]');
      const isModal = target.closest('[role="dialog"]');
      const isAction = target.closest('[data-selection-ignore="true"]');
      const isRow = target.closest('[data-schedule-row="true"]');
      
      if (!isInspector && !isModal && !isAction && !isRow) {
        setSelectedIds(new Set());
        setSelectionAnchorId(null);
        setInspectedItem(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Stable refs for keyboard navigation to avoid excessive re-binding
  const navRefs = React.useRef({
    inspectedItem,
    handleNavigateNext,
    handleNavigatePrev,
  });

  React.useEffect(() => {
    navRefs.current = {
      inspectedItem,
      handleNavigateNext,
      handleNavigatePrev,
    };
  }, [inspectedItem, handleNavigateNext, handleNavigatePrev]);

  // Keyboard navigation & Escape handling
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputActive = 
        target?.tagName === "INPUT" || 
        target?.tagName === "TEXTAREA" || 
        target?.getAttribute("contenteditable") === "true";

      if (isInputActive) {
        if (e.key === "Escape") {
          target?.blur();
          e.preventDefault();
        }
        return;
      }

      const { 
        inspectedItem: currentInspectedItem, 
        handleNavigateNext: navNext, 
        handleNavigatePrev: navPrev 
      } = navRefs.current;

      if (currentInspectedItem) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          navPrev();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          navNext();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setInspectedItem(null);
          setSelectedIds(new Set());
          setSelectionAnchorId(null);
        }
      } else {
        if (e.key === "Escape") {
          setSelectedIds(new Set());
          setSelectionAnchorId(null);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
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
        setInspectedItem(null);
        return;
      }

      const range = ids.slice(Math.min(start, end), Math.max(start, end) + 1);
      const next = new Set(isCtrl ? selectedIds : []);
      range.forEach(rid => next.add(rid));
      setSelectedIds(next);
      setInspectedItem(null);
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
      setInspectedItem(null);
    } else {
      setSelectedIds(new Set([id]));
      setSelectionAnchorId(id);
      setInspectedItem(null);
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
      handleRefresh();
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
      handleRefresh();
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
      handleRefresh();
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
    <div className="flex h-full w-full overflow-hidden relative bg-slate-50">
      <div className="flex-1 flex flex-col h-full overflow-y-auto transition-all duration-300 ease-in-out">
        <div className="p-4 md:p-8 pb-32 max-w-7xl mx-auto w-full">
      <PageHeader
        eyebrow="Schedule"
        title="Project Schedule"
        description="Manage specifications and procurement for this project."
        action={
          <div className="flex flex-wrap items-center gap-2 md:gap-3 relative">
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

            <div data-selection-ignore="true" className={cn("flex items-center bg-slate-100 p-1 border border-slate-200 mr-2", UI_ENGINE_RADIUS_CONTROL)}>
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
                    setSelectedIds(new Set([entry.id]));
                    setSelectionAnchorId(entry.id);
                    setInspectedItem({ 
                      entryId: entry.id,
                      optionId: finalOption.id, 
                      initialSnapshot: finalOption.data_snapshot as unknown as ScheduleOptionSnapshot
                    });
                  }
                }}
                onDeleteEntry={handleRefresh}
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
                      setSelectedIds(new Set([entry.id]));
                      setSelectionAnchorId(entry.id);
                      setInspectedItem({ 
                        entryId: entry.id,
                        optionId: finalOption.id, 
                        initialSnapshot: finalOption.data_snapshot as unknown as ScheduleOptionSnapshot
                      });
                    }
                  }}
                  onDeleteEntry={handleRefresh}
                  onAddAlternative={(entryId, category) => setPickerModal({
                    isOpen: true,
                    entryId,
                    category,
                    section: activeSection
                  })}
                  selectedIds={selectedIds}
                  onRowClick={handleRowClick}
                  inspectedEntryId={inspectedItem?.entryId}
                />
              </DndContext>
            )
          )}
        </div>
      </Tabs>
      </div>
      </div>

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

      {/* Right Inspector Panel */}
      <div 
        data-workspace-inspector="true"
        className={cn(
          "fixed inset-y-0 right-0 md:relative border-l border-slate-200 bg-white h-full shadow-2xl z-50 md:z-40 transition-all duration-300 ease-in-out shrink-0 overflow-hidden",
          inspectedItem ? "w-full md:w-[400px] opacity-100" : "w-0 border-l-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="w-full md:w-[400px] h-full">
          {inspectedItem && (
            <ScheduleWorkspaceInspector
              optionId={inspectedItem.optionId}
              initialSnapshot={inspectedItem.initialSnapshot}
              onClose={() => setInspectedItem(null)}
              onRefresh={handleRefresh}
              userRole={userRole}
              projectId={projectId}
              onNavigateNext={handleNavigateNext}
              onNavigatePrev={handleNavigatePrev}
              hasNext={hasNext}
              hasPrev={hasPrev}
              activeTab={activeInspectorTab}
              onTabChange={setActiveInspectorTab}
            />
          )}
        </div>
      </div>

    </div>
  );
}
