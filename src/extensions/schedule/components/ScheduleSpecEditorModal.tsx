"use client";

import * as React from "react";
import { 
  Loader2, 
  Tag,
  Type, 
  Link as LinkIcon,
  Palette,
  Maximize2,
  Save,
  Info,
  AlertCircle,
  ImageIcon,
  Eye,
  X,
  ExternalLink,
  Package,
  Ruler,
  Building2,
  Layers,
  Sparkles
} from "lucide-react";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";
import { OptimizedUploader } from "@/components/ui/optimized-uploader";
import { LibraryFacade } from "@/extensions/library/facade";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  updateScheduleOptionSnapshotAction, 
  getScheduleSuggestionsAction,
} from "@/extensions/schedule/actions/schedule-actions";
// createPromotionRequestAction removed, using LibraryFacade instead
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { ScheduleOptionSnapshot } from "../types";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { 
  UI_ENGINE_RADIUS_CARD, 
  UI_ENGINE_RADIUS_CONTROL, 
  UI_ENGINE_RADIUS_ACTION, 
  UI_ENGINE_TYPE_META,
  UI_ENGINE_BORDER_SUBTLE,
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_TYPE_H4
} from "@/ui_engine";

interface ProductSuggestion {
  id: string;
  name: string;
  brand: string;
  catalog_category: string;
  metadata: {
    catalog_sku: string;
    catalog_product_name: string;
    catalog_motif: string | null;
    catalog_color: string | null;
    catalog_finishing: string | null;
    catalog_dimensions: string;
    catalog_reference_url: string | null;
  };
}

interface ScheduleSpecEditorModalProps {
  optionId: string;
  initialSnapshot: ScheduleOptionSnapshot;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onRefresh?: () => void;
  userRole?: string;
  projectId: string;
}

