"use server";

import { signOut } from "@/auth";
import { createAction } from "@/lib/action-wrapper";
import { userService } from "@/lib/services/user-service";
import { assertAdmin, assertSelfOrAdmin } from "@/core/rbac/permissions";
import { Role } from "@/generated/prisma";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_SETTINGS } from "@/lib/revalidation-tags";
import { assertValidInput, validators } from "@/lib/validators";

export const logout = createAction(
  async () => {
    await signOut({ redirectTo: "/login" });
  },
  { useTransaction: false }
);

export const createUser = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { name: string; email: string; password: string; role: Role };

    assertValidInput(
      {
        name: validators.name,
        email: validators.email,
        password: validators.password,
      },
      params
    );

    const result = await userService.executeCreateUser(tx, {
      ...params,
      actorId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    return result;
  }
);

export const updateUserRole = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { targetUserId: string; newRole: Role };

    const result = await userService.executeUpdateUserRole(tx, {
      targetUserId: params.targetUserId,
      newRole: params.newRole,
      actorId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    return result;
  }
);

export const deleteUser = createAction(
  async ({ input, ctx, tx }) => {
    assertAdmin(ctx.role);

    const params = input as { targetUserId: string };

    const result = await userService.executeDeleteUser(tx, {
      targetUserId: params.targetUserId,
      actorId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    return result;
  }
);

export const updateUserName = createAction(
  async ({ input, ctx, tx }) => {
    const params = input as { userId: string; newName: string };

    assertSelfOrAdmin(ctx.userId, params.userId, ctx.role);

    assertValidInput({ newName: validators.name }, { newName: params.newName });

    const result = await userService.executeUpdateUserName(tx, {
      userId: params.userId,
      newName: params.newName,
      actorId: ctx.userId,
    });

    invalidateCache({ scope: REVALIDATE_SETTINGS });
    return result;
  }
);
