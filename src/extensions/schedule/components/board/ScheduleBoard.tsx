"use client";

import React from "react";
import {
  DndContext,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { ScheduleColumn } from "./ScheduleColumn";
import { cn } from "@/lib/utils";
import type { ProductType } from "@/generated/prisma";
import type { ProjectScheduleSheetPayload } from "../../types";

interface ScheduleBoardProps {
  sheet: ProjectScheduleSheetPayload;
  section: ProductType;
  onReorder: (category: string, items: { id: string; schedule_sort_order: number }[]) => Promise<void>;
  onMoveBetweenCategories?: (entryId: string, fromCategory: string, toCategory: string, newIndex: number) => Promise<void>;
  onAddEntry?: (category: string) => void;
  onEditEntry?: (entry: ProjectScheduleSheetPayload["groups"][0]["entries"][0]) => void;
  onDeleteEntry?: (id: string, category: string) => void;
}

export function ScheduleBoard({ 
  sheet, 
  onReorder, 
  onMoveBetweenCategories,
  onAddEntry, 
  onEditEntry, 
  onDeleteEntry 
}: ScheduleBoardProps) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the containers (categories)
    const activeContainer = sheet.groups.find(g => g.entries.some(e => e.id === activeId));
    const overContainer = sheet.groups.find(g => g.schedule_category === overId || g.entries.some(e => e.id === overId));

    if (!activeContainer || !overContainer) return;

    if (activeContainer.schedule_category !== overContainer.schedule_category) {
      // Logic for moving between categories
      const activeEntries = activeContainer.entries;
      const overEntries = overContainer.entries;
      const oldIndex = activeEntries.findIndex(e => e.id === activeId);
      const newIndex = overContainer.schedule_category === overId 
        ? overEntries.length 
        : overEntries.findIndex(e => e.id === overId);

      if (onMoveBetweenCategories) {
        await onMoveBetweenCategories(
          activeId, 
          activeContainer.schedule_category, 
          overContainer.schedule_category, 
          newIndex
        );
      }
    } else {
      // Reordering within the same category
      const entries = activeContainer.entries;
      const oldIndex = entries.findIndex(e => e.id === activeId);
      const newIndex = entries.findIndex(e => e.id === overId);

      if (oldIndex !== newIndex) {
        const newArray = arrayMove(entries, oldIndex, newIndex);
        const updateData = newArray.map((item, index) => ({
          id: item.id,
          schedule_sort_order: index + 1
        }));
        await onReorder(activeContainer.schedule_category, updateData);
      }
    }

    setActiveId(null);
  };

  return (
    <div className="w-full overflow-x-auto pb-6 no-scrollbar h-[calc(100vh-280px)]">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-6 h-full min-w-max px-1">
          {sheet.groups.map((group) => (
            <ScheduleColumn
              key={group.schedule_category}
              id={group.schedule_category}
              title={group.schedule_category}
              items={group.entries}
              onAddEntry={onAddEntry}
              onEditEntry={onEditEntry}
              onDeleteEntry={(id) => onDeleteEntry?.(id, group.schedule_category)}
            />
          ))}
          
          {/* Empty state or Add Column option could go here */}
          {sheet.groups.length === 0 && (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-slate-50/50">
               <div className="text-center">
                 <p className="font-serif text-lg text-slate-400">No categories found</p>
                 <p className="font-sans text-sm text-slate-400 mt-1">Start by adding a category or importing data.</p>
               </div>
            </div>
          )}
        </div>
      </DndContext>
    </div>
  );
}
