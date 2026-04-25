"use client";

import * as React from "react";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductType } from "@/generated/prisma";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { getAvailableSchedulerCategories } from "@/actions/settings-actions";
import { unwrapActionResult } from "@/lib/result";
import { cn } from "@/lib/utils";
import { 
  UI_ENGINE_RADIUS_CARD, 
  UI_ENGINE_RADIUS_CONTROL 
} from "@/ui_engine/tokens/layout";
import {
  UI_ENGINE_TYPE_TITLE,
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_META
} from "@/ui_engine/tokens/typography";
import {
  UI_ENGINE_BG_SUBTLE,
  UI_ENGINE_BORDER_SUBTLE
} from "@/ui_engine/tokens/colors";

interface ScheduleCategoryPickerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  section: ProductType;
  onSelect: (category: string) => void;
}

export function ScheduleCategoryPickerModal({
  isOpen,
  onOpenChange,
  section,
  onSelect,
}: ScheduleCategoryPickerModalProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<string>("");
  const [availableCategories, setAvailableCategories] = React.useState<string[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const fetchCats = async () => {
        setIsLoading(true);
        try {
          const res = await getAvailableSchedulerCategories({});
          setAvailableCategories(unwrapActionResult(res));
        } catch (err) {
          console.error("Failed to fetch categories:", err);
        } finally {
          setIsLoading(false);
        }
      };
      fetchCats();
    } else {
      setSelectedCategory("");
    }
  }, [isOpen]);

  const sectionLabel = section === ProductType.material ? "architectural" : "FF&E";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md border-slate-200 bg-white p-0 shadow-2xl overflow-hidden", UI_ENGINE_RADIUS_CARD)}>
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <div className={cn("mb-3 flex h-11 w-11 items-center justify-center bg-slate-950 text-white", UI_ENGINE_RADIUS_CONTROL)}>
            <FolderPlus className="h-5 w-5" />
          </div>
          <DialogTitle className={cn("font-lora text-slate-900", UI_ENGINE_TYPE_TITLE)}>Add First Row</DialogTitle>
          <DialogDescription className={cn("text-slate-500", UI_ENGINE_TYPE_BODY)}>
            Choose a {sectionLabel} category before opening the manual/catalog picker.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
              Category
            </label>
            <CreatableSearch
              options={availableCategories.map((cat) => ({ id: cat, name: cat }))}
              value={selectedCategory}
              onSelect={(id) => setSelectedCategory(id)}
              onCreate={(val) => setSelectedCategory(val)}
              placeholder={`Search or type ${sectionLabel} category...`}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <Button
              variant="ghost"
              className={cn("text-xs font-bold uppercase tracking-widest text-slate-500", UI_ENGINE_RADIUS_CONTROL)}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className={cn("bg-slate-950 px-6 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-800", UI_ENGINE_RADIUS_CONTROL)}
              disabled={!selectedCategory}
              onClick={() => {
                onSelect(selectedCategory);
                onOpenChange(false);
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
