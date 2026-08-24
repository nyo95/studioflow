import { findAuditLogsCompat } from "@/core/platform/audit/compat";

export type LastChange = {
  actorName: string | null;
  at: string | null;
  action: string | null;
};

export async function lookupProductsLastChange(productIds: string[]): Promise<Record<string, LastChange>> {
  const ids = [...new Set(productIds ?? [])].filter(Boolean);
  if (ids.length === 0) return {};

  const rows = await findAuditLogsCompat(
    {},
    {
      domain: "MASTER_DATA",
      entityType: "Sku",
      entityIds: ids,
    }
  );

  rows.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

  const result: Record<string, LastChange> = {};
  for (const row of rows) {
    if (result[row.entity_id]) continue;
    result[row.entity_id] = {
      actorName: row.actor_name || row.user?.name || null,
      at: row.created_at.toISOString(),
      action: row.action,
    };
  }

  return result;
}
