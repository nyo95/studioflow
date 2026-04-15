import type { PrismaTransaction } from "@/types/common";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit";

export const clientService = {
  async executeDeleteClient(tx: PrismaTransaction, params: { clientId: string; userId: string }) {
    const client = await tx.client.delete({ where: { id: params.clientId } });
    await insertAuditLog(tx, AUDIT_ACTIONS.CLIENT_DELETE, "CLIENT", client.id, params.userId, { name: client.name });
    return client;
  },
};
