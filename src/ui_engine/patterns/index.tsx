"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { FONT_BODY } from "@/ui_engine/tokens";

/**
 * UI ENGINE — SHARED UI PATTERNS (PRD Architecture Cleanup v2 §39)
 * ============================================================================
 * Patterns are one level above primitives: they compose primitives into the
 * recurring shapes every sub-app needs (empty/loading/error states, inline
 * editable cells, pagination, confirm gate). Like everything else in the
 * engine they must stay domain-free — a pattern may know "rows" and "tones",
 * never "SKUs", "phases" or "BQ objects".
 *
 * Added in R5 as the foundation. Domain components keep their own copies until
 * their migration phase (R6–R10); nothing here rewrites them yet.
 */

// ---------------------------------------------------------------------------
// State patterns — EmptyState / LoadingState / ErrorState
// ---------------------------------------------------------------------------

const STATE_SHELL = cn(
  "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white text-center",
  "px-6 py-10"
);
const STATE_TITLE_CLASS = cn("font-semibold text-slate-700");
const STATE_BODY_CLASS = cn("max-w-md text-sm text-slate-500");

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  /** Optional call-to-action (a Button), rendered below the description. */
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action, className, ...props }: EmptyStateProps) {
  return (
    <div className={cn(STATE_SHELL, className)} {...props}>
      <p className={STATE_TITLE_CLASS}>{title}</p>
      {description ? <p className={STATE_BODY_CLASS}>{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export interface LoadingStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Number of skeleton rows to render. Defaults to 3. */
  rows?: number;
}

export function LoadingState({ rows = 3, className, ...props }: LoadingStateProps) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" {...props}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded-lg border border-slate-100 bg-slate-50" />
      ))}
    </div>
  );
}

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  /** Optional retry control (a Button), rendered below the description. */
  action?: React.ReactNode;
}

export function ErrorState({
  title = "Something went wrong.",
  description,
  action,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div role="alert" className={cn(STATE_SHELL, "border-red-200 bg-red-50/50", className)} {...props}>
      <p className={cn(STATE_TITLE_CLASS, "text-red-700")}>{title}</p>
      {description ? <p className={STATE_BODY_CLASS}>{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline edit cells — InlineTextCell / InlineNumberCell / InlineSelectCell
// ---------------------------------------------------------------------------

const INLINE_CELL_BASE =
  "w-full rounded-md border border-transparent bg-transparent px-2 py-1 text-left text-sm transition-colors hover:border-slate-200 hover:bg-slate-50 focus:border-slate-300 focus:bg-white focus:outline-none";

export interface InlineTextCellProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onCommit: (value: string) => void;
}

/** Text input that looks like table content until focused; commits on blur/Enter. */
export function InlineTextCell({ value, onCommit, className, ...props }: InlineTextCellProps) {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          e.currentTarget.blur();
        }
      }}
      className={cn(INLINE_CELL_BASE, className)}
      {...props}
    />
  );
}

export interface InlineNumberCellProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "type" | "value"> {
  value: number | null;
  onCommit: (value: number | null) => void;
}

/**
 * Numeric variant. An empty field commits `null`, not `0` — the same
 * "kosong bukan nol" rule the pricing contract enforces server-side.
 */
export function InlineNumberCell({ value, onCommit, className, ...props }: InlineNumberCellProps) {
  const [draft, setDraft] = React.useState(value === null ? "" : String(value));
  React.useEffect(() => setDraft(value === null ? "" : String(value)), [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (value !== null) onCommit(null);
      return;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(value === null ? "" : String(value));
      return;
    }
    if (parsed !== value) onCommit(parsed);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value === null ? "" : String(value));
          e.currentTarget.blur();
        }
      }}
      className={cn(INLINE_CELL_BASE, "text-right tabular-nums", className)}
      {...props}
    />
  );
}

export interface InlineSelectCellProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  value: string;
  options: { value: string; label: string }[];
  onCommit: (value: string) => void;
}

/** Select that renders as plain text styling until focused. */
export function InlineSelectCell({ value, options, onCommit, className, ...props }: InlineSelectCellProps) {
  return (
    <select
      value={value}
      onChange={(e) => {
        if (e.target.value !== value) onCommit(e.target.value);
      }}
      className={cn(INLINE_CELL_BASE, FONT_BODY, className)}
      {...props}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginationProps extends React.HTMLAttributes<HTMLElement> {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** Minimal pagination footer. Shows "1-based page of total pages" plus prev/next. */
export function Pagination({ page, pageSize, total, onPageChange, className, ...props }: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className={cn("flex items-center justify-between gap-4 pt-3", className)} aria-label="Pagination" {...props}>
      <p className="text-xs text-slate-500">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          Previous
        </button>
        <span className={cn("px-2 text-xs tabular-nums text-slate-500", FONT_BODY)}>
          Page {page} of {pageCount}
        </span>
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          Next
        </button>
      </div>
    </nav>
  );
}
