import { Role } from "@/generated/prisma";
import { ActionError } from "@/lib/error-types";
import { PERMISSION } from "./constants";
import { ROLE_PERMISSIONS } from "./matrix";

/**
 * Context interface for complex permission evaluations.
 */
export interface AccessContext {
  userId: string;
  picDesignerId?: string;
  picDrafterId?: string;
  phaseName?: string;
}

/**
 * Pure function to evaluate if a role has the base permission.
 */
export function hasPermission(role: Role, permission: PERMISSION): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/**
 * ADMIN-equivalent check for everything EXCEPT the SketchUp plugin surface.
 * Both ADMIN (the studio boss) and DEVELOPER (the technical superuser) have
 * full admin-level access to the web app. The SketchUp API/plugin gates
 * deliberately keep hard `role === "DEVELOPER"` checks and must NOT use this
 * helper — that surface is DEVELOPER-only, and ADMIN is excluded from it.
 */
export function isAdminLevel(role: Role): boolean {
  return role === "ADMIN" || role === "DEVELOPER";
}

/**
 * Advanced evaluation including business logic and ownership.
 */
export function evaluateAccess(
  role: Role,
  permission: PERMISSION,
  context: AccessContext
): boolean {
  // 1. Admin-level roles (ADMIN, DEVELOPER) always have access
  if (isAdminLevel(role)) return true;

  // 2. Base Permission Check
  if (!hasPermission(role, permission)) return false;

  const { userId, picDesignerId, picDrafterId, phaseName } = context;

  // 3. Contextual Logic
  switch (permission) {
    case PERMISSION.PROJECT_EDIT_METADATA:
      // Only the assigned PIC Designer can edit metadata
      return role === "DIC" && userId === picDesignerId;

    case PERMISSION.PHASE_ACTIVATE:
    case PERMISSION.PHASE_SUBMIT_REVIEW:
    case PERMISSION.PHASE_REOPEN:
    case PERMISSION.PHASE_REJECT:
    case PERMISSION.PHASE_OVERRIDE:
    case PERMISSION.PHASE_APPROVE_INTERNAL:
      // Project Lead (DIC) can perform transitions on all phases.
      // Phase PIC (e.g. Drafter on CD phase) can also perform transitions on their assigned phase.
      if (role === "DIC" && userId === picDesignerId) return true;
      if (phaseName === "CD" && role === "DRIC" && userId === picDrafterId) return true;
      return false;

    case PERMISSION.PHASE_MUTATE_CONTENT:
      // For CD Phase: Both Drafter (Owner) and Designer (DIC) can mutate
      if (phaseName === "CD") {
        return userId === picDrafterId || (role === "DIC" && userId === picDesignerId);
      }
      // For other phases: Strictly the assigned PIC Designer
      return role === "DIC" && userId === picDesignerId;

    case PERMISSION.PROJECT_SYNC_CHECKLIST:
      // Designers or Drafters assigned to the project can sync
      return userId === picDesignerId || userId === picDrafterId;

    default:
      return true;
  }
}

/**
 * Throws an ActionError if access evaluation fails.
 */
export function assertPermission(
  role: Role,
  permission: PERMISSION,
  context: AccessContext,
  customErrorMsg?: string
) {
  if (!evaluateAccess(role, permission, context)) {
    throw new ActionError(
      customErrorMsg || `Unauthorized: Missing ${permission} permission`,
      "UNAUTHORIZED"
    );
  }
}

/**
 * Simple membership check for project members.
 */
export function isProjectMember(
  userId: string,
  picDesignerId: string,
  picDrafterId: string
): boolean {
  return userId === picDesignerId || userId === picDrafterId;
}

/**
 * Throws an ActionError if user is not a member of the project.
 */
export function assertProjectMembership(
  userId: string,
  role: Role,
  picDesignerId: string,
  picDrafterId: string
) {
  if (isAdminLevel(role)) return;
  if (!isProjectMember(userId, picDesignerId, picDrafterId)) {
    throw new ActionError("Unauthorized: Not a project member", "UNAUTHORIZED");
  }
}
