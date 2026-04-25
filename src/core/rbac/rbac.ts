export * from "./constants";
export * from "./matrix";
export * from "./guards";

import { Role } from "@/generated/prisma";
import { ActionError } from "@/lib/error-types";
import { PERMISSION } from "./constants";
import { hasPermission } from "./guards";

// Maintain Legacy RBAC object for scheduler compat until fully migrated
type PluginPermission = "plugin.schedule.manage" | "plugin.library.manage";

function hasPluginPermission(role: Role, permission: PluginPermission): boolean {
  switch (permission) {
    case "plugin.schedule.manage":
      return (
        hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_ADD) ||
        hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_EDIT) ||
        hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_APPROVE) ||
        hasPermission(role, PERMISSION.PLUGIN_SCHEDULE_DELETE)
      );
    case "plugin.library.manage":
      return (
        hasPermission(role, PERMISSION.LIBRARY_CREATE_ITEM) ||
        hasPermission(role, PERMISSION.LIBRARY_EDIT_ITEM) ||
        hasPermission(role, PERMISSION.LIBRARY_DELETE_ITEM) ||
        hasPermission(role, PERMISSION.LIBRARY_PROCESS_REQUEST)
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
