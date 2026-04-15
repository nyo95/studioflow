"use client";

import * as React from "react";
import { 
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
import { updateScheduleOptionSnapshotAction, promoteToLibraryAction } from "@/actions/schedule-actions";
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
    contact_name: initialSnapshot.contact_name || "",
    contact_phone: initialSnapshot.contact_phone || "",
    contact_email: initialSnapshot.contact_email || "",
    product_type: initialSnapshot.specs?.product_type || "",
    motif_or_color: initialSnapshot.specs?.motif_or_color || "",
    color: initialSnapshot.specs?.color || "",
    finishing: initialSnapshot.specs?.finishing || "",
    dimensions: initialSnapshot.specs?.dimensions || ""
  });

  React.useEffect(() => {
    if (isOpen) {
      setForm({
        name: initialSnapshot.name || "",
        brand: initialSnapshot.brand || "",
        initials_type: initialSnapshot.initials_type || "",
        reference_url: initialSnapshot.reference_url || "",
        contact_name: initialSnapshot.contact_name || "",
        contact_phone: initialSnapshot.contact_phone || "",
        contact_email: initialSnapshot.contact_email || "",
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
          contact_name: form.contact_name || null,
          contact_phone: form.contact_phone || null,
          contact_email: form.contact_email || null,
          specs: {
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
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden rounded-3xl bg-white">
        <DialogHeader className="p-8 pb-4">
          <DialogTitle className="font-lora text-2xl font-medium text-slate-900 mb-1">Edit Specification</DialogTitle>
          <DialogDescription className="text-xs font-inter text-slate-400">Update the immutable snapshot for this item.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[450px] px-8 pb-8">
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Material Name</Label>
                <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="h-12 bg-slate-50 rounded-xl" />
              </div>
              {/* ... other fields similarly ... */}
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex gap-3 items-start">
               <Info className="h-4 w-4 text-slate-400 mt-0.5" />
               <p className="text-[10px] font-medium font-inter text-slate-500 leading-relaxed italic">Editing these values only affects this project catalog entry.</p>
            </div>
          </div>
        </ScrollArea>
        <div className="p-8 pt-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={async () => {
            const toastId = toast.loading("Requesting promotion...");
            try {
              unwrapActionResult(await promoteToLibraryAction({ optionId }));
              toast.success("Promotion request sent!", { id: toastId });
              if (onSuccess) onSuccess();
            } catch (err: unknown) {
              toast.error(err instanceof Error ? err.message : "Promotion failed", { id: toastId });
            }
          }} className="h-10 rounded-xl text-[10px] font-bold uppercase">Request Library Promotion</Button>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="h-12 px-6 rounded-2xl font-inter font-bold text-xs uppercase tracking-widest">Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || !form.name || !form.brand} className="bg-slate-950 text-white rounded-2xl h-12 px-10">Save Changes</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
