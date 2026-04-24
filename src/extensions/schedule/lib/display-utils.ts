import type { ScheduleSnapshot } from "../types";

const PLACEHOLDERS = ["N/A", "UNKNOWN", "PENDING", "-", "—", "[RESERVED]"];

export const isPlaceholder = (val?: string | null) => {
  if (!val) return true;
  return PLACEHOLDERS.includes(val.trim().toUpperCase());
};

/**
 * Resolves the effective display title for a schedule product.
 * Hierarchy: [Secondary (Color/Motif/Finishing)] - [Primary (Name/SKU)]
 * If Primary is a placeholder, only Secondary is shown.
 */
export function getEffectiveTitle(snapshot: ScheduleSnapshot | null | undefined): string {
  if (!snapshot) return "Reserved Slot";

  const name = snapshot.catalog_product_name;
  const sku = snapshot.specs?.catalog_sku;
  const color = snapshot.specs?.catalog_color;
  const motif = snapshot.specs?.catalog_motif;
  const finishing = snapshot.specs?.catalog_finishing;

  // Primary Identity
  const primary = !isPlaceholder(name) ? name : (!isPlaceholder(sku) ? sku : null);

  // Secondary Identity (Appearance)
  const secondaryParts = [color, motif, finishing].filter(v => !isPlaceholder(v));
  const secondary = secondaryParts.length > 0 ? secondaryParts.join(" ") : null;

  if (secondary && primary && secondary !== primary) {
    return `${secondary} - ${primary}`;
  }

  if (secondary) return secondary;
  if (primary) return primary;

  return snapshot.catalog_initials_type || "Reserved Slot";
}
