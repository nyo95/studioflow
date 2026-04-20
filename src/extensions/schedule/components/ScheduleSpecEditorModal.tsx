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
  ImageIcon
} from "lucide-react";
import { TagInput } from "@/components/ui/tag-input";
import { cn } from "@/lib/utils";
import { UniversalImageUploader } from "@/components/ui/universal-image-uploader";
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
}

export function ScheduleSpecEditorModal({
  optionId,
  initialSnapshot,
  isOpen,
  onOpenChange,
  onSuccess,
  onRefresh
}: ScheduleSpecEditorModalProps) {
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

  // Fetch suggestions
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

  // Reset form when modal opens with new snapshot
  React.useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, initialSnapshot]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const dataPayload = {
        catalog_product_name: form.catalog_product_name || undefined,
        catalog_brand: form.catalog_brand || undefined,
        catalog_reference_url: form.catalog_reference_url || null,
        catalog_image_url: form.catalog_image_url || undefined,
        catalog_sub_category: form.catalog_sub_category || undefined,
        specs: {
          catalog_sku: form.catalog_sku,
          catalog_motif: form.catalog_motif || undefined,
          catalog_color: form.catalog_color || undefined,
          catalog_finishing: form.catalog_finishing || undefined,
          catalog_dimensions: form.catalog_dimensions,
          catalog_structured_tags: form.catalog_structured_tags,
          catalog_reference_url: form.catalog_reference_url || undefined,
        }
      };
      unwrapActionResult(await updateScheduleOptionSnapshotAction({
        optionId,
        data: dataPayload
      }));

      toast.success("Specification updated successfully");
      onOpenChange(false);
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
        className="sm:max-w-[550px] p-0 overflow-hidden border-slate-100 rounded-3xl shadow-2xl backdrop-blur-sm bg-white/95"
      >
        <DialogHeader className="p-8 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg shadow-slate-200">
               <Tag className="h-5 w-5" />
            </div>
            <div>
               <DialogTitle className="font-lora text-2xl font-medium text-slate-900 leading-none mb-1">
                 Edit Specification
               </DialogTitle>
               <DialogDescription className="text-xs font-inter text-slate-400 font-medium tracking-tight">
                 Changes are local to this project and won&apos;t affect the Global Library.
               </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[580px] px-8 pb-8">
          <div className="space-y-8 pt-2">

            {/* 0. PRODUCT IMAGE */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-1 w-4 rounded-full bg-slate-200" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cover Image</span>
              </div>
              <div className="flex items-start gap-5">
                <div className="w-[140px] flex-shrink-0">
                  <UniversalImageUploader
                    initialImageUrl={form.catalog_image_url}
                    onUploadComplete={({ cover }) => setForm(prev => ({ ...prev, catalog_image_url: cover }))}
                    label="Upload 1:1 Image"
                    aspectRatio={1}
                  />
                </div>
                <div className="flex-1 space-y-2 pt-1">
                  <p className="font-sans text-[10px] text-slate-400 leading-relaxed">
                    Upload a project-specific image for this material entry. Supports JPG/PNG up to 5MB. The image will be cropped to a 1:1 square ratio.
                  </p>
                  <p className="font-sans text-[9px] text-slate-300 italic">
                    This image is local to this project entry and won&apos;t affect the global library.
                  </p>
                </div>
              </div>
            </div>

            {/* 1. PRODUCT IDENTITY */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-1 w-4 rounded-full bg-slate-900" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">1. Product Identity</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Product SKU</Label>
                  <Input 
                    value={form.catalog_sku} 
                    onChange={(e) => setForm({...form, catalog_sku: e.target.value})}
                    placeholder="e.g. PL-1" 
                    className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-bold transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Product / Collection Name</Label>
                  <Input 
                    value={form.catalog_product_name} 
                    onChange={(e) => setForm({...form, catalog_product_name: e.target.value})}
                    placeholder="e.g. HPL Wood Texture" 
                    className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-bold transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Brand</Label>
                <CreatableSearch 
                  value={suggestions.brands.find(b => b.name === form.catalog_brand)?.id || ""}
                  placeholder="Select or enter Brand... ex: TACO"
                  options={suggestions.brands}
                  allowFreeText={true}
                  onSelect={(id, name) => setForm({ ...form, catalog_brand: name })}
                  onCreate={(name) => setForm({ ...form, catalog_brand: name })}
                  className="h-12"
                />
              </div>
            </div>

            {/* 2. PHYSICAL IDENTITY */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-1 w-4 rounded-full bg-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">2. Physical Identity</span>
              </div>
              
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Pattern / Motif</Label>
                   <Input 
                     value={form.catalog_motif} 
                     onChange={(e) => setForm({...form, catalog_motif: e.target.value})}
                     placeholder="e.g. Natural Grain" 
                     className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Color Info</Label>
                   <Input 
                     value={form.catalog_color} 
                     onChange={(e) => setForm({...form, catalog_color: e.target.value})}
                     placeholder="e.g. Match to PL-2" 
                     className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                   />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Finishing Type</Label>
                    <Input 
                      value={form.catalog_finishing} 
                      onChange={(e) => setForm({...form, catalog_finishing: e.target.value})}
                      placeholder="e.g. Matte / Glossy" 
                      className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                    />
                 </div>
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Dimensions</Label>
                    <Input 
                      value={form.catalog_dimensions} 
                      onChange={(e) => setForm({...form, catalog_dimensions: e.target.value})}
                      placeholder="e.g. 122 x 244 x 1 cm" 
                      className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                    />
                 </div>
               </div>
            </div>

            {/* 3. ADDITIONAL METADATA */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-1 w-4 rounded-full bg-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">3. Additional Metadata</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Sub-Category</Label>
                    <Input 
                      value={form.catalog_sub_category} 
                      onChange={(e) => setForm({...form, catalog_sub_category: e.target.value})}
                      placeholder="e.g. Wood Series" 
                      className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                    <LinkIcon className="h-2.5 w-2.5" /> Reference Link
                  </Label>
                  <Input 
                    value={form.catalog_reference_url} 
                    onChange={(e) => setForm({...form, catalog_reference_url: e.target.value})}
                    placeholder="https://..." 
                    className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                  />
                  </div>
              </div>
            </div>

            {/* 4. DYNAMIC TAGS */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-4 rounded-full bg-slate-400" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">4. Dynamic Tags & Specs</span>
                </div>
              </div>
              
              <TagInput 
                tags={form.catalog_structured_tags} 
                onChange={(tags) => setForm({ ...form, catalog_structured_tags: tags })} 
                placeholder="Type tag (e.g. Roughness: R10, Price: 10k)..." 
                className="w-full"
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-3 items-start">
               <Info className="h-4 w-4 text-slate-400 mt-0.5" />
               <p className="text-[10px] font-medium font-inter text-slate-500 leading-relaxed">
                 Updating this specification creates an immutable snapshot for this project entry. 
                 Changes do not sync back to the global library unless explicitly promoted.
               </p>
            </div>
          </div>
        </ScrollArea>

        <div className="p-8 pt-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              type="button"
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
              className="h-10 rounded-xl border-slate-200 text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:bg-white hover:border-slate-900 transition-all font-inter"
            >
              Save To Library
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              className="h-12 px-6 rounded-2xl font-inter font-bold text-xs uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all"
            >
              Cancel
            </Button>
            <Button 
               onClick={handleSubmit} 
               disabled={isSubmitting || !form.catalog_product_name || !form.catalog_brand}
               className="bg-slate-950 hover:bg-slate-800 text-white rounded-2xl h-12 px-10 shadow-xl shadow-slate-200 transition-all font-inter font-bold text-xs uppercase tracking-widest gap-2"
            >
               {isSubmitting ? (
                 <Loader2 className="h-4 w-4 animate-spin" />
               ) : (
                 <>
                   <Save className="h-3.5 w-3.5" />
                   Save Changes
                 </>
               )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
