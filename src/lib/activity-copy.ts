/**
 * Turns raw audit-log rows into a readable sentence.
 *
 * English, matching the rest of the UI (roadmap §D4). Verbs are past tense
 * because the audit log is a record of what happened, not a live feed —
 * "approved internal review", not "approves".
 *
 * An action with no entry here falls back to its own name with the underscores
 * removed. That is deliberate: a new AUDIT_ACTIONS constant should render as
 * slightly awkward English rather than disappear or throw, so the gap is
 * visible in the UI and someone fills it in.
 */

const ACTION_LABELS: Record<string, string> = {
  ACTIVATE_PHASE: "started phase",
  SUBMIT_FOR_INTERNAL_REVIEW: "sent for internal review",
  APPROVE_INTERNAL: "approved internal review",
  SUBMIT_FOR_CLIENT_REVIEW: "sent for client review",
  APPROVE_CLIENT_PHASE: "approved phase with client",
  REJECT_PHASE_INTERNAL: "returned phase from internal review",
  REJECT_PHASE_CLIENT: "returned phase from client review",
  REOPEN_PHASE: "reopened phase",
  COMPLETE_SUPERVISION_PHASE: "completed supervision phase",
  PROJECT_COMPLETED_MANUAL: "marked project complete",
  REVISION_OVERRIDE_ADMIN: "overrode revision",
  BYPASS_PHASE_TO_COMPLETED: "skipped phase to complete",
  TOGGLE_ACTIVITY_STATUS: "changed activity status",
  SYNC_PROJECT_CHECKLISTS: "synced project checklist",
  ADD_ACTIVITY: "added activity",
  UPDATE_ACTIVITY: "updated activity",
  DELETE_ACTIVITY: "deleted activity",
  TOGGLE_CHECKLIST: "ticked a task",
  ADD_CHECKLIST_ITEM: "added a task",
  UPDATE_CHECKLIST_ITEM: "updated a task",
  DELETE_CHECKLIST_ITEM: "deleted a task",
  DETACH_CHECKLIST_TEMPLATE: "detached a task from its template",
  REORDER_CHECKLIST: "reordered tasks",
};

function normalizeWords(value: string) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function capitalize(value: string) {
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function humanizeAuditAction(action: string) {
  return ACTION_LABELS[action] ?? normalizeWords(action);
}

export function humanizeEntityType(entityType: string) {
  return normalizeWords(entityType);
}

export function buildActivitySentence(params: {
  actorName?: string | null;
  action: string;
  entityType: string;
}) {
  const actor = params.actorName || "System";
  const action = humanizeAuditAction(params.action);
  const entity = humanizeEntityType(params.entityType);
  return `${actor} ${action} on ${entity}`;
}

export function formatActionLabel(action: string) {
  return capitalize(humanizeAuditAction(action));
}
