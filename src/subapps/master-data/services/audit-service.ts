/**
 * MASTER DATA — audit trail service.
 *
 * Every write to a `master_data` table MUST pass through `recordAudit`. The
 * function writes a single `MasterDataAudit` row inside the same transaction
 * as the operation it records.
 *
 * Design decisions (from implementation_plan.md §3):
 * - `actor_id` is a plain string, NOT a FK — master_data deliberately does not
 *   cross into studioflow, so no "verify user exists" dance is needed.
 * - UPDATE with no real change → no audit row. Audit that records non-events
 *   makes real events harder to find.
 * - `Decimal` serialized to string, `Date` to ISO.
 * - One real operation = one audit row, with entity + entity_id pointing to the
 *   actual record.
 */

import { Prisma } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { recordAudit as recordCoreAudit } from "@/core/platform/audit/record";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MasterDataEntity =
  | "Party" | "PartyRole" | "PartyContact" | "PartyLink"
  | "Brand" | "BrandLink" | "BrandSupplier" | "BrandCategory"
  | "Category" | "Sku" | "SkuCategory" | "SkuMedia" | "SkuPrice"
  | "WorkPrice" | "Sample";

type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "RESTORE";

interface AuditArgs {
  entity: MasterDataEntity;
  entity_id: string;
  action: AuditAction;
  actor: { id?: string | null; name: string };
  changes?: Record<string, { from: unknown; to: unknown }> | Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Serialize Prisma.Decimal and Date to JSON-safe values. */
function serializeValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "object" && "toJSON" in v && typeof (v as { toJSON: () => unknown }).toJSON === "function") {
    return (v as { toJSON: () => unknown }).toJSON();
  }
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(serializeValue);
  if (typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = serializeValue(val);
    }
    return out;
  }
  return v;
}

/** Sanitize a changes object for Prisma Json. */
function sanitizeChanges(changes: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(changes, (_key, value) => serializeValue(value))) as Prisma.InputJsonValue;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record one audit entry inside the given transaction.
 *
 * Call this INSIDE the same `tx` that performs the write, AFTER the write
 * succeeds. If the transaction rolls back, the audit row rolls back too —
 * which is correct: an audit that survives a rollback is a lie.
 */
export async function recordAudit(
  tx: PrismaTransaction,
  args: AuditArgs,
): Promise<void> {
  const changesJson = args.changes
    ? sanitizeChanges(args.changes)
    : undefined;

  await tx.masterDataAudit.create({
    data: {
      entity: args.entity,
      entity_id: args.entity_id,
      action: args.action,
      actor_id: args.actor.id ?? null,
      actor_name: args.actor.name,
      changes: changesJson,
    },
  });

  // R3 dual-write (PRD Architecture Cleanup v2 §20): baris kanonik baru
  // ditulis ke satu tabel AuditLog generic di transaksi yang sama. Tabel
  // master_data.MasterDataAudit tetap sumber baca sampai backfill historis
  // selesai dan parity terverifikasi, lalu di-drop.
  await recordCoreAudit(tx, {
    domain: "MASTER_DATA",
    entityType: args.entity,
    entityId: args.entity_id,
    action: args.action,
    actorId: args.actor.id ?? null,
    actorName: args.actor.name,
    metadata: args.changes
      ? ({ changes: JSON.parse(JSON.stringify(changesJson)) } as Record<string, unknown>)
      : undefined,
  });
}

/**
 * Build a changes object by comparing old and new values for the specified
 * keys. Only fields that actually changed are included.
 *
 * Usage:
 *   const changes = diffFields(oldRow, newRow, ["name", "legal_name", "address"]);
 *   if (Object.keys(changes).length > 0) {
 *     await recordAudit(tx, { ..., changes });
 *   }
 */
export function diffFields<T extends Record<string, unknown>>(
  oldRow: T,
  newRow: T,
  keys: string[],
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of keys) {
    const oldVal = oldRow[key];
    const newVal = newRow[key];
    // Compare via JSON to handle Decimal, Date, etc.
    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      changes[key] = { from: serializeValue(oldVal), to: serializeValue(newVal) };
    }
  }
  return changes;
}
