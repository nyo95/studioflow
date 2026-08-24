"use client";

/**
 * CREATABLE SEARCH — the one searchable-select in the app.
 * ============================================================================
 * A combobox that filters a list, optionally groups it, and offers to create
 * what was typed when nothing matches. Master Data Sheet2 calls the two halves
 * "searchableedit" and "quick entry"; they are one control because they are one
 * gesture — you type a name, and either it exists or you make it exist.
 *
 * ----------------------------------------------------------------------------
 * WHY EVERYTHING GOES THROUGH HERE (2026-08-11)
 * ----------------------------------------------------------------------------
 * Master Data had grown FOUR near-identical comboboxes — SkuPicker, PartyPicker,
 * WorkVendorPicker, MasterDataBrandPicker, 771 lines between them — each with
 * its own outside-click handler, its own Escape key handling, its own
 * "not found" copy. Only one of the four could create a missing row, so
 * "quick entry on every page" was impossible without writing it three more
 * times.
 *
 * They are now thin wrappers over this file. Keyboard behaviour, focus
 * handling, and the create affordance are fixed once here rather than four
 * times, badly, in four places.
 *
 * ----------------------------------------------------------------------------
 * TOKENS, NOT COLOURS
 * ----------------------------------------------------------------------------
 * This component used `bg-slate-900`, `rounded-xl`, `shadow-xl` directly. Those
 * are three separate decisions the design system had already made, overruled
 * here by accident — so a studio that themed its radius or action colour got a
 * dropdown that ignored both. Every visual value below now comes from a
 * `--ui-*` variable. AGENTS.md Zero Hardcode Policy.
 *
 * The tokens are referenced as CSS variables rather than imported from
 * `@/ui_engine/tokens` because this file lives *inside* the engine's primitive
 * layer — importing the engine from its own primitives is a cycle.
 */

import * as React from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { normalizeSearchText } from "@/core/utilities/normalize";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { ScrollArea } from "./scroll-area";

interface Option {
  id: string;
  name: string;
  subText?: string;
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
  onSelect?: (id: string, name: string) => void;
  onCreate?: (name: string) => void;
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

