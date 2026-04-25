import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { ActionError } from "@/lib/error-types";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/core/platform/audit";

/**
 * Functional Service Layer for User operations.
 */
export const userService = {
  /**
   * Creates a new user (ADMIN only).
   */
  async executeCreateUser(
    tx: PrismaTransaction,
    params: { name: string; email: string; password: string; role: Role; actorId: string }
  ) {
    const { name, email, password, role, actorId } = params;

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedName || !normalizedEmail || !normalizedPassword) {
      throw new ActionError("INVALID_INPUT", "MISSING_REQUIRED_FIELDS");
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 12);

    const user = await tx.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        password: hashedPassword,
        role,
      },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.USER_CREATE, "USER", user.id, actorId, {
      name: user.name,
      email: user.email,
      role: user.role
    });

    return user;
  },

  /**
   * Updates user role (ADMIN only).
   */
  async executeUpdateUserRole(
    tx: PrismaTransaction,
    params: { targetUserId: string; newRole: Role; actorId: string }
  ) {
    const { targetUserId, newRole, actorId } = params;

    const user = await tx.user.update({
      where: { id: targetUserId },
      data: { role: newRole },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.USER_UPDATE, "USER", targetUserId, actorId, {
      new_role: newRole
    });

    return user;
  },

  /**
   * Updates user name (ADMIN or self).
   */
  async executeUpdateUserName(
    tx: PrismaTransaction,
    params: { userId: string; newName: string; actorId: string }
  ) {
    const { userId, newName, actorId } = params;

    const normalizedName = newName.trim();
    if (!normalizedName) {
      throw new ActionError("INVALID_INPUT", "NAME_REQUIRED");
    }

    const user = await tx.user.update({
      where: { id: userId },
      data: { name: normalizedName },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.USER_UPDATE, "USER", userId, actorId, {
      new_name: normalizedName
    });

    return user;
  },
};
