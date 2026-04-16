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
  Info
} from "lucide-react";
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
import { updateScheduleOptionSnapshotAction } from "@/actions/schedule-actions";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { ScheduleOptionSnapshot } from "../types";

interface ScheduleSpecEditorModalProps {
  optionId: string;
  initialSnapshot: ScheduleOptionSnapshot;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ScheduleSpecEditorModal({
  optionId,
  initialSnapshot,
  isOpen,
  onOpenChange,
  onSuccess
}: ScheduleSpecEditorModalProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [form, setForm] = React.useState({
    name: initialSnapshot.name || "",
    brand: initialSnapshot.brand || "",
    initials_type: initialSnapshot.initials_type || "",
    reference_url: initialSnapshot.reference_url || "",
    product_type: initialSnapshot.specs?.product_type || "",
    motif_or_color: initialSnapshot.specs?.motif_or_color || "",
    color: initialSnapshot.specs?.color || "",
    finishing: initialSnapshot.specs?.finishing || "",
    dimensions: initialSnapshot.specs?.dimensions || ""
  });

  // Reset form when modal opens with new snapshot
  React.useEffect(() => {
    if (isOpen) {
      setForm({
        name: initialSnapshot.name || "",
        brand: initialSnapshot.brand || "",
        initials_type: initialSnapshot.initials_type || "",
        reference_url: initialSnapshot.reference_url || "",
        product_type: initialSnapshot.specs?.product_type || "",
        motif_or_color: initialSnapshot.specs?.motif_or_color || "",
        color: initialSnapshot.specs?.color || "",
        finishing: initialSnapshot.specs?.finishing || "",
        dimensions: initialSnapshot.specs?.dimensions || ""
      });
    }
  }, [isOpen, initialSnapshot]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      unwrapActionResult(await updateScheduleOptionSnapshotAction({
        optionId,
        data: {
          name: form.name,
          brand: form.brand,
          initials_type: form.initials_type || null,
          reference_url: form.reference_url || null,
          specs: {
            ...initialSnapshot.specs,
            product_type: form.product_type,
            motif_or_color: form.motif_or_color || null,
            color: form.color || null,
            finishing: form.finishing || null,
            dimensions: form.dimensions || "N/A"
          }
        }
      }));

      toast.success("Specification updated successfully");
      onOpenChange(false);
      if (onSuccess) onSuccess();
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
                 Update the immutable snapshot for this item.
               </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[450px] px-8 pb-8">
          <div className="space-y-6 pt-2">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-1 w-4 rounded-full bg-slate-900" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900">Core Identity</span>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Material Name</Label>
                  <div className="relative">
                    <Type className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                    <Input 
                      value={form.name} 
                      onChange={(e) => setForm({...form, name: e.target.value})}
                      placeholder="e.g. Carrara Marble Tile" 
                      className="pl-10 h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Brand</Label>
                    <Input 
                      value={form.brand} 
                      onChange={(e) => setForm({...form, brand: e.target.value})}
                      placeholder="e.g. Toto" 
                      className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Reference Link</Label>
                    <div className="relative">
                      <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-300" />
                      <Input 
                        value={form.reference_url} 
                        onChange={(e) => setForm({...form, reference_url: e.target.value})}
                        placeholder="URL" 
                        className="pl-10 h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Initials Type</Label>
                    <Input
                      value={form.initials_type}
                      onChange={(e) => setForm({...form, initials_type: e.target.value})}
                      placeholder="e.g. Pink Tua / Matte"
                      className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* Technical Specs */}
            <div className="space-y-4 pt-2">
               <div className="flex items-center gap-2 mb-1">
                <div className="h-1 w-4 rounded-full bg-slate-400" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Technical Details</span>
              </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Product Type</Label>
                   <Input 
                     value={form.product_type} 
                     onChange={(e) => setForm({...form, product_type: e.target.value})}
                     placeholder="e.g. Sanitary Ware" 
                     className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                   />
                 </div>
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Motif / Pattern</Label>
                   <Input 
                     value={form.motif_or_color} 
                     onChange={(e) => setForm({...form, motif_or_color: e.target.value})}
                     placeholder="e.g. Natural Grain" 
                     className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                   />
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                      <Palette className="h-2.5 w-2.5" /> Color & Finishing
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input 
                        value={form.color} 
                        onChange={(e) => setForm({...form, color: e.target.value})}
                        placeholder="White" 
                        className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                      />
                      <Input 
                        value={form.finishing} 
                        onChange={(e) => setForm({...form, finishing: e.target.value})}
                        placeholder="Matte" 
                        className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                      />
                    </div>
                 </div>
                 <div className="space-y-2">
                   <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 flex items-center gap-1">
                     <Maximize2 className="h-2.5 w-2.5" /> Dimensions
                   </Label>
                   <Input 
                     value={form.dimensions} 
                     onChange={(e) => setForm({...form, dimensions: e.target.value})}
                     placeholder="e.g. 60 x 60 cm" 
                     className="h-12 bg-slate-50 border-slate-100 rounded-xl focus:ring-slate-900 font-inter font-medium transition-all"
                   />
                 </div>
               </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-3 items-start">
               <Info className="h-4 w-4 text-slate-400 mt-0.5" />
               <p className="text-[10px] font-medium font-inter text-slate-500 leading-relaxed">
                 Editing these values will only affect this project catalog entry. It will not update the global material library.
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
              Request Library Promotion
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
               disabled={isSubmitting || !form.name || !form.brand}
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