export function ScheduleSpecEditorModal({
  optionId,
  initialSnapshot,
  isOpen,
  onOpenChange,
  onSuccess,
  onRefresh,
  userRole = "STAFF",
  projectId
}: ScheduleSpecEditorModalProps) {
  const isAdmin = ["ADMIN", "DIC", "DRIC"].includes(userRole);
  
  const isReserved = initialSnapshot.catalog_product_name === "[RESERVED]";
  
  // Domain Exception: Authorized users (DIC, DRIC, ADMIN) or uninitialized entries open in Edit Mode by default
  const [isEditMode, setIsEditMode] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<{
    brands: { id: string, name: string }[],
    products: ProductSuggestion[]
  }>({ brands: [], products: [] });

  const [form, setForm] = React.useState({
    catalog_product_name: initialSnapshot.catalog_product_name === "[RESERVED]" ? "" : (initialSnapshot.catalog_product_name || ""),
    catalog_brand: initialSnapshot.catalog_brand || "",
    catalog_reference_url: initialSnapshot.catalog_reference_url || "",
    catalog_image_url: initialSnapshot.catalog_image_url || "",
    catalog_sku: initialSnapshot.specs?.catalog_sku || "",
    catalog_sub_category: initialSnapshot.catalog_sub_category || "",
    catalog_motif: initialSnapshot.specs?.catalog_motif || "",
    catalog_color: initialSnapshot.specs?.catalog_color || "",
    catalog_finishing: initialSnapshot.specs?.catalog_finishing || "",
    catalog_dimensions: initialSnapshot.specs?.catalog_dimensions || "",
    catalog_structured_tags: initialSnapshot.specs?.catalog_structured_tags || []
  });

  React.useEffect(() => {
    async function fetchSuggestions() {
      try {
        const result = unwrapActionResult(await getScheduleSuggestionsAction({}));
        setSuggestions(result as {
          brands: { id: string; name: string }[];
          products: ProductSuggestion[];
        });
      } catch (error) {
        console.error("Failed to fetch suggestions", error);
      }
    }
    fetchSuggestions();
  }, []);

  React.useEffect(() => {
    if (isOpen && !isSubmitting) {
      // Re-evaluate initial edit mode state when modal opens
      setIsEditMode(true);
      setForm({
        catalog_product_name: initialSnapshot.catalog_product_name === "[RESERVED]" ? "" : (initialSnapshot.catalog_product_name || ""),
        catalog_brand: initialSnapshot.catalog_brand || "",
        catalog_reference_url: initialSnapshot.catalog_reference_url || "",
        catalog_image_url: initialSnapshot.catalog_image_url || "",
        catalog_sku: initialSnapshot.specs?.catalog_sku || "",
        catalog_sub_category: initialSnapshot.catalog_sub_category || "",
        catalog_motif: initialSnapshot.specs?.catalog_motif || "",
        catalog_color: initialSnapshot.specs?.catalog_color || "",
        catalog_finishing: initialSnapshot.specs?.catalog_finishing || "",
        catalog_dimensions: initialSnapshot.specs?.catalog_dimensions || "",
        catalog_structured_tags: initialSnapshot.specs?.catalog_structured_tags || [],
      });
    }
  }, [isOpen, initialSnapshot, isSubmitting, isAdmin, isReserved]);

  const placeholders = ["N/A", "UNKNOWN", "PENDING", "-", "—", "[RESERVED]"];
  const isPlaceholder = (val?: string | null) => !val || placeholders.includes(val.trim().toUpperCase());

  const hasPrimaryIdentity = !isPlaceholder(form.catalog_sku) || !isPlaceholder(form.catalog_product_name);
  const isBrandComplete = !isPlaceholder(form.catalog_brand);
  
  const isPrimaryComplete = hasPrimaryIdentity && isBrandComplete;
  const isSecondaryComplete = !!form.catalog_color?.trim() && !isPlaceholder(form.catalog_color);
  const isReadyForPromotion = isPrimaryComplete && !!form.catalog_image_url;
  const isDraft = !initialSnapshot.product_catalog_id;

  const handleSubmit = async () => {
    if (!isSecondaryComplete) {
      toast.warning("Color is mandatory for project snapshots - saving as draft");
    }
    setIsSubmitting(true);
    try {
      const dataPayload = {
        catalog_product_name: form.catalog_product_name || undefined,
        catalog_brand: form.catalog_brand || undefined,
        catalog_reference_url: form.catalog_reference_url || null,
        catalog_image_url: form.catalog_image_url || null,
        catalog_sub_category: form.catalog_sub_category || undefined,
        specs: {
          catalog_sku: form.catalog_sku,
          catalog_motif: form.catalog_motif || undefined,
          catalog_color: form.catalog_color || undefined,
          catalog_finishing: form.catalog_finishing || undefined,
          catalog_dimensions: form.catalog_dimensions,
          catalog_structured_tags: form.catalog_structured_tags || [],
          catalog_reference_url: form.catalog_reference_url || undefined,
        }
      };
      unwrapActionResult(await updateScheduleOptionSnapshotAction({
        optionId,
        data: dataPayload
      }));

      toast.success("Specification updated successfully");
      setIsEditMode(false);
      if (onSuccess) onSuccess();
      if (onRefresh) onRefresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update specification");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent 
        onKeyDown={(e) => e.stopPropagation()}
        className={cn(
          "p-0 overflow-hidden border-none shadow-[var(--ui-surface-shadow-premium,0_32px_64px_-12px_rgba(0,0,0,0.14))] bg-white",
          UI_ENGINE_RADIUS_CARD,
          "max-w-[1100px] w-[95vw]"
        )}
      >
        <div className="flex flex-col md:flex-row h-[750px] max-h-[90vh]">
          {/* Left Panel: Visual Focus & Checklist */}
          <div className="w-full md:w-[380px] bg-slate-50 border-r border-slate-100 flex flex-col relative overflow-hidden">
             <div className="flex-1 flex flex-col p-8 pt-10">
               {/* Hero Image Card */}
               <div className={cn("relative group w-full aspect-square bg-white shadow-xl shadow-slate-200/50 border", UI_ENGINE_BORDER_SUBTLE, "overflow-hidden flex items-center justify-center mb-10", UI_ENGINE_RADIUS_CARD)}>
                 {form.catalog_image_url ? (
                   <img 
                    src={form.catalog_image_url} 
                    alt={form.catalog_product_name} 
                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                   />
                 ) : (
                   <div className="flex flex-col items-center gap-4 text-slate-200">
                     <Package className="h-16 w-16 stroke-[1]" />
                     <span className="text-[9px] font-black uppercase tracking-[0.3em]">No Visual Data</span>
                   </div>
                 )}
                 
                 {!isEditMode && form.catalog_reference_url && (
                   <a 
                    href={form.catalog_reference_url} 
                    target="_blank" 
                    className={cn("absolute bottom-4 right-4 h-10 w-10 bg-white/90 backdrop-blur-md shadow-lg flex items-center justify-center text-slate-900 hover:bg-slate-900 hover:text-white transition-all", UI_ENGINE_RADIUS_ACTION)}
                   >
                     <ExternalLink className="h-4 w-4" />
                   </a>
                 )}
               </div>

               {/* Promotion Readiness Checklist */}
               <div className="space-y-6">
                 <div className="flex items-center gap-3">
                   <div className={cn("h-5 w-5 bg-slate-950 flex items-center justify-center", UI_ENGINE_RADIUS_ACTION)}>
                      <Sparkles className="h-3 w-3 text-white" />
                    </div>
                   <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-950">Library Readiness</h4>
                 </div>
                 
                 <div className={cn("space-y-5 p-5 bg-white border shadow-sm", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
                    {/* Stage 1: Project Minimum */}
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
                        isSecondaryComplete ? "bg-emerald-500 border-emerald-500 shadow-[0_2px_8px_-2px_rgba(16,185,129,0.3)]" : "bg-white border-slate-200"
                      )}>
                        {isSecondaryComplete ? <Layers className="h-3 w-3 text-white" /> : <div className="h-2 w-2 rounded-full bg-slate-200" />}
                      </div>
                      <div className="space-y-0.5">
                        <span className={cn("text-[11px] font-bold block transition-colors", isSecondaryComplete ? "text-slate-900" : "text-slate-400")}>Stage 1: Project Snapshot</span>
                        <span className="text-[10px] text-slate-400 font-medium">Requires Color specification.</span>
                      </div>
                    </div>

                    {/* Stage 2: Catalog Ready */}
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
                        isReadyForPromotion ? "bg-indigo-600 border-indigo-600 shadow-sm" : "bg-white border-slate-200"
                      )}>
                        {isReadyForPromotion ? (
                          <Sparkles className="h-3 w-3 text-white" />
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-slate-200" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <span className={cn("text-[11px] font-bold block tracking-tight transition-colors", isReadyForPromotion ? "text-slate-900" : "text-slate-400")}>Stage 2: Catalog Ready</span>
                        <span className="text-[10px] text-slate-400 font-medium leading-tight">Requires SKU or Name, Brand & Image.</span>
                      </div>
                    </div>
                 </div>

                 {!isReadyForPromotion && isEditMode && (
                   <div className={cn("p-4 bg-amber-50/50 border border-amber-100 mt-2", UI_ENGINE_RADIUS_CONTROL)}>
                     <div className="flex gap-2 text-amber-700">
                       <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                       <span className="text-[10px] font-medium leading-relaxed">
                         Complete Primary Info and Brand to promote this item to the Global Library.
                       </span>
                     </div>
                   </div>
                 )}
               </div>
             </div>

             <div className="p-8 border-t border-slate-100 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">System Code</span>
                  <span className="text-sm font-mono font-bold text-slate-900 tracking-tighter">{initialSnapshot.schedule_code || "NEW"}</span>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Status</span>
                  <Badge variant="outline" className={cn(
                    "text-[9px] font-black uppercase border-none px-2 py-0.5",
                    isReadyForPromotion ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                  )}>
                    {isReadyForPromotion ? "Ready" : "Draft"}
                  </Badge>
                </div>
             </div>
          </div>

          {/* Right Panel: Content / Form */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
            <DialogHeader className={cn("p-10 pb-6 border-b flex flex-row items-center justify-between", UI_ENGINE_BORDER_SUBTLE)}>
              <div className="space-y-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className={cn("bg-slate-900 text-white font-black uppercase tracking-widest px-2 py-0.5", UI_ENGINE_TYPE_META, UI_ENGINE_RADIUS_CONTROL)}>
                    {initialSnapshot.schedule_category || "General"}
                  </Badge>
                  {isReadyForPromotion && (
                    <Badge className={cn("bg-indigo-50 text-indigo-600 border-none font-black uppercase tracking-widest px-2 py-0.5", UI_ENGINE_TYPE_META, UI_ENGINE_RADIUS_CONTROL)}>
                      Premium Catalog
                    </Badge>
                  )}
                </div>
                <DialogTitle className="font-lora text-3xl font-bold text-slate-900">
                  {isEditMode ? "Modify Specification" : (form.catalog_product_name || "Product Details")}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 font-inter">
                  Managing snapshot {initialSnapshot.schedule_code ? `for ${initialSnapshot.schedule_code}` : "details"} in this project.
                </DialogDescription>
              </div>
<div className="flex items-center gap-3">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => onOpenChange(false)}
                    className={cn("h-10 w-10 text-slate-400 hover:text-slate-900 hover:bg-slate-50", UI_ENGINE_RADIUS_ACTION)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
              </div>
            </DialogHeader>

            <ScrollArea className="flex-1">
              <div className="p-[var(--ui-modal-padding,2.5rem)]">
                {isEditMode ? (
                  <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Section 1: Identity & Brand (Required for Catalog) */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className={cn("h-8 w-8 bg-slate-950 text-white flex items-center justify-center text-[10px] font-bold", UI_ENGINE_RADIUS_ACTION)}>01</div>
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Identity & Vendor</h4>
                          <p className="text-[10px] text-slate-400">Essential information for Global Library promotion.</p>
                        </div>
                      </div>
                      
                      <div className={cn("p-8 space-y-6 border", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                        <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">SKU / Catalog Code</Label>
                            <Input 
                              value={form.catalog_sku} 
                              onChange={(e) => setForm({...form, catalog_sku: e.target.value})}
                              placeholder="e.g. PT-01" 
                              className={cn("h-12 bg-white border-slate-200 focus:border-slate-900 transition-all text-sm font-medium", UI_ENGINE_RADIUS_CONTROL)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Product Name</Label>
                            <Input 
                              value={form.catalog_product_name} 
                              onChange={(e) => setForm({...form, catalog_product_name: e.target.value})}
                              placeholder="e.g. Oak Wood Texture" 
                              className={cn("h-12 bg-white border-slate-200 focus:border-slate-900 transition-all text-sm font-medium", UI_ENGINE_RADIUS_CONTROL)}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Brand / Vendor Name</Label>
                          <CreatableSearch 
                            value={suggestions.brands.find(b => b.name === form.catalog_brand)?.id || ""}
                            placeholder="Search or type brand name..."
                            options={suggestions.brands}
                            allowFreeText={true}
                            onSelect={(id, name) => setForm({ ...form, catalog_brand: name })}
                            onCreate={(name) => setForm({ ...form, catalog_brand: name })}
                            className="h-12"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Secondary / Initials */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className={cn("h-8 w-8 bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold", UI_ENGINE_RADIUS_ACTION)}>02</div>
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Secondary Specs</h4>
                          <p className="text-[10px] text-slate-400">Mandatory &quot;Initials&quot; for project schedule visualization.</p>
                        </div>
                      </div>
                      
                      <div className={cn("p-8 bg-white border shadow-sm space-y-6", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-950 ml-1">Color (Mandatory) *</Label>
                          <Input 
                            value={form.catalog_color} 
                            onChange={(e) => setForm({...form, catalog_color: e.target.value})}
                            placeholder="e.g. Walnut Brown" 
                            className={cn("h-12 bg-white border-slate-900/20 ring-1 ring-slate-900/5 text-sm font-bold", UI_ENGINE_RADIUS_CONTROL)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pattern / Motif</Label>
                            <Input 
                              value={form.catalog_motif} 
                              onChange={(e) => setForm({...form, catalog_motif: e.target.value})}
                              placeholder="e.g. Grainy" 
                              className={cn("h-12 bg-slate-50 border-transparent text-sm", UI_ENGINE_RADIUS_CONTROL)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Finishing</Label>
                            <Input 
                              value={form.catalog_finishing} 
                              onChange={(e) => setForm({...form, catalog_finishing: e.target.value})}
                              placeholder="e.g. Matte" 
                              className={cn("h-12 bg-slate-50 border-transparent text-sm", UI_ENGINE_RADIUS_CONTROL)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Tertiary & Media */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-4">
                        <div className={cn("h-8 w-8 bg-slate-200 text-slate-600 flex items-center justify-center text-[10px] font-bold", UI_ENGINE_RADIUS_ACTION)}>03</div>
                        <div>
                          <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-950">Tertiary & Assets</h4>
                          <p className="text-[10px] text-slate-400">Dimensions, metadata, and hero image upload.</p>
                        </div>
                      </div>

                      <div className="space-y-8">
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dimensions</Label>
                            <Input 
                              value={form.catalog_dimensions} 
                              onChange={(e) => setForm({...form, catalog_dimensions: e.target.value})}
                              placeholder="e.g. 60x60 cm" 
                              className={cn("h-12 bg-slate-50 border-transparent text-sm", UI_ENGINE_RADIUS_CONTROL)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Reference Link</Label>
                            <Input 
                              value={form.catalog_reference_url} 
                              onChange={(e) => setForm({...form, catalog_reference_url: e.target.value})}
                              placeholder="https://..." 
                              className={cn("h-12 bg-slate-50 border-transparent text-sm", UI_ENGINE_RADIUS_CONTROL)}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Product Tags</Label>
                          <TagInput 
                            tags={form.catalog_structured_tags} 
                            onChange={(tags) => setForm({ ...form, catalog_structured_tags: tags })} 
                            placeholder="Add tags..." 
                            className="w-full"
                          />
                        </div>

                        <div className={cn("p-10 bg-slate-50 border border-dashed border-slate-200 flex flex-col items-center gap-6", UI_ENGINE_RADIUS_CARD)}>
                            <div className="w-44 aspect-square">
                              <OptimizedUploader
                                value={form.catalog_image_url}
                                onUpload={async (file) => {
                                  const timestamp = Date.now();
                                  const fileName = `${timestamp}-${file.name.replace(/\s/g, "_")}`;
                                  const url = await LibraryFacade.uploadProductImage(file, `covers/${fileName}`);
                                  setForm(prev => ({ ...prev, catalog_image_url: url }));
                                  return url;
                                }}
                                onClear={() => setForm(prev => ({ ...prev, catalog_image_url: "" }))}
                                aspect={1}
                              />
                            </div>
                            <div className="text-center space-y-1">
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-950">Master Catalog Hero Image</p>
                              <p className="text-[10px] text-slate-400 italic">White background recommended for catalog consistency.</p>
                            </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-12 animate-in fade-in duration-500">
                    <div className="grid grid-cols-2 gap-10">
                      {/* Section: Identity Matrix */}
                      <div className="col-span-2 space-y-6">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Identity & Branding</span>
                          <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-1">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-1">Brand Name</span>
                              <div className={cn("p-5 border flex items-center gap-3", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                <Building2 className="h-4 w-4 text-slate-400" />
                                <span className="text-sm font-bold text-slate-900">{form.catalog_brand || "Not Set"}</span>
                              </div>
                           </div>
                           <div className="space-y-1">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-1">Catalog SKU</span>
                              <div className={cn("p-5 border flex items-center gap-3", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                                <Tag className="h-4 w-4 text-slate-400" />
                                <span className="font-mono text-sm font-bold text-slate-900">{form.catalog_sku || "N/A"}</span>
                              </div>
                           </div>
                        </div>
                      </div>

                      {/* Section: Specification Matrix */}
                      <div className="col-span-2 space-y-6">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Specification Matrix</span>
                          <div className="h-px flex-1 bg-slate-100" />
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                           <div className="space-y-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-1">Color</span>
                             <div className={cn("p-5 bg-white border shadow-sm flex items-center gap-3", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                               <Palette className="h-4 w-4 text-slate-400" />
                               <span className="text-sm font-bold text-slate-900">{form.catalog_color || "—"}</span>
                             </div>
                           </div>
                           <div className="space-y-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-1">Pattern</span>
                             <div className={cn("p-5 border flex items-center gap-3", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                               <Layers className="h-4 w-4 text-slate-400" />
                               <span className="text-sm font-medium text-slate-600">{form.catalog_motif || "—"}</span>
                             </div>
                           </div>
                           <div className="space-y-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-1">Finishing</span>
                             <div className={cn("p-5 border flex items-center gap-3", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                               <Sparkles className="h-4 w-4 text-slate-400" />
                               <span className="text-sm font-medium text-slate-600">{form.catalog_finishing || "—"}</span>
                             </div>
                           </div>
                        </div>
                        <div className="space-y-1">
                             <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block ml-1">Dimensions</span>
                             <div className={cn("p-5 border flex items-center gap-3", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CONTROL)}>
                               <Ruler className="h-4 w-4 text-slate-400" />
                               <span className="text-sm font-medium text-slate-600">{form.catalog_dimensions || "Standard Dimensions"}</span>
                             </div>
                        </div>
                      </div>

                      {/* Tags & Context */}
                      {form.catalog_structured_tags.length > 0 && (
                        <div className="col-span-2 space-y-4">
                           <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-900">Search Tags</span>
                            <div className="h-px flex-1 bg-slate-100" />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {form.catalog_structured_tags.map((tag: string, i: number) => (
                              <Badge key={i} className={cn("bg-slate-100 text-slate-600 border-none font-bold px-3 py-1", UI_ENGINE_TYPE_META, UI_ENGINE_RADIUS_ACTION)}>
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            <div className={cn("p-10 pt-6 border-t flex items-center justify-between", UI_ENGINE_BG_SUBTLE, UI_ENGINE_BORDER_SUBTLE)}>
              {isEditMode ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setIsEditMode(false)}
                    className={cn("h-12 px-8 font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-950", UI_ENGINE_RADIUS_CONTROL)}
                  >
                    Discard Changes
                  </Button>
                  <Button 
                    onClick={handleSubmit} 
                    disabled={isSubmitting}
                    className={cn("bg-slate-950 hover:bg-black text-white h-12 px-12 shadow-xl shadow-slate-200 font-black text-[10px] uppercase tracking-widest gap-3 transition-all", UI_ENGINE_RADIUS_CONTROL)}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Finalize Snapshot</>}
                  </Button>
                </>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "h-10 px-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest border",
                      isReadyForPromotion ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100",
                      UI_ENGINE_RADIUS_ACTION
                    )}>
                      {isReadyForPromotion ? <Sparkles className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                      {isReadyForPromotion ? "Promotion Ready" : "Promotion Locked"}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {isDraft && (
                      <Button 
                        variant={isReadyForPromotion ? "default" : "secondary"}
                        disabled={!isReadyForPromotion}
                        onClick={async () => {
                          const toastId = toast.loading("Requesting promotion to Master Catalog...");
                          try {
                            unwrapActionResult(await LibraryFacade.requestPromotionFromSnapshot({ 
                              schedule_option_id: optionId,
                              project_id: projectId 
                            }));
                            toast.success("Product promoted to Global Library!", { id: toastId });
                            if (onRefresh) onRefresh();
                          } catch (err: unknown) {
                            toast.error(err instanceof Error ? err.message : "Promotion failed", { id: toastId });
                          }
                        }}
                        className={cn(
                          "h-12 px-8 font-black text-[10px] uppercase tracking-widest gap-2 shadow-lg transition-all",
                          isReadyForPromotion ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100" : "bg-slate-100 text-slate-400 shadow-none cursor-not-allowed",
                          UI_ENGINE_RADIUS_CONTROL
                        )}
                      >
                        <Sparkles className="h-4 w-4" />
                        Promote to Master Catalog
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      onClick={() => onOpenChange(false)}
                      className={cn("h-12 px-10 font-black text-[10px] uppercase tracking-widest text-slate-500 hover:text-slate-950 hover:bg-slate-100/50", UI_ENGINE_RADIUS_CONTROL)}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
