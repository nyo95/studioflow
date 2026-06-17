"use client";

import React, { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { pushSketchupToSchedule } from "../actions/sketchup-actions";

interface PushToScheduleButtonProps {
  sketchupProjectId: string;
}

export function PushToScheduleButton({ sketchupProjectId }: PushToScheduleButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handlePush = () => {
    startTransition(async () => {
      try {
        const result = await pushSketchupToSchedule(sketchupProjectId);
        
        if (result.errors && result.errors.length > 0 && result.pushed === 0 && result.updated === 0) {
          toast.error("Push failed. Please check the logs.");
        } else {
          toast.success(`${result.pushed} entries pushed, ${result.updated} entries updated`);
        }

        if (result.errors && result.errors.length > 0) {
          toast.warning(`${result.errors.length} items skipped`, {
            description: result.errors.slice(0, 3).join(", "),
          });
        }
      } catch (error) {
        console.error(error);
        toast.error("Push failed. Please try again.");
      }
    });
  };

  return (
    <button
      onClick={handlePush}
      disabled={isPending}
      className="flex items-center gap-2 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 rounded-[var(--ui-radius-action)] text-sm font-medium px-4 py-2 transition-colors disabled:opacity-50 cursor-pointer"
    >
      {isPending && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
      <span>{isPending ? "Pushing..." : "Push to Schedule"}</span>
    </button>
  );
}
