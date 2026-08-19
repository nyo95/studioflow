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

    // Email is unique. If a row already exists for this address, decide by its
    // soft-delete state: an active account is a genuine conflict, but a
    // previously removed one is reactivated in place — this keeps the SAME user
    // id, so all of that person's historical relations (projects, comments,
    // audit logs) reattach to the returning account instead of orphaning.
    const existing = await tx.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, deleted_at: true },
    });

    if (existing && existing.deleted_at === null) {
      throw new ActionError("EMAIL_ALREADY_EXISTS", "CONFLICT");
    }

    if (existing) {
      const reactivated = await tx.user.update({
        where: { id: existing.id },
        data: {
          name: normalizedName,
          password: hashedPassword,
          role,
          deleted_at: null,
        },
      });

      await insertAuditLog(tx, AUDIT_ACTIONS.USER_CREATE, "USER", reactivated.id, actorId, {
        name: reactivated.name,
        email: reactivated.email,
        role: reactivated.role,
        reactivated: true,
      });

      return reactivated;
    }

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
   * Soft-deletes a user (ADMIN / DEVELOPER only). The row is retained so every
   * relation that points at it keeps resolving to a real name; the account is
   * merely stamped deleted_at, hidden from the roster, and blocked from login.
   *
   * Guard: the last remaining admin-level (ADMIN / DEVELOPER) account can never
   * be removed — that would lock the studio out of all admin surfaces.
   */
  async executeDeleteUser(
    tx: PrismaTransaction,
    params: { targetUserId: string; actorId: string }
  ) {
    const { targetUserId, actorId } = params;

    const target = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true, deleted_at: true },
    });

    if (!target) {
      throw new ActionError("USER_NOT_FOUND", "NOT_FOUND");
    }

    // Already removed — treat as a no-op success so double-clicks are harmless.
    if (target.deleted_at !== null) {
      return target;
    }

    // Last-admin guard: block removing the final active admin-level account.
    if (target.role === Role.ADMIN || target.role === Role.DEVELOPER) {
      const otherAdmins = await tx.user.count({
        where: {
          deleted_at: null,
          role: { in: [Role.ADMIN, Role.DEVELOPER] },
          id: { not: targetUserId },
        },
      });

      if (otherAdmins === 0) {
        throw new ActionError("CANNOT_REMOVE_LAST_ADMIN", "CONFLICT");
      }
    }

    const user = await tx.user.update({
      where: { id: targetUserId },
      data: { deleted_at: new Date() },
    });

    await insertAuditLog(tx, AUDIT_ACTIONS.USER_DELETE, "USER", targetUserId, actorId, {
      name: target.name,
      email: target.email,
      role: target.role,
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
