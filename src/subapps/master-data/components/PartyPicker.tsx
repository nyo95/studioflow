"use client";

/**
 * Searchable Party picker.
 *
 * Rewritten 2026-08-11 as a wrapper over `CreatableSearch`. It was 186 lines of
 * combobox — outside-click, Escape, filtering, a "none" row — all of which the
 * shared control already does. What is left here is the only part that was ever
 * about Party: which fields to search, and what the subtitle says.
 *
 * Gained by the move: quick entry. Pass `onQuickCreate` and the dropdown offers
 * to create the typed name (Sheet2 "searchableedit -> kalau data ga lengkap
 * munculin quick entry").
 */

import * as React from "react";
import { CreatableSearch } from "@/ui_engine";
import type { PartyData } from "../types/party";

export function PartyPicker({
  companies,
  value,
  disabled,
  onSelect,
  onQuickCreate,
  placeholder = "Search parties…",
  clearLabel = "— None —",
}: {
  companies: PartyData[];
  /** Selected company id, or null/empty string for "none". */
  value: string | null;
  disabled?: boolean;
  onSelect: (companyId: string | null) => void;
  /**
   * Create a Party with just this name and select it. Omit to hide the
   * create row entirely — some callers must not mint parties.
   */
  onQuickCreate?: (name: string) => void;
  placeholder?: string;
  clearLabel?: string;
}) {
  const options = React.useMemo(
    () =>
      companies.map((c) => ({
        id: c.id,
        name: c.name,
        subText: c.legal_name ?? undefined,
      })),
    [companies]
  );

  return (
    <CreatableSearch
      options={options}
      value={value ?? ""}
      disabled={disabled}
      placeholder={placeholder}
      aria-label="Party"
      allowClear
      clearLabel={clearLabel}
      emptyLabel="Party not found."
      createLabel={'Add party "{q}"'}
      onSelect={(id) => onSelect(id || null)}
      onCreate={onQuickCreate}
    />
  );
}
