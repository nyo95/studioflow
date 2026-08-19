import type { ChecklistFilter, ChecklistFilterQuery } from "@/types/checklist";

export function toChecklistFilterQuery(
  filter: ChecklistFilter,
  showCompleted: boolean
): ChecklistFilterQuery {
  return {
    status: showCompleted ? "COMPLETED" : "OPEN",
    priority: filter === "p1" ? "P1" : null,
    assignee: filter === "mine" ? "ME" : null,
    due:
      filter === "today"
        ? "TODAY_OR_EARLIER"
        : filter === "overdue"
          ? "OVERDUE"
          : null,
  };
}

export function fromChecklistFilterQuery(query: ChecklistFilterQuery): {
  filter: ChecklistFilter;
  showCompleted: boolean;
} {
  let filter: ChecklistFilter = "all";
  if (query.due === "OVERDUE") filter = "overdue";
  else if (query.due === "TODAY_OR_EARLIER") filter = "today";
  else if (query.priority === "P1") filter = "p1";
  else if (query.assignee === "ME") filter = "mine";

  return { filter, showCompleted: query.status === "COMPLETED" };
}
