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
  Loader2 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  UI_ENGINE_RADIUS_CONTROL, 
  UI_ENGINE_RADIUS_ACTION,
  UI_ENGINE_TYPE_H3,
  UI_ENGINE_TYPE_BODY
} from "@/ui_engine";
import { ProductType } from "@/generated/prisma";
import { unwrapActionResult } from "@/lib/result";
import { 
  addScheduleEntryInstantAction, 
  updateScheduleOptionSnapshotAction,
  getScheduleCategoriesAction,
  getScheduleSuggestionsAction
} from "@/actions/schedule-actions";
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
  onSuccess?: () => void;
}

type Classification = "color" | "motif" | "finishing";

export function QuickDraftDialog({ 
  isOpen, 
  onOpenChange, 
  projectId, 
  section, 
  initialValue,
  onSuccess
}: QuickDraftDialogProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Form State
  const [productName, setProductName] = React.useState(initialValue);
  const [color, setColor] = React.useState("");
  const [pattern, setPattern] = React.useState("");
  const [finishing, setFinishing] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [brand, setBrand] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  // Suggestions
  const [categories, setCategories] = React.useState<string[]>([]);
  const [brands, setBrands] = React.useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
    if (isOpen) {
      loadData();
      
      const v = initialValue.toLowerCase();
      const isPattern = /(kayu|wood|jati|oak|pine|maple|walnut|marble|marmer|stone|batu|terrazzo|concrete|beton|pattern|motif)/.test(v);
      const isFinishing = /(matte|glossy|doff|polished|honed|satin|brushed|texture|finishing)/.test(v);
      const isColor = /(hitam|putih|merah|kuning|hijau|biru|coklat|grey|abu|black|white|red|yellow|green|blue|brown|gold|silver|bronze)/.test(v);

      setColor(isColor ? initialValue : "");
      setPattern(isPattern ? initialValue : "");
      setFinishing(isFinishing ? initialValue : "");
      setProductName((!isColor && !isPattern && !isFinishing) ? initialValue : "");
    }
  }, [isOpen, initialValue]);

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
    if (!brand) {
      // Optional now, so no toast needed, but we keep the comment
    }
    if (!color.trim()) {
      toast.error("Color is required (Stage 1). Type 'TBD' if unknown.");
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
        catalog_brand: brand.trim() || undefined,
        catalog_image_url: imageUrl || undefined,
        specs: {
          catalog_color: color.trim() || undefined,
          catalog_motif: pattern.trim() || undefined,
          catalog_finishing: finishing.trim() || undefined
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
      <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden gap-0">
        <DialogHeader className="p-6 bg-slate-50 border-b border-slate-200">
          <DialogTitle className={cn(UI_ENGINE_TYPE_H3, "font-serif")}>Quick Draft Entry</DialogTitle>
          <DialogDescription className={UI_ENGINE_TYPE_BODY}>
            Create a local project entry following Stage 1 (Draft) standards.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[min(80vh,600px)]">
          <div className="p-6 space-y-6">
            {/* Specifications Inputs */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Product Name</Label>
                <input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Roman Floor Tile"
                  className={cn(
                    "w-full h-11 px-4 text-sm font-medium bg-white border border-slate-200 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                    UI_ENGINE_RADIUS_CONTROL
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Color (Required)</Label>
                <input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="e.g. Hitam Dove"
                  className={cn(
                    "w-full h-11 px-4 text-sm font-medium bg-white border border-slate-200 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                    UI_ENGINE_RADIUS_CONTROL
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pattern / Motif</Label>
                <input
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  placeholder="e.g. Kayu Jati"
                  className={cn(
                    "w-full h-11 px-4 text-sm font-medium bg-white border border-slate-200 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                    UI_ENGINE_RADIUS_CONTROL
                  )}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Finishing</Label>
                <input
                  value={finishing}
                  onChange={(e) => setFinishing(e.target.value)}
                  placeholder="e.g. Matte, Glossy"
                  className={cn(
                    "w-full h-11 px-4 text-sm font-medium bg-white border border-slate-200 outline-none transition-all focus:border-slate-900 focus:ring-1 focus:ring-slate-900",
                    UI_ENGINE_RADIUS_CONTROL
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Category Selection */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Schedule Category</Label>
                <CreatableSearch
                  value={category}
                  onSearchChange={(val) => {}}
                  onSelect={(id, name) => setCategory(name)}
                  onCreate={(name) => setCategory(name)}
                  allowFreeText={true}
                  options={categories.map(c => ({ id: c, name: c }))}
                  placeholder="PAINT, TILE..."
                  className="h-11"
                />
              </div>

              {/* Brand Selection */}
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Brand / Vendor (Optional)</Label>
                <CreatableSearch
                  value={brand}
                  onSearchChange={(val) => {}}
                  onSelect={(id, name) => setBrand(name)}
                  onCreate={(name) => setBrand(name)}
                  allowFreeText={true}
                  options={brands}
                  placeholder="Select or type brand..."
                  className="h-11"
                />
              </div>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Visual Image (Optional)</Label>
              <UniversalImageUploader
                initialImageUrl={imageUrl}
                onUploadComplete={(urls) => setImageUrl(urls.cover)}
                className="h-32"
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="p-6 border-t border-slate-200 bg-slate-50/50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={cn(UI_ENGINE_RADIUS_ACTION, "font-sans font-bold text-[10px] uppercase tracking-widest")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className={cn(UI_ENGINE_RADIUS_ACTION, "bg-slate-900 hover:bg-slate-800 font-sans font-bold text-[10px] uppercase tracking-widest")}
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
