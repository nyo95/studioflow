"use client";

import { KeyboardEvent, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { addChecklistItem } from "@/app/actions";
import { cn } from "@/lib/utils";

interface TodayInlineAddProps {
  phaseId: string;
  phaseName: string;
  className?: string;
  buttonClassName?: string;
  inputWrapperClassName?: string;
  inputClassName?: string;
  buttonLabel?: string;
  placeholder?: string;
}

export function TodayInlineAdd({
  phaseId,
  phaseName,
  className,
  buttonClassName,
  inputWrapperClassName,
  inputClassName,
  buttonLabel,
  placeholder,
}: TodayInlineAddProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

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
        await addChecklistItem(phaseId, trimmedValue);
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
          onClick={() => setIsEditing(true)}
          className={cn(
            "flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600",
            buttonClassName
          )}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span>{buttonLabel ?? `Add task to ${phaseName}...`}</span>
        </button>
      ) : (
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border-b px-2 py-2 transition-all",
            error ? "border-rose-300" : "border-slate-300 focus-within:border-slate-900",
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
            placeholder={placeholder ?? `Add task to ${phaseName}...`}
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
      )}
      {error ? <p className="mt-1 px-1 text-[11px] text-rose-500">{error}</p> : null}
    </div>
  );
}
