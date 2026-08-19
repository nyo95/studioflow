"use client";

/**
 * CREATABLE CHECKLIST — checkbox-list sibling of `CreatableTagInput`.
 * ============================================================================
 * Added 2026-08-18 (owner feedback item 5).
 *
 * `CreatableTagInput` (see that file's header) is right for a field where the
 * FULL option pool is large and mostly irrelevant to any one record — typing
 * to filter beats scanning eighty chips. Brand `Category` is the opposite
 * shape now: the pool is a curated ~40-item list the owner wants to scan and
 * tick, not search one at a time, and a brand routinely carries more than one
 * (HPL brands are frequently also SPC, or Compact Laminate). A checklist reads
 * that shape directly; a type-to-filter combobox hides it.
 *
 * Still creatable, though — the 40-item list is a default, not a ceiling. The
 * text field at the bottom adds a new option to the visible list AND checks it
 * in the same action, exactly like `CreatableTagInput`'s "create" row, just
 * without the autocomplete dropdown (a checklist already shows every option).
 *
 * Every visual value comes from a `--ui-*` variable (AGENTS.md Zero Hardcode).
 */

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { ScrollArea } from "./scroll-area";

export interface CreatableChecklistProps {
  /** Options currently checked on the record. */
  value: string[];
  onChange: (next: string[]) => void;
  /** The known option pool — rendered as checkbox rows, sorted alphabetically. */
  options: string[];
  placeholder?: string;
  addLabel?: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

/** Case- and whitespace-insensitive identity — matches `CreatableTagInput`. */
function sameTag(a: string, b: string) {
  return a.trim().toLocaleLowerCase("id-ID") === b.trim().toLocaleLowerCase("id-ID");
}

export function CreatableChecklist({
  value,
  onChange,
  options,
  placeholder = 'Tambah kategori baru…',
  addLabel = "Tambah",
  readOnly = false,
  disabled = false,
  className,
  "aria-label": ariaLabel,
}: CreatableChecklistProps) {
  const [query, setQuery] = React.useState("");
  // Options typed in THIS session that aren't in `options` yet — the prop is
  // server data and won't include a brand-new name until the next fetch. Kept
  // locally so a freshly created option stays visible and checked right away.
  const [createdLocally, setCreatedLocally] = React.useState<string[]>([]);

  const rows = React.useMemo(() => {
    const seen = new Set<string>();
    const pool: string[] = [];
    for (const raw of [...options, ...createdLocally, ...value]) {
      const tag = raw.trim();
      if (!tag) continue;
      const key = tag.toLocaleLowerCase("id-ID");
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push(tag);
    }
    return pool.sort((a, b) => a.localeCompare(b, "id-ID"));
  }, [options, createdLocally, value]);

  const toggle = (tag: string) => {
    if (disabled) return;
    if (value.some((v) => sameTag(v, tag))) {
      onChange(value.filter((v) => !sameTag(v, tag)));
    } else {
      onChange([...value, tag]);
    }
  };

  const addNew = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    if (!rows.some((r) => sameTag(r, trimmed))) {
      setCreatedLocally((prev) => [...prev, trimmed]);
    }
    if (!value.some((v) => sameTag(v, trimmed))) {
      onChange([...value, trimmed]);
    }
    setQuery("");
  };

  if (readOnly) {
    if (value.length === 0) return <span className="text-sm text-slate-400">—</span>;
    // Same read-mode convention as `CreatableTagInput`: comma + italic, not chips.
    return (
      <span className={cn("text-sm italic text-slate-500", className)}>
        {value.join(", ")}
      </span>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <ScrollArea
        className={cn(
          "max-h-56 border p-2",
          "border-[var(--ui-border-subtle,rgb(241_245_249))]",
          "rounded-[var(--ui-radius-control,0.5rem)]"
        )}
      >
        <div role="group" aria-label={ariaLabel} className="flex flex-col gap-0.5">
          {rows.length === 0 ? (
            <span className="px-2 py-1.5 text-sm text-slate-400">Belum ada kategori.</span>
          ) : (
            rows.map((tag) => {
              const checked = value.some((v) => sameTag(v, tag));
              return (
                <label
                  key={tag}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700",
                    "rounded-[var(--ui-radius-action,0.5rem)]",
                    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[var(--ui-canvas-bg,rgb(248_250_252))]"
                  )}
                >
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onCheckedChange={() => toggle(tag)}
                  />
                  {tag}
                </label>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={ariaLabel ? `${ariaLabel} — add new` : undefined}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addNew();
            }
          }}
          className={cn("font-sans", "rounded-[var(--ui-radius-control,0.5rem)]")}
        />
        <button
          type="button"
          onClick={addNew}
          disabled={disabled || !query.trim()}
          className={cn(
            "flex shrink-0 items-center gap-1 border px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-[var(--ui-canvas-bg,rgb(248_250_252))] disabled:cursor-not-allowed disabled:opacity-50",
            "border-[var(--ui-border-subtle,rgb(241_245_249))]",
            "rounded-[var(--ui-radius-action,0.5rem)]"
          )}
        >
          <Plus className="size-3.5" aria-hidden />
          {addLabel}
        </button>
      </div>
    </div>
  );
}
