"use client";

import React from "react";
import { Search, Plus, Check, ChevronRight, ChevronLeft, Package, Boxes, Layers, Sparkles, Palette, Ruler, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import type { GradualFormData, GradualFormMaterials } from "../types";

interface GradualInputFormProps {
  section: string;
  category: string;
  onConfirm: (data: GradualFormData) => Promise<void>;
  onCancel: () => void;
  materials: GradualFormMaterials;
  isSearching?: boolean;
  onSearch: (query: string) => void;
}

type Step = "SELECT" | "PHYSICAL" | "METADATA";

const initialCustomData = {
  catalog_sku: "",
  catalog_product_name: "",
  catalog_color: "",
  catalog_motif: "",
  catalog_finishing: "",
  catalog_brand: "",
  catalog_sub_category: "",
  catalog_dimensions: "",
  catalog_reference_url: "",
};

export function GradualInputForm({
  section,
  category,
  onConfirm,
  onCancel,
  materials,
  isSearching,
  onSearch
}: GradualInputFormProps) {
  const [step, setStep] = React.useState<Step>("SELECT");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [customData, setCustomData] = React.useState(initialCustomData);

  const handleSelect = (id: string, name: string) => {
    setSelectedId(id);
    if (!id) {
       setCustomData(prev => ({ ...prev, catalog_product_name: name }));
    }
    setStep("PHYSICAL");
  };

  const selectedMaterial = materials.find(m => m.id === selectedId);

  const canProceedFromPhysical = selectedId || customData.catalog_color.trim().length > 0;

  const handleFinalize = async () => {
    if (!canProceedFromPhysical) return;
    
    setIsSubmitting(true);
    try {
      await onConfirm({
        selectedId: selectedId ?? "",
        customData: !selectedId ? customData : initialCustomData
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
         <div className="flex items-center gap-2">
            {[ "SELECT", "PHYSICAL", "METADATA" ].map((s, i) => (
              <React.Fragment key={s}>
                {i > 0 && <div className={cn("w-6 h-px", i <= [ "SELECT", "PHYSICAL", "METADATA" ].indexOf(step) ? "bg-slate-900" : "bg-slate-200")} />}
                <div className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-black transition-all",
                  step === s ? "bg-slate-900 text-white shadow-lg shadow-slate-200 scale-110" : 
                  [ "SELECT", "PHYSICAL", "METADATA" ].indexOf(step) > i ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                )}>
                  { [ "SELECT", "PHYSICAL", "METADATA" ].indexOf(step) > i ? <Check size={14} strokeWidth={4} /> : i + 1 }
                </div>
              </React.Fragment>
            ))}
         </div>
         <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 block">Step {["SELECT", "PHYSICAL", "METADATA"].indexOf(step) + 1} of 3</span>
            <span className="text-xs font-bold text-slate-900">
              {step === "SELECT" ? "Primary Identity" : step === "PHYSICAL" ? "Physical Identity" : "Metadata & Brand"}
            </span>
         </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {step === "SELECT" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-lora text-2xl font-medium text-slate-900">Choose a starting point</h3>
                <p className="text-sm text-slate-400 font-inter">Search the master library or define a bespoke product.</p>
             </div>

             <div className="space-y-4">
                <CreatableSearch
                  options={materials.map(m => ({
                        id: m.id,
                        name: m.catalog_sku,
                        subText: m.catalog_brand || "Custom Brand"
                      }))}
                      onSelect={handleSelect}
                      onCreate={(name) => handleSelect("", name)}
                      onSearchChange={onSearch}
                      placeholder="Search brands, codes, or motifs..."
                      allowFreeText
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                   <button 
                     onClick={() => handleSelect("", "RESERVED")}
                     className="p-6 rounded-[2rem] border-2 border-dashed border-slate-100 hover:border-slate-900 hover:bg-slate-50 transition-all text-left group"
                   >
                     <div className="h-10 w-10 rounded-2xl bg-slate-50 group-hover:bg-slate-900 text-slate-300 group-hover:text-white flex items-center justify-center mb-4 transition-all">
                        <Sparkles size={20} />
                     </div>
                     <h5 className="font-lora text-lg font-medium text-slate-900">Reserve Placeholder</h5>
                     <p className="text-xs text-slate-400 mt-1 leading-relaxed">Add an empty slot to the schedule to be filled later. System will auto-generate a code.</p>
                   </button>

                   <div className="p-6 rounded-[2rem] bg-indigo-50/30 border border-indigo-100 flex flex-col justify-center">
                      <div className="flex items-start gap-4">
                         <div className="h-8 w-8 rounded-xl bg-indigo-500 text-white flex items-center justify-center shrink-0">
                            <Layers size={16} />
                         </div>
                         <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Library Insight</span>
                            <p className="text-xs text-indigo-900 font-medium mt-1 leading-relaxed">
                               The {category} archive currently holds {materials.length} verified specifications ready for snapshotting.
                            </p>
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {step === "PHYSICAL" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-lora text-2xl font-medium text-slate-900">Physical Identity</h3>
                <p className="text-sm text-slate-400 font-inter">Specify color, pattern, and finishing for this material.</p>
             </div>

             <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                {selectedId ? (
                  <div className="flex items-center gap-6">
                    <div className="h-20 w-20 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                       {selectedMaterial?.catalog_image_url ? (
                         <img src={selectedMaterial.catalog_image_url} className="w-full h-full object-cover" />
                       ) : <Package className="w-full h-full p-6 text-slate-100" />}
                    </div>
                    <div>
                       <Badge className="bg-slate-900 text-white text-[9px] mb-2">MASTER COPY</Badge>
                       <h5 className="font-lora text-xl font-bold text-slate-900">{selectedMaterial?.catalog_sku}</h5>
                       <p className="text-xs text-slate-400 font-inter">{selectedMaterial?.catalog_brand || "Bespoke"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product Name</Label>
                        <Input 
                          value={customData.catalog_product_name} 
                          onChange={e => setCustomData(prev => ({...prev, catalog_product_name: e.target.value}))}
                          placeholder="e.g. HPL Wood Texture"
                          className="h-12 rounded-2xl border-none bg-white shadow-sm font-bold text-slate-900" 
                        />
                     </div>

                     <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                              <Palette className="h-3 w-3" /> Color <span className="text-red-500">*</span>
                           </Label>
                           <Input 
                             value={customData.catalog_color} 
                             onChange={e => setCustomData(prev => ({...prev, catalog_color: e.target.value}))}
                             placeholder="e.g. Walnut Brown"
                             className="h-12 rounded-xl border-none bg-white font-medium" 
                           />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pattern / Motif</Label>
                           <Input 
                             value={customData.catalog_motif} 
                             onChange={e => setCustomData(prev => ({...prev, catalog_motif: e.target.value}))}
                             placeholder="e.g. Wood Grain"
                             className="h-12 rounded-xl border-none bg-white font-medium" 
                           />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Finishing</Label>
                           <Input 
                             value={customData.catalog_finishing} 
                             onChange={e => setCustomData(prev => ({...prev, catalog_finishing: e.target.value}))}
                             placeholder="e.g. Matte"
                             className="h-12 rounded-xl border-none bg-white font-medium" 
                           />
                        </div>
                     </div>

                     <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
                        <div className="h-2 w-2 rounded-full bg-amber-500" />
                        <span className="text-xs font-medium text-amber-700">Color is mandatory - required before submission</span>
                     </div>
                  </div>
                )}
             </div>

             <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("SELECT")} className="rounded-xl px-6 h-12 font-bold text-[10px] uppercase tracking-widest text-slate-400">
                   <ChevronLeft className="mr-2 h-4 w-4" /> Back to Search
                </Button>
                <Button 
                  onClick={() => setStep("METADATA")} 
                  disabled={!selectedId && (!customData.catalog_color.trim() || !customData.catalog_product_name.trim())}
                  className="bg-slate-900 text-white rounded-xl px-10 h-12 font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                   Next: Metadata <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
             </div>
          </div>
        )}

        {step === "METADATA" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-lora text-2xl font-medium text-slate-900">Metadata & Brand</h3>
                <p className="text-sm text-slate-400 font-inter">Add brand, sub-category, and dimensions.</p>
             </div>

             <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                         <Building2 className="h-3 w-3" /> Brand / Vendor
                      </Label>
                      <Input 
                        value={customData.catalog_brand} 
                        onChange={e => setCustomData(prev => ({...prev, catalog_brand: e.target.value}))}
                        placeholder="e.g. Roman, TACO"
                        className="h-12 rounded-xl border-none bg-white font-medium" 
                      />
                   </div>
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sub-Category</Label>
                      <Input 
                        value={customData.catalog_sub_category} 
                        onChange={e => setCustomData(prev => ({...prev, catalog_sub_category: e.target.value}))}
                        placeholder="e.g. Exterior Panel"
                        className="h-12 rounded-xl border-none bg-white font-medium" 
                      />
                   </div>
                </div>

                <div className="grid grid-cols-1 gap-6 mt-6">
                   <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1">
                         <Ruler className="h-3 w-3" /> Dimensions
                      </Label>
                      <Input 
                        value={customData.catalog_dimensions} 
                        onChange={e => setCustomData(prev => ({...prev, catalog_dimensions: e.target.value}))}
                        placeholder="e.g. 122 x 244 x 1.2 cm"
                        className="h-12 rounded-xl border-none bg-white font-medium" 
                      />
                   </div>
                </div>
             </div>

             <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("PHYSICAL")} className="rounded-xl px-6 h-12 font-bold text-[10px] uppercase tracking-widest text-slate-400">
                   <ChevronLeft className="mr-2 h-4 w-4" /> Back to Physical
                </Button>
                <Button 
                  onClick={handleFinalize} 
                  disabled={isSubmitting}
                  className="bg-slate-900 text-white rounded-xl px-10 h-12 font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200 disabled:opacity-50"
                >
                   {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Commit Specification"}
                </Button>
             </div>
          </div>
        )}
      </div>

      <div className="px-8 py-6 border-t border-slate-50 bg-slate-50/10 flex items-center justify-between">
         <div className="flex items-center gap-2 text-slate-300">
            <Boxes size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">StudioFlow Catalyst Engine</span>
         </div>
         <Button variant="ghost" onClick={onCancel} className="text-xs font-bold text-slate-400 hover:text-red-500 transition-colors">
            Discard Session
         </Button>
      </div>
    </div>
  );
}