export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
export const DEFAULT_DATE_RANGE_DAYS = 30;
export const DEFAULT_PAGINATION_LIMIT = 50;
export const PROJECT_MEMBER_FETCH_LIMIT = 100;
export const ACTIVITY_FETCH_LIMIT = 100;
export const AUDIT_LOG_LIMIT = 500;

// ---------------------------------------------------------------------------
// Checklist / tasks — see roadmap.md §C
// ---------------------------------------------------------------------------

/// Gap left between consecutive sort_order values so a row can be dropped
/// between two others without renumbering the whole list.
export const CHECKLIST_SORT_STEP = 10;

/// Subtasks may not have subtasks. Enforced here rather than in the schema:
/// loosening this later needs no migration, tightening it would. Each extra
/// level also multiplies the cost of rendering, drag-and-drop, and deciding
/// what "done" means for a parent.
export const MAX_CHECKLIST_DEPTH = 1;

/// 1 = P1 (highest) … 4 = none. Plain integers rather than an enum so that
/// `ORDER BY priority ASC` is correct without anyone having to remember which
/// order the enum was declared in.
export const CHECKLIST_PRIORITY_MIN = 1;
export const CHECKLIST_PRIORITY_NONE = 4;

export const CHECKLIST_LABEL_MAX_LENGTH = 200;
