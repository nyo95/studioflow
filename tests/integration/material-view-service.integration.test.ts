import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomUUID } from "node:crypto";

import { closePrismaConnection, prisma } from "@/core/platform/db";
import {
  EXPANDED_SKU_LIMIT,
  getBrandView,
  getSkusForBrand,
} from "@/subapps/master-data/services/material-view-service";
import { lookupProductsLastChange } from "@/subapps/master-data/services/audit-read-service";
import { softDeleteSku } from "@/subapps/master-data/services/sku-delete-service";

const runId = `${Date.now()}-${process.pid}`;
const prefix = `it-brand-${runId}`;
const now = new Date();

const ids = {
  owner: randomUUID(),
  supplier: randomUUID(),
  deletedSupplier: randomUUID(),
  alphaBrand: randomUUID(),
  betaBrand: randomUUID(),
  limitBrand: randomUUID(),
  deletedBrand: randomUUID(),
  category: randomUUID(),
  alphaSkuA: randomUUID(),
  alphaSkuB: randomUUID(),
  deleteTargetSku: randomUUID(),
  deletedSku: randomUUID(),
};

async function cleanupFixtures() {
  const brands = await prisma.brand.findMany({
    where: { slug: { startsWith: prefix } },
    select: { id: true },
  });
  const brandIds = brands.map((brand) => brand.id);
  const skus = brandIds.length
    ? await prisma.sku.findMany({
        where: { brand_id: { in: brandIds } },
        select: { id: true },
      })
    : [];
  const skuIds = skus.map((sku) => sku.id);

  if (skuIds.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { domain: "MASTER_DATA", entity_type: "Sku", entity_id: { in: skuIds } },
    });
    await prisma.sampleMovement.deleteMany({
      where: { sample: { sku_id: { in: skuIds } } },
    });
    await prisma.sample.deleteMany({ where: { sku_id: { in: skuIds } } });
    await prisma.skuPrice.deleteMany({ where: { sku_id: { in: skuIds } } });
    await prisma.skuMedia.deleteMany({ where: { sku_id: { in: skuIds } } });
    await prisma.skuCategory.deleteMany({ where: { sku_id: { in: skuIds } } });
    await prisma.sku.deleteMany({ where: { id: { in: skuIds } } });
  }

  if (brandIds.length > 0) {
    await prisma.partyContact.updateMany({
      where: { brand_id: { in: brandIds } },
      data: { brand_id: null },
    });
    await prisma.brandSupplier.deleteMany({ where: { brand_id: { in: brandIds } } });
    await prisma.brandCategory.deleteMany({ where: { brand_id: { in: brandIds } } });
    await prisma.brandLink.deleteMany({ where: { brand_id: { in: brandIds } } });
    await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
  }

  await prisma.category.deleteMany({ where: { slug: { startsWith: prefix } } });
  await prisma.party.deleteMany({ where: { slug: { startsWith: prefix } } });
}

