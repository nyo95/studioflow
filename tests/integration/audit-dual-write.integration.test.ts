import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { randomUUID } from "node:crypto";

import { closePrismaConnection, prisma } from "@/core/platform/db";
import { recordAudit as recordPlatformAudit } from "@/core/platform/audit/record";
import {
  diffFields,
  recordAudit,
  splitLegacyChanges,
} from "@/subapps/master-data/services/audit-service";
import type { PrismaTransaction } from "@/types/common";

const runId = `${Date.now()}-${process.pid}`;
const prefix = `it-audit-${runId}`;

const ids = {
  party: randomUUID(),
  brand: randomUUID(),
};

async function cleanupFixtures() {
  const audits = await prisma.auditLog.findMany({
    where: { entity_id: { in: [ids.brand, ids.party] } },
    select: { id: true },
  });
  if (audits.length > 0) {
    await prisma.auditLog.deleteMany({
      where: { id: { in: audits.map((a) => a.id) } },
    });
  }
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

describe("audit consolidation (R3)", () => {
  test("generic AuditLog accepts StudioFlow, Master Data, and BQ rows", async () => {
    await prisma.$transaction(async (tx: PrismaTransaction) => {
      await recordPlatformAudit(tx, {
        domain: "STUDIOFLOW",
        entityType: "IntegrationProbe",
        entityId: ids.party,
        action: "UPDATE",
        actorId: "studioflow-actor",
        metadata: { project_id: "project-a" },
      });
      await recordPlatformAudit(tx, {
        domain: "MASTER_DATA",
        entityType: "Party",
        entityId: ids.party,
        action: "CREATE",
        actorName: "Master Data Actor",
      });
      await recordPlatformAudit(tx, {
        domain: "BQ",
        entityType: "BqProject",
        entityId: ids.party,
        action: "CREATE",
        actorId: "bq-actor",
        metadata: { bq_project_id: "bq-project-a" },
      });
    });

    const rows = await prisma.auditLog.findMany({
      where: {
        OR: [
          { domain: "STUDIOFLOW", entity_type: "IntegrationProbe", entity_id: ids.party },
          { domain: "MASTER_DATA", entity_type: "Party", entity_id: ids.party },
          { domain: "BQ", entity_type: "BqProject", entity_id: ids.party },
        ],
      },
      orderBy: [{ domain: "asc" }, { entity_type: "asc" }],
    });

    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => [row.domain, row.entity_type, row.entity_id]),
      [
        ["STUDIOFLOW", "IntegrationProbe", ids.party],
        ["MASTER_DATA", "Party", ids.party],
        ["BQ", "BqProject", ids.party],
      ],
    );
  });

  test("master data recordAudit writes one generic row with before/after preserved", async () => {
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
    assert.deepEqual(coreRows[1].before_json, { name: "Old" });
    assert.deepEqual(coreRows[1].after_json, { name: "New" });
    assert.equal(coreRows[1].metadata_json, null);
  });

  test("legacy change payload keeps non-diff audit information for historical migration", () => {
    const payload = splitLegacyChanges({
      status: { from: "REQUESTED", to: "IN_PROGRESS" },
      vendor_contacted_by: "Integration User",
      notes: "Called supplier",
    });

    assert.deepEqual(payload.before, { status: "REQUESTED" });
    assert.deepEqual(payload.after, { status: "IN_PROGRESS" });
    assert.deepEqual(payload.metadata, {
      changes: {
        status: { from: "REQUESTED", to: "IN_PROGRESS" },
        vendor_contacted_by: "Integration User",
        notes: "Called supplier",
      },
    });
  });

  test("rollback of the transaction discards the generic audit row", async () => {
    const rollbackEntityId = randomUUID();

    await assert.rejects(() =>
      prisma.$transaction(async (tx: PrismaTransaction) => {
        await recordAudit(tx, {
          entity: "Party",
          entity_id: rollbackEntityId,
          action: "UPDATE",
          actor: { name: "Rollback Actor" },
        });
        throw new Error("force rollback");
      })
    );

    const coreLeft = await prisma.auditLog.count({
      where: { entity_type: "Party", entity_id: rollbackEntityId, domain: "MASTER_DATA" },
    });
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
