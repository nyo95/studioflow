import { Prisma, ProductType } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import {
  attachDerivedCatalogFields,
  catalogStatusToSkuStatus,
} from "@/subapps/master-data/contracts/catalog";
import type {
  BrandCategoryCoverage,
  CatalogSampleStatus,
  LibraryItemStatus,
  LibraryVendor,
  ProductCatalogWithRelations,
} from "@/subapps/master-data/contracts/catalog";

/**
 * Canonical Master Data include for SKU detail/list reads.
 *
 * The Library extension may consume the same read model, but ownership of the
 * shape sits in Master Data because it reflects canonical `master_data.*`.
 */
const SKU_FULL_INCLUDE = {
  brand: {
    include: {
      scoped_contacts: true,
      links: true,
      owner: { select: { legal_name: true, address: true } },
    },
  },
  samples: { where: { deleted_at: null } },
  media: true,
  prices: {
    orderBy: [{ price_net: "asc" }, { updated_at: "desc" }, { created_at: "desc" }],
    include: { supplier: { select: { id: true, name: true } } },
  },
  categories: { include: { category: true } },
} satisfies Prisma.SkuInclude;

function catalogSampleStatusToV2(status?: CatalogSampleStatus) {
  return status ?? "AVAILABLE";
}

export class CatalogReadService {
  static async getAllVendors(tx: PrismaTransaction): Promise<LibraryVendor[]> {
    const rows = await tx.brand.findMany({
      where: { deleted_at: null },
      include: {
        scoped_contacts: true,
        links: true,
        owner: {
          select: {
            id: true,
            name: true,
            legal_name: true,
            address: true,
            roles: { select: { role: true } },
          },
        },
        suppliers: { select: { party_id: true } },
        categories: {
          where: { source: "SEED" },
          orderBy: { sort_order: "asc" },
          include: { category: { select: { id: true, name: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    return rows.map((row) => ({
      ...row,
      seed_categories: row.categories.map((link) => link.category),
    }));
  }

  static async getAllProducts(
    tx: PrismaTransaction,
    filters?: {
      category?: string;
      vendorId?: string;
      search?: string;
      hasPhysicalOnly?: boolean;
      status?: LibraryItemStatus | LibraryItemStatus[];
      type?: ProductType;
      tags?: string[];
      price?: "ALL" | "READY" | "INCOMPLETE";
      pricePresence?: "ALL" | "WITH" | "WITHOUT";
      completeness?: "ALL" | "COMPLETE" | "INCOMPLETE";
      sort?: "sku" | "newest" | "updated" | "name" | "brand";
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ items: ProductCatalogWithRelations[]; total: number }> {
    const where: Prisma.SkuWhereInput = { deleted_at: null };
    const and: Prisma.SkuWhereInput[] = [];

    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      where.status = { in: statuses.map(catalogStatusToSkuStatus) };
    }
    if (filters?.category && filters.category !== "all") {
      and.push({
        categories: {
          some: { category: { kind: "PRODUCT", name: filters.category } },
        },
      });
    }
    if (filters?.vendorId) where.brand_id = filters.vendorId;
    if (filters?.type) where.kind = filters.type === "fixture" ? "FIXTURE" : "MATERIAL";

    if (filters?.price === "READY") {
      and.push({ prices: { some: { unit: { not: "" } } } });
    } else if (filters?.price === "INCOMPLETE") {
      and.push({ prices: { none: { unit: { not: "" } } } });
    }

    if (filters?.pricePresence === "WITH") {
      and.push({ prices: { some: {} } });
    } else if (filters?.pricePresence === "WITHOUT") {
      and.push({ prices: { none: {} } });
    }

    const completeSku: Prisma.SkuWhereInput = {
      AND: [
        { name: { not: "" } },
        { base_unit: { not: "" } },
        {
          categories: {
            some: { category: { kind: "PRODUCT", is_active: true } },
          },
        },
      ],
    };
    if (filters?.completeness === "COMPLETE") {
      and.push(completeSku);
    } else if (filters?.completeness === "INCOMPLETE") {
      and.push({ NOT: completeSku });
    }

    if (filters?.search) {
      const search = filters.search;
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { brand: { name: { contains: search, mode: "insensitive" } } },
        { code: { contains: search, mode: "insensitive" } },
        {
          categories: {
            some: {
              category: {
                kind: "PRODUCT",
                name: { contains: search, mode: "insensitive" },
              },
            },
          },
        },
      ];
    }
    if (filters?.hasPhysicalOnly) {
      where.samples = { some: { deleted_at: null } };
    }
    if (filters?.tags?.length) {
      and.push({
        categories: {
          some: { category: { kind: "PRODUCT", name: { in: filters.tags } } },
        },
      });
    }
    if (and.length > 0) where.AND = and;

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 24;
    const skip = (page - 1) * pageSize;

    const orderBy: Prisma.SkuOrderByWithRelationInput[] =
      filters?.sort === "newest"
        ? [{ created_at: "desc" }]
        : filters?.sort === "updated"
          ? [{ updated_at: { sort: "desc", nulls: "last" } }, { created_at: "desc" }]
          : filters?.sort === "name"
            ? [{ name: "asc" }, { code: "asc" }]
            : filters?.sort === "brand"
              ? [{ brand: { name: "asc" } }, { code: "asc" }]
              : [{ code: { sort: "asc", nulls: "last" } }, { created_at: "desc" }];

    const [items, total] = await Promise.all([
      tx.sku.findMany({
        where,
        include: SKU_FULL_INCLUDE,
        orderBy,
        skip,
        take: pageSize,
      }),
      tx.sku.count({ where }),
    ]);

    return { items: items.map(attachDerivedCatalogFields), total };
  }

  static async getProductById(
    tx: PrismaTransaction,
    id: string
  ): Promise<ProductCatalogWithRelations | null> {
    const sku = await tx.sku.findUnique({
      where: { id, deleted_at: null },
      include: SKU_FULL_INCLUDE,
    });
    return sku ? attachDerivedCatalogFields(sku) : null;
  }

  static async getProductMetadata(tx: PrismaTransaction) {
    const [liveSkus, categories] = await Promise.all([
      tx.sku.findMany({
        select: { spec: true },
        where: { deleted_at: null },
      }),
      tx.category.findMany({
        where: { kind: "PRODUCT", is_active: true },
        orderBy: { name: "asc" },
        select: { name: true },
      }),
    ]);

    const finishings = Array.from(
      new Set(
        liveSkus
          .map((sku) => (sku.spec as Record<string, unknown> | null)?.finishing)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    return {
      subCategories: [],
      finishings,
      tags: categories.map((category) => category.name),
    };
  }

  static async getBrandCategoryCoverage(
    tx: PrismaTransaction
  ): Promise<BrandCategoryCoverage> {
    const rows = await tx.skuCategory.findMany({
      where: { sku: { deleted_at: null } },
      include: {
        category: { select: { name: true } },
        sku: { select: { brand_id: true, kind: true } },
      },
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.sku.brand_id) continue;
      const section: ProductType = row.sku.kind === "MATERIAL" ? "material" : "fixture";
      const key = `${row.sku.brand_id}::${section}::${row.category.name}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const byVendor = new Map<string, { category: string; section: ProductType; count: number }[]>();
    for (const [key, count] of counts) {
      const [vendorId, section, category] = key.split("::");
      const list = byVendor.get(vendorId) ?? [];
      list.push({ category, section: section as ProductType, count });
      byVendor.set(vendorId, list);
    }

    return Object.fromEntries(
      Array.from(byVendor.entries()).map(([vendorId, list]) => [
        vendorId,
        list.sort((a, b) => b.count - a.count || a.category.localeCompare(b.category)),
      ])
    );
  }

  static async getPhysicalSamples(
    tx: PrismaTransaction,
    filters?: {
      search?: string;
      status?: CatalogSampleStatus;
      vendorId?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    const where: Prisma.SampleWhereInput = {
      deleted_at: null,
      sku: { deleted_at: null, ...(filters?.vendorId ? { brand_id: filters.vendorId } : {}) },
    };

    if (filters?.status) where.status = catalogSampleStatusToV2(filters.status);

    if (filters?.search) {
      const search = filters.search;
      where.OR = [
        { rack_number: { contains: search, mode: "insensitive" } },
        { box_number: { contains: search, mode: "insensitive" } },
        { borrower_name: { contains: search, mode: "insensitive" } },
        { sku: { code: { contains: search, mode: "insensitive" } } },
        { sku: { name: { contains: search, mode: "insensitive" } } },
        { sku: { brand: { name: { contains: search, mode: "insensitive" } } } },
      ];
    }

    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 50;

    const [items, total] = await Promise.all([
      tx.sample.findMany({
        where,
        include: {
          sku: { include: { brand: { include: { scoped_contacts: true } } } },
        },
        orderBy: [{ rack_number: "asc" }, { box_number: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tx.sample.count({ where }),
    ]);

    return { items, total };
  }
}
