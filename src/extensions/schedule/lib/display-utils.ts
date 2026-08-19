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

  // Support legacy snapshot format where fields sat at the top level or under
  // a different key. Cast through `unknown` to avoid `as any`.
  type LegacySnap = Record<string, unknown>;
  const legacySnap = snapshot as unknown as LegacySnap;
  const legacySpecs = (legacySnap["specs"] as LegacySnap | undefined) ?? {};

  const name = snapshot.catalog_product_name || (legacySpecs["catalog_product_name"] as string | undefined);
  const sku = snapshot.specs?.catalog_sku || (legacySpecs["catalog_sku"] as string | undefined);
  const color = snapshot.specs?.catalog_color
    || (legacySpecs["catalog_color"] as string | undefined)
    || (legacySnap["catalog_color"] as string | undefined);
  const motif = snapshot.specs?.catalog_motif
    || (legacySpecs["catalog_motif"] as string | undefined)
    || (legacySnap["catalog_motif"] as string | undefined);
  const finishing = snapshot.specs?.catalog_finishing
    || (legacySpecs["catalog_finishing"] as string | undefined)
    || (legacySnap["catalog_finishing"] as string | undefined);

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
