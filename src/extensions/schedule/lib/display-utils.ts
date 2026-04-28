import type { ScheduleSnapshot } from "@/lib/validations/schedule-snapshot";

const PLACEHOLDERS = ["N/A", "UNKNOWN", "PENDING", "-", "—", "[RESERVED]", "GENERIC", "DRAFT"];

export const isPlaceholder = (val?: string | null) => {
  if (!val) return true;
  const v = val.trim().toUpperCase();
  return PLACEHOLDERS.includes(v);
};

/**
 * Resolves the effective display title for a schedule product.
 * Hierarchy: [Secondary (Color/Motif/Finishing)] - [Primary (Name/SKU)]
 * If Primary is a placeholder, only Secondary is shown.
 */
export function getEffectiveTitle(snapshot: ScheduleSnapshot | null | undefined): string {
  if (!snapshot) return "Reserved Slot";

  // Handle both legacy and namespaced snapshot formats
  const legacySpecs = (snapshot as any)?.specs || {};
  
  const name = snapshot.catalog_product_name || legacySpecs.catalog_product_name;
  const sku = snapshot.specs?.catalog_sku || legacySpecs.catalog_sku;
  const color = snapshot.specs?.catalog_color || legacySpecs.catalog_color || (snapshot as any).catalog_color;
  const motif = snapshot.specs?.catalog_motif || legacySpecs.catalog_motif || (snapshot as any).catalog_motif;
  const finishing = snapshot.specs?.catalog_finishing || legacySpecs.catalog_finishing || (snapshot as any).catalog_finishing;

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
