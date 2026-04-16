const ACTION_LABELS: Record<string, string> = {
  ACTIVATE_PHASE: "memulai fase",
  SUBMIT_FOR_INTERNAL_REVIEW: "mengirim ke review internal",
  APPROVE_INTERNAL: "menyetujui review internal",
  SUBMIT_FOR_CLIENT_REVIEW: "mengirim ke review klien",
  APPROVE_CLIENT_PHASE: "menyetujui fase dari klien",
  REJECT_PHASE_INTERNAL: "mengembalikan fase dari review internal",
  REJECT_PHASE_CLIENT: "mengembalikan fase dari review klien",
  REOPEN_PHASE: "membuka ulang fase",
  COMPLETE_SUPERVISION_PHASE: "menyelesaikan fase supervisi",
  PROJECT_COMPLETED_MANUAL: "menandai proyek selesai",
  REVISION_OVERRIDE_ADMIN: "melakukan override revisi",
  BYPASS_PHASE_TO_COMPLETED: "melewati fase ke selesai",
  TOGGLE_ACTIVITY_STATUS: "mengubah status aktivitas",
  SYNC_PROJECT_CHECKLISTS: "sinkron checklist proyek",
  ADD_ACTIVITY: "menambah aktivitas",
  UPDATE_ACTIVITY: "memperbarui aktivitas",
  DELETE_ACTIVITY: "menghapus aktivitas",
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
  const normalized = normalizeWords(entityType);
  if (normalized === "project") return "proyek";
  if (normalized === "phase") return "fase";
  if (normalized === "activity") return "aktivitas";
  if (normalized === "revision") return "revisi";
  return normalized;
}

export function buildActivitySentence(params: {
  actorName?: string | null;
  action: string;
  entityType: string;
}) {
  const actor = params.actorName || "Sistem";
  const action = humanizeAuditAction(params.action);
  const entity = humanizeEntityType(params.entityType);
  return `${actor} ${action} pada ${entity}`;
}

export function formatActionLabel(action: string) {
  return capitalize(humanizeAuditAction(action));
}
