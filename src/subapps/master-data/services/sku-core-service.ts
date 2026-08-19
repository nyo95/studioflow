/**
 * MASTER DATA — the one place a new `Sku` row gets created.
 *
 * B5 (roadmap Gelombang 4, 2026-08-18) — five call sites each wrote their own
 * `tx.sku.create()`, and each had independently (and inconsistently) solved
 * the same four small problems. `createSkuCore` is the fix: not a rewrite of
 * all five flows into one shape (they genuinely differ — a rich "Add
 * Material" form that also creates photos and initial stock in the same
 * transaction, a bulk Excel importer with its own update branch, three
 * lighter quick-create/receive paths), just the sliver every one of them
 * needs to get right and previously didn't all get right the same way.
 */

import type { Prisma } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { recordAudit } from "./audit-service";
import { slugify } from "../lib/slug";
import { ensureUniqueSlug } from "./slug-service";

export type CreateSkuCoreData = Omit<Prisma.SkuUncheckedCreateInput, "slug" | "base_unit"> & {
  /** Optional here — `createSkuCore` falls back to `"pcs"` when blank. */
  base_unit?: string | null;
};

export interface CreateSkuCoreParams {
  /** The caller's full create payload, minus the two fields this owns. */
  data: CreateSkuCoreData;
  /** Text the slug is derived from. Defaults to `data.name`. */
  slugSeed?: string;
  /**
   * Category ids to attach, in priority order — the first becomes
   * `is_primary: true`. Omit or pass `[]` for a caller that resolves and
   * attaches categories itself afterward (e.g. `upsertSkuCategories`, which
   * already applies the same `is_primary: index === 0` rule for a full
   * multi-tag list and also handles reconciling an EXISTING sku's tags —
   * something `createSkuCore` has no reason to duplicate for a brand-new row).
   */
  categoryIds?: string[];
}

/**
 * What this guarantees, for every caller:
 *
 * 1. **`slug`** — derived from `slugSeed` (or `data.name`) and run through
 *    `ensureUniqueSlug` (B3), scoped to `data.brand_id` exactly like the
 *    schema's `@@unique([brand_id, slug])` and the raw partial index
 *    `Sku_slug_nobrand_uniq` it backs when `brand_id` is null. The caller
 *    never sets `slug` directly any more — that is what let the five sites
 *    diverge in the first place.
 * 2. **`base_unit`** — never `""`. `quickCreateSkuAction` used to write an
 *    empty string (the column is `NOT NULL`, so `null` wasn't an option
 *    either) when nothing had been chosen yet. A blank string is not `""`
 *    to a strict-equality check elsewhere in the app, but it reads as "no
 *    unit" on a BQ line — the exact ambiguity `AGENTS.md` §"Kosong bukan
 *    nol" warns about for prices. Falls back to `"pcs"`, matching every
 *    other site's existing default.
 * 3. **Primary category** — if `categoryIds` is non-empty, the first entry
 *    is written `is_primary: true`. Whether to attach a category at all is
 *    still each caller's decision; this does not invent one.
 * 4. **`recordAudit`** — exactly once, to `master_data.MasterDataAudit`. Two
 *    of the five sites also called `insertAuditLog` right after creating —
 *    writing the SAME creation event into `studioflow.AuditLog` too, which
 *    `AGENTS.md` §6 rules out explicitly for `master_data` writes (the same
 *    class of defect as §11/H1, fixed for `Sample` in changelog #25). That
 *    second call is gone at both sites; this is the only one left.
 */
export async function createSkuCore(
  tx: PrismaTransaction,
  params: CreateSkuCoreParams,
  // Matches `recordAudit`'s own `actor` type exactly (id is optional/nullable
  // there — `excel-service.ts`'s bulk importer sometimes has no user id to
  // hand) since this is forwarded to it as-is below.
  actor: { id?: string | null; name: string }
) {
  const { data, categoryIds = [] } = params;
  const brandId = data.brand_id ?? null;
  const seed = (params.slugSeed ?? data.name).trim();
  const baseUnit = data.base_unit?.trim() || "pcs";

  const slug = await ensureUniqueSlug(slugify(seed), async (candidate) =>
    Boolean(
      await tx.sku.findFirst({
        where: { brand_id: brandId, slug: candidate, deleted_at: null },
        select: { id: true },
      })
    )
  );

  const created = await tx.sku.create({
    data: {
      ...data,
      slug,
      base_unit: baseUnit,
    },
    include: { media: true, samples: true },
  });

  if (categoryIds.length > 0) {
    for (const [index, categoryId] of categoryIds.entries()) {
      await tx.skuCategory.create({
        data: {
          sku_id: created.id,
          category_id: categoryId,
          sort_order: index,
          is_primary: index === 0,
        },
      });
    }
  }

  await recordAudit(tx, {
    entity: "Sku",
    entity_id: created.id,
    action: "CREATE",
    actor,
    changes: { code: data.code ?? null, name: data.name },
  });

  return created;
}
