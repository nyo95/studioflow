"use client";

import React, { KeyboardEvent, useEffect, useRef, useState, useMemo, useTransition } from "react";
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
  phases: Array<{ id: string; name: string; revisionId?: string; status: string; isProjectLevel?: boolean; projectId?: string; isLocked?: boolean }>;
  allProjectPhases?: Array<{ id: string; name: string; revisionId?: string; status: string; isProjectLevel?: boolean; projectId?: string; isLocked?: boolean }>;
  mode?: "TODO" | "FEEDBACK";
  className?: string;
  containerClassName?: string;
  buttonClassName?: string;
  inputWrapperClassName?: string;
  inputClassName?: string;
  buttonLabel?: string;
  placeholder?: string;
}

const PHASE_ALIASES: Record<string, string> = {
  moodboard: "moodboard",
  mood: "moodboard",
  concept: "moodboard",
  layout: "layout",
  design3d: "design 3d",
  design_3d: "design 3d",
  design: "design 3d",
  "3d": "design 3d",
  cd: "cd",
  drawing: "cd",
  supervision: "supervision",
  spv: "supervision",
  lapangan: "supervision",
  general: "general tasks",
  project: "general tasks"
};

export function TodayInlineAdd({
  phases,
  allProjectPhases,
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

  const availablePhases = allProjectPhases && allProjectPhases.length > 0 ? allProjectPhases : phases;
  const selectedPhase = availablePhases.find(p => p.id === selectedPhaseId) || availablePhases[0];

  const [activeIndex, setActiveIndex] = useState(0);
  // tagQuery is derived from value — no state or effect needed.
  const tagQuery = useMemo(() => {
    const m = value.match(/(?:^|\s)#([a-zA-Z0-9_]*)$/);
    return m ? m[1] : null;
  }, [value]);

  const filteredPhases = availablePhases.filter(p => {
    if (!tagQuery) return true;
    const queryLower = tagQuery.toLowerCase().replace(/_/g, "");
    const phaseNameClean = p.name.toLowerCase().replace(/ |\_/g, "");
    
    const canonicalTarget = PHASE_ALIASES[queryLower] || queryLower;
    if (phaseNameClean.includes(queryLower)) return true;
    if (phaseNameClean.includes(canonicalTarget.replace(/ |\_/g, ""))) return true;

    return Object.entries(PHASE_ALIASES).some(([alias, target]) => {
      return target.replace(/ |\_/g, "") === phaseNameClean && alias.includes(queryLower);
    });
  });

  useEffect(() => {
    if (isEditing) {
      inputRef.current?.focus();
    }
  }, [isEditing]);

  // Reset the keyboard-nav cursor when the hashtag filter text changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useEffect(() => {
    const firstActive = filteredPhases.findIndex((p) => !p.isLocked);
    setActiveIndex(firstActive !== -1 ? firstActive : 0);
  }, [tagQuery]); // intentionally only tagQuery — filteredPhases is derived from it

  type PhaseItem = { id: string; name: string; revisionId?: string; status: string; isProjectLevel?: boolean; projectId?: string; isLocked?: boolean };
  function selectPhase(phase: PhaseItem) {
    if (phase.isLocked) return;
    setSelectedPhaseId(phase.id);
    const newValue = value.replace(/(?:^|\s)#[a-zA-Z0-9_]*$/, " ");
    setValue(newValue);
    inputRef.current?.focus();
  }

  function handleAdd() {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      setError("Task name cannot be empty.");
      inputRef.current?.focus();
      return;
    }

    // Check if there is an unapplied hashtag matching a locked phase
    const tagMatch = trimmedValue.match(/(?:^|\s)#([a-zA-Z0-9_]+)$/);
    let targetPhase = selectedPhase;
    let finalContent = trimmedValue;

    if (tagMatch) {
      const tagText = tagMatch[1].toLowerCase().replace(/_/g, "");
      const canonicalName = PHASE_ALIASES[tagText] || tagText;
      const foundPhase = availablePhases.find(p => 
        p.name.toLowerCase().replace(/ |\_/g, "") === canonicalName.replace(/ |\_/g, "") ||
        p.name.toLowerCase().replace(/ |\_/g, "").includes(tagText)
      );

      if (foundPhase) {
        if (foundPhase.isLocked) {
          setError(`Phase "${foundPhase.name}" is locked. You cannot add tasks to it.`);
          inputRef.current?.focus();
          return;
        }
        targetPhase = foundPhase;
        // Clean up tag from content
        finalContent = trimmedValue.replace(/(?:^|\s)#[a-zA-Z0-9_]+$/, "").trim();
      }
    }

    if (!finalContent) {
      setError("Task name cannot be empty.");
      inputRef.current?.focus();
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        if (targetPhase?.isProjectLevel) {
          unwrapActionResult(await addProjectActivity({ 
            projectId: targetPhase.projectId!, 
            content: finalContent, 
          }));
        } else {
          if (!targetPhase?.revisionId) {
            setError(`Cannot add tasks to "${targetPhase?.name}" without an active iteration.`);
            return;
          }
          unwrapActionResult(await addActivity({ 
            revisionId: targetPhase.revisionId, 
            content: finalContent, 
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
    if (tagQuery !== null && filteredPhases.length > 0) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        // Skip locked phases
        let nextIndex = activeIndex;
        for (let i = 1; i <= filteredPhases.length; i++) {
          const idx = (activeIndex + i) % filteredPhases.length;
          if (!filteredPhases[idx].isLocked) {
            nextIndex = idx;
            break;
          }
        }
        setActiveIndex(nextIndex);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        // Skip locked phases
        let prevIndex = activeIndex;
        for (let i = 1; i <= filteredPhases.length; i++) {
          const idx = (activeIndex - i + filteredPhases.length) % filteredPhases.length;
          if (!filteredPhases[idx].isLocked) {
            prevIndex = idx;
            break;
          }
        }
        setActiveIndex(prevIndex);
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const targetPhase = filteredPhases[activeIndex];
        if (targetPhase && !targetPhase.isLocked) {
          selectPhase(targetPhase);
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // Clearing value clears tagQuery (derived). Just blur the dropdown.
        setValue(value.replace(/(?:^|\s)#[a-zA-Z0-9_]*$/, " ").trimEnd());
        return;
      }
    }

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
          <span>{buttonLabel ?? `Add todo...`}</span>
        </button>
      ) : (
        <div className="relative flex flex-col gap-3">
          <div className="relative flex items-center">
            <div
              className={cn(
                UI_ENGINE_INLINE_ADD_INPUT_CLASS,
                error ? "border-rose-300" : "border-slate-200 focus-within:border-slate-500",
                "flex-1 items-center px-3 pl-2",
                containerClassName,
                inputWrapperClassName
              )}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-slate-400" />
              ) : (
                <Plus className="h-4 w-4 flex-shrink-0 text-slate-300 mr-2" />
              )}
              <input
                ref={inputRef}
                type="text"
                value={value}
                onBlur={() => {
                  if (!value.trim() && !isPending) {
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
                placeholder={placeholder ?? `Add todo...`}
                disabled={isPending}
                className={cn(
                  "flex-1 bg-transparent font-sans text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none disabled:opacity-50",
                  inputClassName
                )}
              />
              {selectedPhase && availablePhases.length > 1 && (
                <div 
                  className="flex-shrink-0 bg-slate-100 px-2 py-0.5 mx-2 rounded text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer select-none" 
                  title="Currently selected phase"
                >
                  {selectedPhase.name}
                </div>
              )}
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

          {/* Autocomplete Dropdown */}
          {tagQuery !== null && filteredPhases.length > 0 && (
            <div className="absolute top-full left-0 z-50 mt-1 w-64 rounded-md border border-slate-200 bg-white p-1 shadow-lg animate-in slide-in-from-top-1">
              {filteredPhases.map((phase, i) => (
                <button
                  key={phase.id}
                  type="button"
                  disabled={phase.isLocked}
                  onClick={() => !phase.isLocked && selectPhase(phase)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium rounded-sm transition-colors",
                    phase.isLocked 
                      ? "text-slate-300 cursor-not-allowed opacity-60" 
                      : i === activeIndex 
                        ? "bg-slate-100 text-slate-900" 
                        : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <span className="flex items-center">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 mr-2">#</span>
                    {phase.name}
                  </span>
                  {phase.isLocked && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">
                      Locked
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {error ? <p className="mt-1 px-1 text-[11px] text-rose-500">{error}</p> : null}
    </div>
  );
}
