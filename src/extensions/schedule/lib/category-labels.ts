/**
 * Canonical material/fixture code prefix -> full category name.
 *
 * This mirrors the BerkahStudio SketchUp plugin's prefix registry
 * (Plugins/berkahstudio/types.json), which is the studio's source of truth
 * for these codes. When SketchUp pushes materials, only the short prefix
 * (e.g. "CT") reliably reaches StudioFlow, so schedule groups end up keyed by
 * the code. Use resolveCategoryLabel() at display time to show the human name
 * ("Ceramic Tile") without changing the stored grouping key.
 *
 * Keep this list in sync if the studio adds new prefixes in the plugin.
 */
export const CANONICAL_CATEGORY_LABELS: Record<string, string> = {
  ACR: "Acrylic",
  CT: "Ceramic Tile",
  F: "Fabric",
  GL: "Glass",
  HT: "Homogeneous Tile",
  MSC: "Miscellaneous",
  MT: "Metal",
  PL: "High Pressure Laminate",
  PT: "Paint",
  SO: "Solid Surface",
  SPR: "Spray Paint",
  ST: "Stone",
  TER: "Terrazzo",
  WD: "Wood",
};

/**
 * Resolve a human-readable category label from a code prefix and/or the value
 * stored on the schedule group. Prefers the canonical full name for a known
 * code; otherwise falls back to whatever was stored (already a real name), or
 * the raw prefix as a last resort.
 */
export function resolveCategoryLabel(
  prefix?: string | null,
  storedCategory?: string | null
): string {
  const code = (prefix || storedCategory || "").trim().toUpperCase();
  if (code && CANONICAL_CATEGORY_LABELS[code]) {
    return CANONICAL_CATEGORY_LABELS[code];
  }

  const stored = (storedCategory || "").trim();
  if (stored) return stored;
  return (prefix || "").trim() || "Uncategorized";
}
