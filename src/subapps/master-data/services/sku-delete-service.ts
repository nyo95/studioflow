import { ActionError } from "@/lib/error-types";
import type { PrismaTransaction } from "@/types/common";
import { recordAudit } from "./audit-service";

export type DeleteSkuActor = {
  id?: string | null;
  name: string;
};

/**
 * Menonaktifkan satu SKU hidup sambil mempertahankan seluruh riwayat relasinya.
 *
 * `SkuPrice` sengaja tidak disentuh: harga adalah bukti historis dan pembaca
 * data aktif sudah membatasi hasil lewat `sku.deleted_at = null`. Karena itu,
 * pemulihan SKU kelak tetap membawa lini waktu harganya secara utuh.
 */
export async function softDeleteSku(
  tx: PrismaTransaction,
  skuId: string,
  actor: DeleteSkuActor
): Promise<{ id: string; deletedAt: string }> {
  const sku = await tx.sku.findFirst({
    where: { id: skuId, deleted_at: null },
    select: { id: true },
  });

  if (!sku) {
    throw new ActionError(
      "This SKU no longer exists or was already deleted. Refresh the page and try again.",
      "NOT_FOUND"
    );
  }

  const deletedAt = new Date();
  const updated = await tx.sku.updateMany({
    where: { id: sku.id, deleted_at: null },
    data: {
      deleted_at: deletedAt,
      updated_by_name: actor.name,
    },
  });

  if (updated.count !== 1) {
    throw new ActionError(
      "This SKU was changed in another tab or session. Refresh the page and try again.",
      "CONFLICT"
    );
  }

  await recordAudit(tx, {
    entity: "Sku",
    entity_id: sku.id,
    action: "DELETE",
    actor,
    changes: {
      deleted_at: { from: null, to: deletedAt.toISOString() },
    },
  });

  return { id: sku.id, deletedAt: deletedAt.toISOString() };
}
