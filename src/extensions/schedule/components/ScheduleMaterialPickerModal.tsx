"use client";

import * as React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Search, 
  Plus, 
  Loader2, 
  Package, 
  Check, 
  Building2,
  Calendar,
  Layers,
  Sparkles
} from "lucide-react";
import {
  getMaterialsAction,
  getVendorsAction,
} from "../../library/actions/library-actions";
import {
  addScheduleEntryAction,
  addScheduleOptionAction,
} from "@/actions/schedule-actions";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { cn } from "@/lib/utils";
import type {
  MaterialCatalogWithRelations,
  LibraryVendor,
} from "../../library/types";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { ScheduleSection } from "@/generated/prisma";
import { useProjectScheduleContext } from "../context/ProjectScheduleContext";

type SchedulePickerPayload =
  | {
      projectId: string;
      category: string;
      section: ScheduleSection;
      mode: "catalog";
      catalogItemId: string;
    }
  | {
      projectId: string;
      category: string;
      section: ScheduleSection;
      mode: "create_catalog";
      catalogCreateData: {
        name: string;
        brand: string;
        reference_url?: string | null;
      };
    }
  | {
      projectId: string;
      category: string;
      section: ScheduleSection;
      mode: "reserve";
    };

interface ScheduleMaterialPickerModalProps {
  entryId?: string; // If provided, we are adding an option to an existing entry
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ScheduleMaterialPickerModal({
  entryId,
  isOpen,
  onOpenChange,
}: ScheduleMaterialPickerModalProps) {
  const { projectId, category, section, onSuccess } = useProjectScheduleContext();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [materials, setMaterials] = React.useState<MaterialCatalogWithRelations[]>([]);
  const [vendors, setVendors] = React.useState<LibraryVendor[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = React.useState<string | null>(null);
  
  // Custom Creation State
  const [createCatalogName, setCreateCatalogName] = React.useState<string | null>(null);
  const [createBrand, setCreateBrand] = React.useState("");
  const [createReferenceUrl, setCreateReferenceUrl] = React.useState("");

  const fetchVendors = React.useCallback(async () => {
    try {
      const res = unwrapActionResult(await getVendorsAction(undefined));
      setVendors(res);
    } catch (e) {
      console.error("Failed to fetch vendors", e);
    }
  }, []);

  const fetchMaterials = React.useCallback(async () => {
    setIsSearching(true);
    try {
      const res = unwrapActionResult(await getMaterialsAction({ search: searchQuery }));
      setMaterials(res);
    } catch (error) {
      toast.error("Failed to fetch library catalog");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  React.useEffect(() => {
    if (isOpen) {
      fetchVendors();
      fetchMaterials();
    }
  }, [isOpen, fetchMaterials, fetchVendors]);

  // Load catalog options
  React.useEffect(() => {
    let isMounted = true;
    const run = async () => {
      setIsSearching(true);
      try {
        const results = unwrapActionResult(
          await getMaterialsAction({
            category: category !== "all" ? category : undefined,
            search: searchQuery.trim() || undefined,
          }),
        );
        if (isMounted) setMaterials(results);
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        if (isMounted) setIsSearching(false);
      }
    };

    const timer = setTimeout(() => { run(); }, 300);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [category, searchQuery]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      let payload: SchedulePickerPayload;

      if (createCatalogName) {
        payload = {
          projectId,
          category,
          section,
          mode: "create_catalog",
          catalogCreateData: {
            name: createCatalogName,
            brand: createBrand.trim() || "Custom",
            reference_url: createReferenceUrl.trim() || null,
          },
        };
      } else {
        payload = {
          projectId,
          category,
          section,
          mode: "catalog",
          catalogItemId: selectedMaterialId as string,
        };
      }

      if (entryId) {
        unwrapActionResult(
          await addScheduleOptionAction({
            entryId: entryId,
            mode: payload.mode,
            ...(payload.mode === "catalog" ? { catalogItemId: payload.catalogItemId } : {}),
            ...(payload.mode === "create_catalog" ? { catalogCreateData: payload.catalogCreateData } : {}),
          }),
        );
        toast.success("New alternative option added successfully");
      } else {
        unwrapActionResult(await addScheduleEntryAction(payload));
        toast.success(`New row added to ${category}`);
      }

      onOpenChange(false);
      if (onSuccess) onSuccess();
      // Note: Removed router.refresh() - onSuccess already triggers fetchSchedule

      // Reset form
      setCreateBrand("");
      setCreateReferenceUrl("");
      setSelectedMaterialId(null);
      setCreateCatalogName(null);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Something went wrong during submission"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        onKeyDown={(e) => e.stopPropagation()}
        className="sm:max-w-[1000px] p-0 overflow-hidden border-none rounded-[2rem] shadow-2xl bg-white focus-visible:outline-none"
      >
        <DialogHeader className="p-8 pb-6 border-b border-slate-100 bg-slate-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200">
                <Layers className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="font-serif text-2xl font-medium text-slate-900">
                  {entryId ? "Add Alternative Option" : "Add Row"}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Section:</span>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-tighter border-slate-200 text-slate-500 rounded-sm px-1.5 h-4">
                    {section}
                  </Badge>
                  <span className="text-slate-300 mx-1">â€¢</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category:</span>
                  <Badge className="bg-slate-900 text-white text-[10px] font-bold uppercase tracking-tighter rounded-sm px-1.5 h-4">
                    {category}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="hidden md:flex flex-col items-end">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">Architecture Pillar 2</span>
              <span className="text-[9px] font-sans italic text-slate-400">Standardized Selection Protocol</span>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[430px] px-8 pb-8">
            <div className="space-y-4 pt-4">
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Search Catalog or Define New</Label>
                <div className="relative group">
                  <CreatableSearch
                    options={materials.map((item) => ({
                      id: item.id,
                      name: `${item.product_type} â€¢ ${item.vendor?.brand_name ?? "Unknown Brand"}`,
                      badge: item.status === 'APPROVED' ? "Gold" : "Queue"
                    }))}
                    value={selectedMaterialId ?? undefined}
                    onSelect={(id: string) => {
                      setSelectedMaterialId(id);
                      setCreateCatalogName(null);
                    }}
                    onCreate={(name: string) => {
                      setCreateCatalogName(name);
                      setSelectedMaterialId(null);
                      setSearchQuery(name);
                    }}
                    onSearchChange={setSearchQuery}
                    placeholder="Type brand, material name, or motif..."
                    allowFreeText
                  />
                </div>
              </div>

            {isSearching ? (
              <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-50">
                <Loader2 className="h-10 w-10 animate-spin text-slate-900" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 animate-pulse">
                  Scanning Archives...
                </p>
              </div>
            ) : materials.length > 0 ? (
              <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-sm ring-1 ring-slate-100/50">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow className="hover:bg-transparent border-slate-100">
                      <TableHead className="w-16 h-12"></TableHead>
                      <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Material Details
                      </TableHead>
                      <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Brand / Origin
                      </TableHead>
                      <TableHead className="w-10 h-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materials.map((item) => (
                      <TableRow
                        key={item.id}
                        onClick={() => setSelectedMaterialId(item.id)}
                        className={cn(
                          "cursor-pointer transition-colors group h-16 border-slate-50",
                          selectedMaterialId === item.id
                            ? "bg-slate-900/5 hover:bg-slate-900/10"
                            : "hover:bg-slate-50",
                        )}
                      >
                        <TableCell className="py-2">
                          <div className="h-12 w-12 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center shrink-0">
                            {item.cover_url ? (
                              <img
                                src={item.cover_url}
                                alt={item.product_type}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-slate-200" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {item.product_type}
                              </span>
                              {item.status === "APPROVED" ? (
                                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] font-black uppercase h-4 px-1.5 shadow-none">
                                  Gold
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-50 text-amber-600 border-amber-100 text-[8px] font-black uppercase h-4 px-1.5 shadow-none">
                                  In Review
                                </Badge>
                              )}
                            </div>
                            {item.sub_category && (
                              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">
                                {item.sub_category}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3 w-3 text-slate-300" />
                            <span className="text-xs font-medium text-slate-600">
                              {item.vendor?.brand_name || "Bespoke / Custom"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 pr-6">
                          {selectedMaterialId === item.id ? (
                            <div className="h-6 w-6 rounded-full bg-slate-900 flex items-center justify-center text-white scale-100 animate-in zoom-in-50 duration-300">
                              <Check className="h-3.5 w-3.5 stroke-[3]" />
                            </div>
                          ) : (
                            <div className="h-6 w-6 rounded-full border border-slate-200 group-hover:border-slate-300 transition-colors" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : searchQuery ? (
              <div className="py-20 text-center">
                <p className="text-sm font-sans text-slate-400 italic">
                  No matches found for &quot;{searchQuery}&quot;
                </p>
              </div>
            ) : (
              <div className="py-20 text-center space-y-2 opacity-30 italic font-sans font-medium text-slate-400 text-sm">
                Type to explore the global material library...
              </div>
            )}

            {createCatalogName && (
              <div className="rounded-2xl border-2 border-slate-900 bg-white p-6 space-y-5 shadow-xl animate-in fade-in zoom-in-95 duration-300">
                <div className="flex items-center gap-3">
                   <div className="h-8 w-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
                      <Plus className="h-4 w-4" />
                   </div>
                   <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">New Catalog Intent</p>
                      <p className="text-sm font-semibold text-slate-900 underline decoration-slate-200 underline-offset-4">{createCatalogName}</p>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Vendor / Brand</Label>
                    <Input
                      value={createBrand}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateBrand(e.target.value)}
                      placeholder="e.g. Roman, KIA, or Custom"
                      className="h-11 bg-slate-50 border-none rounded-xl font-sans text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">External Reference Link</Label>
                    <Input
                      value={createReferenceUrl}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreateReferenceUrl(e.target.value)}
                      placeholder="https://www.tokopedia.com/..."
                      className="h-11 bg-slate-50 border-none rounded-xl font-sans text-sm"
                    />
                  </div>
                </div>
                <p className="text-[10px] font-medium text-slate-400 italic">
                  * Creating this will automatically harvest the data into Global Library (Pending Review)
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-8 pt-4 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="text-[10px] font-bold font-sans text-slate-400 uppercase tracking-widest">
            {selectedMaterialId ? "1 Item Selected" : createCatalogName ? "New Item Ready" : "Selection Required"}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button
              variant="ghost"
              onClick={async () => {
                setIsSubmitting(true);
                try {
                  const payload: SchedulePickerPayload = { projectId, category, section, mode: "reserve" };
                  if (entryId) {
                    unwrapActionResult(await addScheduleOptionAction({ entryId, mode: "reserve" }));
                    toast.success("Reserved placeholder option added");
                  } else {
                    unwrapActionResult(await addScheduleEntryAction(payload));
                    toast.success("Code reserved successfully");
                  }
                  onOpenChange(false);
                  if (onSuccess) onSuccess();
                  // Note: Removed router.refresh() - onSuccess already triggers fetchSchedule
                } catch (e: unknown) {
                  toast.error(e instanceof Error ? e.message : "Failed to reserve code");
                } finally {
                  setIsSubmitting(false);
                }
              }}
              disabled={isSubmitting}
              className="flex-1 md:flex-initial h-12 px-6 rounded-2xl font-sans font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all border border-slate-200"
            >
              Reserve Code
            </Button>

            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="flex-1 md:flex-initial h-12 px-6 rounded-2xl font-sans font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (!selectedMaterialId && !createCatalogName)}
              className="flex-1 md:flex-initial bg-slate-950 hover:bg-slate-800 text-white rounded-2xl h-12 px-10 shadow-xl shadow-slate-200 transition-all font-sans font-bold text-xs uppercase tracking-widest relative overflow-hidden"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {entryId ? "Add Option" : "Add Row"}
                  <Plus className="ml-2 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

