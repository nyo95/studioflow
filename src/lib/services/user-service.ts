import bcrypt from "bcryptjs";
import { Role } from "@/generated/prisma";
import type { PrismaTransaction } from "@/types/common";
import { insertAuditLog } from "@/actions/_shared";
import { AUDIT_ACTIONS } from "@/lib/services/audit";

export const userService = {
  async executeCreateUser(tx: PrismaTransaction, params: any) {
    const { name, email, password, role, actorId } = params;
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await tx.user.create({
      data: { name, email, password: hashedPassword, role },
    });
    await insertAuditLog(tx, AUDIT_ACTIONS.USER_CREATE, "USER", user.id, actorId, { email });
    return user;
  },
};