before(async () => {
  await cleanupFixtures();

  await prisma.party.createMany({
    data: [
      {
        id: ids.owner,
        name: `${prefix} Owner Trading`,
        legal_name: `${prefix} Owner Legal`,
        slug: `${prefix}-owner`,
        type: "COMPANY",
      },
      {
        id: ids.supplier,
        name: `${prefix} Active Supplier`,
        legal_name: `${prefix} Supplier Legal`,
        slug: `${prefix}-supplier`,
        type: "COMPANY",
      },
      {
        id: ids.deletedSupplier,
        name: `${prefix} Deleted Supplier`,
        slug: `${prefix}-deleted-supplier`,
        type: "COMPANY",
        deleted_at: now,
      },
    ],
  });

  await prisma.brand.createMany({
    data: [
      {
        id: ids.alphaBrand,
        name: `${prefix} Alpha Surface`,
        slug: `${prefix}-alpha`,
        owner_party_id: ids.owner,
        tags: ["Stone", "Budget Finish"],
      },
      {
        id: ids.betaBrand,
        name: `${prefix} Beta Plain`,
        slug: `${prefix}-beta`,
        tags: ["Timber"],
      },
      {
        id: ids.limitBrand,
        name: `${prefix} Limit Catalogue`,
        slug: `${prefix}-limit`,
      },
      {
        id: ids.deletedBrand,
        name: `${prefix} Deleted Brand`,
        slug: `${prefix}-deleted-brand`,
        deleted_at: now,
      },
    ],
  });

  await prisma.category.create({
    data: {
      id: ids.category,
      name: `${prefix} Product Surface`,
      slug: `${prefix}-product-surface`,
      kind: "PRODUCT",
      path: `${prefix}-product-surface`,
    },
  });
  await prisma.brandCategory.create({
    data: {
      brand_id: ids.alphaBrand,
      category_id: ids.category,
      source: "DERIVED_FROM_SKU",
    },
  });
  await prisma.brandSupplier.createMany({
    data: [
      { brand_id: ids.alphaBrand, party_id: ids.supplier },
      { brand_id: ids.alphaBrand, party_id: ids.deletedSupplier },
    ],
  });

  await prisma.sku.createMany({
    data: [
      {
        id: ids.alphaSkuA,
        brand_id: ids.alphaBrand,
        code: "IT-A-001",
        name: `${prefix} Searchable Tile`,
        slug: `${prefix}-alpha-a`,
        base_unit: "sheet",
        status: "ACTIVE",
        spec: { color: "Warm Grey", finishing: "Matte" },
      },
      {
        id: ids.alphaSkuB,
        brand_id: ids.alphaBrand,
        code: "IT-A-002",
        name: `${prefix} Quiet Panel`,
        slug: `${prefix}-alpha-b`,
        base_unit: "panel",
        status: "DRAFT",
      },
      {
        id: ids.deletedSku,
        brand_id: ids.alphaBrand,
        code: "IT-A-000",
        name: `${prefix} Deleted SKU Search Term`,
        slug: `${prefix}-deleted-sku`,
        base_unit: "sheet",
        deleted_at: now,
      },
      {
        id: ids.deleteTargetSku,
        brand_id: ids.betaBrand,
        code: "IT-DELETE-001",
        name: `${prefix} Delete Target`,
        slug: `${prefix}-delete-target`,
        base_unit: "sheet",
        status: "ACTIVE",
      },
    ],
  });
  await prisma.skuCategory.create({
    data: {
      sku_id: ids.alphaSkuA,
      category_id: ids.category,
      is_primary: true,
    },
  });
  await prisma.skuPrice.createMany({
    data: [
      {
        sku_id: ids.alphaSkuA,
        supplier_party_id: ids.supplier,
        price_net: 125,
        unit: "sheet",
      },
      {
        sku_id: ids.deleteTargetSku,
        supplier_party_id: ids.supplier,
        price_net: 225,
        unit: "sheet",
      },
    ],
  });
  await prisma.sample.createMany({
    data: [
      {
        sku_id: ids.alphaSkuA,
        rack_number: "IT-R1",
        box_number: "IT-B1",
        status: "AVAILABLE",
      },
      {
        sku_id: ids.alphaSkuA,
        rack_number: "IT-R2",
        box_number: "IT-B2",
        status: "AVAILABLE",
        deleted_at: now,
      },
    ],
  });
  await prisma.skuMedia.create({
    data: {
      sku_id: ids.alphaSkuA,
      kind: "REFERENCE",
      url: `https://example.invalid/${prefix}/reference`,
    },
  });

  await prisma.sku.createMany({
    data: Array.from({ length: EXPANDED_SKU_LIMIT + 1 }, (_, index) => {
      const sequence = String(index).padStart(3, "0");
      return {
        brand_id: ids.limitBrand,
        code: `IT-L-${sequence}`,
        name: `${prefix} Limit Item ${sequence}`,
        slug: `${prefix}-limit-${sequence}`,
        base_unit: "unit",
        status: "DRAFT" as const,
      };
    }),
  });
});

after(async () => {
  try {
    await cleanupFixtures();
  } finally {
    await closePrismaConnection();
  }
});

describe("getBrandView against PostgreSQL", () => {
  test("search resolves every supported relation back to Brand grain", async () => {
    const searches = [
      `${prefix} Alpha Surface`,
      `${prefix} Owner Legal`,
      `${prefix} Product Surface`,
      "budget fin",
      `${prefix} Active Supplier`,
      "IT-A-001",
      `${prefix} Searchable Tile`,
    ];

    for (const search of searches) {
      const result = await getBrandView({ search, pageSize: 10 });
      assert.deepEqual(
        result.rows.map((row) => row.id),
        [ids.alphaBrand],
        `search should resolve to Alpha Brand: ${search}`
      );
      assert.equal(result.total, 1);
    }

    const deletedSkuMatch = await getBrandView({
      search: `${prefix} Deleted SKU Search Term`,
      pageSize: 10,
    });
    assert.equal(deletedSkuMatch.total, 0);
  });

  test("counts, completeness, soft-delete filters, sort and pagination agree", async () => {
    const result = await getBrandView({ pageSize: 10 });
    assert.deepEqual(result.totals, { all: 3, complete: 1, incomplete: 2 });
    assert.equal(result.total, 3);

    const alpha = result.rows.find((row) => row.id === ids.alphaBrand);
    assert.ok(alpha);
    assert.equal(alpha.skuCount, 2);
    assert.equal(alpha.supplierCount, 1);
    assert.equal(alpha.isComplete, true);

    const bySkuCount = await getBrandView({ sort: "sku_count", pageSize: 1 });
    assert.equal(bySkuCount.rows[0]?.id, ids.limitBrand);

    const secondByName = await getBrandView({ sort: "name", page: 2, pageSize: 1 });
    assert.equal(secondByName.rows[0]?.id, ids.betaBrand);
  });
});

