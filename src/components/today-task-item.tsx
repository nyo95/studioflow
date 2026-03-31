"use client";

import { Check } from "lucide-react";
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
  className?: string;
  labelClassName?: string;
}

export function TodayTaskItem({
  id,
  label,
  isChecked,
  className,
  labelClassName,
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

  return (
    <div
      onClick={handleToggle}
      className={cn(
        UI_ENGINE_TASK_ROW_CLASS,
        isChecked && "bg-white text-slate-400",
        isPending && "pointer-events-none opacity-60",
        className
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-all duration-150",
          isChecked
            ? "border-slate-900 bg-slate-900 text-white"
            : "border-slate-300 bg-white group-hover:border-slate-500"
        )}
      >
        {isChecked ? <Check className="h-3 w-3" /> : null}
      </div>

      <span
        className={cn(
          "flex-1 pt-0.5 font-sans text-sm leading-6 transition-all",
          isChecked ? "text-slate-400 line-through" : "text-slate-700",
          labelClassName
        )}
      >
        {label}
      </span>
    </div>
  );
}
