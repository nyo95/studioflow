import { Role } from "@/generated/prisma";
import { ActionError } from "@/lib/error-types";

/**
 * Granular Permissions for the StudioFlow system.
 * Centralized here to ensure a single source of truth for access control.
 */
export enum PERMISSION {
  // Project Permissions (8)
  PROJECT_CREATE = "PROJECT_CREATE",
  PROJECT_DELETE = "PROJECT_DELETE",
  PROJECT_EDIT_METADATA = "PROJECT_EDIT_METADATA",
  PROJECT_EDIT_PRIORITY = "PROJECT_EDIT_PRIORITY",
  PROJECT_VIEW_AUDIT = "PROJECT_VIEW_AUDIT",
  PROJECT_SYNC_CHECKLIST = "PROJECT_SYNC_CHECKLIST",
  PROJECT_FORCE_SYNC = "PROJECT_FORCE_SYNC",
  PROJECT_EXPORT_PDF = "PROJECT_EXPORT_PDF",

  // Phase Permissions (12)
  PHASE_ACTIVATE = "PHASE_ACTIVATE",
  PHASE_SUBMIT_REVIEW = "PHASE_SUBMIT_REVIEW",
  PHASE_APPROVE_INTERNAL = "PHASE_APPROVE_INTERNAL",
  PHASE_APPROVE_CLIENT = "PHASE_APPROVE_CLIENT",
  PHASE_REJECT = "PHASE_REJECT",
  PHASE_REOPEN = "PHASE_REOPEN",
  PHASE_OVERRIDE = "PHASE_OVERRIDE",
  PHASE_MUTATE_CONTENT = "PHASE_MUTATE_CONTENT",
  PHASE_UPLOAD_FILE = "PHASE_UPLOAD_FILE",
  PHASE_DELETE_FILE = "PHASE_DELETE_FILE",
  PHASE_MANAGE_CD = "PHASE_MANAGE_CD",
  PHASE_MANAGE_TIMELINE = "PHASE_MANAGE_TIMELINE",

  // Scheduled Fixtures (Plugin) (7)
  PLUGIN_SCHEDULE_ADD = "PLUGIN_SCHEDULE_ADD",
  PLUGIN_SCHEDULE_EDIT = "PLUGIN_SCHEDULE_EDIT",
  PLUGIN_SCHEDULE_DELETE = "PLUGIN_SCHEDULE_DELETE",
  PLUGIN_SCHEDULE_APPROVE = "PLUGIN_SCHEDULE_APPROVE",
  PLUGIN_SCHEDULE_EXPORT = "PLUGIN_SCHEDULE_EXPORT",
  PLUGIN_SCHEDULE_ASSIGN = "PLUGIN_SCHEDULE_ASSIGN",
  PLUGIN_SCHEDULE_VIEW = "PLUGIN_SCHEDULE_VIEW",

  // Library Permissions (12)
  LIBRARY_VIEW = "LIBRARY_VIEW",
  LIBRARY_CREATE_ITEM = "LIBRARY_CREATE_ITEM",
  LIBRARY_EDIT_ITEM = "LIBRARY_EDIT_ITEM",
  LIBRARY_DELETE_ITEM = "LIBRARY_DELETE_ITEM",
  LIBRARY_MANAGE_VENDORS = "LIBRARY_MANAGE_VENDORS",
  LIBRARY_MANAGE_BRANDS = "LIBRARY_MANAGE_BRANDS",
  LIBRARY_MANAGE_SAMPLES = "LIBRARY_MANAGE_SAMPLES",
  LIBRARY_REQUEST_MATERIAL = "LIBRARY_REQUEST_MATERIAL",
  LIBRARY_PROCESS_REQUEST = "LIBRARY_PROCESS_REQUEST",
  LIBRARY_MARK_RECEIVED = "LIBRARY_MARK_RECEIVED",
  LIBRARY_EXPORT_LIST = "LIBRARY_EXPORT_LIST",
  LIBRARY_ADMIN_OVERRIDE = "LIBRARY_ADMIN_OVERRIDE",

  // System Permissions
  SYSTEM_CONFIG_EDIT = "SYSTEM_CONFIG_EDIT",
}

/**
 * Static mapping of Roles to Permissions.
 */
const ROLE_PERMISSIONS: Record<Role, PERMISSION[]> = {
  ADMIN: Object.values(PERMISSION),
  STAFF: [
    PERMISSION.PROJECT_VIEW_AUDIT,
    PERMISSION.PLUGIN_SCHEDULE_VIEW,
    PERMISSION.LIBRARY_VIEW,
    PERMISSION.LIBRARY_EXPORT_LIST,
  ],
  DIC: [
    PERMISSION.PROJECT_EDIT_METADATA,
    PERMISSION.PROJECT_SYNC_CHECKLIST,
    PERMISSION.PROJECT_EXPORT_PDF,
    PERMISSION.PHASE_ACTIVATE,
    PERMISSION.PHASE_SUBMIT_REVIEW,
    PERMISSION.PHASE_APPROVE_INTERNAL,
    PERMISSION.PHASE_REOPEN,
    PERMISSION.PHASE_OVERRIDE,
    PERMISSION.PHASE_MUTATE_CONTENT,
    PERMISSION.PHASE_UPLOAD_FILE,
    PERMISSION.PHASE_DELETE_FILE,
    PERMISSION.PLUGIN_SCHEDULE_ADD,
    PERMISSION.PLUGIN_SCHEDULE_EDIT,
    PERMISSION.PLUGIN_SCHEDULE_DELETE,
    PERMISSION.PLUGIN_SCHEDULE_VIEW,
    PERMISSION.LIBRARY_VIEW,
    PERMISSION.LIBRARY_REQUEST_MATERIAL,
  ],
  DRIC: [
    PERMISSION.PHASE_MUTATE_CONTENT,
    PERMISSION.PHASE_UPLOAD_FILE,
    PERMISSION.PLUGIN_SCHEDULE_ADD,
    PERMISSION.PLUGIN_SCHEDULE_EDIT,
    PERMISSION.PLUGIN_SCHEDULE_VIEW,
    PERMISSION.LIBRARY_VIEW,
    PERMISSION.LIBRARY_REQUEST_MATERIAL,
  ],
};

/**
 * Pure function to evaluate if a role has the base permission.
 */
export function hasPermission(role: Role, permission: PERMISSION): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

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
 * Advanced evaluation including business logic and ownership.
 */
export function evaluateAccess(
  role: Role,
  permission: PERMISSION,
  context: AccessContext
): boolean {
  // 1. Admin always has access
  if (role === "ADMIN") return true;

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

type PluginPermission = "plugin.schedule.manage";

function hasPluginPermission(role: Role, permission: PluginPermission): boolean {
  switch (permission) {
    case "plugin.schedule.manage":
      return (
        hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_ADD) ||
        hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_EDIT) ||
        hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_APPROVE) ||
        hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_DELETE)
      );
    default:
      return false;
  }
}

export const RBAC = {
  assert(_tx: unknown, permission: PluginPermission, role: Role) {
    if (!hasPluginPermission(role, permission)) {
      throw new ActionError("Unauthorized Scheduler Action", "UNAUTHORIZED");
    }
  },
};
