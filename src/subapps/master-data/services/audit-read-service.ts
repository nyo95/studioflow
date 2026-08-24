import { prisma } from "@/core/platform/db";

export type LastChange = {
  actorName: string | null;
  at: string | null;
  action: string | null;
};

export async function lookupProductsLastChange(productIds: string[]): Promise<Record<string, LastChange>> {
  const ids = [...new Set(productIds ?? [])].filter(Boolean);
  if (ids.length === 0) return {};

  const rows = await prisma.auditLog.findMany({
    where: {
      domain: "MASTER_DATA",
      entity_type: "Sku",
      entity_id: { in: ids },
    },
    orderBy: { created_at: "desc" },
    select: {
      entity_id: true,
      action: true,
      created_at: true,
      actor_name: true,
    },
  });

  const result: Record<string, LastChange> = {};
  for (const row of rows) {
    if (result[row.entity_id]) continue;
    result[row.entity_id] = {
      actorName: row.actor_name || null,
      at: row.created_at.toISOString(),
      action: row.action,
    };
  }

  return result;
}
