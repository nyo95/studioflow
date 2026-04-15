"use server";

import { signOut } from "@/auth";
import { createAction } from "@/lib/action-wrapper";
import { userService } from "@/lib/services/user-service";
import { assertAdmin } from "@/lib/permissions";
import { Role } from "@/generated/prisma";
import { invalidateCache } from "@/lib/revalidation";
import { REVALIDATE_SETTINGS } from "@/lib/revalidation-tags";

export const logout = createAction(async () => {
  await signOut({ redirectTo: "/login" });
}, { useTransaction: false });

export const getUsers = createAction(async ({ tx }) => {
  return tx.user.findMany({ select: { id: true, name: true, email: true, role: true } });
});
