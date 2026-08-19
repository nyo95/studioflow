import "server-only";

import type { CategoryKind } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { recordAudit } from "./audit-service";
import { categorySlug, buildCategoryPath } from "./category-tree-rules";

export { categorySlug, buildCategoryPath } from "./category-tree-rules";

/**
 * MASTER DATA — the two-level category tree.
 *
 * ============================================================================
 * WHAT EXCEL ASKS FOR
 * ============================================================================
 * `design database masterdata.xlsx` gives every price table two category
 * columns, and the pairs are parent/child in both — just written in opposite
 * order, which is what made this confusing enough to need asking about:
 *
 *   Table 2   Category = "Bahan Baku"   Material = "Plywood"     (parent, child)
 *   Table 3/4 Vendor Category = "MEP"   Category = "Lighting"    (parent, child)
 *
 * Table 2's first example row fills both with "HPL", which reads like a
 * contradiction and is not: a leaf whose parent happens to share its name is
 * ordinary. "HPL" the material group contains "HPL" the product category.
 *
 * ============================================================================
 * WHY `path` MATTERS AND IS NOT DECORATION
 * ============================================================================
 * `Category.path` stores "bahan-baku/plywood". Without it, "everything under
 * Bahan Baku" is a recursive CTE on every read; with it, one `LIKE 'bahan-baku/%'`.
 * It is a denormalisation, which means it can go stale — so it is written here,
 * in the one function allowed to create categories, and nowhere else.
 */

export type ResolvedCategory = {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
};

/**
 * Resolves (parent, child) to a Category row, creating whatever is missing.
 *
 * `parentName` empty means the category sits at the root — legal, and what
 * happens for every row entered before the tree existed. A root category is
 * not a broken one; it is one nobody has filed yet.
 */
export async function resolveCategoryPath(
  tx: PrismaTransaction,
  kind: CategoryKind,
  parentName: string | null | undefined,
  childName: string,
  actor?: { id?: string | null; name: string }
): Promise<ResolvedCategory> {
  const child = childName.trim();
  if (!child) {
    throw new Error("resolveCategoryPath called with an empty category name");
  }
  const parent = parentName?.trim() || null;

  let parentRow: { id: string; path: string | null } | null = null;
  if (parent) {
    parentRow = await upsertCategory(tx, kind, parent, null, null, actor);
  }

  // A leaf may share its parent's name (Excel Table 2 row 1: HPL under HPL), so
  // the slug has to carry the parent to stay unique within `@@unique([kind, slug])`.
  const row = await upsertCategory(
    tx,
    kind,
    child,
    parentRow?.id ?? null,
    parentRow?.path ?? null,
    actor
  );

  return {
    id: row.id,
    name: child,
    parentId: parentRow?.id ?? null,
    path: row.path ?? categorySlug(child),
  };
}

