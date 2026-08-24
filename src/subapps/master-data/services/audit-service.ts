/**
 * MASTER DATA — audit trail service.
 *
 * Every write to a `master_data` table MUST pass through `recordAudit`. The
 * function writes a single generic `AuditLog` row inside the same transaction
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

function isDiffEntry(value: unknown): value is { from: unknown; to: unknown } {
  return Boolean(
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "from" in value &&
    "to" in value
  );
}

export function splitLegacyChanges(
  changes?: Record<string, unknown>
): {
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
} {
  if (!changes) {
    return {};
  }

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  let hasDiffEntries = false;
  let hasNonDiffEntries = false;

  for (const [key, value] of Object.entries(changes)) {
    if (isDiffEntry(value)) {
      hasDiffEntries = true;
      before[key] = serializeValue(value.from);
      after[key] = serializeValue(value.to);
      continue;
    }

    hasNonDiffEntries = true;
  }

  return {
    before: hasDiffEntries ? before : undefined,
    after: hasDiffEntries ? after : undefined,
    metadata: hasNonDiffEntries
      ? { changes: sanitizeChanges(changes) as Record<string, unknown> }
      : undefined,
  };
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
  const payload = splitLegacyChanges(
    args.changes
      ? (JSON.parse(JSON.stringify(args.changes, (_key, value) => serializeValue(value))) as Record<string, unknown>)
      : undefined
  );

  await recordCoreAudit(tx, {
    domain: "MASTER_DATA",
    entityType: args.entity,
    entityId: args.entity_id,
    action: args.action,
    actorId: args.actor.id ?? null,
    actorName: args.actor.name,
    before: payload.before,
    after: payload.after,
    metadata: payload.metadata,
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
