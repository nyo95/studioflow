"use client";

/**
 * Searchable + creatable SKU picker for the Material Prices dialog.
 *
 * Rewritten 2026-08-11 as a wrapper over `CreatableSearch` — see PartyPicker
 * for why.
 *
 * Quick-entry is intentionally minimal: only a SKU code is captured here. The
 * created row gets `base_unit: "pcs"` and no category — fill in the rest on
 * the Materials page. That is a step up from the previous search-only
 * behaviour, which forced users to leave the dialog just to add their first
 * SKU for a brand.
 *
 * The label collapses "TH 231 — TH 231" to just "TH 231": when a SKU code
 * and its product name are the same string, printing both reads as a
 * rendering bug.
 */

import * as React from "react";
import { CreatableSearch } from "@/ui_engine";

export type SkuPickerOption = {
  id: string;
  sku: string;
  productName: string;
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("id-ID");
}

export function SkuPicker({
  skus,
  value,
  disabled,
  onCreate,
  isCreating,
  onSelect,
}: {
  skus: SkuPickerOption[];
  /** Selected sku id, or null for "Not linked to a SKU". */
  value: string | null;
  disabled?: boolean;
  /** When provided, the picker shows a "Create …" option for unmatched queries. */
  onCreate?: (name: string) => void;
  /** True while a create is in flight — disables the picker during the request. */
  isCreating?: boolean;
  onSelect: (skuId: string | null) => void;
}) {
  const options = React.useMemo(
    () =>
      skus.map((s) => ({
        id: s.id,
        name: s.sku || s.productName,
        subText:
          s.productName && normalize(s.productName) !== normalize(s.sku)
            ? s.productName
            : undefined,
      })),
    [skus]
  );

  return (
    <CreatableSearch
      options={options}
      value={value ?? ""}
      disabled={disabled || isCreating}
      placeholder="Search SKU or product name…"
      aria-label="SKU"
      allowClear
      clearLabel="— Not linked to a SKU —"
      emptyLabel="SKU tidak ditemukan."
      onSelect={(id) => onSelect(id || null)}
      onCreate={onCreate}
    />
  );
}
