"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { LibraryFacade } from "@/extensions/library/facade";

interface ScheduleSampleRequestModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  scheduleEntryId: string;
  scheduleOptionId: string;
  productNameFallback: string; // Used if there's no library ID
  productCatalogId?: string; // If the option is already linked to the library
  defaultLocation?: string; // Passed automatically from schedule row
  onSuccess?: () => void;
}

export function ScheduleSampleRequestModal({
  isOpen,
  onOpenChange,
  projectId,
  scheduleEntryId,
  scheduleOptionId,
  productNameFallback,
  productCatalogId,
  defaultLocation,
  onSuccess,
}: ScheduleSampleRequestModalProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  React.useEffect(() => {
    if (!isOpen) {
      setNotes("");
    }
  }, [isOpen]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      unwrapActionResult(
        await LibraryFacade.createProjectProductRequest({
          project_id: projectId,
          schedule_entry_id: scheduleEntryId,
          schedule_option_id: scheduleOptionId,
          product_catalog_id: productCatalogId || undefined,
          custom_product_name: productCatalogId ? undefined : productNameFallback,
          area_location: defaultLocation || undefined,
          is_scheduled: true,
          notes: notes || undefined,
        })
      );
      toast.success("Sample request submitted successfully.");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to submit sample request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-medium flex items-center gap-2">
            <Package className="h-5 w-5 text-slate-900" />
            Request Product Sample
          </DialogTitle>
          <p className="text-sm text-slate-500 font-sans mt-1">
            Requesting sample for <strong className="text-slate-900">{productNameFallback}</strong>.
          </p>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {defaultLocation && (
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Installation Area
              </Label>
              <div className="h-9 px-3 flex items-center bg-slate-50 border border-slate-200 rounded-lg text-sm font-sans text-slate-700">
                {defaultLocation}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Contextual Notes (Optional)
            </Label>
            <Input
              id="notes"
              placeholder="e.g. Needs sample for client meeting next week"
              className="bg-slate-50 border-slate-200 h-11 focus:ring-slate-900 text-sm font-sans"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-slate-500 hover:text-slate-900 font-sans text-sm"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-11 px-8 shadow-sm font-sans text-xs uppercase tracking-widest font-bold ml-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
