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
  Check,
  X,
  ExternalLink,
  Package,
  Ruler,
  Building2,
  Layers,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Edit3
} from "lucide-react";
import { getEffectiveTitle, isPlaceholder } from "../lib/display-utils";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";
import { OptimizedUploader } from "@/components/ui/optimized-uploader";
import { LibraryFacade } from "@/extensions/library/facade";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VisualAsset } from "@/components/ui/visual-asset";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  updateScheduleOptionSnapshotAction, 
  getScheduleSuggestionsAction,
} from "@/extensions/schedule/actions/schedule-actions";
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

interface ScheduleWorkspaceInspectorProps {
  optionId: string;
  initialSnapshot: ScheduleOptionSnapshot;
  onClose: () => void;
  onSuccess?: () => void;
  onRefresh?: () => void;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
  hasNext?: boolean;
  hasPrev?: boolean;
  userRole?: string;
  projectId: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function ScheduleWorkspaceInspector({
  optionId,
  initialSnapshot,
  onClose,
  onSuccess,
  onRefresh,
  onNavigateNext,
  onNavigatePrev,
  hasNext,
  hasPrev,
  userRole = "STAFF",
  projectId,
  activeTab,
  onTabChange
}: ScheduleWorkspaceInspectorProps) {
  const [localTab, setLocalTab] = React.useState("identity");
  const tab = activeTab ?? localTab;
  const setTab = onTabChange ?? setLocalTab;
  const isAdmin = ["ADMIN", "DIC", "DRIC"].includes(userRole);
  const isReserved = initialSnapshot.catalog_product_name === "[RESERVED]";
  
  // Workspace-first editing: Default to edit mode
  const [isEditMode, setIsEditMode] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isPromoting, setIsPromoting] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<{
    brands: { id: string, name: string }[],
    products: ProductSuggestion[]
  }>({ brands: [], products: [] });

  const [form, setForm] = React.useState({
    catalog_product_name: "",
    catalog_brand: "",
    catalog_reference_url: "",
    catalog_image_url: "",
    catalog_sku: "",
    catalog_sub_category: "",
    catalog_motif: "",
    catalog_color: "",
    catalog_finishing: "",
    catalog_dimensions: "",
    catalog_structured_tags: [] as string[],
  });

  React.useEffect(() => {
    let isMounted = true;
    async function fetchSuggestions() {
      try {
        const result = unwrapActionResult(await getScheduleSuggestionsAction({}));
        if (isMounted) {
          setSuggestions(result as {
            brands: { id: string; name: string }[];
            products: ProductSuggestion[];
          });
        }
      } catch (error) {
        console.error("Failed to fetch suggestions", error);
      }
    }
    fetchSuggestions();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update form when selected item changes
  React.useEffect(() => {
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
    // Auto-save strategy: when navigating away, we might want to save. For now, rely on explicit save button.
  }, [initialSnapshot, optionId]);

  const hasPrimaryIdentity = !isPlaceholder(form.catalog_sku) && !isPlaceholder(form.catalog_product_name);
  const isBrandComplete = !isPlaceholder(form.catalog_brand);
  
  const isPrimaryComplete = hasPrimaryIdentity && isBrandComplete;
  const isSecondaryComplete = !!form.catalog_color?.trim() && !isPlaceholder(form.catalog_color);
  const isReadyForPromotion = isPrimaryComplete && isSecondaryComplete && !!form.catalog_image_url;
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
          catalog_sku: form.catalog_sku || undefined,
          catalog_motif: form.catalog_motif || undefined,
          catalog_color: form.catalog_color || undefined,
          catalog_finishing: form.catalog_finishing || undefined,
          catalog_dimensions: form.catalog_dimensions || undefined,
          catalog_structured_tags: form.catalog_structured_tags || [],
          catalog_reference_url: form.catalog_reference_url || undefined,
        }
      };
      unwrapActionResult(await updateScheduleOptionSnapshotAction({
        optionId,
        data: dataPayload
      }));

