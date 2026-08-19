/**
 * MASTER DATA — slug uniqueness helper.
 *
 * B3 (roadmap Gelombang 4, 2026-08-18) — before this, eight write paths
 * called `slugify(name)` and handed the result straight to `create()`/
 * `update()`. Two names that only differ in punctuation or spacing
 * ("CV Abc" vs "CV. Abc") pass the NAME collision check (they're different
 * strings) but collapse to the same slug — and then the write hits a raw
 * Prisma P2002 mid-keystroke instead of a message anyone can act on.
 *
 * `ensureUniqueSlug` fixes that proactively: given a candidate base slug and
 * a way to check whether it is already taken, it appends `-2`, `-3`, … until
 * it finds one that isn't. `M6`'s error mapping is the safety net for
 * whatever still slips past this (a concurrent write racing between the
 * check and the insert); this is the fix that stops it happening in the
 * first place.
 */

import crypto from "crypto";

/**
 * Takes an `exists` closure rather than a Prisma model/delegate because the
 * uniqueness SCOPE differs per caller: Party and Brand check "any live row
 * in the whole table has this slug" (a table-wide partial unique index);
 * Sku checks "any live row under this brand_id has this slug" (a composite
 * unique). One generically-typed delegate can't express both without more
 * conditional-generic machinery than the closure costs to write at each call
 * site — and the call site is exactly where the right scope is already known.
 *
 * Also covers the other half of B3: `slugify` can return `""` for a name
 * that normalises away to nothing (all emoji, all CJK, all diacritics with no
 * base Latin letters). An empty string used to reach `create()` as a real,
 * collidable value under the partial unique index. Here it is replaced with
 * a short random root before uniqueness is even checked, so it never
 * competes with anyone else's slug — or with the next empty-named row.
 */
export async function ensureUniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>
): Promise<string> {
  const root = base || `item-${crypto.randomBytes(4).toString("hex")}`;

  let candidate = root;
  let suffix = 2;
  // Bounded, not `while (true)`. A scope where `-2` through `-1000` are all
  // already taken is a data problem worth an exception, not an infinite loop.
  for (let attempt = 0; attempt < 1000; attempt++) {
    if (!(await exists(candidate))) return candidate;
    candidate = `${root}-${suffix}`;
    suffix++;
  }
  throw new Error(
    `ensureUniqueSlug: no free slug found for base "${base}" after 1000 attempts`
  );
}
