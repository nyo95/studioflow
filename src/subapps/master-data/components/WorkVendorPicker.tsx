"use client";

/**
 * Searchable vendor picker for the Material + Labour and Labour Prices forms.
 *
 * Rewritten 2026-08-11 as a wrapper over `CreatableSearch` — see PartyPicker
 * for why. 186 lines to ~60, and it gained quick entry, which is exactly the
 * case Sheet2 describes: you are typing a price and the vendor who quoted it
 * has never been entered.
 *
 * `clearLabel` stays configurable because "no vendor" means something specific
 * here — the price is ours, not quoted. "— Internal price —" says that;
 * "— None —" would read as missing data.
 */

import * as React from "react";
import { CreatableSearch } from "@/ui_engine";
import type { ServiceVendorData } from "../types/pricing";

export function WorkVendorPicker({
  vendors,
  value,
  disabled,
  clearLabel = "— Internal price —",
  onSelect,
  onQuickCreate,
}: {
  vendors: ServiceVendorData[];
  /** Selected vendor id, or null/empty string for "none". */
  value: string | null;
  disabled?: boolean;
  clearLabel?: string;
  onSelect: (vendorId: string | null) => void;
  /** Create a vendor with just this name and select it. */
  onQuickCreate?: (name: string) => void;
}) {
  const options = React.useMemo(
    () =>
      vendors.map((v) => ({
        id: v.id,
        name: v.name,
        subText: v.trade ?? undefined,
      })),
    [vendors]
  );

  return (
    <CreatableSearch
      options={options}
      value={value ?? ""}
      disabled={disabled}
      placeholder="Search trade or vendor…"
      aria-label="Vendor"
      allowClear
      clearLabel={clearLabel}
      emptyLabel="Vendor not found."
      createLabel={'Add vendor "{q}"'}
      onSelect={(id) => onSelect(id || null)}
      onCreate={onQuickCreate}
    />
  );
}