async function upsertCategory(
  tx: PrismaTransaction,
  kind: CategoryKind,
  name: string,
  parentId: string | null,
  parentPath: string | null,
  actor?: { id?: string | null; name: string }
) {
  const slug = parentPath
    ? `${parentPath}/${categorySlug(name)}`.replace(/\//g, "-")
    : categorySlug(name);
  const path = buildCategoryPath(parentPath, name);

  // B7 (2026-08-18): the lookup used to be `OR: [{ slug }, { name, parent_id:
  // parentId }]`. When re-parenting a ROOT category, `parentId` is non-null
  // by definition — so `slug` is already `"induk-anak"` (never matches the
  // old root row, whose slug is plain `"anak"`), AND `{ name, parent_id:
  // parentId }` requires the OLD row's parent_id to already equal the NEW
  // parent — which is exactly what re-parenting hasn't happened yet. Neither
  // branch of the OR could ever find the row `needsParent` was written to
  // re-parent, so it was silently dead: every "give this root a parent"
  // call fell through to create a second, duplicate category instead. The
  // fix adds the one case that was missing — a root with this name, present
  // only when `parentId` is non-null so an ordinary root lookup (`parentId
  // === null`) does not start matching itself.
  const existing = await tx.category.findFirst({
    where: {
      kind,
      OR: [
        { slug },
        { name, parent_id: parentId },
        ...(parentId !== null ? [{ name, parent_id: null }] : []),
      ],
    },
    select: { id: true, path: true, is_active: true, parent_id: true },
  });

  if (existing) {
    // Re-parenting an existing category is deliberately allowed only in one
    // direction: a root category gains a parent the first time someone files
    // it. Moving an already-filed category is a bigger decision than a form
    // submission should make silently, so it is left alone.
    const needsParent = existing.parent_id === null && parentId !== null;
    const pathChanged = existing.path !== null && existing.path !== path;
    if (needsParent || !existing.is_active || existing.path !== path) {
      const updated = await tx.category.update({
        where: { id: existing.id },
        data: {
          is_active: true,
          ...(needsParent ? { parent_id: parentId } : {}),
          path,
        },
        select: { id: true, path: true },
      });
      // AGENTS.md §4: `path` backs `LIKE 'induk/%'` reads. Updating this
      // row's own path is not enough — every descendant's `path` still
      // starts with the OLD prefix, so that query silently drops the whole
      // subtree the moment an ancestor's path changes (a rename, or the
      // re-parent above).
      if (pathChanged) {
        await propagateDescendantPaths(tx, kind, existing.path as string, path);
      }
      if (actor) {
        await recordAudit(tx, {
          entity: "Category",
          entity_id: existing.id,
          action: "UPDATE",
          actor: { id: actor.id ?? null, name: actor.name },
        });
      }
      return updated;
    }
    return { id: existing.id, path: existing.path };
  }

  const created = await tx.category.create({
    data: { name, slug, kind, parent_id: parentId, path, is_active: true },
    select: { id: true, path: true },
  });
  if (actor) {
    await recordAudit(tx, {
      entity: "Category",
      entity_id: created.id,
      action: "CREATE",
      actor: { id: actor.id ?? null, name: actor.name },
    });
  }
  return created;
}

/**
 * B7 (2026-08-18): when a category's `path` changes, every descendant's
 * `path` still carries the OLD prefix and has to be rewritten too — this is
 * the other half of the fix above. Descendants are found by prefix match
 * (`oldPath/%`, one level or ten, all of them) rather than walking
 * `parent_id` recursively, which keeps this a single query instead of a
 * depth-first crawl and matches how `path` is read everywhere else
 * (`LIKE 'induk/%'`).
 */
async function propagateDescendantPaths(
  tx: PrismaTransaction,
  kind: CategoryKind,
  oldPath: string,
  newPath: string
): Promise<void> {
  const descendants = await tx.category.findMany({
    where: { kind, path: { startsWith: `${oldPath}/` } },
    select: { id: true, path: true },
  });
  for (const d of descendants) {
    if (!d.path) continue;
    await tx.category.update({
      where: { id: d.id },
      data: { path: `${newPath}${d.path.slice(oldPath.length)}` },
    });
  }
}

/** Parent categories of one kind, for the first level of a two-level picker. */
export async function listCategoryParents(
  tx: PrismaTransaction,
  kind: CategoryKind
) {
  return tx.category.findMany({
    where: { kind, parent_id: null, is_active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Every category of one kind with its parent name, for a two-level picker. */
export async function listCategoryTree(
  tx: PrismaTransaction,
  kind: CategoryKind
) {
  const rows = await tx.category.findMany({
    where: { kind, is_active: true },
    select: {
      id: true,
      name: true,
      parent_id: true,
      path: true,
      parent: { select: { id: true, name: true } },
    },
    orderBy: [{ path: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    parentId: r.parent_id,
    parentName: r.parent?.name ?? null,
    path: r.path,
  }));
}