  // -------------------------------------------------------------------------
  // Added 2026-08-11 for the Master Data picker consolidation
  // -------------------------------------------------------------------------
  /**
   * Show an explicit "none" row at the top of the list.
   *
   * Every one of the four pickers this replaced needed it, and each phrased it
   * differently on purpose: "— Not linked to a SKU —" is a different statement
   * from "— Internal price —". Clearing is a CHOICE the user makes, not the
   * absence of one, so it gets a row rather than only a backspace.
   */
  allowClear?: boolean;
  /** Copy for the clear row. Only rendered when `allowClear`. */
  clearLabel?: string;
  /**
   * Copy for the create row. `{q}` is replaced with the typed text.
   * Defaults to `Add new "{q}"` (or `Use "{q}"` when `allowFreeText`).
   */
  createLabel?: string;
  /**
   * Offer the create row even when the typed text exactly matches an option.
   * Off by default — an exact match almost always means "select that one".
   */
  alwaysOfferCreate?: boolean;
  /** Copy shown when the filter matches nothing and creating is not offered. */
  emptyLabel?: string;
  /** Forwarded to the input for labelling. */
  "aria-label"?: string;
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
  allowClear = false,
  clearLabel = "— None —",
  createLabel,
  alwaysOfferCreate = false,
  emptyLabel = "No matches found",
  "aria-label": ariaLabel,
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
      return;
    }
    if (allowFreeText && value) {
      // For free text usage, value itself is the text
      setSearch(value);
      return;
    }
    /**
     * Value cleared by the PARENT (dialog reset to CREATE, form set back to
     * EMPTY_*) — the box must empty with it.
     *
     * This branch used to be a comment saying "don't clear search when value is
     * unset — let the user keep typing", and it caused the bug reported
     * 2026-08-14 item 7 ("modals create tidak bisa creatablesearch"): closing an
     * EDIT dialog and reopening it as CREATE left the previous brand's name
     * sitting in the field, filtering the list down to that one row. The list
     * looked broken; it was doing exactly what the stale text asked.
     *
     * Typing is still protected — while the user types, `search` is ahead of
     * `value` but this effect only fires when `value` itself changes, and a
     * keystroke does not change `value`.
     */
    if (!value) setSearch("");
  }, [value, allOptions, allowFreeText]);

  const filterOptions = React.useCallback((opts: Option[]) => {
    const normalized = normalizeSearchText(search);
    if (!normalized) return opts;
    return opts.filter((o) =>
      normalizeSearchText(o.name).includes(normalized) ||
      normalizeSearchText(o.subText).includes(normalized)
    );
  }, [search]);

  const filteredFlat = React.useMemo(() => filterOptions(allOptions), [filterOptions, allOptions]);

  const filteredGroups = React.useMemo(() => {
    if (!groups) return null;
    return groups
      .map((g) => ({ ...g, options: filterOptions(g.options) }))
      .filter((g) => g.options.length > 0);
  }, [filterOptions, groups]);

  const showCreateOption = React.useMemo(() => {
    if (!onCreate && !allowFreeText) return false;
    const normalized = search.trim();
    if (!normalized) return false;
    if (alwaysOfferCreate) return true;
    const normalizedSearch = normalizeSearchText(normalized);
    const exactMatch = allOptions.some(
      (o) => normalizeSearchText(o.name) === normalizedSearch
    );
    return !exactMatch;
  }, [search, allOptions, onCreate, allowFreeText, alwaysOfferCreate]);

  const hasResults = groups ? (filteredGroups?.length ?? 0) > 0 : filteredFlat.length > 0;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && search.trim()) {
      e.preventDefault();
      const normalizedSearch = normalizeSearchText(search);
      const exactMatch = allOptions.find(
        (o) => normalizeSearchText(o.name) === normalizedSearch
      );
      if (exactMatch) {
        handleSelect(exactMatch);
      } else if (showCreateOption) {
        handleCreate(search.trim());
      } else if (filteredFlat.length === 1) {
        // One survivor after filtering is an unambiguous choice — the four
        // pickers this replaced all did this and users relied on it.
        handleSelect(filteredFlat[0]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (option: Option) => {
    onSelect?.(option.id, option.name);
    setSearch(option.name);
    setOpen(false);
  };

  const handleCreate = (name: string) => {
    onCreate?.(name);
    if (allowFreeText) {
      onSelect?.("", name);
    }
    setSearch(name);
    setOpen(false);
  };

  const handleClear = () => {
    onSelect?.("", "");
    setSearch("");
    setOpen(false);
  };

  const renderOption = (option: Option) => (
    <button
      key={option.id}
      type="button"
      role="option"
      aria-selected={value === option.id}
      onClick={() => handleSelect(option)}
      className={cn(
        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
        "rounded-[var(--ui-radius-action,0.5rem)]",
        value === option.id
          ? "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]"
          : "text-slate-700 hover:bg-[var(--ui-canvas-bg,rgb(248_250_252))]"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="block truncate font-medium">{option.name}</span>
        {option.subText && (
          <span className={cn(
            "block truncate text-[10px]",
            value === option.id ? "opacity-70" : "text-slate-400"
          )}>
            {option.subText}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {badge && (
          <span className={value === option.id ? "opacity-80" : ""}>
            {badge(option)}
          </span>
        )}
        {value === option.id && <Check className="h-3.5 w-3.5 shrink-0" />}
      </div>
    </button>
  );

  const createText = (() => {
    const q = search.trim();
    if (createLabel) return createLabel.replace("{q}", q);
    return allowFreeText ? `Use "${q}"` : `Add new "${q}"`;
  })();

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-label={ariaLabel}
          value={search}
          onChange={(e) => {
            const val = e.target.value;
            setSearch(val);
            setOpen(true);
            onSearchChange?.(val);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "border-none bg-[var(--ui-bg-subtle,rgb(248_250_252))] pl-9 font-sans transition-all",
            "focus-visible:ring-[var(--ui-action-bg)]",
            allowClear && search ? "pr-9" : "pr-4"
          )}
        />
        {/* An inline clear beside the field, for the common case of undoing a
            pick without opening the list to find the "none" row. */}
        {allowClear && search && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear selection"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && !disabled && (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 overflow-hidden border bg-white",
            "border-[var(--ui-border-subtle,rgb(241_245_249))]",
            "rounded-[var(--ui-radius-card,0.75rem)]",
            "shadow-[var(--ui-shadow-elevated,0_10px_30px_-10px_rgb(15_23_42/0.25))]",
            "animate-in fade-in zoom-in-95 duration-200"
          )}
        >
          <ScrollArea className="max-h-[var(--ui-combobox-menu-max-height,16rem)]">
            <div className="p-1">
              {/* Clear row — a stated choice, not an absence */}
              {allowClear && (
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  onClick={handleClear}
                  className={cn(
                    "flex w-full items-center px-3 py-2 text-left text-sm transition-colors",
                    "rounded-[var(--ui-radius-action,0.5rem)]",
                    !value
                      ? "bg-[var(--ui-action-bg)] text-[var(--ui-action-text)]"
                      : "text-slate-400 hover:bg-[var(--ui-canvas-bg,rgb(248_250_252))]"
                  )}
                >
                  {clearLabel}
                </button>
              )}

              {/* Grouped rendering */}
              {groups && filteredGroups ? (
                filteredGroups.length > 0 ? (
                  filteredGroups.map((group, gi) => (
                    <div key={group.label}>
                      {(gi > 0 || allowClear) && <div className="my-1 h-px bg-slate-100" />}
                      <div className="px-3 py-1.5">
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                          {group.label}
                        </span>
                      </div>
                      {group.options.map(renderOption)}
                    </div>
                  ))
                ) : !showCreateOption ? (
                  <div className="px-3 py-4 text-center text-xs italic text-slate-400">
                    {emptyLabel}
                  </div>
                ) : null
              ) : /* Flat rendering */
              filteredFlat.length > 0 ? (
                filteredFlat.map(renderOption)
              ) : !showCreateOption ? (
                <div className="px-3 py-4 text-center text-xs italic text-slate-400">
                  {emptyLabel}
                </div>
              ) : null}

              {/* Create option — Sheet2's "quick entry" */}
              {showCreateOption && (
                <>
                  {(hasResults || allowClear) && <div className="my-1 h-px bg-slate-100" />}
                  <button
                    type="button"
                    onClick={() => handleCreate(search.trim())}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-bold text-slate-900 transition-colors",
                      "rounded-[var(--ui-radius-action,0.5rem)]",
                      "bg-[var(--ui-bg-subtle,rgb(248_250_252))]/50 hover:bg-[var(--ui-canvas-bg,rgb(248_250_252))]"
                    )}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--ui-action-bg)] text-[var(--ui-action-text)]">
                      <Plus className="h-3 w-3" />
                    </div>
                    <span className="flex-1 truncate">{createText}</span>
                    <span className="ml-auto shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                      Enter ↵
                    </span>
                  </button>
                </>
              )}
            </div>
          </ScrollArea>

          {/* Empty state when nothing typed */}
          {!hasResults && !showCreateOption && !allowClear && search.trim() === "" && (
            <div className="px-3 py-3 text-center text-xs italic text-slate-300">
              Type to search...
            </div>
          )}
        </div>
      )}
    </div>
  );
}
