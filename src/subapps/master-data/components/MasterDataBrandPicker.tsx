"use client";

/**
 * Searchable brand picker.
 *
 * Rewritten 2026-08-11 as a wrapper over `CreatableSearch` — see PartyPicker
 * for why. 207 lines to ~70.
 *
 * This is the picker the other three were copied FROM: it already had a create
 * affordance, which is how "quick entry" existed on exactly one screen instead
 * of all of them. Its `onCreateVendor` is kept under that name (callers pass a
 * suggested name and open the full brand dialog); `onQuickCreate` is the new,
 * lighter path that writes a name-only brand without leaving the form.
 */

import * as React from "react";
import { CreatableSearch } from "@/ui_engine";
import type { LibraryVendor } from "@/subapps/master-data/contracts/catalog";

export function MasterDataBrandPicker({
  vendors,
  value,
  disabled,
  canCreateVendor,
  onSelect,
  onCreateVendor,
  onQuickCreate,
  allowClear = false,
  clearLabel = "— No brand —",
}: {
  vendors: LibraryVendor[];
  value: string;
  disabled?: boolean;
  /** Whether this user may mint brands at all. */
  canCreateVendor: boolean;
  onSelect: (vendorId: string) => void;
  /** Opens the FULL brand dialog, pre-filled with the typed name. */
  onCreateVendor?: (suggestedName: string) => void;
  /** Writes a name-only brand inline and selects it. Preferred when present. */
  onQuickCreate?: (name: string) => void;
  /** Generic stock has no brand (Q7) — callers that allow that pass true. */
  allowClear?: boolean;
  clearLabel?: string;
}) {
  const options = React.useMemo(
    () =>
      vendors.map((v) => ({
        id: v.id,
        name: v.name,
        subText: v.owner?.legal_name ?? undefined,
      })),
    [vendors]
  );

  const create = canCreateVendor ? (onQuickCreate ?? onCreateVendor) : undefined;

  return (
    <CreatableSearch
      options={options}
      value={value}
      disabled={disabled}
      placeholder="Search brands…"
      aria-label="Brand"
      allowClear={allowClear}
      clearLabel={clearLabel}
      emptyLabel="Vendor not found."
      createLabel={'Tambah brand "{q}"'}
      onSelect={(id) => onSelect(id)}
      onCreate={create}
    />
  );
}
