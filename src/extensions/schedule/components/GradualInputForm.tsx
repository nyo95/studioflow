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
import type { GradualFormData, GradualFormProducts } from "../types";

interface GradualInputFormProps {
  section: string;
  category: string;
  onConfirm: (data: GradualFormData) => Promise<void>;
  onCancel: () => void;
  products: GradualFormProducts;
  isSearching?: boolean;
  onSearch: (query: string) => void;
}

type Step = "TYPE" | "SELECT" | "IDENTITY" | "PHYSICAL" | "VENDOR" | "REVIEW";

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
  products,
  isSearching,
  onSearch
}: GradualInputFormProps) {
  const [step, setStep] = React.useState<Step>("TYPE");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [customData, setCustomData] = React.useState({
    ...initialCustomData,
    catalog_type: (section.toLowerCase() === "ffe" ? "fixture" : "material") as "material" | "fixture"
  });

  const handleSelect = (id: string, name: string) => {
    setSelectedId(id);
    if (!id) {
       setCustomData(prev => ({ ...prev, catalog_product_name: name }));
    }
    setStep("IDENTITY");
  };

  const selectedProduct = products.find(m => m.id === selectedId);

  const isMaterial = customData.catalog_type === "material";
  const isFixture = customData.catalog_type === "fixture";

  const canProceedFromIdentity = !!customData.catalog_product_name.trim();
  const canProceedFromPhysical = selectedId || (
    isMaterial ? !!customData.catalog_color.trim() : (!!customData.catalog_dimensions.trim())
  );
  const canProceedFromVendor = !!customData.catalog_brand.trim();

  const handleFinalize = async () => {
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

  const steps: Step[] = ["TYPE", "SELECT", "IDENTITY", "PHYSICAL", "VENDOR", "REVIEW"];
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
         <div className="flex items-center gap-2">
            {steps.map((s, i) => (
              <React.Fragment key={s}>
                {i > 0 && <div className={cn("w-4 h-px", i <= currentStepIndex ? "bg-slate-900" : "bg-slate-200")} />}
                <div className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-black transition-all",
                  step === s ? "bg-slate-900 text-white shadow-lg shadow-slate-200 scale-110" : 
                  currentStepIndex > i ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                )}>
                  { currentStepIndex > i ? <Check size={12} strokeWidth={4} /> : i + 1 }
                </div>
              </React.Fragment>
            ))}
         </div>
         <div className="text-right">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 block">Step {currentStepIndex + 1} of 6</span>
            <span className="text-xs font-bold text-slate-900">
              {step === "TYPE" ? "Classification" : 
               step === "SELECT" ? "Source Search" : 
               step === "IDENTITY" ? "Identity" :
               step === "PHYSICAL" ? "Physical Details" :
               step === "VENDOR" ? "Brand & Subcat" : "Review Commit"}
            </span>
         </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {step === "TYPE" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-lora text-2xl font-medium text-slate-900">Product Classification</h3>
                <p className="text-sm text-slate-400 font-inter">Determine the fundamental nature of this entry.</p>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => { setCustomData(p => ({...p, catalog_type: "material"})); setStep("SELECT"); }}
                  className={cn(
                    "p-6 rounded-[2rem] border-2 transition-all text-left group",
                    customData.catalog_type === "material" ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-300"
                  )}
                >
                  <Package className="h-8 w-8 mb-4 text-slate-900" />
                  <h5 className="font-lora text-lg font-bold">Material</h5>
                  <p className="text-xs text-slate-400 mt-1">Tiles, Paint, Flooring, Wallpaper, etc.</p>
                </button>
                <button 
                  onClick={() => { setCustomData(p => ({...p, catalog_type: "fixture"})); setStep("SELECT"); }}
                  className={cn(
                    "p-6 rounded-[2rem] border-2 transition-all text-left group",
                    customData.catalog_type === "fixture" ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-300"
                  )}
                >
                  <Building2 className="h-8 w-8 mb-4 text-slate-900" />
                  <h5 className="font-lora text-lg font-bold">Fixture</h5>
                  <p className="text-xs text-slate-400 mt-1">Appliances, Furniture, Lighting, etc.</p>
                </button>
             </div>
          </div>
        )}

        {step === "SELECT" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-lora text-2xl font-medium text-slate-900">Source Search</h3>
                <p className="text-sm text-slate-400 font-inter">Search the master library or define a bespoke product.</p>
             </div>

             <div className="space-y-4">
                <CreatableSearch
                  options={products.map(m => ({
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
                     <p className="text-xs text-slate-400 mt-1 leading-relaxed">Add an empty slot to the schedule to be filled later.</p>
                   </button>
                   <Button variant="ghost" onClick={() => setStep("TYPE")} className="h-full rounded-[2rem] border-2 border-slate-50">
                      <ChevronLeft className="mr-2" /> Back
                   </Button>
                </div>
             </div>
          </div>
        )}

        {step === "IDENTITY" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-lora text-2xl font-medium text-slate-900">Core Identity</h3>
                <p className="text-sm text-slate-400 font-inter">Define the primary name and SKU for this snapshot.</p>
             </div>
             <div className="space-y-6">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product Name</Label>
                   <Input 
                     value={customData.catalog_product_name} 
                     onChange={e => setCustomData(prev => ({...prev, catalog_product_name: e.target.value}))}
                     placeholder="e.g. Oak Wood Plank"
                     className="h-12 rounded-2xl border-none bg-slate-50 shadow-inner font-bold text-slate-900" 
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Merchant SKU (Optional)</Label>
                   <Input 
                     value={customData.catalog_sku} 
                     onChange={e => setCustomData(prev => ({...prev, catalog_sku: e.target.value}))}
                     placeholder="e.g. SKU-12345"
                     className="h-12 rounded-2xl border-none bg-slate-50 shadow-inner font-medium" 
                   />
                </div>
             </div>
             <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("SELECT")} className="rounded-xl px-6 h-12 font-bold text-[10px] uppercase tracking-widest text-slate-400">
                   Back
                </Button>
                <Button 
                   onClick={() => setStep("PHYSICAL")} 
                   disabled={!canProceedFromIdentity}
                   className="bg-slate-900 text-white rounded-xl px-10 h-12 font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200"
                >
                   Next: Physical <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
             </div>
          </div>
        )}

        {step === "PHYSICAL" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-lora text-2xl font-medium text-slate-900">Physical Details</h3>
                <p className="text-sm text-slate-400 font-inter">Specify visual and tactile properties.</p>
             </div>

             <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-100">
                {selectedId ? (
                   <div className="flex items-center gap-6">
                      <div className="h-20 w-20 rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-sm">
                         {selectedProduct?.catalog_image_url ? (
                           <img src={selectedProduct.catalog_image_url} className="w-full h-full object-cover" />
                         ) : <Package className="w-full h-full p-6 text-slate-100" />}
                      </div>
                      <div>
                         <Badge className="bg-slate-900 text-white text-[9px] mb-2">MASTER SNAPSHOT</Badge>
                         <h5 className="font-lora text-xl font-bold text-slate-900">{selectedProduct?.catalog_sku}</h5>
                         <p className="text-xs text-slate-400 font-inter">{selectedProduct?.catalog_brand}</p>
                      </div>
                   </div>
                ) : (
                  <div className="space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Color {isMaterial && <span className="text-red-500">*</span>}
                           </Label>
                           <Input 
                             value={customData.catalog_color} 
                             onChange={e => setCustomData(prev => ({...prev, catalog_color: e.target.value}))}
                             placeholder="e.g. Matte Black"
                             className="h-12 rounded-xl border-none bg-white font-medium" 
                           />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pattern</Label>
                           <Input 
                             value={customData.catalog_motif} 
                             onChange={e => setCustomData(prev => ({...prev, catalog_motif: e.target.value}))}
                             placeholder="e.g. Marble"
                             className="h-12 rounded-xl border-none bg-white font-medium" 
                           />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dimensions</Label>
                        <Input 
                          value={customData.catalog_dimensions} 
                          onChange={e => setCustomData(prev => ({...prev, catalog_dimensions: e.target.value}))}
                          placeholder="e.g. 60 x 60 cm"
                          className="h-12 rounded-xl border-none bg-white font-medium shadow-sm" 
                        />
                     </div>
                  </div>
                )}
             </div>

             <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("IDENTITY")} className="rounded-xl px-6 h-12 font-bold text-[10px] uppercase tracking-widest text-slate-400">
                   Back
                </Button>
                <Button 
                   onClick={() => setStep("VENDOR")} 
                   disabled={!canProceedFromPhysical}
                   className="bg-slate-900 text-white rounded-xl px-10 h-12 font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200"
                >
                   Next: Brand <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
             </div>
          </div>
        )}

        {step === "VENDOR" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-lora text-2xl font-medium text-slate-900">Brand & Classification</h3>
                <p className="text-sm text-slate-400 font-inter">Specify the legacy and grouping of this product.</p>
             </div>

             <div className="space-y-6">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Brand Name <span className="text-red-500">*</span></Label>
                   <Input 
                     value={customData.catalog_brand} 
                     onChange={e => setCustomData(prev => ({...prev, catalog_brand: e.target.value}))}
                     placeholder="e.g. Roman, Kohler"
                     className="h-12 rounded-2xl border-none bg-slate-50 shadow-inner font-bold text-slate-900" 
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sub-Category</Label>
                   <Input 
                     value={customData.catalog_sub_category} 
                     onChange={e => setCustomData(prev => ({...prev, catalog_sub_category: e.target.value}))}
                     placeholder="e.g. Wall Tiles"
                     className="h-12 rounded-2xl border-none bg-slate-50 shadow-inner font-medium" 
                   />
                </div>
             </div>
             <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("PHYSICAL")} className="rounded-xl px-6 h-12 font-bold text-[10px] uppercase tracking-widest text-slate-400">
                   Back
                </Button>
                <Button 
                   onClick={() => setStep("REVIEW")} 
                   disabled={!canProceedFromVendor}
                   className="bg-slate-900 text-white rounded-xl px-10 h-12 font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200"
                >
                   Review Entry <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
             </div>
          </div>
        )}

        {step === "REVIEW" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-lora text-2xl font-medium text-slate-900">Confirm Commitment</h3>
                <p className="text-sm text-slate-400 font-inter">Verify the snapshot details before final synchronization.</p>
             </div>

             <div className="bg-slate-900 rounded-[2rem] p-8 text-white space-y-4">
                <div className="flex justify-between items-start border-b border-white/10 pb-4">
                   <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Identity</span>
                      <h4 className="font-lora text-xl font-bold">{selectedId ? selectedProduct?.catalog_sku : customData.catalog_product_name}</h4>
                      <p className="text-xs text-slate-400">{customData.catalog_brand}</p>
                   </div>
                   <Badge className="bg-emerald-500 text-white border-none uppercase text-[8px] font-black">Ready</Badge>
                </div>
                <div className="grid grid-cols-2 gap-y-4 text-sm">
                   <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">Type</span>
                      <span className="font-medium capitalize">{customData.catalog_type}</span>
                   </div>
                   <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">Category</span>
                      <span className="font-medium">{category}</span>
                   </div>
                   <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">Color/Specs</span>
                      <span className="font-medium">{selectedId ? "-" : (customData.catalog_color || customData.catalog_dimensions || "Standard")}</span>
                   </div>
                </div>
             </div>

             <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("VENDOR")} className="rounded-xl px-6 h-12 font-bold text-[10px] uppercase tracking-widest text-slate-400">
                   Adjust Details
                </Button>
                <Button 
                   onClick={handleFinalize} 
                   disabled={isSubmitting}
                   className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-10 h-12 font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-200"
                >
                   {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Commit to Schedule"}
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