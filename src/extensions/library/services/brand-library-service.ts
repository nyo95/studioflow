import { prisma } from "@/core/platform/db";
import type { PrismaTransaction } from "@/types/common";

/**
 * §6.14 Brand-First Library — read-only service backing StudioFlow's Library.
 * PLAN-LIBRARY-BRAND-FIRST.md §7 / §7.2.
 *
 * THE UNIT OF RESULT IS ALWAYS A BRAND. Owner direction: "fokusnya bukan cari
 * barang lagi, tapi cari brand yang jual barang tsb." The search term names a
 * thing ("terazzo"); the answer names suppliers. There is deliberately no
 * category-picking step in between and no product list — a designer who wants
 * to see products opens the brand's own catalog PDF, which the brand maintains.
 *
 * Master Data v2 (2026-08-10): StudioFlow reads EXACTLY the surface the
 * owner scoped — see `master_data.v_library_brand`
 * (prisma/migrations-masterdata-v2/04_views_and_grants.sql). This service
 * queries the underlying `master_data` tables directly rather than the SQL
 * view (Prisma can't select from a view without a model for it), but stays
 * inside that same contract: name/slug, categories, allowlisted links, and
 * physical-sample availability only. No price, no contact, no supplier
 * identity — those never left Master Data-only visibility.
 *
 * SCOPE LOCK (owner, 1 Aug 2026): *"ga ada fungsi lain."* Library for a
 * designer is search-a-brand → view-its-catalog. Nothing else.
 */

const ALLOWED_LINK_KINDS = [
  "WEBSITE",
  "INSTAGRAM",
  "FACEBOOK",
  "TIKTOK",
  "YOUTUBE",
  "LINKEDIN",
  "CATALOG",
  "DRIVE",
  "MARKETPLACE",
  "PRICE_LIST",
] as const;

type Db = PrismaTransaction | typeof prisma;

/**
 * Collapses repeated letters and non-alphanumerics so `terrazzo`, `terazzo`,
 * and `Terazzo ` all reduce to `terazo`.
 */
function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "")
    .replace(/(.)\1+/g, "$1");
}

/**
 * Category strings in the source workbook are frequently several categories
 * crammed into one cell — split at read time so they stay matchable.
 */
