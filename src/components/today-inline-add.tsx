"use client";

import { KeyboardEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { addActivity } from "@/actions/phase-actions";
import { addProjectActivity } from "@/actions/project-actions";
import { cn } from "@/lib/utils";
import { unwrapActionResult } from "@/lib/result";
import {
  UI_ENGINE_INLINE_ADD_ACTION_CLASS,
  UI_ENGINE_INLINE_ADD_INPUT_CLASS,
} from "@/ui_engine";

interface TodayInlineAddProps {
  phases: Array<{ id: string; name: string; revisionId?: string; status: string; isProjectLevel?: boolean; projectId?: string }>;
  mode?: "TODO" | "FEEDBACK";
  className?: string;
  containerClassName?: string;
  buttonClassName?: string;
  inputWrapperClassName?: string;
  inputClassName?: string;
  buttonLabel?: string;
  placeholder?: string;
}

export function TodayInlineAdd({
  phases,
  mode = "TODO",
  className,
  containerClassName,
  buttonClassName,
  inputWrapperClassName,
  inputClassName,
  buttonLabel,
  placeholder,
}: TodayInlineAddProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPhaseId, setSelectedPhaseId] = useState(phases[0]?.id);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedPhase = phases.find(p => p.id === selectedPhaseId) || phases[0];

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  function handleAdd() {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setError("Task name cannot be empty.");
      inputRef.current?.focus();
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        if (selectedPhase?.isProjectLevel) {
          unwrapActionResult(await addProjectActivity({ 
            projectId: selectedPhase.projectId!, 
            content: trimmedValue, 
          }));
        } else {
          if (!selectedPhase?.revisionId) {
            setError("Cannot add tasks without an active iteration.");
            return;
          }
          unwrapActionResult(await addActivity({ 
            revisionId: selectedPhase.revisionId, 
            content: trimmedValue, 
            mode 
          }));
        }
        setValue("");
        setIsEditing(false);
        router.refresh();
      } catch (err) {
        console.error("Failed to add task:", err);
        setError("Failed to add task. Try again.");
      }
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      handleAdd();
    }

    if (event.key === "Escape") {
      setValue("");
      setError(null);
      setIsEditing(false);
    }
  }

  const showInput = isEditing || value.length > 0;

  return (
    <div className={cn("pt-1", className)}>
      {!showInput ? (
        <button
          type="button"
          disabled={phases.length === 0}
          onClick={() => setIsEditing(true)}
          className={cn(
            UI_ENGINE_INLINE_ADD_ACTION_CLASS,
            phases.length === 0 && "opacity-50 cursor-not-allowed",
            containerClassName,
            buttonClassName
          )}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" />
          <span>{buttonLabel ?? `+ Add todo...`}</span>
        </button>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Phase Selector - only show if multiple choices available */}
          {phases.length > 1 && (
            <div className="flex flex-wrap gap-2 animate-in slide-in-from-top-1 duration-200">
              {phases.map((phase) => (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => setSelectedPhaseId(phase.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] transition-all",
                    selectedPhaseId === phase.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-400 hover:border-slate-400 hover:text-slate-600"
                  )}
                >
                  {phase.name}
                </button>
              ))}
            </div>
          )}

          <div
            className={cn(
              UI_ENGINE_INLINE_ADD_INPUT_CLASS,
              error ? "border-rose-300" : "border-slate-200 focus-within:border-slate-500",
              containerClassName,
              inputWrapperClassName
            )}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-slate-400" />
            ) : (
              <Plus className="h-4 w-4 flex-shrink-0 text-slate-300" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={value}
              onBlur={() => {
                if (!value.trim() && !isPending) {
                  // Keep open if user was selecting a phase?
                  // Actually, if value is empty, close it
                  setIsEditing(false);
                }
              }}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) {
                  setError(null);
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={placeholder ?? `Add todo to ${selectedPhase?.name}...`}
              disabled={isPending}
              className={cn(
                "flex-1 bg-transparent font-sans text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none disabled:opacity-50",
                inputClassName
              )}
            />
            {value.trim() && !isPending ? (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleAdd}
                className="flex-shrink-0 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-slate-700"
              >
                Add
              </button>
            ) : null}
          </div>
        </div>
      )}
      {error ? <p className="mt-1 px-1 text-[11px] text-rose-500">{error}</p> : null}
    </div>
  );
}
