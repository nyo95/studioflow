"use client";

import React from "react";
import { Search, Plus, Check, ChevronRight, ChevronLeft, Package, Boxes, Layers, Sparkles, Palette, Ruler, Building2, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { OptimizedUploader } from "@/components/ui/optimized-uploader";
import { VisualAsset } from "@/components/ui/visual-asset";
import { LibraryFacade } from "@/extensions/library/facade";
import type { GradualFormData, GradualFormProducts } from "../types";
import { 
  UI_ENGINE_RADIUS_CARD, 
  UI_ENGINE_RADIUS_CONTROL, 
  UI_ENGINE_RADIUS_ACTION, 
  UI_ENGINE_TYPE_META,
  UI_ENGINE_BORDER_SUBTLE,
  UI_ENGINE_BG_SUBTLE
} from "@/ui_engine";

interface GradualInputFormProps {
  section: string;
  category: string;
  onConfirm: (data: GradualFormData) => Promise<void>;
  onCancel: () => void;
  products: GradualFormProducts;
  isSearching?: boolean;
  onSearch: (query: string) => void;
}

type Step = "TYPE" | "SELECT" | "INITIALS" | "VENDOR" | "REVIEW";

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
  catalog_image_url: "",
};

export function GradualInputForm({
  section,
  category,
  onConfirm,
  onCancel,
  products,
  isSearching,
  onSearch,
  initialStepOverride
}: GradualInputFormProps & { initialStepOverride?: Step }) {
  // Logic: If section is already clearly defined (material/fixture), skip the TYPE step.
  const isFixtureSection = ["fixture", "fixtures", "ffe"].includes(section.toLowerCase());
  const isMaterialSection = ["material", "materials", "architectural"].includes(section.toLowerCase());
  
  const autoDetectedStep = (isFixtureSection || isMaterialSection) ? "SELECT" : "TYPE";
  const [step, setStep] = React.useState<Step>(initialStepOverride || autoDetectedStep);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [customData, setCustomData] = React.useState({
    ...initialCustomData,
    catalog_type: (isFixtureSection ? "fixture" : "material") as "material" | "fixture"
  });

  const handleSelect = (id: string, name: string) => {
    setSelectedId(id);
    if (!id) {
       // If name was reserved or custom, we proceed to Initials for new material
       const isReserved = name === "RESERVED";
       setCustomData(prev => ({ 
         ...prev, 
         catalog_product_name: isReserved ? "" : name,
         catalog_sku: isReserved ? "" : name
       }));
       setStep("INITIALS");
    } else {
       setStep("REVIEW");
    }
  };

  const selectedProduct = products.find(m => m.id === selectedId);

  const isMaterial = customData.catalog_type === "material";
  
  const canProceedFromInitials = (!!customData.catalog_sku.trim() && !!customData.catalog_product_name.trim()) || !!customData.catalog_color.trim();
  const canProceedFromVendor = !!customData.catalog_brand.trim();

  const handleFinalize = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm({
        selectedId: selectedId ?? "",
        customData: !selectedId ? {
          ...customData,
          // Smart Input Guard: Ensure SKU/Name are at least set to Color if empty
          catalog_sku: customData.catalog_sku.trim() || customData.catalog_color.trim() || "DRAFT",
          catalog_product_name: customData.catalog_product_name.trim() || customData.catalog_color.trim() || "New Item",
        } : initialCustomData
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps: Step[] = React.useMemo(() => {
    const baseSteps: Step[] = ["TYPE", "SELECT", "INITIALS", "VENDOR", "REVIEW"];
    if (isFixtureSection || isMaterialSection) {
      return baseSteps.filter(s => s !== "TYPE");
    }
    return baseSteps;
  }, [isFixtureSection, isMaterialSection]);

  const currentStepIndex = steps.indexOf(step);

  return (
    <div className={cn("flex flex-col h-full bg-white", UI_ENGINE_RADIUS_CARD)}>
      <div className={cn("px-8 py-6 border-b flex items-center justify-between", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE)}>
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
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 block">Step {currentStepIndex + 1} of {steps.length}</span>
            <span className="text-xs font-bold text-slate-900">
              {step === "TYPE" ? "Classification" : 
               step === "SELECT" ? "Source Search" : 
               step === "INITIALS" ? "Secondary/Initials" :
               step === "VENDOR" ? "Brand & Subcat" : "Review Commit"}
            </span>
         </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {step === "TYPE" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-serif text-2xl font-medium text-slate-900">Product Classification</h3>
                <p className="text-sm text-slate-400 font-sans">Determine the fundamental nature of this entry.</p>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => { setCustomData(p => ({...p, catalog_type: "material"})); setStep("SELECT"); }}
                  className={cn(
                    "p-6 border-2 transition-all text-left group",
                    UI_ENGINE_RADIUS_CARD,
                    customData.catalog_type === "material" ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-300"
                  )}
                >
                  <Package className="h-8 w-8 mb-4 text-slate-900" />
                  <h5 className="font-serif text-lg font-bold">Material</h5>
                  <p className="text-xs text-slate-400 mt-1">Tiles, Paint, Flooring, Wallpaper, etc.</p>
                </button>
                <button 
                  onClick={() => { setCustomData(p => ({...p, catalog_type: "fixture"})); setStep("SELECT"); }}
                  className={cn(
                    "p-6 border-2 transition-all text-left group",
                    UI_ENGINE_RADIUS_CARD,
                    customData.catalog_type === "fixture" ? "border-slate-900 bg-slate-50" : "border-slate-100 hover:border-slate-300"
                  )}
                >
                  <Building2 className="h-8 w-8 mb-4 text-slate-900" />
                  <h5 className="font-serif text-lg font-bold">Fixture</h5>
                  <p className="text-xs text-slate-400 mt-1">Appliances, Furniture, Lighting, etc.</p>
                </button>
             </div>
          </div>
        )}

        {step === "SELECT" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-serif text-2xl font-medium text-slate-900">Source Search</h3>
                <p className="text-sm text-slate-400 font-sans">Search the master library or define a bespoke product.</p>
             </div>

             <div className="space-y-4">
                <CreatableSearch
                  options={products.map(m => ({
                        id: m.id,
                        name: `${m.catalog_sku}${m.catalog_product_name ? ` - ${m.catalog_product_name}` : ""}`,
                        subText: `[Shared] ${m.catalog_brand || "Custom Brand"}`
                      }))}
                      onSelect={handleSelect}
                      onCreate={(name) => handleSelect("", name)}
                      onSearchChange={onSearch}
                      placeholder="Search Library or type Color, Pattern, or SKU..."
                      allowFreeText
                />

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    <button 
                      onClick={() => handleSelect("", "RESERVED")}
                      className={cn("p-6 border-2 border-dashed border-slate-100 hover:border-slate-900 hover:bg-slate-50 transition-all text-left group", UI_ENGINE_RADIUS_CARD, steps[0] === "SELECT" ? "md:col-span-2" : "")}
                    >
                      <div className="h-10 w-10 rounded-lg bg-slate-50 group-hover:bg-slate-900 text-slate-300 group-hover:text-white flex items-center justify-center mb-4 transition-all">
                         <Sparkles size={20} />
                      </div>
                      <h5 className="font-serif text-lg font-medium text-slate-900">Reserve Placeholder</h5>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">Add an empty slot to the schedule to be filled later.</p>
                    </button>
                    {steps[0] === "TYPE" && (
                      <Button variant="ghost" onClick={() => setStep("TYPE")} className={cn("h-full border-2 border-slate-50", UI_ENGINE_RADIUS_CARD)}>
                         <ChevronLeft className="mr-2" /> Back
                      </Button>
                    )}
                 </div>
             </div>
          </div>
        )}

        {step === "INITIALS" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-serif text-2xl font-medium text-slate-900">Secondary / Initials</h3>
                <p className="text-sm text-slate-400 font-sans">Quick draft: focus on visual representation first.</p>
             </div>
             
             <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-1 w-4 rounded-full bg-slate-200" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Image (Optional)</span>
                  </div>
                  <div className="flex items-start gap-5">
                    <div className="w-[140px] flex-shrink-0">
                      <OptimizedUploader
                        value={customData.catalog_image_url}
                        onUpload={async (file) => {
                          const timestamp = Date.now();
                          const fileName = `${timestamp}-${file.name.replace(/\s/g, "_")}`;
                          const coverPath = `covers/${fileName}`;
                          const url = await LibraryFacade.uploadProductImage(file, coverPath);
                          setCustomData(prev => ({ ...prev, catalog_image_url: url }));
                          return url;
                        }}
                        onClear={() => setCustomData(prev => ({ ...prev, catalog_image_url: "" }))}
                        aspect={1}
                      />
                    </div>
                    <div className="flex-1 space-y-2 pt-1">
                      <p className="font-sans text-[10px] text-slate-400 leading-relaxed">
                        Upload a reference photo to help identify this item in the schedule.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Product Name</Label>
                   <Input 
                     value={customData.catalog_product_name} 
                     onChange={e => setCustomData(prev => ({...prev, catalog_product_name: e.target.value}))}
                     placeholder="e.g. Carrara White"
                     className={cn("h-12 border-none bg-slate-50 shadow-inner font-medium", UI_ENGINE_RADIUS_ACTION)} 
                   />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">SKU / Code</Label>
                     <Input 
                       value={customData.catalog_sku} 
                       onChange={e => setCustomData(prev => ({...prev, catalog_sku: e.target.value}))}
                       placeholder="e.g. CR-01"
                       className={cn("h-12 border-none bg-slate-50 shadow-inner font-bold text-slate-900", UI_ENGINE_RADIUS_ACTION)} 
                     />
                  </div>
                  <div className="space-y-2">
                     <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Color / Finish <span className="text-red-500">*</span></Label>
                     <Input 
                       value={customData.catalog_color} 
                       onChange={e => setCustomData(prev => ({...prev, catalog_color: e.target.value}))}
                       placeholder="e.g. Matte Black"
                       className={cn("h-12 border-none bg-slate-50 shadow-inner font-bold text-slate-900", UI_ENGINE_RADIUS_ACTION)} 
                     />
                  </div>
                </div>
             </div>
             <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("SELECT")} className="rounded-lg px-6 h-12 font-bold text-[10px] uppercase tracking-widest text-slate-400">
                   Back
                </Button>
                <Button 
                   onClick={() => setStep("VENDOR")} 
                   disabled={!canProceedFromInitials}
                   className="bg-slate-900 text-white rounded-lg px-10 h-12 font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200"
                >
                   Next: Brand <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
             </div>
          </div>
        )}

        {step === "VENDOR" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-serif text-2xl font-medium text-slate-900">Brand & Classification</h3>
                <p className="text-sm text-slate-400 font-sans">Specify the legacy and grouping of this product.</p>
             </div>

             <div className="space-y-6">
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Brand Name <span className="text-red-500">*</span></Label>
                   <Input 
                     value={customData.catalog_brand} 
                     onChange={e => setCustomData(prev => ({...prev, catalog_brand: e.target.value}))}
                     placeholder="e.g. Roman, Kohler (Brand)"
                     className={cn("h-12 border-none bg-slate-50 shadow-inner font-bold text-slate-900", UI_ENGINE_RADIUS_ACTION)} 
                   />
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sub-Category</Label>
                   <Input 
                     value={customData.catalog_sub_category} 
                     onChange={e => setCustomData(prev => ({...prev, catalog_sub_category: e.target.value}))}
                     placeholder="e.g. Wall Tiles"
                     className={cn("h-12 border-none bg-slate-50 shadow-inner font-medium", UI_ENGINE_RADIUS_ACTION)} 
                   />
                </div>
             </div>
             <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("INITIALS")} className="rounded-lg px-6 h-12 font-bold text-[10px] uppercase tracking-widest text-slate-400">
                   Back
                </Button>
                <Button 
                   onClick={() => setStep("REVIEW")} 
                   disabled={!canProceedFromVendor}
                   className="bg-slate-900 text-white rounded-lg px-10 h-12 font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-slate-200"
                >
                   Review Entry <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
             </div>
          </div>
        )}

        {step === "REVIEW" && (
          <div className="p-8 space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="space-y-2">
                <h3 className="font-serif text-2xl font-medium text-slate-900">Confirm Commitment</h3>
                <p className="text-sm text-slate-400 font-sans">Verify the snapshot details before final synchronization.</p>
             </div>

             <div className={cn("bg-slate-900 p-8 text-white space-y-4", UI_ENGINE_RADIUS_CARD)}>
                <div className="flex justify-between items-start border-b border-white/10 pb-4">
                   <div className="flex items-center gap-4">
                      <div className={cn("h-12 w-12 bg-white/10 border border-white/20 overflow-hidden flex-shrink-0", UI_ENGINE_RADIUS_ACTION)}>
                        {(selectedId ? selectedProduct?.catalog_image_url : customData.catalog_image_url) ? (
                          <VisualAsset 
                            src={(selectedId ? selectedProduct?.catalog_image_url : customData.catalog_image_url)}
                            className="w-full h-full object-cover" 
                          />
                        ) : <Package className="w-full h-full p-3 text-white/20" />}
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Identity</span>
                        <h4 className="font-serif text-xl font-bold">
                          {selectedId 
                            ? `${selectedProduct?.catalog_sku || ""}${selectedProduct?.catalog_product_name ? ` — ${selectedProduct.catalog_product_name}` : ""}`
                            : (customData.catalog_color || "New Item")
                          }
                        </h4>
                        <p className="text-xs text-slate-400">{selectedId ? selectedProduct?.catalog_brand : customData.catalog_brand}</p>
                      </div>
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
                   {!selectedId && (
                     <div>
                        <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block">Status</span>
                        <span className="font-medium text-amber-400">Local Draft</span>
                     </div>
                   )}
                </div>
             </div>

             <div className="flex items-center justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep(selectedId ? "SELECT" : "VENDOR")} className="rounded-lg px-6 h-12 font-bold text-[10px] uppercase tracking-widest text-slate-400">
                   Adjust Details
                </Button>
                <Button 
                   onClick={handleFinalize} 
                   disabled={isSubmitting}
                   className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg px-10 h-12 font-bold text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-200"
                >
                   {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Commit to Schedule"}
                </Button>
             </div>
          </div>
        )}
      </div>

      <div className={cn("px-8 py-6 border-t flex items-center justify-between", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE)}>
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
