import type { PrismaTransaction } from "@/types/common";
import { trimOrNull } from "@/core/utilities/normalize";
import { ActionError } from "@/lib/error-types";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit";

/**
 * Functional Service Layer for Client operations.
 * Pure business logic - no HTTP/UI concerns.
 */
export const clientService = {
  /**
   * Deletes a client (only if no active projects).
   */
  async executeDeleteClient(tx: PrismaTransaction, params: { clientId: string; userId: string }) {
    const { clientId, userId } = params;

    const client = await tx.client.findUniqueOrThrow({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        projects: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (client.projects.length > 0) {
      throw new ActionError("CLIENT_HAS_ACTIVE_PROJECTS", "HAS_PROJECTS");
    }

    await tx.client.delete({ where: { id: clientId } });

    await insertAuditLog(tx, AUDIT_ACTIONS.CLIENT_DELETE, "CLIENT", client.id, userId, { name: client.name });

    return { id: client.id };
  },

  /**
   * Merges source client into target client.
   */
  async executeMergeClients(
    tx: PrismaTransaction,
    params: { sourceClientId: string; targetClientId: string; userId: string }
  ) {
    const { sourceClientId, targetClientId, userId } = params;

    if (sourceClientId === targetClientId) {
      throw new ActionError("INVALID_INPUT", "SAME_CLIENT");
    }

    const [sourceClient, targetClient] = await Promise.all([
      tx.client.findUnique({
        where: { id: sourceClientId },
        select: {
          id: true,
          name: true,
          projects: { select: { id: true } },
        },
      }),
      tx.client.findUnique({
        where: { id: targetClientId },
        select: { id: true, name: true },
      }),
    ]);

    if (!sourceClient || !targetClient) {
      throw new ActionError("CLIENT_NOT_FOUND", "NOT_FOUND");
    }

    const movedProjectIds = sourceClient.projects.map((project) => project.id);

    await tx.project.updateMany({
      where: { clientId: sourceClient.id },
      data: { clientId: targetClient.id },
    });

    await tx.client.delete({ where: { id: sourceClient.id } });

    await insertAuditLog(tx, AUDIT_ACTIONS.CLIENT_MERGE, "CLIENT", sourceClient.id, userId, {
      sourceClientId: sourceClient.id,
      sourceClientName: sourceClient.name,
      targetClientId: targetClient.id,
      targetClientName: targetClient.name,
      movedProjectIds,
    });

    return {
      movedProjectIds,
      sourceClientId: sourceClient.id,
      targetClientId: targetClient.id,
    };
  },

  /**
   * Updates client branding (address, logo).
   */
  async executeUpdateClientBranding(
    tx: PrismaTransaction,
    params: { clientId: string; address?: string; logo_url?: string; userId: string }
  ) {
    const { clientId, address, logo_url, userId } = params;

    const normalizedAddress = trimOrNull(address);
    const normalizedLogoUrl = trimOrNull(logo_url);

    const client = await tx.client.update({
      where: { id: clientId },
      data: {
        address: normalizedAddress,
        logo_url: normalizedLogoUrl,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.CLIENT_UPDATE_BRANDING, "CLIENT", client.id, userId, {
      address: client.address,
      logo_url: client.logo_url,
    });

    return client;
  },
};
