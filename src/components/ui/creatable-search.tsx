"use client";

import * as React from "react";
import { Check, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { ScrollArea } from "./scroll-area";

interface Option {
  id: string;
  name: string;
}

interface OptionGroup {
  label: string;
  options: Option[];
}

interface CreatableSearchProps {
  /** Flat list of options (use either `options` or `groups`, not both) */
  options?: Option[];
  /** Grouped list of options */
  groups?: OptionGroup[];
  value?: string;
  onSelect: (id: string, name: string) => void;
  onCreate: (name: string) => void;
  onSearchChange?: (search: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
  /**
   * If true, selecting a non-existing option stores the typed text directly
   * (no DB write implied). The dropdown "Add new" option calls `onCreate`
   * with the typed text and also immediately triggers `onSelect("", name)`
   * so the parent can update its state without needing a round-trip.
   */
  allowFreeText?: boolean;
  /** Render an optional badge to the right of each option label */
  badge?: (option: Option) => React.ReactNode;
}

export function CreatableSearch({
  options = [],
  groups,
  value,
  onSelect,
  onCreate,
  onSearchChange,
  placeholder = "Search or create...",
  className,
  disabled,
  allowFreeText = false,
  badge,
}: CreatableSearchProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Flatten all options for lookup/filter purposes
  const allOptions = React.useMemo(() => {
    if (groups) return groups.flatMap((g) => g.options);
    return options;
  }, [options, groups]);

  // Sync search text when value changes externally
  // Only update if user is NOT actively typing (preserve user input)
  React.useEffect(() => {
    const selected = allOptions.find((o) => o.id === value);
    if (selected) {
      // Only sync when a real selection is made (not during typing)
      setSearch(selected.name);
    }
    // Don't clear search when value is unset - let user keep typing
  }, [value, allOptions]);

  const filterOptions = React.useCallback((opts: Option[]) => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return opts;
    return opts.filter((o) => o.name.toLowerCase().includes(normalized));
  }, [search]);

  const filteredFlat = React.useMemo(() => filterOptions(allOptions), [filterOptions, allOptions]);

  const filteredGroups = React.useMemo(() => {
    if (!groups) return null;
    return groups
      .map((g) => ({ ...g, options: filterOptions(g.options) }))
      .filter((g) => g.options.length > 0);
  }, [filterOptions, groups]);

  const showCreateOption = React.useMemo(() => {
    const normalized = search.trim();
    if (!normalized) return false;
    const exactMatch = allOptions.some(
      (o) => o.name.toLowerCase() === normalized.toLowerCase()
    );
    return !exactMatch;
  }, [search, allOptions]);

  const hasResults = groups ? (filteredGroups?.length ?? 0) > 0 : filteredFlat.length > 0;

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        // In allowFreeText mode, commit whatever is in the input as the value
        if (allowFreeText && search.trim() && search !== allOptions.find(o => o.id === value)?.name) {
          onCreate(search.trim());
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [allowFreeText, search, allOptions, value, onCreate]);

  const handleSelect = (option: Option) => {
    onSelect(option.id, option.name);
    setSearch(option.name);
    setOpen(false);
  };

  const handleCreate = (name: string) => {
    onCreate(name);
    if (allowFreeText) {
      // In free-text mode, also call onSelect with empty id so parent can store the raw string
      onSelect("", name);
    }
    setSearch(name);
    setOpen(false);
  };

  const renderOption = (option: Option) => (
    <button
      key={option.id}
      type="button"
      onClick={() => handleSelect(option)}
      className={cn(
        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors gap-2",
        value === option.id
          ? "bg-slate-900 text-white"
          : "text-slate-700 hover:bg-slate-50"
      )}
    >
      <span className="truncate flex-1">{option.name}</span>
      <div className="flex items-center gap-1.5 shrink-0">
        {badge && (
          <span className={value === option.id ? "opacity-80" : ""}>
            {badge(option)}
          </span>
        )}
        {value === option.id && <Check className="h-3.5 w-3.5 shrink-0" />}
      </div>
    </button>
  );

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={search}
          onChange={(e) => {
            const val = e.target.value;
            setSearch(val);
            setOpen(true);
            onSearchChange?.(val);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className="pl-9 pr-4 bg-slate-50 border-none focus-visible:ring-slate-900 transition-all font-inter"
        />
      </div>

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-200">
          <ScrollArea
            className={cn(
              "max-h-64",
              hasResults || showCreateOption ? "h-auto" : "h-0"
            )}
          >
            <div className="p-1">
              {/* Grouped rendering */}
              {groups && filteredGroups ? (
                filteredGroups.length > 0 ? (
                  filteredGroups.map((group, gi) => (
                    <div key={group.label}>
                      {gi > 0 && <div className="my-1 h-px bg-slate-100" />}
                      <div className="px-3 py-1.5">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                          {group.label}
                        </span>
                      </div>
                      {group.options.map(renderOption)}
                    </div>
                  ))
                ) : !showCreateOption ? (
                  <div className="px-3 py-4 text-center text-xs text-slate-400 italic">
                    No matches found
                  </div>
                ) : null
              ) : /* Flat rendering */
              filteredFlat.length > 0 ? (
                filteredFlat.map(renderOption)
              ) : !showCreateOption ? (
                <div className="px-3 py-4 text-center text-xs text-slate-400 italic">
                  No matches found
                </div>
              ) : null}

              {/* Create option */}
              {showCreateOption && (
                <>
                  {hasResults && <div className="my-1 h-px bg-slate-100" />}
                  <button
                    type="button"
                    onClick={() => handleCreate(search.trim())}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-bold text-slate-900 hover:bg-slate-50 transition-colors bg-slate-50/50"
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white shrink-0">
                      <Plus className="h-3 w-3" />
                    </div>
                    <span className="truncate">
                      {allowFreeText ? `Use "${search.trim()}"` : `Add new "${search.trim()}"`}
                    </span>
                  </button>
                </>
              )}
            </div>
          </ScrollArea>

          {/* Empty state when nothing typed */}
          {!hasResults && !showCreateOption && search.trim() === "" && (
            <div className="px-3 py-3 text-center text-xs text-slate-300 italic">
              Type to search...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
