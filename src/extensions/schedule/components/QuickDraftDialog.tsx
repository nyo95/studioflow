"use client";

import * as React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { 
  Paintbrush, 
  Layers, 
  Fingerprint, 
  Plus, 
  Loader2,
  Terminal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  UI_ENGINE_RADIUS_CONTROL, 
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_RADIUS_CARD,
} from "@/ui_engine/tokens/layout";
import {
  UI_ENGINE_TYPE_TITLE,
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_META,
  UI_ENGINE_TYPE_H3,
} from "@/ui_engine/tokens/typography";
import { ProductType } from "@/generated/prisma";
import { unwrapActionResult } from "@/lib/result";
import { 
  addScheduleEntryInstantAction, 
  updateScheduleOptionSnapshotAction,
  getScheduleCategoriesAction,
  getScheduleSuggestionsAction
} from "@/extensions/schedule/actions/schedule-actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { UniversalImageUploader } from "@/components/ui/universal-image-uploader";
import { ScrollArea } from "@/components/ui/scroll-area";

interface QuickDraftDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  section: ProductType;
  initialValue: string;
  preParsedData?: Record<string, string>;
  onSuccess?: () => void;
}

export function QuickDraftDialog({ 
  isOpen, 
  onOpenChange, 
  projectId, 
  section, 
  initialValue,
  preParsedData,
  onSuccess
}: QuickDraftDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Form State
  const [productName, setProductName] = React.useState("");
  const [sku, setSku] = React.useState("");
  const [color, setColor] = React.useState("");
  const [pattern, setPattern] = React.useState("");
  const [finishing, setFinishing] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  
  // Tertiary
  const [dimension, setDimension] = React.useState("");
  const [link, setLink] = React.useState("");

  // Suggestions
  const [categories, setCategories] = React.useState<string[]>([]);
  const [brands, setBrands] = React.useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      loadData();
      
      if (preParsedData) {
        setProductName(preParsedData.name || "");
        setSku(preParsedData.sku || "");
        setBrand(preParsedData.brand || "");
        setColor(preParsedData.color || "");
        setPattern(preParsedData.motif || "");
        setFinishing(preParsedData.finishing || "");
        setDimension(preParsedData.dim || "");
        setLink(preParsedData.link || "");
        setImageUrl(preParsedData.img || null);
      } else {
        const v = initialValue.toLowerCase();
        const isPattern = /(kayu|wood|jati|oak|pine|maple|walnut|marble|marmer|stone|batu|terrazzo|concrete|beton|pattern|motif)/.test(v);
        const isFinishing = /(matte|glossy|doff|polished|honed|satin|brushed|texture|finishing)/.test(v);
        const isColor = /(hitam|putih|merah|kuning|hijau|biru|coklat|grey|abu|black|white|red|yellow|green|blue|brown|gold|silver|bronze)/.test(v);

        setColor(isColor ? initialValue : "");
        setPattern(isPattern ? initialValue : "");
        setFinishing(isFinishing ? initialValue : "");
        setProductName((!isColor && !isPattern && !isFinishing) ? initialValue : "");
      }
    }
  }, [isOpen, initialValue, preParsedData]);

  const loadData = async () => {
    try {
      const [catRes, sugRes] = await Promise.all([
        getScheduleCategoriesAction({ section }),
        getScheduleSuggestionsAction({ projectId })
      ]);
      
      const catList = unwrapActionResult(catRes) as { category: string }[];
      const sugList = unwrapActionResult(sugRes) as { brands: { id: string; name: string }[] };
      
      setCategories(catList.map(c => c.category));
      setBrands(sugList.brands);
    } catch (error) {
      console.error("Failed to load suggestions:", error);
    }
  };

  const handleSubmit = async () => {
    if (!category) {
      toast.error("Please select a category");
      return;
    }
    
    const hasPrimary = productName.trim() || sku.trim() || brand.trim();
    const hasSecondary = color.trim() || pattern.trim() || finishing.trim();

    if (!hasPrimary && !hasSecondary) {
      toast.error("At least one Primary (Name/SKU/Brand) or Secondary (Color/Motif/Finishing) data is required.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create instant entry
      const entry = unwrapActionResult(await addScheduleEntryInstantAction({
        projectId,
        schedule_category: category.toUpperCase(),
        section,
      }));

      if (!entry?.options?.[0]) {
        throw new Error("Failed to create entry option");
      }

      // 2. Update with Stage 1 metadata
      const updateData: any = {
        catalog_product_name: productName.trim() || undefined,
        catalog_sku: sku.trim() || undefined,
        catalog_brand: brand.trim() || undefined,
        catalog_image_url: imageUrl || undefined,
        catalog_reference_url: link.trim() || undefined,
        specs: {
          catalog_sku: sku.trim() || undefined,
          catalog_color: color.trim() || undefined,
          catalog_motif: pattern.trim() || undefined,
          catalog_finishing: finishing.trim() || undefined,
          catalog_dimensions: dimension.trim() || undefined,
          catalog_reference_url: link.trim() || undefined,
        }
      };

      await unwrapActionResult(await updateScheduleOptionSnapshotAction({
        optionId: entry.options[0].id,
        data: updateData
      }));

      toast.success("Draft entry created successfully");
      onOpenChange(false);
      onSuccess?.();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create draft");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-[540px] p-0 overflow-hidden gap-0", UI_ENGINE_RADIUS_CARD)}>
        <DialogHeader className="p-6 bg-slate-50 border-b border-slate-200">
          <DialogTitle className={cn(UI_ENGINE_TYPE_TITLE, "text-xl flex items-center gap-2")}>
            <Terminal className="h-5 w-5 text-blue-600" />
            Quick Draft Entry
          </DialogTitle>
          <DialogDescription className={UI_ENGINE_TYPE_BODY}>
            Create a local project entry using slash commands or manual input.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[min(80vh,700px)]">
          <div className="p-6 space-y-8">
            {/* Primary Tier */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-1">
                <span className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em]">Primary Tier</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className={cn("text-[9px] font-bold uppercase text-slate-400")}>Product Name</Label>
                  <input
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="e.g. Roman Floor Tile"
                    className={cn(
                      "w-full h-10 px-3 text-sm font-medium bg-white border border-slate-200 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                      UI_ENGINE_RADIUS_CONTROL
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={cn("text-[9px] font-bold uppercase text-slate-400")}>SKU</Label>
                  <input
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    placeholder="e.g. RM-101"
                    className={cn(
                      "w-full h-10 px-3 text-sm font-medium bg-white border border-slate-200 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                      UI_ENGINE_RADIUS_CONTROL
                    )}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className={cn("text-[9px] font-bold uppercase text-slate-400")}>Brand / Vendor</Label>
                <CreatableSearch
                  value={brand}
                  onSearchChange={(val) => {}}
                  onSelect={(id, name) => setBrand(name)}
                  onCreate={(name) => setBrand(name)}
                  allowFreeText={true}
                  options={brands}
                  placeholder="Select or type brand..."
                  className="h-10"
                />
              </div>
            </div>

            {/* Secondary Tier */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-1">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Secondary Tier</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className={cn("text-[9px] font-bold uppercase text-slate-400")}>Color</Label>
                  <input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. White"
                    className={cn(
                      "w-full h-10 px-3 text-sm font-medium bg-white border border-slate-200 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                      UI_ENGINE_RADIUS_CONTROL
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={cn("text-[9px] font-bold uppercase text-slate-400")}>Motif</Label>
                  <input
                    value={pattern}
                    onChange={(e) => setPattern(e.target.value)}
                    placeholder="e.g. Marble"
                    className={cn(
                      "w-full h-10 px-3 text-sm font-medium bg-white border border-slate-200 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                      UI_ENGINE_RADIUS_CONTROL
                    )}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={cn("text-[9px] font-bold uppercase text-slate-400")}>Finishing</Label>
                  <input
                    value={finishing}
                    onChange={(e) => setFinishing(e.target.value)}
                    placeholder="e.g. Matte"
                    className={cn(
                      "w-full h-10 px-3 text-sm font-medium bg-white border border-slate-200 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                      UI_ENGINE_RADIUS_CONTROL
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Tertiary Tier & Category */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tertiary & Identity</span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className={cn("text-[9px] font-bold uppercase text-slate-400")}>Schedule Category</Label>
                  <CreatableSearch
                    value={category}
                    onSearchChange={(val) => {}}
                    onSelect={(id, name) => setCategory(name)}
                    onCreate={(name) => setCategory(name)}
                    allowFreeText={true}
                    options={categories.map(c => ({ id: c, name: c }))}
                    placeholder="e.g. TILE"
                    className="h-10 border-blue-100 bg-blue-50/30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className={cn("text-[9px] font-bold uppercase text-slate-400")}>Dimensions</Label>
                  <input
                    value={dimension}
                    onChange={(e) => setDimension(e.target.value)}
                    placeholder="e.g. 60x60 cm"
                    className={cn(
                      "w-full h-10 px-3 text-sm font-medium bg-white border border-slate-200 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                      UI_ENGINE_RADIUS_CONTROL
                    )}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className={cn("text-[9px] font-bold uppercase text-slate-400")}>Reference Link</Label>
                <input
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://..."
                  className={cn(
                    "w-full h-10 px-3 text-sm font-medium bg-white border border-slate-200 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                    UI_ENGINE_RADIUS_CONTROL
                  )}
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label className={cn("text-[9px] font-bold uppercase text-slate-400")}>Visual Image (Optional)</Label>
              <UniversalImageUploader
                initialImageUrl={imageUrl}
                onUploadComplete={(urls) => setImageUrl(urls.cover)}
                className="h-28"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t border-slate-200 bg-slate-50/50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={cn(UI_ENGINE_RADIUS_ACTION, "font-bold text-[10px] uppercase tracking-widest", UI_ENGINE_TYPE_META)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className={cn(UI_ENGINE_RADIUS_ACTION, "bg-slate-900 hover:bg-slate-800 font-bold text-[10px] uppercase tracking-widest", UI_ENGINE_TYPE_META)}
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Create Draft Entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
