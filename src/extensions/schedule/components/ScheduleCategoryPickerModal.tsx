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
import type { ProductType } from "@/generated/prisma";
import { CreatableSearch } from "@/components/ui/creatable-search";
import { getAvailableSchedulerCategories } from "@/actions/settings-actions";
import { unwrapActionResult } from "@/lib/result";

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
      <DialogContent className="max-w-md rounded-3xl border-slate-200 bg-white p-0 shadow-2xl">
        <DialogHeader className="border-b border-slate-100 px-6 py-5">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
            <FolderPlus className="h-5 w-5" />
          </div>
          <DialogTitle className="font-lora text-2xl text-slate-900">Add First Row</DialogTitle>
          <DialogDescription className="font-inter text-sm text-slate-500">
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
              className="rounded-2xl text-xs font-bold uppercase tracking-widest text-slate-500"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="rounded-2xl bg-slate-950 px-6 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-800"
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
