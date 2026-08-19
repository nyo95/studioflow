/**
 * Shelf-address normalisation for physical samples.
 *
 * Lives in its own module rather than beside the sample actions because a
 * `"use server"` file may only export async functions — a sync helper exported
 * from there fails at build time. Both write paths (the sample library and the
 * receive-sample step of a request) import it from here, so a rack can only be
 * spelled one way.
 */

/**
 * Collapses the ways a human writes a shelf address into one canonical form.
 *
 *   "  rak a "  ->  "RAK A"
 *   "Box  3"    ->  "BOX 3"
 *
 * Upper-cased because rack labels are codes, not prose, and inner whitespace is
 * collapsed because a double space is invisible in the UI but distinct in the
 * database. Without this, grouping by rack silently splits into near-duplicates.
 */
export function normaliseLocation(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleUpperCase("id-ID");
}