describe("getSkusForBrand against PostgreSQL", () => {
  test("returns active Brand-scoped SKUs with current relations and scalar fields", async () => {
    const result = await getSkusForBrand(ids.alphaBrand);
    assert.equal(result.truncated, false);
    assert.deepEqual(
      result.rows.map((row) => row.sku),
      ["IT-A-001", "IT-A-002"]
    );

    const priced = result.rows[0];
    assert.equal(priced.id, ids.alphaSkuA);
    assert.equal(priced.price, 125);
    assert.equal(priced.priceUnit, "sheet");
    assert.equal(priced.priceOfferCount, 1);
    assert.equal(priced.priceSupplierId, ids.supplier);
    assert.equal(priced.sampleCount, 1);
    assert.equal(priced.sampleState, "AVAILABLE");
    assert.deepEqual(priced.categoryTags, [`${prefix} Product Surface`]);
    assert.equal(
      priced.referenceUrl,
      `https://example.invalid/${prefix}/reference`
    );
  });

  test("caps a large Brand expansion and reports truncation truthfully", async () => {
    const result = await getSkusForBrand(ids.limitBrand);
    assert.equal(result.truncated, true);
    assert.equal(result.rows.length, EXPANDED_SKU_LIMIT);
    assert.equal(result.rows[0]?.sku, "IT-L-000");
    assert.equal(result.rows.at(-1)?.sku, "IT-L-199");
  });
});

describe("softDeleteSku against PostgreSQL", () => {
  test("soft-deletes once, retains current price rows, and records one audit row", async () => {
    const priceStateBefore = await prisma.skuPrice.findMany({
      where: { sku_id: ids.deleteTargetSku },
      orderBy: { price_net: "asc" },
      select: { id: true, supplier_party_id: true, price_net: true, unit: true },
    });

    const deleted = await prisma.$transaction((tx) =>
      softDeleteSku(tx, ids.deleteTargetSku, {
        id: "integration-test-actor",
        name: "Integration Test",
      })
    );
    assert.equal(deleted.id, ids.deleteTargetSku);

    const sku = await prisma.sku.findUnique({
      where: { id: ids.deleteTargetSku },
      select: { deleted_at: true, updated_by_name: true },
    });
    assert.ok(sku?.deleted_at);
    assert.equal(sku.updated_by_name, "Integration Test");

    const priceStateAfter = await prisma.skuPrice.findMany({
      where: { sku_id: ids.deleteTargetSku },
      orderBy: { price_net: "asc" },
      select: { id: true, supplier_party_id: true, price_net: true, unit: true },
    });
    assert.deepEqual(priceStateAfter, priceStateBefore);

    const audits = await prisma.auditLog.findMany({
      where: {
        domain: "MASTER_DATA",
        entity_type: "Sku",
        entity_id: ids.deleteTargetSku,
        action: "DELETE",
      },
    });
    assert.equal(audits.length, 1);

    const activeRows = await getSkusForBrand(ids.betaBrand);
    assert.equal(
      activeRows.rows.some((row) => row.id === ids.deleteTargetSku),
      false
    );

    await assert.rejects(
      () =>
        prisma.$transaction((tx) =>
          softDeleteSku(tx, ids.deleteTargetSku, {
            id: "integration-test-actor",
            name: "Integration Test",
          })
        ),
      /already deleted/
    );
  });

  test("last-change lookup reads the generic AuditLog in newest-first order", async () => {
    await prisma.auditLog.createMany({
      data: [
        {
          domain: "MASTER_DATA",
          entity_type: "Sku",
          entity_id: ids.alphaSkuA,
          action: "CREATE",
          actor_name: "Older Actor",
          created_at: new Date("2026-08-22T03:00:00.000Z"),
        },
        {
          domain: "MASTER_DATA",
          entity_type: "Sku",
          entity_id: ids.alphaSkuA,
          action: "UPDATE",
          actor_name: "Newest Actor",
          created_at: new Date("2026-08-23T03:00:00.000Z"),
        },
      ],
    });

    const result = await lookupProductsLastChange([ids.alphaSkuA, ids.alphaSkuB]);

    assert.deepEqual(result[ids.alphaSkuA], {
      actorName: "Newest Actor",
      at: "2026-08-23T03:00:00.000Z",
      action: "UPDATE",
    });
    assert.equal(result[ids.alphaSkuB], undefined);
  });
});
