import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { PrismaTransaction } from "@/lib/action-wrapper";
import { ActionError } from "@/lib/result";
import { ERR } from "@/lib/permissions";

/**
 * Functional Service Layer for User operations.
 */
export const userService = {
  /**
   * Creates a new user (ADMIN only).
   */
  async executeCreateUser(
    _tx: PrismaTransaction,
    params: { name: string; email: string; password: string; role: string }
  ) {
    const { name, email, password, role } = params;

    const normalizedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();

    if (!normalizedName || !normalizedEmail || !normalizedPassword) {
      throw new ActionError("INVALID_INPUT", "MISSING_REQUIRED_FIELDS");
    }

    const hashedPassword = await bcrypt.hash(normalizedPassword, 12);

    const user = await prisma.user.create({
      data: {
        name: normalizedName,
        email: normalizedEmail,
        password: hashedPassword,
        role: role as any,
      },
    });

    return user;
  },

  /**
   * Updates user role (ADMIN only).
   */
  async executeUpdateUserRole(
    _tx: PrismaTransaction,
    params: { targetUserId: string; newRole: string }
  ) {
    const { targetUserId, newRole } = params;

    const user = await prisma.user.update({
      where: { id: targetUserId },
      data: { role: newRole as any },
    });

    return user;
  },

  /**
   * Updates user name (ADMIN or self).
   */
  async executeUpdateUserName(
    _tx: PrismaTransaction,
    params: { userId: string; newName: string }
  ) {
    const { userId, newName } = params;

    const normalizedName = newName.trim();
    if (!normalizedName) {
      throw new ActionError("INVALID_INPUT", "NAME_REQUIRED");
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { name: normalizedName },
    });

    return user;
  },
};
