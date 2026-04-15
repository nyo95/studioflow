"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FileText,
  GripVertical,
  MoreHorizontal,
  Trash2,
  Plus,
  Loader2,
  Globe,
  ChevronUp,
  ChevronDown
} from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { Button } from "@/components/ui/button";
import { 
  deleteScheduleEntryAction, 
  updateScheduleOptionSnapshotAction, 
} from "@/actions/schedule-actions";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectScheduleEntryWithRelations, ScheduleOptionSnapshot } from "../types";
import { ScheduleMaterialPickerModal } from "./ScheduleMaterialPickerModal";
import { ScheduleSpecEditorModal } from "./ScheduleSpecEditorModal";
import { uploadLibraryImage } from "../../library/lib/upload-client";
import { ProjectScheduleProvider } from "../context/ProjectScheduleContext";
import { cn } from "@/lib/utils";

interface ScheduleEntryRowProps {
  entry: ProjectScheduleEntryWithRelations;
  onRefresh: () => void;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
}

export function ScheduleEntryRow({ 
  entry, 
  onRefresh,
  isSelected,
  onSelect 
}: ScheduleEntryRowProps) {
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);
  const [isSpecEditorOpen, setIsSpecEditorOpen] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [previewImage, setPreviewImage] = React.useState<string | undefined>(undefined);
  
  const [activeOptionId, setActiveOptionId] = React.useState<string | null>(
    entry.options.find(o => o.is_final)?.id || entry.options[0]?.id || null
  );

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const activeOption = entry.options.find(o => o.id === activeOptionId) || entry.options[0];
  const snapshot = activeOption?.data_snapshot as ScheduleOptionSnapshot | null | undefined;
  const hasMultipleOptions = entry.options.length > 1;

  const handleNextOption = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeOptionId) return;
    const currentIndex = entry.options.findIndex(o => o.id === activeOptionId);
    const nextIndex = (currentIndex + 1) % entry.options.length;
    setActiveOptionId(entry.options[nextIndex].id);
  };

  const handlePrevOption = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeOptionId) return;
    const currentIndex = entry.options.findIndex(o => o.id === activeOptionId);
    const prevIndex = (currentIndex - 1 + entry.options.length) % entry.options.length;
    setActiveOptionId(entry.options[prevIndex].id);
  };

  const handleDeleteEntry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      unwrapActionResult(
        await deleteScheduleEntryAction({
          projectId: entry.project_id,
          entryId: entry.id,
        })
      );
      toast.success(`Deleted ${entry.code}`);
      onRefresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete entry");
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeOption) return;

    setIsUploading(true);
    try {
      const uploadPath = `schedule/${entry.id}_${Date.now()}_${file.name}`;
      const imageUrl = await uploadLibraryImage(file, uploadPath);
      unwrapActionResult(
        await updateScheduleOptionSnapshotAction({
          optionId: activeOption.id,
          data: { image_url: imageUrl },
        })
      );
      toast.success("Image uploaded successfully");
      onRefresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const typeName = snapshot?.name || snapshot?.specs?.product_type || "No specification";
  
  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      {...attributes}
      {...listeners}
      className={cn(
        "group/row border-b border-slate-200 transition-all duration-300 hover:bg-slate-50 cursor-default select-none",
        isDragging ? "bg-white shadow-2xl scale-[1.01] z-50 cursor-grabbing" : "",
        isSelected ? "bg-blue-50/50" : ""
      )}
    >
      <TableCell className="w-10 px-0 text-center border-r border-slate-200/60 align-top py-8">
        <GripVertical className="h-3.5 w-3.5 text-slate-300 mx-auto" />
      </TableCell>

      <TableCell className="w-24 px-4 py-8 align-top border-r border-slate-200/60 bg-slate-50/10 relative">
        <div className="flex items-start gap-3">
          {hasMultipleOptions && (
            <div className="flex flex-col items-center gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={handlePrevOption} className="p-1 rounded hover:bg-slate-200"><ChevronUp className="h-3 w-3" /></button>
              <button onClick={handleNextOption} className="p-1 rounded hover:bg-slate-200"><ChevronDown className="h-3 w-3" /></button>
            </div>
          )}
          <div className="font-inter text-base font-black tracking-tighter text-slate-950 uppercase">{entry.code}</div>
        </div>
      </TableCell>

      <TableCell className="w-40 px-4 py-8 align-top border-r border-slate-200/60 font-inter">
        <div className="text-[10px] font-bold text-slate-900 uppercase tracking-wide">{snapshot?.category || entry.category}</div>
      </TableCell>

      <TableCell className="w-32 px-4 py-8 align-top border-r border-slate-200/60 bg-slate-50/5">
        <div className="text-[10px] font-bold text-slate-400 font-inter uppercase tracking-widest">{snapshot?.brand || "-"}</div>
      </TableCell>

      <TableCell className="px-4 py-8 align-top border-r border-slate-200/60 min-w-[200px]">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsSpecEditorOpen(true); }}
          className="font-inter text-xs font-bold text-slate-900 leading-tight uppercase hover:underline"
        >
          {typeName}
        </button>
      </TableCell>

      <TableCell className="w-40 px-4 py-8 align-top border-r border-slate-200/60 bg-slate-50/10 text-center">
        <div className="text-[10px] font-medium text-slate-400 font-inter italic uppercase">
          {snapshot?.initials_type || "-"}
        </div>
      </TableCell>

      <TableCell className="w-32 p-4 align-top border-r border-slate-200/60 text-center">
        <div className="relative inline-block group/image">
          {snapshot?.image_url ? (
            <button onClick={(e) => { e.stopPropagation(); setPreviewImage(snapshot.image_url!); }} className="relative h-24 w-24 overflow-hidden rounded border border-slate-200 bg-white">
              <img src={snapshot.image_url} alt="" className="h-full w-full object-cover" />
            </button>
          ) : (
            <div onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} className="flex h-24 w-24 cursor-pointer items-center justify-center rounded border border-dashed border-slate-200 bg-slate-50/50">
              <Plus className="h-4 w-4 text-slate-300" />
            </div>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />
        </div>
        <ImageLightbox src={previewImage || null} onClose={() => setPreviewImage(undefined)} />
      </TableCell>

      <TableCell className="w-32 px-4 py-8 align-top border-r border-slate-200/60 text-center">
        <div className="text-[10px] font-bold text-slate-600 uppercase">{entry.location || "-"}</div>
      </TableCell>

      <TableCell className="w-32 px-4 py-8 align-top border-r border-slate-200/60 bg-slate-50/5">
        <div className="text-[9px] font-medium text-slate-400 uppercase">
          {snapshot?.contact_name || snapshot?.contact_email ? (snapshot.contact_name || snapshot.contact_email) : "N/A"}
        </div>
      </TableCell>

      <TableCell className="w-16 px-2 py-8 text-right align-top">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" className="h-8 w-8 rounded-lg p-0 text-slate-300 hover:bg-slate-100 hover:text-slate-900">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[180px] rounded-xl">
            <DropdownMenuItem onClick={() => setIsPickerOpen(true)}><Plus className="mr-2 h-3.5 w-3.5" />Add Alternative</DropdownMenuItem>
            <DropdownMenuItem className="text-rose-500" onClick={handleDeleteEntry}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ProjectScheduleProvider value={{ projectId: entry.project_id, category: entry.category, section: entry.section, onSuccess: onRefresh }}>
          <ScheduleMaterialPickerModal entryId={entry.id} isOpen={isPickerOpen} onOpenChange={setIsPickerOpen} />
        </ProjectScheduleProvider>

        {activeOption && snapshot && (
          <ScheduleSpecEditorModal optionId={activeOption.id} initialSnapshot={snapshot} isOpen={isSpecEditorOpen} onOpenChange={setIsSpecEditorOpen} onSuccess={onRefresh} />
        )}
      </TableCell>
    </TableRow>
  );
}
