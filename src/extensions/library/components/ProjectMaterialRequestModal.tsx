"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search, Loader2, Plus, Box, MapPin, ImageIcon, CheckCircle2, Building2 } from "lucide-react";

import { getMaterialsAction, createProjectMaterialRequestAction } from "../actions/library-actions";
import { MaterialCatalogWithRelations } from "../types";
import { unwrapActionResult } from "@/lib/result";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { UniversalImageUploader } from "@/components/ui/universal-image-uploader";

interface ProjectMaterialRequestModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  onSuccess?: () => void;
}

export function ProjectMaterialRequestModal({
  isOpen,
  onOpenChange,
  projectId,
  onSuccess,
}: ProjectMaterialRequestModalProps) {
  const [materials, setMaterials] = React.useState<MaterialCatalogWithRelations[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = React.useState<string | null>(null);
  const [isManualEntry, setIsManualEntry] = React.useState(false);
  const [customName, setCustomName] = React.useState("");
  const [referenceUrl, setReferenceUrl] = React.useState("");
  const [search, setSearch] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [areaLocation, setAreaLocation] = React.useState("");
  const [coverUrl, setCoverUrl] = React.useState("");
  const [originalUrl, setOriginalUrl] = React.useState("");

  const fetchMaterials = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = unwrapActionResult(await getMaterialsAction({ search, status: 'APPROVED' }));
      setMaterials(result);
    } catch (error) {
      toast.error("Failed to fetch library catalog");
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    if (!isOpen) {
      setSearch("");
      setNotes("");
      setAreaLocation("");
      setCustomName("");
      setReferenceUrl("");
      setCoverUrl("");
      setOriginalUrl("");
    }
    if (isOpen) {
      fetchMaterials();
    }
  }, [isOpen, fetchMaterials]);

  async function handleSubmit() {
    if (!isManualEntry && !selectedMaterialId) {
      toast.error("Please select a material first or use Manual Entry");
      return;
    }

    if (isManualEntry && !customName.trim()) {
      toast.error("Please enter a material name for manual entry");
      return;
    }
    
    setSubmitting(true);
    try {
      unwrapActionResult(await createProjectMaterialRequestAction({
        project_id: projectId,
        material_id: isManualEntry ? undefined : (selectedMaterialId || undefined),
        custom_material_name: isManualEntry ? customName.trim() : undefined,
        reference_url: isManualEntry ? referenceUrl.trim() : undefined,
        cover_url: isManualEntry ? coverUrl : undefined,
        original_url: isManualEntry ? originalUrl : undefined,
        area_location: areaLocation || undefined,
        is_scheduled: true, // Default to true as per requirements
        notes: notes || undefined
      }));
      toast.success("Material added to schedule");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to add to schedule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 border-b border-slate-100 bg-white">
          <DialogTitle className="font-lora text-2xl font-medium">Request Project Material</DialogTitle>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-slate-400 font-inter uppercase tracking-widest">
              Standardized procurement workflow
            </p>
            <span className="text-[10px] bg-emerald-50 text-emerald-600 font-black px-1.5 py-0.5 rounded uppercase tracking-tighter" title="Suggested from global archives.">
              Library Suggester
            </span>
          </div>
          
          <div className="mt-6 space-y-4">
             <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Search Catalog or Type Custom *</Label>
                <CreatableSearch
                  options={materials.map(m => ({ 
                    id: m.id, 
                    name: `${m.catalog_product_name} • ${m.vendor?.brand_name || "Custom"}`,
                    badge: m.status === 'APPROVED' ? "Gold" : "Queue"
                  }))}
                  value={selectedMaterialId || undefined}
                  onSelect={(id, name) => {
                    setSelectedMaterialId(id);
                    setIsManualEntry(false);
                    setCustomName("");
                  }}
                  onCreate={(name) => {
                    setSelectedMaterialId(null);
                    setIsManualEntry(true);
                    setCustomName(name);
                  }}
                  onSearchChange={setSearch}
                  placeholder="Search by brand, type, or motif..."
                  allowFreeText
                />
                {isManualEntry && (
                   <div className="animate-in fade-in slide-in-from-top-1 duration-300">
                      <Badge className="bg-amber-50 text-amber-600 border-amber-100 py-1 px-2 pointer-events-none lowercase font-inter italic tracking-normal">
                        Ready for manual entry: &quot;{customName}&quot;
                      </Badge>
                   </div>
                )}
             </div>

             <div className="flex flex-col md:flex-row gap-4">
               <div className="flex-1 space-y-2">
                 <Label htmlFor="area_location" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Area / Location in Project</Label>
                 <Input
                   id="area_location"
                   placeholder="e.g. Master Bedroom, Dining Wall Area"
                   className="bg-slate-50 border-none h-11 focus:ring-slate-900 text-sm font-inter"
                   value={areaLocation}
                   onChange={(e) => setAreaLocation(e.target.value)}
                 />
               </div>
               <div className="flex-1 space-y-2">
                 <Label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contextual Notes (Optional)</Label>
                 <Input
                   id="notes"
                   placeholder="e.g. Needs sample for client meeting"
                   className="bg-slate-50 border-none h-11 focus:ring-slate-900 text-sm font-inter"
                   value={notes}
                   onChange={(e) => setNotes(e.target.value)}
                 />
               </div>
             </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2">
          {isManualEntry && (
            <div className="py-6 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-1">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 block">Visual Reference</Label>
                      <UniversalImageUploader
                        initialImageUrl={null}
                        onUploadComplete={({ original, cover }) => {
                          setCoverUrl(cover);
                          setOriginalUrl(original);
                        }}
                        label="Add Photo"
                      />
                  </div>
                  <div className="md:col-span-2 space-y-6">
                      <div className="space-y-2">
                          <Label htmlFor="custom_name" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Custom Material Name & Brand</Label>
                          <Input
                            id="custom_name"
                            placeholder="e.g. Roman Tile Granit G6022..."
                            className="bg-white border-2 border-slate-100 focus:border-slate-900 h-12 text-sm font-medium transition-all"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                          />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="ref_url" className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reference Link (Tokopedia/Website)</Label>
                          <Input
                            id="ref_url"
                            placeholder="https://www.tokopedia.com/product..."
                            className="bg-white border-2 border-slate-100 focus:border-slate-900 h-12 text-sm font-inter transition-all"
                            value={referenceUrl}
                            onChange={(e) => setReferenceUrl(e.target.value)}
                          />
                      </div>
                  </div>
               </div>
            </div>
          )}

          {!isManualEntry && selectedMaterialId && (
            <div className="py-6 animate-in zoom-in-95 duration-300">
{materials.filter(m => m.id === selectedMaterialId).map(m => (
                  <div key={m.id} className="flex items-start gap-6 p-6 rounded-[2rem] bg-slate-50 border border-slate-100 shadow-sm transition-all hover:shadow-md">
                     <div className="h-24 w-24 rounded-2xl bg-white shadow-inner overflow-hidden flex-shrink-0 border border-slate-100">
                       {m.catalog_image_url ? (
                         <img src={m.catalog_image_url || ""} alt={m.catalog_product_name || ""} className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center">
                           <ImageIcon className="h-8 w-8 text-slate-200" />
                         </div>
                       )}
                     </div>
                     <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Catalog Match</span>
                           {m.status === 'APPROVED' ? (
                             <Badge className="bg-emerald-50 text-emerald-600 border-none font-black text-[8px] uppercase px-1.5 h-4">Gold Standard</Badge>
                           ) : (
                             <Badge className="bg-slate-200 text-slate-600 border-none font-black text-[8px] uppercase px-1.5 h-4">In Queue</Badge>
                           )}
                        </div>
                        <h3 className="font-lora text-xl font-medium text-slate-900">{m.catalog_product_name}</h3>
                        <div className="flex items-center gap-2 text-xs font-inter text-slate-500">
                           <Building2 className="h-3 w-3" />
                           <span>{m.vendor?.brand_name || "Custom / Bespoke"}</span>
                        </div>
                        {m.catalog_sub_category && (
                          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter text-slate-400 pt-1">
                             <Plus className="h-3 w-3" />
                             <span>{m.catalog_sub_category}</span>
                          </div>
                        )}
                    </div>
                    <div className="pt-1">
                       <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    </div>
                 </div>
               ))}
            </div>
          )}

          {!isManualEntry && !selectedMaterialId && (
            <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4 animate-in fade-in duration-500">
               <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center">
                  <Search className="h-6 w-6 text-slate-400" />
               </div>
               <p className="text-sm font-medium font-inter">Search the archives to fetch material specs...</p>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50 mt-auto flex items-center justify-end">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-slate-500 hover:text-slate-900 font-inter text-sm"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={(!isManualEntry && !selectedMaterialId) || (isManualEntry && !customName.trim()) || submitting}
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 px-8 shadow-lg shadow-slate-200 font-inter text-xs uppercase tracking-widest font-bold ml-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
