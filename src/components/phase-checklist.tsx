"use client";

import { useEffect, useState } from "react";
import { toggleChecklist } from "@/app/actions";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { AlertTriangle, Loader2 } from "lucide-react";
import { usePhaseLive } from "@/ui_engine";

interface PhaseChecklistProps {
  isLocked: boolean;
  canEdit: boolean;
  phaseStatus: string;
}

export function PhaseChecklist({
  isLocked,
  canEdit,
  phaseStatus,
}: PhaseChecklistProps) {
  const { checklistItems, toggleChecklistOptimistic, syncNow } = usePhaseLive();
  const [loading, setLoading] = useState<string | null>(null);
  
  // Local state for immediate UI feedback and reconciliation
  const [internalItems, setInternalItems] = useState(checklistItems);

  // Sync internal state with Provider whenever Provider data changes
  useEffect(() => {
    setInternalItems(checklistItems);
  }, [checklistItems]);

  const isDisabled = isLocked || !canEdit || phaseStatus !== "IN_PROGRESS";
  const completedCount = internalItems.filter((item) => item.is_checked).length;

  const handleToggle = async (id: string, checked: boolean) => {
    if (isDisabled) return;

    setLoading(id);
    
    // 1. Local Optimistic Update (Immediate)
    setInternalItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, is_checked: checked } : item
      )
    );

    // 2. Provider Optimistic Update (For other components in this browser)
    toggleChecklistOptimistic(id, checked);

    try {
      await toggleChecklist(id, checked);
    } catch (err) {
      // Rollback on error
      setInternalItems(checklistItems);
      toggleChecklistOptimistic(id, !checked);
      console.error(err);
    } finally {
      setLoading(null);
      // Trigger a sync to ensure we have the absolute latest from the server
      void syncNow().catch((error) => {
        console.error("Failed to sync phase checklist:", error);
      });
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
        <div className="flex items-center gap-3">
          Phase Checklist
          <div className="h-[4px] w-[4px] rounded-full bg-slate-300" />
          <span className="text-slate-500">
            {completedCount}/{internalItems.length} Done
          </span>
        </div>
        <div className="h-px flex-1 bg-zinc-100" />
      </h3>

      {internalItems.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <AlertTriangle className="mb-3 h-8 w-8 text-slate-200" />
          <p className="text-xs italic text-slate-400">
            No checklist items defined for this phase.
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1 gap-3">
        {internalItems.map((item) => (
          <div 
            key={item.id}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg border transition-all select-none",
              item.is_checked 
                ? "bg-slate-50 border-slate-100 text-slate-400 opacity-60" 
                : "bg-white border-zinc-200 shadow-sm hover:border-zinc-300"
            )}
          >
            <div className="relative h-5 w-5 flex items-center justify-center shrink-0">
              {loading === item.id ? (
                <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
              ) : (
                <Checkbox 
                  id={item.id}
                  checked={item.is_checked}
                  disabled={isDisabled}
                  onCheckedChange={(checked) => {
                    const nextChecked = checked === true;
                    void handleToggle(item.id, nextChecked);
                  }}
                  className="data-[state=checked]:bg-slate-900 data-[state=checked]:border-slate-900 rounded-sm"
                />
              )}
            </div>
            <label 
              htmlFor={item.id}
              className={cn(
                "text-xs font-sans font-medium cursor-pointer flex-1 py-0.5 leading-relaxed",
                item.is_checked && "line-through"
              )}
            >
              {item.label}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
