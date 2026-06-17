"use client";

import { Check, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleActivityStatus } from "@/actions/phase-actions";
import { cn } from "@/lib/utils";
import { UI_ENGINE_TASK_ROW_CLASS } from "@/ui_engine";
import { unwrapActionResult } from "@/lib/result";

interface TodayTaskItemProps {
  id: string;
  label: string;
  isChecked: boolean;
  mode?: string; // "TODO" | "FEEDBACK"
  isUrgent?: boolean;
  className?: string;
  labelClassName?: string;
  phaseName?: string;
}

export function TodayTaskItem({
  id,
  label,
  isChecked,
  mode = "TODO",
  isUrgent,
  className,
  labelClassName,
  phaseName,
}: TodayTaskItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      try {
        unwrapActionResult(await toggleActivityStatus({ activityId: id }));
        router.refresh();
      } catch (err) {
        console.error("Failed to toggle task:", err);
      }
    });
  }

  const isFeedback = mode === "FEEDBACK";

  return (
    <div
      onClick={handleToggle}
      className={cn(
        UI_ENGINE_TASK_ROW_CLASS,
        isChecked && "text-slate-400",
        isPending && "pointer-events-none opacity-60",
        className
      )}
    >
      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
        {isFeedback ? (
          <MessageSquare 
            className={cn(
              "h-3.5 w-3.5",
              isChecked ? "text-slate-300" : "text-amber-500"
            )} 
          />
        ) : (
          <div
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full border transition-all duration-150",
              isChecked
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white group-hover:border-slate-500"
            )}
          >
            {isChecked ? <Check className="h-2.5 w-2.5" /> : null}
          </div>
        )}
      </div>

      <span
        className={cn(
          "flex-1 font-sans text-[13px] leading-5 transition-all text-left",
          isChecked ? "text-slate-400 line-through" : "text-slate-800",
          labelClassName
        )}
      >
        {isUrgent && <span className="mr-1.5 text-red-600 font-bold">•</span>}
        {label}
      </span>

      {phaseName && (
        <span className="flex-shrink-0 ml-4 bg-slate-100 px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 uppercase tracking-widest select-none">
          {phaseName.replace(" Tasks", "")}
        </span>
      )}
    </div>
  );
}
