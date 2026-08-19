import { auth } from "@/auth";
import { Role } from "@/generated/prisma";
import { throwActionError } from "@/lib/error-types";
import { LEAST_PRIVILEGE_ROLE } from "@/core/rbac/app-access";

export async function getSession() {
  const session = await auth();

  return {
    userId: session?.user?.id ?? "",
    // SECURITY: was "STAFF". See src/core/rbac/app-access.ts for why a missing
    // role claim must resolve to the least-privileged role, not to the role
    // that owns Master Data. Callers that can reject outright should prefer
    // requireSession(), which throws when there is no userId.
    role: (session?.user?.role as Role | undefined) ?? LEAST_PRIVILEGE_ROLE,
    user: session?.user ?? null,
  };
}

export async function requireSession() {
  const session = await getSession();

  if (!session.userId || !session.user) {
    throwActionError("UNAUTHORIZED_ACTION");
  }

  return {
    userId: session.userId,
    role: session.role as Role,
    user: session.user,
  };
}
