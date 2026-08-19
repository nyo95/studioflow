export type MaterialInitialsFields = {
  color?: string | null;
  pattern?: string | null;
  finish?: string | null;
  size?: string | null;
};

/**
 * Formats the office Material List's INITIALS TYPE value.
 *
 * The order is a user-facing contract: Color, Pattern/Motif,
 * Texture/Finishing, then Size/Dimensions.
 */
export function formatMaterialInitialsType(item: MaterialInitialsFields): string {
  const seen = new Set<string>();

  return [item.color, item.pattern, item.finish, item.size]
    .map((value) => value?.trim() ?? "")
    .filter((value) => {
      if (!value) return false;

      const key = value.toLocaleUpperCase("en-US");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(" / ");
}