function categoryFragments(name: string): string[] {
  return name
    .split(/\s+-\s+|\|/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function matchesTerm(haystack: string, rawQuery: string, normQuery: string): boolean {
  if (!haystack) return false;
  if (haystack.toLowerCase().includes(rawQuery)) return true;
  return normalizeTerm(haystack).includes(normQuery);
}

export type BrandMatchReason =
  | { kind: "category"; label: string }
  | { kind: "tag"; label: string }
  | { kind: "product"; label: string }
  | { kind: "brand"; label: string };

export interface BrandSearchResult {
  id: string;
  brand_name: string;
  /** Why this brand matched — shown in the UI so the result is explainable. */
  reasons: BrandMatchReason[];
  /** All categories the brand is filed under, for context on the card. */
  category_names: string[];
  hasCatalog: boolean;
  availableSampleCount: number;
}

export interface AllowedBrandLink {
  id: string;
  kind: string;
  url: string;
  archive_url: string | null;
  label: string | null;
}

export interface BrandDetail {
  id: string;
  brand_name: string;
  legal_name: string | null;
  is_active: boolean;
  categories: { id: string; name: string; slug: string }[];
  links: AllowedBrandLink[];
  sampleAvailability: {
    hasAvailableSample: boolean;
    availableCount: number;
    totalSkuCount: number;
  };
}

export const BrandLibraryService = {
  /**
   * Search a thing, get the brands that supply it.
   *
   * Evidence is gathered from five independent places:
   *   - Category / BrandCategory — directory rows ("Flooring|Terrazzo")
   *   - Brand.tags               — free-form hashtags curated on the Brand
   *   - Sku.categories           — tags on registered material (SkuCategory join)
   *   - Sku.name                 — physical-sample rows tag themselves "Tile"
   *                                and only say "Terrazzo" in the product name
   * Plus the brand's own name, so searching "Niro" finds Niro.
   */
  async searchBrands(db: Db, query: string, limit = 60): Promise<BrandSearchResult[]> {
    const raw = query.trim().toLowerCase();
    if (raw.length < 2) return [];
    const norm = normalizeTerm(query);
    if (!norm) return [];

    const [categories, skus, searchableBrands] = await Promise.all([
      db.category.findMany({
        where: { is_active: true, kind: "PRODUCT" },
        select: { id: true, name: true },
      }),
      db.sku.findMany({
        where: { deleted_at: null },
        select: {
          brand_id: true,
          name: true,
          categories: { select: { category: { select: { name: true } } } },
        },
      }),
      db.brand.findMany({
        where: { is_active: true, deleted_at: null },
        select: { id: true, name: true, tags: true },
      }),
    ]);

    const reasonsByBrand = new Map<string, Map<string, BrandMatchReason>>();
    const addReason = (brandId: string | null, reason: BrandMatchReason) => {
      if (!brandId) return;
      const key = `${reason.kind}:${reason.label.toLowerCase()}`;
      const existing = reasonsByBrand.get(brandId);
      if (existing) existing.set(key, reason);
      else reasonsByBrand.set(brandId, new Map([[key, reason]]));
    };

    // 1. Category evidence, matched per fragment so composite strings work.
    const matchedCategoryIds: { id: string; label: string }[] = [];
    for (const category of categories) {
      const fragment = categoryFragments(category.name).find((part) =>
        matchesTerm(part, raw, norm)
      );
      if (fragment) matchedCategoryIds.push({ id: category.id, label: fragment });
    }

    if (matchedCategoryIds.length > 0) {
      const links = await db.brandCategory.findMany({
        where: {
          category_id: { in: matchedCategoryIds.map((c) => c.id) },
          brand: { is_active: true, deleted_at: null },
        },
        select: { brand_id: true, category_id: true },
      });
      const labelById = new Map(matchedCategoryIds.map((c) => [c.id, c.label]));
      for (const link of links) {
        addReason(link.brand_id, {
          kind: "category",
          label: labelById.get(link.category_id) ?? "",
        });
      }
    }

    // 2 & 3. Tag and product-name evidence from registered material.
    for (const sku of skus) {
      const tag = sku.categories.map((c) => c.category.name).find((t) => matchesTerm(t, raw, norm));
      if (tag) addReason(sku.brand_id, { kind: "tag", label: tag });
      if (matchesTerm(sku.name, raw, norm)) {
        addReason(sku.brand_id, {
          kind: "product",
          label: sku.name,
        });
      }
    }

    // 4. Brand hashtags. These were split out of BrandCategory in #37; without
    // this branch, moving a descriptor such as "CNC" to the new Hashtag field
    // silently made the brand undiscoverable in StudioFlow's Library.
    for (const brand of searchableBrands) {
      const tag = brand.tags.find((value) => matchesTerm(value, raw, norm));
      if (tag) addReason(brand.id, { kind: "tag", label: tag });
    }

    // 5. The brand's own name.
    for (const brand of searchableBrands) {
      if (matchesTerm(brand.name, raw, norm)) {
        addReason(brand.id, { kind: "brand", label: brand.name });
      }
    }

    if (reasonsByBrand.size === 0) return [];

    const brandIds = [...reasonsByBrand.keys()];
    const brands = await db.brand.findMany({
      where: { id: { in: brandIds }, is_active: true, deleted_at: null },
      select: {
        id: true,
        name: true,
        categories: {
          select: { category: { select: { name: true } } },
          orderBy: { sort_order: "asc" },
        },
        links: {
          where: { kind: { in: ["CATALOG", "DRIVE", "PRICE_LIST"] } },
          select: { id: true },
        },
        skus: {
          where: { deleted_at: null },
          select: {
            samples: {
              where: { deleted_at: null, status: "AVAILABLE" },
              select: { id: true },
            },
          },
        },
      },
    });

    // A brand matched by several kinds of evidence is a stronger answer than
    // one matched by a single stray tag, so rank by evidence count, then name
    // for a stable order.
    return brands
      .map((brand) => {
        const reasons = [...(reasonsByBrand.get(brand.id)?.values() ?? [])];
        return {
          id: brand.id,
          brand_name: brand.name,
          reasons,
          category_names: brand.categories.map((c) => c.category.name),
          hasCatalog: brand.links.length > 0,
          availableSampleCount: brand.skus.reduce(
            (sum, sku) => sum + sku.samples.length,
            0
          ),
        };
      })
      .sort((a, b) => {
        if (b.reasons.length !== a.reasons.length) {
          return b.reasons.length - a.reasons.length;
        }
        return a.brand_name.localeCompare(b.brand_name);
      })
      .slice(0, limit);
  },

  /**
   * Popular category fragments, for the empty state — something to click when
   * the designer has not typed anything yet.
   */
  async suggestedCategories(db: Db, limit = 24): Promise<string[]> {
    const [rows, brands] = await Promise.all([
      db.brandCategory.findMany({
        where: { brand: { is_active: true, deleted_at: null } },
        select: { category: { select: { name: true } } },
      }),
      db.brand.findMany({
        where: { is_active: true, deleted_at: null },
        select: { tags: true },
      }),
    ]);

    const counts = new Map<string, number>();
    for (const row of rows) {
      for (const fragment of categoryFragments(row.category.name)) {
        const key = fragment.trim();
        if (key.length < 3) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    for (const brand of brands) {
      for (const tag of brand.tags) {
        const key = tag.trim();
        if (key.length < 3) continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const byNormalized = new Map<string, { label: string; count: number }>();
    for (const [label, count] of counts) {
      const key = normalizeTerm(label);
      const existing = byNormalized.get(key);
      if (!existing || count > existing.count) {
        byNormalized.set(key, {
          label,
          count: (existing?.count ?? 0) + (existing ? count : count),
        });
      } else {
        existing.count += count;
      }
    }

    return [...byNormalized.values()]
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
      .slice(0, limit)
      .map((entry) => entry.label);
  },

  /**
   * One brand's panel: allowlisted links only, categories, and physical-sample
   * availability. Never selects contacts or price.
   */
  async getBrandDetail(db: Db, brandId: string): Promise<BrandDetail | null> {
    const brand = await db.brand.findUnique({
      where: { id: brandId },
      select: {
        id: true,
        name: true,
        is_active: true,
        owner: { select: { legal_name: true } },
        categories: {
          select: { category: { select: { id: true, name: true, slug: true } } },
          orderBy: { sort_order: "asc" },
        },
        links: {
          where: { kind: { in: [...ALLOWED_LINK_KINDS] } },
          select: { id: true, kind: true, url: true, archive_url: true, label: true },
          orderBy: { sort_order: "asc" },
        },
        skus: {
          where: { deleted_at: null },
          select: {
            id: true,
            samples: {
              where: { deleted_at: null },
              select: { status: true },
            },
          },
        },
      },
    });

    if (!brand) return null;

    const allSamples = brand.skus.flatMap((s) => s.samples);
    const availableCount = allSamples.filter((s) => s.status === "AVAILABLE").length;

    return {
      id: brand.id,
      brand_name: brand.name,
      legal_name: brand.owner?.legal_name ?? null,
      is_active: brand.is_active,
      categories: brand.categories.map((c) => c.category),
      links: brand.links,
      sampleAvailability: {
        hasAvailableSample: availableCount > 0,
        availableCount,
        totalSkuCount: brand.skus.length,
      },
    };
  },
};
