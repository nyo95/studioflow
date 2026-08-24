import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomUUID } from "node:crypto";

import { closePrismaConnection, prisma } from "@/core/platform/db";
import { diffFields, recordAudit } from "@/subapps/master-data/services/audit-service";
import type { PrismaTransaction } from "@/types/common";

const runId = `${Date.now()}-${process.pid}`;
const prefix = `it-audit-${runId}`;

const ids = {
  party: randomUUID(),
  brand: randomUUID(),
};

async function cleanupFixtures() {
  const audits = await prisma.auditLog.findMany({
    where: { entity_id: { in: [ids.brand, ids.party] }, domain: "MASTER_DATA" },
    select: { id: true },
  });
  if (audits.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { id: { in: audits.map((a) => a.id) } },
    });
  }
  await prisma.masterDataAudit.deleteMany({
    where: { entity_id: { in: [ids.brand, ids.party] } },
  });
  await prisma.brand.deleteMany({ where: { id: ids.brand } });
  await prisma.party.deleteMany({ where: { id: ids.party } });
}

before(async () => {
  await cleanupFixtures();
  await prisma.party.create({
    data: {
      id: ids.party,
      name: `${prefix} Holder`,
      slug: `${prefix}-holder`,
      type: "COMPANY",
    },
  });
  await prisma.brand.create({
    data: {
      id: ids.brand,
      name: `${prefix} Audited Brand`,
      slug: `${prefix}-brand`,
    },
  });
});

after(async () => {
  try {
    await cleanupFixtures();
  } finally {
    await closePrismaConnection();
  }
});

describe("audit dual-write (R3 consolidation)", () => {
  test("recordAudit writes MasterDataAudit AND generic AuditLog in the same tx", async () => {
    await prisma.$transaction(async (tx: PrismaTransaction) => {
      await recordAudit(tx, {
        entity: "Brand",
        entity_id: ids.brand,
        action: "CREATE",
        actor: { id: "integration-actor", name: "Integration Actor" },
      });

      const before = { name: "Old" };
      const after = { name: "New" };
      const changes = diffFields(
        before as Record<string, unknown>,
        after as Record<string, unknown>,
        ["name"]
      );
      await recordAudit(tx, {
        entity: "Brand",
        entity_id: ids.brand,
        action: "UPDATE",
        actor: { name: "No Id Actor" },
        changes,
      });
    });

    const legacyRows = await prisma.masterDataAudit.findMany({
      where: { entity: "Brand", entity_id: ids.brand },
      orderBy: { created_at: "asc" },
    });
    assert.equal(legacyRows.length, 2);

    const coreRows = await prisma.auditLog.findMany({
      where: { entity_type: "Brand", entity_id: ids.brand, domain: "MASTER_DATA" },
      orderBy: { created_at: "asc" },
    });
    assert.equal(coreRows.length, 2);

    assert.equal(coreRows[0].action, "CREATE");
    assert.equal(coreRows[0].actor_id, "integration-actor");
    assert.equal(coreRows[0].actor_name, "Integration Actor");
    assert.equal(coreRows[0].user_id, null);

    assert.equal(coreRows[1].action, "UPDATE");
    assert.equal(coreRows[1].actor_id, null);
    assert.equal(coreRows[1].actor_name, "No Id Actor");
    const details = coreRows[1].details as {
      changes?: Record<string, { from: unknown; to: unknown }>;
    };
    assert.deepEqual(details.changes?.name, { from: "Old", to: "New" });

    for (let i = 0; i < legacyRows.length; i++) {
      assert.equal(legacyRows[i].action, coreRows[i].action);
      assert.equal(legacyRows[i].entity, coreRows[i].entity_type);
      assert.equal(legacyRows[i].entity_id, coreRows[i].entity_id);
      assert.equal(legacyRows[i].actor_name, coreRows[i].actor_name);
    }
  });

  test("rollback of the transaction discards BOTH audit rows", async () => {
    await assert.rejects(() =>
      prisma.$transaction(async (tx: PrismaTransaction) => {
        await recordAudit(tx, {
          entity: "Party",
          entity_id: ids.party,
          action: "UPDATE",
          actor: { name: "Rollback Actor" },
        });
        throw new Error("force rollback");
      })
    );

    const legacyLeft = await prisma.masterDataAudit.count({
      where: { entity: "Party", entity_id: ids.party },
    });
    const coreLeft = await prisma.auditLog.count({
      where: { entity_type: "Party", entity_id: ids.party, domain: "MASTER_DATA" },
    });
    assert.equal(legacyLeft, 0);
    assert.equal(coreLeft, 0);
  });

  test("AuditLog.domain defaults to STUDIOFLOW for legacy write paths", async () => {
    const created = await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        entity_type: "IntegrationProbe",
        entity_id: ids.party,
      },
      select: { id: true, domain: true },
    });
    try {
      assert.equal(created.domain, "STUDIOFLOW");
    } finally {
      await prisma.auditLog.deleteMany({
        where: { id: created.id },
      });
    }
  });
});
