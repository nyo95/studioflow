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
  FileUp,
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
  promoteToLibraryAction 
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
import { cn } from "@/lib/utils";


interface ScheduleEntryRowProps {
  entry: ProjectScheduleEntryWithRelations;
  onRefresh: () => void;
  isSelected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  openPicker: (entryId: string) => void;
  openEditor: (optionId: string, snapshot: ScheduleOptionSnapshot) => void;
}
export function ScheduleEntryRow({ 
  entry, 
  onRefresh,
  isSelected,
  onSelect,
  openPicker,
  openEditor
}: ScheduleEntryRowProps) {
  const [isDetailsOpen, setIsDetailsOpen] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const [isPromoting, setIsPromoting] = React.useState(false);
  const [previewImage, setPreviewImage] = React.useState<string | undefined>(undefined);
  
  // Navigation State
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

  // Derive active data
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
      toast.success(`Deleted ${entry.schedule_code}`);
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
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-z0-9.]/gi, "_").toLowerCase();
      const uploadPath = `schedule/${entry.id}_${timestamp}_${safeFileName}`;

      const imageUrl = await uploadLibraryImage(file, uploadPath);
      unwrapActionResult(
        await updateScheduleOptionSnapshotAction({
          optionId: activeOption.id,
          data: { catalog_image_url: imageUrl },
        })
      );
      toast.success("Image uploaded successfully");
      onRefresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePromote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeOption) return;
    
    setIsPromoting(true);
    try {
      unwrapActionResult(
        await promoteToLibraryAction({ optionId: activeOption.id })
      );
      toast.success("Request sent to Global Library");
      onRefresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to promote material");
    } finally {
      setIsPromoting(false);
    }
  };

  const getValidString = (val: any) => {
    if (!val) return null;
    const clean = String(val).trim().toUpperCase();
    // Reject empty strings, literal dashes, N/A, and dummy dimension placeholders
    const isInvalid = clean === '' || 
                      clean === '-' || 
                      clean === 'N/A' || 
                      clean === 'X X CM' ||
                      clean === 'XX CM';
                      
    return isInvalid ? null : String(val).trim();
  };

  const materialName = getValidString(snapshot?.catalog_product_name);
  const productSku = getValidString(snapshot?.specs?.catalog_sku);
  const isReservedValue = materialName === "[RESERVED]";
  let primaryTitleParts = [];
  if (!isReservedValue && materialName) primaryTitleParts.push(materialName);
  if (productSku) primaryTitleParts.push(`[${productSku}]`);

  // Substitution logic
  let displayTitle = "";
  if (!isReservedValue && (materialName || productSku)) {
    // Standard format: [SKU] - [Name] ex. [Brand]
    const brand = getValidString(snapshot?.catalog_brand);
    
    const parts = [];
    if (productSku) parts.push(productSku);
    if (materialName) parts.push(materialName);
    
    displayTitle = parts.join(" - ");
    if (brand) {
      displayTitle += ` ex. ${brand}`;
    }
  } else if (!isReservedValue) {
    // Fallback for empty Name and empty SKU -> Physical Identity
    const physicalParts = [
      getValidString(snapshot?.specs?.catalog_color), 
      getValidString(snapshot?.specs?.catalog_motif), 
      getValidString(snapshot?.specs?.catalog_finishing)
    ].filter(Boolean);
    
    displayTitle = physicalParts.length > 0 ? physicalParts.join(" — ") : "Action Required";
  } else {
    displayTitle = "[RESERVED]";
  }

  // Display Meta: Brand, Motif, Color, Finishing, Dimensions

  // Display Meta: Brand, Motif, Color, Finishing, Dimensions
  const displayMeta = [
    getValidString(snapshot?.catalog_sub_category), 
    getValidString(snapshot?.specs?.catalog_motif), 
    getValidString(snapshot?.catalog_initials_type) || getValidString(snapshot?.specs?.catalog_color), 
    getValidString(snapshot?.specs?.catalog_finishing),
    getValidString(snapshot?.specs?.catalog_dimensions)
  ]
  .filter(Boolean)
  // Deduplicate: If the value is already in the Title, don't show it in Meta
  .filter(val => !displayTitle.toLowerCase().includes(String(val).toLowerCase()))
  .join(' • ');





  const statusColor = {
    APPROVED: "bg-emerald-500",
    PENDING: "bg-amber-500",
    REJECTED: "bg-rose-500",
  };

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (activeOption && snapshot) {
          openEditor(activeOption.id, snapshot);
        } else {
          openPicker(entry.id);
        }
      }}
      {...attributes}
      {...listeners}
      className={cn(
        "group/row border-b border-slate-100 transition-all duration-300 hover:bg-slate-50/50 cursor-pointer select-none h-32", // Increased to h-32 for better visibility
        isDragging ? "bg-white shadow-2xl scale-[1.01] z-50 cursor-grabbing" : "",
        isSelected ? "bg-blue-50/50 hover:bg-blue-50/80" : ""
      )}
    >

      {/* 1. CODE (w-20) */}
      <TableCell className="w-20 px-4 py-2 align-middle relative">
        <div className="flex items-center gap-2 group/code h-full">

          {hasMultipleOptions && (
            <div className="flex flex-col items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
              <button 
                onClick={handlePrevOption}
                className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-900 transition-colors"
              >
                <ChevronUp className="h-3 w-3" />
              </button>
              <button 
                onClick={handleNextOption}
                className="p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-900 transition-colors"
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
          )}
          
          <div className="flex-1 flex items-center justify-center relative gap-2">
            <div className="font-inter text-base font-black tracking-tighter text-slate-950 uppercase leading-none">{entry.schedule_code}</div>
            
            <div className="min-w-[18px] flex items-center justify-center">
              {activeOption?.material_catalog ? (
                <button 
                  onClick={handlePromote}
                  disabled={isPromoting || activeOption.material_catalog.status !== "REJECTED"}
                  className={cn(
                    "p-1 rounded-md text-white flex items-center justify-center shadow-sm border border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                    activeOption.material_catalog.status === "REJECTED" ? "cursor-pointer hover:scale-110" : "cursor-default",
                    statusColor[activeOption.material_catalog.status as keyof typeof statusColor] || "bg-slate-400"
                  )}
                  title={
                    activeOption.material_catalog.status === "REJECTED" 
                      ? "Rejected. Click to re-request approval." 
                      : `Global Library Status: ${activeOption.material_catalog.status}`
                  }
                >
                  {isPromoting ? (
                    <Loader2 className="h-2 w-2 animate-spin" />
                  ) : (
                    <Globe className="h-2 w-2 stroke-[3]" />
                  )}
                </button>
              ) : (
                <button
                  onClick={handlePromote}
                  disabled={isPromoting}
                  className="p-1 rounded-md bg-slate-100 text-slate-400 hover:text-slate-900 hover:bg-slate-200 flex items-center justify-center shadow-sm border border-slate-200 transition-transform hover:scale-110 opacity-0 group-hover/code:opacity-100"
                  title="Promote to Global Library"
                >
                  {isPromoting ? (
                    <Loader2 className="h-2 w-2 animate-spin" />
                  ) : (
                    <FileUp className="h-2 w-2 stroke-[3]" />
                  )}
                </button>
              )}
            </div>

          </div>
        </div>
      </TableCell>

      {/* 2. IMAGE (w-24) */}
      <TableCell className="w-24 px-4 py-2 align-middle text-center">

        <div className="relative inline-block group/image">
          {snapshot?.catalog_image_url ? (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage(snapshot.catalog_image_url || undefined);
              }}
              className="relative h-24 w-24 overflow-hidden rounded-md border border-slate-200 shadow-md transition-all hover:border-slate-900 group/btn bg-white"
            >
              <img
                src={snapshot.catalog_image_url}
                alt={displayTitle}
                className="h-full w-full object-cover transition-all duration-500 group-hover/btn:scale-110"
              />

            </button>
          ) : (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50/50 text-[10px] font-bold text-slate-300 hover:border-slate-300 hover:text-slate-400 transition-all group/empty"
            >
              <Plus className="h-6 w-6 group-hover/empty:scale-110 transition-transform" />
            </div>
          )}
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            onClick={(e) => e.stopPropagation()}
            accept="image/*" 
            className="hidden" 
          />
        </div>
        
        <ImageLightbox 
          src={previewImage || null} 
          onClose={() => setPreviewImage(undefined)} 
        />
      </TableCell>

      {/* 3. PRODUCT INFO (flex-1) */}
      <TableCell className="px-6 py-2 align-middle flex-1 min-w-[350px]">
        <div className="flex flex-col gap-1 truncate">
          <div className="flex items-center gap-2">
            <div className={cn(
              "font-lora font-semibold text-[15px] truncate leading-tight", // Premium serif heading
              isReservedValue ? "text-slate-300 italic" : "text-slate-900",
              isSelected ? "text-blue-900" : ""
            )}>
              {displayTitle}
            </div>
            {isReservedValue && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-100 flex-shrink-0">
                <div className="h-1 w-1 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-widest text-amber-600">Action Required</span>
              </div>
            )}
          </div>
          <div className="text-slate-400 text-[11px] font-medium uppercase tracking-wider truncate flex items-center gap-2">
            <span className="shrink-0 text-slate-900 px-1 py-0.5 bg-slate-100 rounded text-[9px] font-black">{snapshot?.schedule_category}</span>
            <span className="truncate">{displayMeta}</span>
          </div>
        </div>
      </TableCell>



      {/* 4. LOCATION (w-40) */}
      <TableCell className="w-40 px-6 py-2 align-middle">
        <div className="text-[12px] font-bold text-slate-800 truncate uppercase tracking-tight">
          {entry.schedule_location || "-"}
        </div>
      </TableCell>

      {/* 5. ACTIONS (w-16) */}
      <TableCell className="w-16 px-4 py-2 text-right align-middle">
        <div className="flex items-center justify-end opacity-0 group-hover/row:opacity-100 transition-opacity duration-200">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 focus-visible:ring-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px] rounded-xl">
              <DropdownMenuItem 
                className="cursor-pointer" 
                onClick={(e) => {
                  e.stopPropagation();
                  openPicker(entry.id);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Alternative
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-rose-500 focus:text-rose-600"
                onClick={handleDeleteEntry}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Entry
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </TableCell>

    </TableRow>
  );
}