      toast.success("Specification saved");
      if (onSuccess) onSuccess();
      if (onRefresh) onRefresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update specification");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Inspector Header */}
      <div className={cn("p-5 border-b flex flex-col gap-4", UI_ENGINE_BORDER_SUBTLE)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={cn("bg-slate-900 text-white font-black uppercase tracking-widest px-2 py-0.5", UI_ENGINE_TYPE_META, UI_ENGINE_RADIUS_CONTROL)}>
              {initialSnapshot.schedule_code || "NEW"}
            </Badge>
            {isReadyForPromotion && (
              <Badge className={cn("bg-indigo-50 text-indigo-600 border-none font-black uppercase tracking-widest px-2 py-0.5", UI_ENGINE_TYPE_META, UI_ENGINE_RADIUS_CONTROL)}>
                Ready
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onNavigatePrev}
              disabled={!hasPrev}
              className={cn("h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-50", UI_ENGINE_RADIUS_ACTION)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onNavigateNext}
              disabled={!hasNext}
              className={cn("h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-50", UI_ENGINE_RADIUS_ACTION)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="w-px h-4 bg-slate-200 mx-1" />
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className={cn("h-8 w-8 text-slate-400 hover:text-slate-900 hover:bg-slate-50", UI_ENGINE_RADIUS_ACTION)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div>
          <h2 className="font-serif text-lg font-bold text-slate-900 leading-tight">
            {form.catalog_product_name || "Product Details"}
          </h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            {form.catalog_brand || "No brand specified"}
          </p>
        </div>
      </div>

      {/* Inspector Body */}
      <ScrollArea className="flex-1">
        <div className="p-5 pb-20">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className={cn("grid grid-cols-3 w-full h-10 p-1 bg-slate-100/80 mb-6", UI_ENGINE_RADIUS_CONTROL)}>
              <TabsTrigger
                value="identity"
                className={cn("py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm", UI_ENGINE_RADIUS_ACTION)}
              >
                Identity
              </TabsTrigger>
              <TabsTrigger
                value="specs"
                className={cn("py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm", UI_ENGINE_RADIUS_ACTION)}
              >
                Specs
              </TabsTrigger>
              <TabsTrigger
                value="curation"
                className={cn("py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm", UI_ENGINE_RADIUS_ACTION)}
              >
                Curation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="identity" className="space-y-6 outline-none animate-in fade-in-50 duration-200">
              {/* Media / Image */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                   <ImageIcon className="h-3 w-3 text-slate-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Visual</span>
                </div>
                <div className={cn("w-full aspect-square shadow-sm rounded-[var(--ui-radius-card,1rem)] bg-slate-50 border", UI_ENGINE_BORDER_SUBTLE)}>
                  <OptimizedUploader
                    value={form.catalog_image_url}
                    onUpload={async (file) => {
                      const timestamp = Date.now();
                      const fileName = `${timestamp}-${file.name.replace(/\s/g, "_")}`;
                      const url = await LibraryFacade.uploadProductImage(file, `covers/${fileName}`);
                      setForm(prev => ({ ...prev, catalog_image_url: url }));
                      handleSubmit();
                      return url;
                    }}
                    onColorSelect={async (colorUri) => {
                      setForm(prev => ({ ...prev, catalog_image_url: colorUri }));
                    }}
                    onClear={() => setForm(prev => ({ ...prev, catalog_image_url: "" }))}
                    aspect={1}
                    className="w-full h-full"
                  />
                </div>
              </div>

              {/* Identity */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <Tag className="h-3 w-3 text-slate-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Identity & Vendor</span>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-600">Product Name</Label>
                    <Input 
                      value={form.catalog_product_name} 
                      onChange={(e) => setForm({...form, catalog_product_name: e.target.value})}
                      placeholder="e.g. Oak Wood Texture" 
                      className={cn("h-9 bg-white border-slate-200 text-xs", UI_ENGINE_RADIUS_CONTROL)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-600">SKU</Label>
                      <Input 
                        value={form.catalog_sku} 
                        onChange={(e) => setForm({...form, catalog_sku: e.target.value})}
                        placeholder="e.g. PT-01" 
                        className={cn("h-9 bg-white border-slate-200 text-xs font-mono", UI_ENGINE_RADIUS_CONTROL)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-600">Brand</Label>
                      <CreatableSearch 
                        value={suggestions.brands.find(b => b.name === form.catalog_brand)?.id || form.catalog_brand || ""}
                        placeholder="Brand..."
                        options={suggestions.brands}
                        allowFreeText={true}
                        onSelect={(id, name) => setForm({ ...form, catalog_brand: name })}
                        onCreate={(name) => setForm({ ...form, catalog_brand: name })}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="specs" className="space-y-6 outline-none animate-in fade-in-50 duration-200">
              {/* Specifications */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                   <Layers className="h-3 w-3 text-slate-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Specifications</span>
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-600">Color *</Label>
                      <Input 
                        value={form.catalog_color} 
                        onChange={(e) => setForm({...form, catalog_color: e.target.value})}
                        placeholder="Walnut Brown" 
                        className={cn("h-9 bg-white border-slate-900/20 text-xs", UI_ENGINE_RADIUS_CONTROL)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-600">Finishing</Label>
                      <Input 
                        value={form.catalog_finishing} 
                        onChange={(e) => setForm({...form, catalog_finishing: e.target.value})}
                        placeholder="Matte" 
                        className={cn("h-9 bg-white border-slate-200 text-xs", UI_ENGINE_RADIUS_CONTROL)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-600">Pattern</Label>
                      <Input 
                        value={form.catalog_motif} 
                        onChange={(e) => setForm({...form, catalog_motif: e.target.value})}
                        placeholder="Grainy" 
                        className={cn("h-9 bg-white border-slate-200 text-xs", UI_ENGINE_RADIUS_CONTROL)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold text-slate-600">Dimensions</Label>
                      <Input 
                        value={form.catalog_dimensions} 
                        onChange={(e) => setForm({...form, catalog_dimensions: e.target.value})}
                        placeholder="60x60 cm" 
                        className={cn("h-9 bg-white border-slate-200 text-xs", UI_ENGINE_RADIUS_CONTROL)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="curation" className="space-y-6 outline-none animate-in fade-in-50 duration-200">
              {/* Additional Info */}
              <div className="space-y-4">
                 <div className="flex items-center gap-2">
                   <Info className="h-3 w-3 text-slate-400" />
                   <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Links & Tags</span>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-600">Reference Link</Label>
                    <div className="flex gap-2">
                      <Input 
                        value={form.catalog_reference_url} 
                        onChange={(e) => setForm({...form, catalog_reference_url: e.target.value})}
                        placeholder="https://..." 
                        className={cn("h-9 bg-white border-slate-200 text-xs", UI_ENGINE_RADIUS_CONTROL)}
                      />
                      {form.catalog_reference_url && (
                        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" asChild>
                          <a href={form.catalog_reference_url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4 text-slate-400" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-600">Tags</Label>
                    <TagInput 
                      tags={form.catalog_structured_tags} 
                      onChange={(tags) => setForm({ ...form, catalog_structured_tags: tags })} 
                      placeholder="Add tags..." 
                      className="w-full text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Library Readiness Checklist */}
              {isDraft && (
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Library Readiness Checklist</span>
                  </div>
                  <div className={cn("space-y-4 p-4 bg-slate-50/50 border", UI_ENGINE_BORDER_SUBTLE, UI_ENGINE_RADIUS_CARD)}>
                    {/* Stage 1: Project Minimum */}
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
                        isSecondaryComplete ? "bg-emerald-500 border-emerald-500" : "bg-white border-slate-200"
                      )}>
                        {isSecondaryComplete ? <Check className="h-3 w-3 text-white" /> : <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />}
                      </div>
                      <div className="space-y-0.5">
                        <span className={cn("text-[10px] font-bold block transition-colors", isSecondaryComplete ? "text-slate-900" : "text-slate-400")}>
                          Stage 1: Project Snapshot
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">
                          Requires Color specification.
                        </span>
                      </div>
                    </div>

                    {/* Stage 2: Catalog Ready */}
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 border-2 transition-all",
                        isReadyForPromotion ? "bg-indigo-600 border-indigo-600 shadow-sm" : "bg-white border-slate-200"
                      )}>
                        {isReadyForPromotion ? (
                          <Sparkles className="h-3 w-3 text-white" />
                        ) : (
                          <div className="h-1.5 w-1.5 rounded-full bg-slate-200" />
                        )}
                      </div>
                      <div className="space-y-0.5">
                        <span className={cn("text-[10px] font-bold block tracking-tight transition-colors", isReadyForPromotion ? "text-slate-900" : "text-slate-400")}>
                          Stage 2: Catalog Ready
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium leading-tight">
                          Requires SKU or Name, Brand, & Image.
                        </span>
                      </div>
                    </div>
                  </div>
                  {!isReadyForPromotion && (
                    <div className={cn("p-3 bg-amber-50/50 border border-amber-100/50", UI_ENGINE_RADIUS_CONTROL)}>
                      <div className="flex gap-2 text-amber-700">
                        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span className="text-[9px] font-medium leading-relaxed">
                          Complete Name, Brand, SKU, Color and Image to promote to Global Library.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      {/* Footer Actions */}
      <div className={cn("p-4 border-t flex flex-col gap-2 bg-white", UI_ENGINE_BORDER_SUBTLE)}>
        {isDraft && (
          <Button
            variant={isReadyForPromotion ? "default" : "secondary"}
            disabled={!isReadyForPromotion || isPromoting}
            onClick={async () => {
              setIsPromoting(true);
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
              } finally {
                setIsPromoting(false);
              }
            }}
            className={cn(
              "w-full h-10 font-black text-[10px] uppercase tracking-widest gap-2 shadow-lg transition-all",
              isReadyForPromotion 
                ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100" 
                : "bg-slate-100 text-slate-400 shadow-none cursor-not-allowed",
              UI_ENGINE_RADIUS_CONTROL
            )}
          >
            {isPromoting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4" /> Promote to Master Catalog</>}
          </Button>
        )}
        <Button 
          onClick={handleSubmit} 
          disabled={isSubmitting}
          className={cn("w-full bg-slate-900 hover:bg-black text-white h-10 shadow-sm font-black text-[10px] uppercase tracking-widest gap-2 transition-all", UI_ENGINE_RADIUS_CONTROL)}
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4" /> Save Snapshot</>}
        </Button>
      </div>

    </div>
  );
}
