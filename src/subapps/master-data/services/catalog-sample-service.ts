import { SampleAction } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit/types";
import { recordAudit } from "@/subapps/master-data/services/audit-service";

export class CatalogSampleService {
  static async logSampleAction(
    tx: PrismaTransaction,
    data: {
      sample_id: string;
      action: SampleAction;
      notes?: string | null;
      userId: string;
      taken_by?: string;
      date_out?: Date;
      date_return?: Date;
    }
  ) {
    const actor = await tx.user.findUnique({
      where: { id: data.userId },
      select: { name: true },
    });

    return tx.sampleMovement.create({
      data: {
        sample_id: data.sample_id,
        actor_id: data.userId,
        actor_name: actor?.name ?? "Unknown",
        action: data.action,
        notes: data.notes,
        taken_by: data.taken_by,
        date_out: data.date_out,
        date_return: data.date_return,
      },
    });
  }

  static async deletePhysicalSample(
    tx: PrismaTransaction,
    sampleId: string,
    userId: string
  ) {
    const sample = await tx.sample.findUnique({
      where: { id: sampleId },
      include: { sku: true },
    });

    if (!sample || sample.deleted_at) {
      throw new Error("Sample not found");
    }
    if (sample.status === "BORROWED" || sample.status === "SENT_TO_CLIENT") {
      throw new Error("Cannot delete a sample that is currently out");
    }

    const removed = await tx.sample.update({
      where: { id: sampleId },
      data: { deleted_at: new Date() },
    });

    await recordAudit(tx, {
      entity: "Sample",
      entity_id: sampleId,
      action: "DELETE",
      actor: { id: userId, name: "system" },
      changes: { rack_number: sample.rack_number, box_number: sample.box_number },
    });

    await this.logSampleAction(tx, {
      sample_id: sampleId,
      action: SampleAction.OUT,
      notes: `Sample removed from inventory (Rack ${sample.rack_number}, Box ${sample.box_number})`,
      userId,
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.CATALOG_UPDATE, "PhysicalSample", sampleId, userId, {
      action: "SOFT_DELETE_SAMPLE",
      material_id: sample.sku.id,
      catalog_sku: sample.sku.code,
    });

    return removed;
  }
}
