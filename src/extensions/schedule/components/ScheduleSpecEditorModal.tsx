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
  Edit3,
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
import { uploadLibraryImage } from "@/extensions/library/lib/upload-client";
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
  promoteToLibraryAction
} from "@/actions/schedule-actions";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { ScheduleOptionSnapshot } from "../types";
import { CreatableSearch } from "@/components/ui/creatable-search";

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
}

export function ScheduleSpecEditorModal({
  optionId,
  initialSnapshot,
  isOpen,
  onOpenChange,
  onSuccess,
  onRefresh,
  userRole = "STAFF"
}: ScheduleSpecEditorModalProps) {
  const isAdmin = ["ADMIN", "DIC", "DRIC"].includes(userRole);
  
  const [isEditMode, setIsEditMode] = React.useState(false);
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
      setIsEditMode(false);
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
  }, [isOpen, initialSnapshot, isSubmitting]);

  const isPrimaryComplete = !!form.catalog_product_name?.trim() && !!form.catalog_sku?.trim();
  const isVendorComplete = !!form.catalog_brand?.trim();
  const isReadyForPromotion = isPrimaryComplete && isVendorComplete;
  const isDraft = !initialSnapshot.product_catalog_id;

  const handleSubmit = async () => {
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
          "p-0 overflow-hidden border-slate-100 rounded-3xl shadow-2xl backdrop-blur-sm bg-white/95",
          isEditMode ? "max-w-[700px]" : "max-w-[600px]"
        )}
      >
        <DialogHeader className="p-8 pb-4">
          <div className="flex items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
                <Tag className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="font-lora text-xl font-medium text-slate-900 leading-none">
                  {isEditMode ? "Edit Snapshot Details" : "Product Specification"}
                </DialogTitle>
                <DialogDescription className="text-xs font-inter text-slate-400 font-medium tracking-tight">
                  {isEditMode ? "Changes are local to this project" : "Click to view full details"}
                </DialogDescription>
              </div>
            </div>
            
            {isAdmin && !isEditMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(true)}
                className="rounded-xl h-9 px-4 text-[10px] font-bold uppercase tracking-widest border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-900"
              >
                <Edit3 className="h-3.5 w-3.5 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </DialogHeader>

        <ScrollArea className={cn("px-8 pb-8", isEditMode ? "h-[580px]" : "h-auto max-h-[70vh]")}>
          {!isEditMode ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              {isDraft && !isReadyForPromotion && (
                <div className="bg-amber-50 border border-amber-200 rounded-[2rem] p-6 flex items-start gap-4 mb-6">
                  <div className="h-10 w-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-amber-900 uppercase tracking-widest">Action Required</h4>
                    <p className="text-xs text-amber-700 leading-relaxed font-medium">
                      This item is a local draft. To enable promotion to the Master Catalog, please complete the 
                      <span className="font-bold"> Primary Data (SKU & Name)</span> and <span className="font-bold">Brand</span> details.
                    </p>
                    <Button 
                      variant="link" 
                      onClick={() => setIsEditMode(true)}
                      className="p-0 h-auto text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 hover:text-amber-900"
                    >
                      Complete Specifications →
                    </Button>
                  </div>
                </div>
              )}

              {isDraft && isReadyForPromotion && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-[2rem] p-6 flex items-start gap-4 mb-6">
                  <div className="h-10 w-10 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-black text-emerald-900 uppercase tracking-widest">Elevation Ready</h4>
                    <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                      All minimum requirements are met. You can now request this item to be added to the Product Catalog.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                <div className="w-32 h-32 rounded-3xl overflow-hidden bg-white border border-slate-200 shadow-sm flex-shrink-0">
                  {form.catalog_image_url ? (
                    <img src={form.catalog_image_url} alt={form.catalog_product_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <Package className="h-8 w-8 text-slate-200" />
                      <span className="text-[8px] font-black text-slate-300 uppercase">No Image</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-lora text-xl font-bold text-slate-900 leading-tight mb-1">
                    {form.catalog_product_name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-slate-500 mb-3">
                    <Building2 className="h-3.5 w-3.5" />
                    <span className="font-medium">{form.catalog_brand}</span>
                  </div>
                  {form.catalog_reference_url && (
                    <a 
                      href={form.catalog_reference_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Reference
                    </a>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Palette className="h-4 w-4 text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Color</span>
                  </div>
                  <span className="font-lora text-lg font-medium text-slate-900">
                    {form.catalog_color}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="h-4 w-4 text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pattern</span>
                  </div>
                  <span className="font-lora text-lg font-medium text-slate-900">
                    {form.catalog_motif}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Type className="h-4 w-4 text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Finishing</span>
                  </div>
                  <span className="font-lora text-lg font-medium text-slate-900">
                    {form.catalog_finishing}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Ruler className="h-4 w-4 text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Dimensions</span>
                  </div>
                  <span className="font-lora text-lg font-medium text-slate-900">
                    {form.catalog_dimensions}
                  </span>
                </div>
              </div>

              {form.catalog_sub_category && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sub-category:</span>
                  <Badge variant="outline" className="text-[10px] font-medium">{form.catalog_sub_category}</Badge>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {form.catalog_structured_tags.map((tag, i) => (
                  <Badge key={i} className="bg-slate-100 text-slate-600 text-[10px] font-medium">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6 pt-2">
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-1 w-4 rounded-full bg-slate-200" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cover Image</span>
                </div>
                <div className="flex items-start gap-5">
                  <div className="w-[140px] flex-shrink-0">
                    <OptimizedUploader
                      value={form.catalog_image_url}
                      onUpload={async (file) => {
                        const timestamp = Date.now();
                        const fileName = `${timestamp}-${file.name.replace(/\s/g, "_")}`;
                        const coverPath = `covers/${fileName}`;
                        const url = await uploadLibraryImage(file, coverPath);
                        setForm(prev => ({ ...prev, catalog_image_url: url }));
                        return url;
                      }}
                      onClear={() => setForm(prev => ({ ...prev, catalog_image_url: "" }))}
                      aspect={1}
                    />
                  </div>
                  <div className="flex-1 space-y-2 pt-1">
                    <p className="font-sans text-[10px] text-slate-400 leading-relaxed">
                      Upload a project-specific image for this product entry.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-1 w-4 rounded-full bg-slate-900" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Product Identity</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">SKU</Label>
                    <Input 
                      value={form.catalog_sku} 
                      onChange={(e) => setForm({...form, catalog_sku: e.target.value})}
                      placeholder="e.g. PL-1" 
                      className="h-11 bg-slate-50 border-slate-100 rounded-xl font-inter font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Product Name</Label>
                    <Input 
                      value={form.catalog_product_name} 
                      onChange={(e) => setForm({...form, catalog_product_name: e.target.value})}
                      placeholder="e.g. HPL Wood Texture" 
                      className="h-11 bg-slate-50 border-slate-100 rounded-xl font-inter font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Brand</Label>
                  <CreatableSearch 
                    value={suggestions.brands.find(b => b.name === form.catalog_brand)?.id || ""}
                    placeholder="Select or enter Brand..."
                    options={suggestions.brands}
                    allowFreeText={true}
                    onSelect={(id, name) => setForm({ ...form, catalog_brand: name })}
                    onCreate={(name) => setForm({ ...form, catalog_brand: name })}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-1 w-4 rounded-full bg-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Physical Identity</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Color</Label>
                    <Input 
                      value={form.catalog_color} 
                      onChange={(e) => setForm({...form, catalog_color: e.target.value})}
                      placeholder="e.g. Walnut" 
                      className="h-11 bg-slate-50 border-slate-100 rounded-xl font-inter font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pattern / Motif</Label>
                    <Input 
                      value={form.catalog_motif} 
                      onChange={(e) => setForm({...form, catalog_motif: e.target.value})}
                      placeholder="e.g. Wood Grain" 
                      className="h-11 bg-slate-50 border-slate-100 rounded-xl font-inter font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Finishing</Label>
                    <Input 
                      value={form.catalog_finishing} 
                      onChange={(e) => setForm({...form, catalog_finishing: e.target.value})}
                      placeholder="e.g. Matte" 
                      className="h-11 bg-slate-50 border-slate-100 rounded-xl font-inter font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dimensions</Label>
                    <Input 
                      value={form.catalog_dimensions} 
                      onChange={(e) => setForm({...form, catalog_dimensions: e.target.value})}
                      placeholder="e.g. 122 x 244 cm" 
                      className="h-11 bg-slate-50 border-slate-100 rounded-xl font-inter font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-1 w-4 rounded-full bg-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Additional</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sub-Category</Label>
                    <Input 
                      value={form.catalog_sub_category} 
                      onChange={(e) => setForm({...form, catalog_sub_category: e.target.value})}
                      placeholder="e.g. Exterior Panel" 
                      className="h-11 bg-slate-50 border-slate-100 rounded-xl font-inter font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                      <LinkIcon className="h-2.5 w-2.5" /> Reference
                    </Label>
                    <Input 
                      value={form.catalog_reference_url} 
                      onChange={(e) => setForm({...form, catalog_reference_url: e.target.value})}
                      placeholder="https://..." 
                      className="h-11 bg-slate-50 border-slate-100 rounded-xl font-inter font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tags</Label>
                <TagInput 
                  tags={form.catalog_structured_tags} 
                  onChange={(tags) => setForm({ ...form, catalog_structured_tags: tags })} 
                  placeholder="Type tag..." 
                  className="w-full"
                />
              </div>
            </div>
          )}
        </ScrollArea>

        <div className="p-6 pt-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          {isEditMode ? (
            <>
              <Button
                variant="ghost"
                onClick={() => setIsEditMode(false)}
                className="h-10 px-4 rounded-xl font-inter font-bold text-xs uppercase tracking-widest text-slate-400"
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                {isDraft && (
                  <Button 
                    variant="outline"
                    type="button"
                    disabled={!isReadyForPromotion}
                    onClick={async () => {
                      const toastId = toast.loading("Requesting promotion...");
                      try {
                        unwrapActionResult(await promoteToLibraryAction({ optionId }));
                        toast.success("Promotion request sent!", { id: toastId });
                        if (onSuccess) onSuccess();
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : "Promotion failed", { id: toastId });
                      }
                    }}
                    className={cn(
                      "h-10 rounded-xl border-slate-200 text-[10px] font-bold uppercase tracking-widest transition-all",
                      isReadyForPromotion ? "text-emerald-600 border-emerald-100 hover:border-emerald-500 hover:bg-emerald-50" : "text-slate-300 bg-slate-50 cursor-not-allowed"
                    )}
                  >
                    {isReadyForPromotion ? "Request to Catalog" : "Incomplete for Catalog"}
                  </Button>
                )}
                <Button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || !form.catalog_product_name?.trim() || !form.catalog_brand?.trim()}
                  className="bg-slate-950 hover:bg-slate-800 text-white rounded-xl h-10 px-6 shadow-xl shadow-slate-200 font-inter font-bold text-xs uppercase tracking-widest gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="h-3.5 w-3.5" />
                      Save Product
                    </>
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Info className="h-4 w-4" />
                <span className="font-medium">Local to this project</span>
              </div>
              <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="h-10 px-6 rounded-xl font-inter font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-slate-900"
              >
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}