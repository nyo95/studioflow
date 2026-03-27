import { auth } from "@/auth";
import { Role } from "@/generated/prisma";

export async function getSession() {
  const session = await auth();

  return {
    userId: session?.user?.id ?? "",
    role: (session?.user?.role as Role | undefined) ?? "STAFF",
    user: session?.user ?? null,
  };
}

export async function requireSession() {
  const session = await getSession();

  if (!session.userId || !session.user) {
    throw new Error("UNAUTHORIZED_ACTION");
  }

  return {
    userId: session.userId,
    role: session.role as Role,
    user: session.user,
  };
}
