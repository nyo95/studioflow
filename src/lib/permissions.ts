import { Role, PhaseName } from "@/generated/prisma";
import { requireSession } from "@/lib/auth";
import { throwActionError } from "@/lib/error-types";
import { evaluateAccess, PERMISSION } from "@/lib/rbac";

export const ERR = {
  UNAUTHORIZED_ACTION: "UNAUTHORIZED_ACTION",
  INVALID_PHASE_STATE: "INVALID_PHASE_STATE",
  PHASE_ALREADY_LOCKED: "PHASE_ALREADY_LOCKED",
} as const;

export function assertAdmin(role: Role) {
  if (role !== "ADMIN") throwActionError(ERR.UNAUTHORIZED_ACTION);
}

export function assertPhaseOwnerAccess(phaseName: PhaseName, project: any, userId: string, role: Role) {
  // RBAC check
}
