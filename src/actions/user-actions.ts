"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { createAction } from "@/lib/action-wrapper";
import { userService } from "@/lib/services/user-service";
import { assertAdmin, ERR } from "@/lib/permissions";
import { Role } from "@/generated/prisma";

export const logout = createAction(
  async () => {
    await signOut({ redirectTo: "/login" });
  },
  { useTransaction: false }
);

export const createUser = createAction(
  async ({ input, ctx }) => {
    assertAdmin(ctx.role);

    const params = input as { name: string; email: string; password: string; role: Role };

    const result = await userService.executeCreateUser(null as any, params);

    revalidatePath("/settings");
    return result;
  }
);

export const updateUserRole = createAction(
  async ({ input, ctx }) => {
    assertAdmin(ctx.role);

    const params = input as { targetUserId: string; newRole: Role };

    const result = await userService.executeUpdateUserRole(null as any, {
      targetUserId: params.targetUserId,
      newRole: params.newRole,
    });

    revalidatePath("/settings");
    return result;
  }
);

export const updateUserName = createAction(
  async ({ input, ctx }) => {
    const params = input as { userId: string; newName: string };

    if (ctx.role !== "ADMIN" && ctx.userId !== params.userId) {
      throw new Error(ERR.UNAUTHORIZED_ACTION);
    }

    const result = await userService.executeUpdateUserName(null as any, {
      userId: params.userId,
      newName: params.newName,
    });

    revalidatePath("/settings");
    return result;
  }
);
