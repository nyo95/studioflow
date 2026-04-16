import * as types from "./types";
import * as queryBuilder from "./query-builder";
import * as readModels from "./read-models";
import * as undoExecutor from "./undo-executor";

export * from "./types";
export * from "./query-builder";
export * from "./read-models";
export * from "./undo-executor";

export const auditService = {
  ...readModels,
  ...undoExecutor,
  // Helper to maintain compatibility if needed
  AUDIT_ACTIONS: types.AUDIT_ACTIONS,
};
