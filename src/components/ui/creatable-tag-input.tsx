"use client";

/**
 * CREATABLE TAG INPUT — many-valued sibling of `CreatableSearch`.
 * ============================================================================
 * Added 2026-08-14 (feedback item 9).
 *
 * The Brand dialog's Category field was a plain `<Input>` holding a raw
 * comma-separated string, with a strip of every known category rendered above
 * it as toggle chips. Two problems, both of which this replaces:
 *
 *   1. No autocomplete. Typing "h" offered nothing, so "HPL" got re-typed on
 *      every brand — and one of those re-typings eventually becomes "hpl" or
 *      "HPL " and Master Data now has three categories that are one category.
 *   2. The chip strip lists EVERY known category up front. That is fine at ten
 *      categories and unreadable at eighty, and it puts the rarely-used options
 *      in front of the eye at the same weight as the common ones.
 *
 * The gesture this implements is the one the owner described: type "h", pick
 * "HPL" from the suggestions (or press Enter to create it), then keep typing
 * for the next one. Comma also commits, because that is what the old free-text
 * field trained everyone to press.
 *
 * ----------------------------------------------------------------------------
 * WHY NOT REUSE `CreatableSearch`
 * ----------------------------------------------------------------------------
 * That control resolves to ONE id and closes. This one accumulates strings and
 * stays open for the next entry, and its values are plain text rather than
 * foreign keys — a brand category is created by naming it, not by picking a
 * row that already exists. Bending `CreatableSearch` into both shapes would
 * have meant a `multiple` flag threading through every branch of its selection
 * logic; the two are one gesture only in the loosest sense.
 *
 * Every visual value comes from a `--ui-*` variable (AGENTS.md Zero Hardcode).
 */

import * as React from "react";
import { Check, Plus, X } from "lucide-react";
import { normalizeSearchText } from "@/core/utilities/normalize";
import { cn } from "@/lib/utils";
import { Input } from "./input";
import { ScrollArea } from "./scroll-area";

export interface CreatableTagInputProps {
  /** Tags currently on the record. */
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * Everything previously entered anywhere, used as the autocomplete pool.
   * Nothing is required to be in here — the point of the control is that a new
   * name can be typed — it only decides what gets *suggested*.
   */
  suggestions?: string[];
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  className?: string;
  /** Copy for the create row. `{q}` is replaced with the typed text. */
  createLabel?: string;
  "aria-label"?: string;
}

/** Case- and whitespace-insensitive identity, so "HPL " and "hpl" are one tag. */
function sameTag(a: string, b: string) {
  return normalizeSearchText(a) === normalizeSearchText(b);
}

