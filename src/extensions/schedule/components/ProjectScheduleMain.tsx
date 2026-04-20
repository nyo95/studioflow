"use client";

import * as React from "react";
import { Loader2, Upload, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unwrapActionResult } from "@/lib/result";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScheduleSection } from "@/generated/prisma";
import { 
  getProjectScheduleAction, 
  importScheduleAction,
  reorderScheduleEntriesAction,
  bulkDeleteScheduleEntriesAction,
} from "@/actions/schedule-actions";
import { ScheduleCategorySection } from "./ScheduleCategorySection";
import { ScheduleSearchBar } from "./ScheduleSearchBar";
import { ScheduleMaterialPickerModal } from "./ScheduleMaterialPickerModal";
import { ScheduleSpecEditorModal } from "./ScheduleSpecEditorModal";
import type { ProjectScheduleSheetPayload } from "../types";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { ErrorFallback } from "@/components/shared/error-fallback";
import { ProjectScheduleProvider } from "../context/ProjectScheduleContext";
import { PageHeader, TableCard } from "@/ui_engine";

import { 
  TableHeader, 
  TableHead,
  TableRow 
} from "@/components/ui/table";
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
}

export function ProjectScheduleMain({
  projectId,
}: ProjectScheduleMainProps) {
  const [sheet, setSheet] = React.useState<ProjectScheduleSheetPayload | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeSection, setActiveSection] = React.useState<ScheduleSection>(ScheduleSection.MATERIAL);
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
    section?: ScheduleSection;
  }>({ 
    isOpen: false 
  });

  const [editorModal, setEditorModal] = React.useState<{ 
    isOpen: boolean; 
    optionId: string; 
    initialSnapshot: import("../types").ScheduleOptionSnapshot;
  } | null>(null);

  const fetchSchedule = React.useCallback(async (section: ScheduleSection) => {
    setLoading(true);
    try {
      const result = unwrapActionResult(await getProjectScheduleAction({
        projectId,
        section,
      }));
      setSheet(result as ProjectScheduleSheetPayload);
      // Clear selection on section change or full refresh? 
      // User says "click outside", but refresh usually stays unless items are gone.
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
        // Only clear if not clicking on a modal/dropdown that might be outside the container
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

    // Flatten all entries across categories to allow range select
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
      // Anchor stays the same for shift selection to allow range adjustment
    } else if (isCtrl) {
      const next = new Set(selectedIds);
      if (next.has(id)) {
        next.delete(id);
        // If we unselected the anchor, update it to the last remaining item or null
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
  }, [fetchSchedule, activeSection]);

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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !sheet) return;

    // Find which group contains the active and over items
    const activeGroup = sheet.groups.find(g => g.entries.some(e => e.id === active.id));
    const overGroup = sheet.groups.find(g => g.entries.some(e => e.id === over.id));

    // Only allow reordering within the same category
    if (!activeGroup || !overGroup || activeGroup.schedule_category !== overGroup.schedule_category) return;

    const entries = activeGroup.entries;
    const oldIndex = entries.findIndex((item) => item.id === active.id);
    const newIndex = entries.findIndex((item) => item.id === over.id);
    
    const newArray = arrayMove(entries, oldIndex, newIndex);
    const updateData = newArray.map((item, index) => ({
      id: item.id,
      schedule_sort_order: index + 1
    }));

    try {
      unwrapActionResult(await reorderScheduleEntriesAction({
        projectId: projectId,
        section: activeSection,
        category: activeGroup.schedule_category,
        items: updateData
      }));
      fetchSchedule(activeSection);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reorder items");
    }
  };

  const handleBulkDelete = async () => {
    if (!sheet || selectedIds.size === 0) return;
    
    const confirm = window.confirm(`Are you sure you want to delete ${selectedIds.size} selected items?`);
    if (!confirm) return;

    const toastId = toast.loading(`Deleting ${selectedIds.size} items...`);
    setLoading(true);
    try {
      // Group selected IDs by category
      const entriesByGroup: Record<string, string[]> = {};
      sheet.groups.forEach(g => {
        const idsInGroup = g.entries
          .filter(e => selectedIds.has(e.id))
          .map(e => e.id);
        if (idsInGroup.length > 0) {
          entriesByGroup[g.schedule_category] = idsInGroup;
        }
      });

      // Execute bulk delete for each group
      for (const [category, ids] of Object.entries(entriesByGroup)) {
        unwrapActionResult(await bulkDeleteScheduleEntriesAction({
          projectId,
          section: activeSection,
          category,
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

  const groups = sheet?.groups ?? [];

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
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <PageHeader
        eyebrow="Specifications"
        title="Material & Fixtures Schedule"
        description="Detailed procurement and technical schedule."
        titleClassName="font-lora text-4xl normal-case tracking-tight text-slate-900"
        descriptionClassName="mt-1 font-inter text-sm text-slate-500 max-w-2xl"
        className="pb-2"
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
                className="h-11 rounded-xl text-xs font-bold text-red-600 bg-transparent hover:bg-red-50 px-4 transition-all"
                onClick={handleBulkDelete}
              >
                Delete Selected ({selectedIds.size})
              </Button>
            )}


            <Button
              variant="outline"
              data-selection-ignore="true"
              onMouseDown={(e) => e.stopPropagation()}
              className="h-11 rounded-xl border-slate-200 text-xs font-semibold text-slate-600"
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
        defaultValue={ScheduleSection.MATERIAL}
        value={activeSection}
        onValueChange={(value) => setActiveSection(value as ScheduleSection)}
        className="w-full"
      >
        <TabsList className="h-12 w-full max-w-md rounded-xl border border-slate-200/60 bg-slate-100/50 p-1">
          <TabsTrigger
            value={ScheduleSection.MATERIAL}
            className="flex-1 rounded-lg py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            Material Schedule
          </TabsTrigger>
          <TabsTrigger
            value={ScheduleSection.FIXTURE}
            className="flex-1 rounded-lg py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
          >
            Fixtures Schedule
          </TabsTrigger>
        </TabsList>

        <div className="mt-6">
          <ScheduleSearchBar 
            projectId={projectId}
            section={activeSection}
            onSuccess={handleRefresh}
          />
        </div>

        <div ref={containerRef} className="mt-6 w-full">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <TableCard className="w-full">
              <TableHeader className="sticky top-0 z-30 bg-white border-b border-slate-200">
                <TableRow className="hover:bg-transparent transition-none border-b border-slate-100">
                  <TableHead className="w-20 px-4 py-2 text-slate-400 text-[10px] font-medium uppercase tracking-wider text-center">Code</TableHead>
                  <TableHead className="w-16 px-4 py-2 text-slate-400 text-[10px] font-medium uppercase tracking-wider text-center">Image</TableHead>
                  <TableHead className="flex-1 px-4 py-2 text-slate-400 text-[10px] font-medium uppercase tracking-wider">Product Information</TableHead>
                  <TableHead className="w-32 px-4 py-2 text-slate-400 text-[10px] font-medium uppercase tracking-wider">Location</TableHead>
                  <TableHead className="w-16 px-4 py-2 text-right"></TableHead>
                </TableRow>
              </TableHeader>

              {groups.map((group) => (
                <ErrorBoundary
                  key={group.schedule_category}
                  name={`Schedule ${group.schedule_category}`}
                  fallback={
                    <tbody>
                      <tr>
                        <td colSpan={11} className="p-4">
                          <ErrorFallback
                            title={`Failed to render ${group.schedule_category}`}
                            message="Please retry loading this category section."
                            onRetry={() => fetchSchedule(activeSection)}
                          />
                        </td>
                      </tr>
                    </tbody>
                  }
                >
                  <ScheduleCategorySection
                    projectId={projectId}
                    category={group.schedule_category}
                    section={group.schedule_section}
                    entries={group.entries}
                    onRefresh={() => fetchSchedule(activeSection)}
                    selectedIds={selectedIds}
                    onRowClick={handleRowClick}
                    onClearSelection={() => {
                       setSelectedIds(new Set());
                       setSelectionAnchorId(null);
                    }}
                    openPicker={(entryId) => setPickerModal({ 
                      isOpen: true, 
                      entryId,
                      category: group.schedule_category,
                      section: activeSection
                    })}

                    openEditor={(optionId, snapshot) => setEditorModal({ isOpen: true, optionId, initialSnapshot: snapshot })}
                  />
                </ErrorBoundary>
              ))}
            </TableCard>
          </DndContext>
        </div>
      </Tabs>

      {/* Hoisted Modals */}
      {pickerModal.isOpen && pickerModal.category && pickerModal.section && (
        <ProjectScheduleProvider
          value={{
            projectId,
            category: pickerModal.category,
            section: pickerModal.section,
            onSuccess: handleRefresh
          }}
        >
          <ScheduleMaterialPickerModal
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
        />
      )}
    </div>
  );
}