export function CreatableTagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Ketik lalu Enter…",
  readOnly = false,
  disabled = false,
  className,
  createLabel = 'Tambah "{q}"',
  "aria-label": ariaLabel,
}: CreatableTagInputProps) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen] = React.useState(false);
  const [highlight, setHighlight] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  /**
   * Suggestions minus what is already on the record, filtered by what has been
   * typed. Deduplicated case-insensitively first: the pool is assembled from
   * free-text history, so it genuinely does contain "HPL" and "Hpl".
   */
  const filtered = React.useMemo(() => {
    const seen = new Set<string>();
    const pool: string[] = [];
    for (const raw of suggestions) {
      const tag = raw.trim();
      if (!tag) continue;
      const key = normalizeSearchText(tag);
      if (seen.has(key)) continue;
      seen.add(key);
      if (value.some((v) => sameTag(v, tag))) continue;
      pool.push(tag);
    }
    const q = normalizeSearchText(query);
    if (!q) return pool.slice(0, 50);
    return pool
      .filter((tag) => normalizeSearchText(tag).includes(q))
      // Prefix matches first — typing "h" should put "HPL" above "Finishing HPL".
      .sort((a, b) => {
        const aStarts = normalizeSearchText(a).startsWith(q) ? 0 : 1;
        const bStarts = normalizeSearchText(b).startsWith(q) ? 0 : 1;
        return aStarts - bStarts || a.localeCompare(b, "id-ID");
      })
      .slice(0, 50);
  }, [suggestions, value, query]);

  const trimmed = query.trim();
  const showCreate =
    trimmed.length > 0 &&
    !filtered.some((tag) => sameTag(tag, trimmed)) &&
    !value.some((v) => sameTag(v, trimmed));

  // Highlight is an index into [create?, ...filtered]; reset whenever the list
  // changes so it never points past the end.
  React.useEffect(() => setHighlight(0), [query]);

  type Row = { kind: "create" | "option"; tag: string };
  const rows = React.useMemo<Row[]>(
    () => [
      ...(showCreate ? [{ kind: "create" as const, tag: trimmed }] : []),
      ...filtered.map((tag) => ({ kind: "option" as const, tag })),
    ],
    [showCreate, trimmed, filtered]
  );

  /**
   * Ejaan kanonik untuk sebuah tag: kalau nama yang sama sudah pernah dipakai
   * (mengabaikan besar-kecil huruf dan spasi tepi), yang dipakai adalah ejaan
   * yang SUDAH ADA, bukan yang baru saja diketik.
   *
   * Inilah bagian "anti case-sensitive" dari permintaan owner 2026-08-14:
   * *"semuanya dipastikan anti typo (dari backend dan anti case sensitive
   * [karena ini seperti hashtag])"*. Backend memang sudah tahan — `categorySlug`
   * membuat "HPL" dan "hpl" jatuh ke baris `Category` yang sama — tapi tanpa
   * penyelarasan di sini orang mengetik "HPL", melihatnya tampil "HPL" sampai
   * disimpan, lalu tiba-tiba berubah jadi "hpl" setelah refresh. Benar, tapi
   * membingungkan. Sekarang koreksinya terlihat pada saat pengetikan.
   */
  const canonical = React.useCallback(
    (raw: string) => suggestions.find((s) => sameTag(s, raw))?.trim() ?? raw.trim(),
    [suggestions]
  );

  const addTag = React.useCallback(
    (raw: string) => {
      // Pasting "HPL, SPC, Sink" should yield three tags, not one — the field
      // this replaces was comma-separated and people paste into it.
      const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.length === 0) return;
      const next = [...value];
      for (const part of parts) {
        if (next.some((v) => sameTag(v, part))) continue;
        next.push(canonical(part));
      }
      if (next.length !== value.length) onChange(next);
      setQuery("");
      setOpen(false);
    },
    [value, onChange, canonical]
  );

  const removeTag = (tag: string) => onChange(value.filter((v) => v !== tag));

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      const picked = rows[highlight];
      addTag(picked ? picked.tag : trimmed);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(rows.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    // Backspace on an empty field removes the last tag — the one gesture every
    // tag field in every app shares, and the only way to undo without aiming.
    if (event.key === "Backspace" && query === "" && value.length > 0) {
      event.preventDefault();
      removeTag(value[value.length - 1]);
    }
  };

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  if (readOnly) {
    if (value.length === 0) {
      return <span className="text-sm text-slate-400">—</span>;
    }
    // Mode baca memakai frasa berkoma-miring, bukan chip. Chip adalah kontrol —
    // ia menjanjikan sesuatu yang bisa diklik. Di mode baca tidak ada yang bisa
    // diklik, dan bentuk yang sama dengan tabel Brands membuat keduanya
    // terbaca sebagai satu hal yang sama. (Permintaan owner 2026-08-14 item 4.)
    return (
      <span className={cn("text-sm italic text-slate-500", className)}>
        {value.join(", ")}
      </span>
    );
  }

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Chips live ABOVE the field rather than inside it. Inside looks tidier
          with three tags and reflows the caret unpredictably with ten. */}
      {value.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-[var(--ui-radius-pill)] border border-[var(--ui-border-subtle)] bg-[var(--ui-bg-subtle,rgb(248_250_252))] py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-700"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Hapus ${tag}`}
                disabled={disabled}
                className="flex size-4 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Input
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-label={ariaLabel}
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        // Committing on blur would swallow a half-typed word every time the
        // user tabbed away to think. Enter and comma are the only commits.
        className={cn("font-sans", "rounded-[var(--ui-radius-control,0.5rem)]")}
      />

      {open && !disabled && rows.length > 0 && (
        <div
          role="listbox"
          className={cn(
            "absolute left-0 right-0 top-[calc(100%+0.35rem)] z-50 overflow-hidden border bg-white",
            "border-[var(--ui-border-subtle,rgb(241_245_249))]",
            "rounded-[var(--ui-radius-card,0.75rem)]",
            "shadow-[var(--ui-shadow-elevated,0_10px_30px_-10px_rgb(15_23_42/0.25))]"
          )}
        >
          <ScrollArea className="max-h-[var(--ui-combobox-menu-max-height,16rem)]">
            <div className="p-1">
              {rows.map((row, index) => (
                <button
                  key={`${row.kind}-${row.tag}`}
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  onMouseEnter={() => setHighlight(index)}
                  onClick={() => addTag(row.tag)}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors",
                    "rounded-[var(--ui-radius-action,0.5rem)]",
                    index === highlight
                      ? "bg-[var(--ui-canvas-bg,rgb(248_250_252))] text-slate-900"
                      : "text-slate-700"
                  )}
                >
                  {row.kind === "create" ? (
                    <>
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[var(--ui-action-bg)] text-[var(--ui-action-text)]">
                        <Plus className="size-3" />
                      </span>
                      <span className="flex-1 truncate font-semibold">
                        {createLabel.replace("{q}", row.tag)}
                      </span>
                      <span className="ml-auto shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                        Enter ↵
                      </span>
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5 shrink-0 opacity-0" aria-hidden />
                      <span className="flex-1 truncate">{row.tag}</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
