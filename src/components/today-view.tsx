"use client";

/**
 * The Today feed.
 *
 * Grouped by project, as before. What is new is everything that makes the list
 * answer a question instead of just listing: filter tabs, due dates, priority,
 * assignee, labels, and subtasks nested under their parent.
 *
 * Rows come from two tables (see `types/task-feed.ts`). The only place that
 * matters here is toggling — `UnifiedTask.source` picks the write path. The
 * rest of the row renders identically, because from the reader's point of view
 * it is one list of things to do.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDateWithOptions } from "@/core/utilities/datetime";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
} from "@/ui_engine";
import { TodayInlineAdd } from "@/components/today-inline-add";
import { SavedChecklistFilters } from "@/components/saved-checklist-filters";
import { cn } from "@/lib/utils";
import { unwrapActionResult } from "@/lib/result";
import {
  setActivityDueDate,
  toggleActivityStatus,
  toggleChecklist,
  updateActivityContent,
} from "@/actions/phase-actions";
import { attachTaskLabel, updateTask } from "@/actions/checklist-actions";
import { applyChecklistFilter, countChecklistFilters } from "@/lib/services/checklist-task";
import { countOpen } from "@/lib/services/task-feed";
import {
  fromChecklistFilterQuery,
  toChecklistFilterQuery,
} from "@/lib/services/checklist-filter-rules";
import type {
  ChecklistFilter,
  ChecklistFilterQuery,
  ChecklistFilterViewData,
  ChecklistUserRef,
} from "@/types/checklist";
import type { TaskFeedGroup, UnifiedTask } from "@/types/task-feed";
import {
  CalendarDays,
  Check,
  ChevronRight,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Tag,
  User as UserIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

const FILTER_LABELS: Record<ChecklistFilter, string> = {
  all: "All",
  today: "Today",
  overdue: "Overdue",
  p1: "P1",
  mine: "Mine",
};

const PRIORITY_STYLES: Record<number, string> = {
  1: "border-red-200 bg-red-50 text-red-700",
  2: "border-amber-200 bg-amber-50 text-amber-700",
  3: "border-sky-200 bg-sky-50 text-sky-700",
  4: "border-slate-200 bg-slate-50 text-slate-400",
};

const LABEL_COLOR_STYLES: Record<string, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-600",
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

const DUE_TONE_STYLES: Record<string, string> = {
  overdue: "border-red-200 bg-red-50 text-red-700",
  today: "border-amber-200 bg-amber-50 text-amber-700",
  soon: "border-slate-200 bg-slate-50 text-slate-600",
  later: "border-slate-200 bg-slate-50 text-slate-500",
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Relative wording near today, the plain date beyond a week.
 * "in 9 days" is arithmetic the reader has to undo; "19 Aug" is not.
 */
function formatDue(iso: string, now: Date) {
  const due = startOfDay(new Date(iso));
  const today = startOfDay(now);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) {
    return { text: days === -1 ? "Yesterday" : `${Math.abs(days)} days ago`, tone: "overdue" as const };
  }
  if (days === 0) return { text: "Today", tone: "today" as const };
  if (days === 1) return { text: "Tomorrow", tone: "soon" as const };
  if (days <= 7) return { text: `in ${days} days`, tone: "soon" as const };

  return {
    text: formatDateWithOptions(due, { day: "numeric", month: "short" }),
    tone: "later" as const,
  };
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${`${d.getMonth() + 1}`.padStart(2, "0")}-${`${d.getDate()}`.padStart(2, "0")}`;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: UnifiedTask;
  depth: number;
  now: Date;
  busy: boolean;
  members: ChecklistUserRef[];
  knownLabels: { id: string; name: string; color: string }[];
  expandable: boolean;
  expanded: boolean;
  childSummary: { done: number; total: number } | null;
  onToggleExpand: () => void;
  onToggle: (task: UnifiedTask, checked: boolean) => void;
  onMutate: (run: () => Promise<unknown>) => void;
}

function TaskRow({
  task,
  depth,
  now,
  busy,
  members,
  knownLabels,
  expandable,
  expanded,
  childSummary,
  onToggleExpand,
  onToggle,
  onMutate,
}: TaskRowProps) {
  const due = task.due_at ? formatDue(task.due_at, now) : null;
  const isFeedback = task.mode === "FEEDBACK";

  // Both sources now carry a due date, so both get a menu — but only checklist
  // rows have priority, labels and an assignee. Showing an Activity a priority
  // picker would offer a control that writes nowhere.
  const isChecklist = task.source === "checklist";

  const [editingLabel, setEditingLabel] = React.useState(false);
  const [labelDraft, setLabelDraft] = React.useState(task.label);

  // Keep the local label aligned with refreshed server data without resetting
  // an in-progress edit. `editingLabel` must stay out of this dependency list:
  // adding it recreates #28b by restoring the old prop immediately after save,
  // before router.refresh() can deliver the new value.
  React.useEffect(() => {
    if (!editingLabel) setLabelDraft(task.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.label]);

  const commitLabelEdit = () => {
    setEditingLabel(false);
    const trimmed = labelDraft.trim();
    if (!trimmed || trimmed === task.label) {
      setLabelDraft(task.label);
      return;
    }

    onMutate(() =>
      task.source === "checklist"
        ? updateTask({ taskId: task.id, label: trimmed })
        : updateActivityContent({ activityId: task.id, content: trimmed })
    );
  };

  /** Both sources set a date; the write path differs, the wording does not. */
  const setDue = (value: string) => {
    const dueAt = value ? new Date(`${value}T00:00:00`) : null;
    onMutate(() =>
      isChecklist
        ? updateTask({ taskId: task.id, dueAt })
        : setActivityDueDate({ activityId: task.id, dueAt })
    );
  };

  return (
    <div
      className={cn(
        "group flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50",
        depth > 0 && "ml-7"
      )}
    >
      <button
        type="button"
        onClick={() => onToggle(task, !task.is_checked)}
        disabled={busy}
        aria-label={task.label}
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
        ) : isFeedback ? (
          // Feedback is not a task someone assigned themselves; it is a note
          // from a review. Same toggle, different mark, so the two do not read
          // as the same kind of work.
          <MessageSquare className={cn("h-3.5 w-3.5", task.is_checked ? "text-slate-300" : "text-amber-500")} />
        ) : (
          <span
            className={cn(
              "flex h-4 w-4 items-center justify-center rounded-full border transition-all",
              task.is_checked
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white group-hover:border-slate-500"
            )}
          >
            {task.is_checked ? <Check className="h-2.5 w-2.5" /> : null}
          </span>
        )}
      </button>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-start gap-2">
          {expandable ? (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
              className="mt-1 shrink-0 text-slate-300 transition-colors hover:text-slate-700"
            >
              <ChevronRight className={cn("h-3 w-3 transition-transform", expanded && "rotate-90")} />
            </button>
          ) : null}

          {editingLabel ? (
            <Input
              autoFocus
              value={labelDraft}
              onChange={(event) => setLabelDraft(event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitLabelEdit();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  setLabelDraft(task.label);
                  setEditingLabel(false);
                }
              }}
              onBlur={commitLabelEdit}
              className="h-6 flex-1 px-1.5 py-0 font-sans text-[13px] leading-5"
            />
          ) : (
            <span
              role="button"
              tabIndex={0}
              onClick={() => setEditingLabel(true)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setEditingLabel(true);
                }
              }}
              className={cn(
                "flex-1 cursor-text rounded-[var(--ui-radius-action)] font-sans text-[13px] leading-5 hover:bg-slate-100",
                task.is_checked ? "text-slate-400 line-through" : "text-slate-800"
              )}
            >
              {labelDraft}
            </span>
          )}
        </div>

        {due || task.priority !== 4 || task.labels.length > 0 || task.comment_count > 0 || childSummary ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {task.priority !== 4 ? (
              <Badge
                variant="outline"
                className={cn("h-5 px-1.5 text-[10px] font-bold", PRIORITY_STYLES[task.priority])}
              >
                P{task.priority}
              </Badge>
            ) : null}

            {due ? (
              <Badge
                variant="outline"
                className={cn(
                  "h-5 gap-1 px-1.5 text-[10px] font-medium",
                  task.is_checked ? DUE_TONE_STYLES.later : DUE_TONE_STYLES[due.tone]
                )}
              >
                <CalendarDays className="h-2.5 w-2.5" />
                {due.text}
              </Badge>
            ) : null}

            {task.labels.map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                className={cn(
                  "h-5 px-1.5 text-[10px] font-medium",
                  LABEL_COLOR_STYLES[label.color] ?? LABEL_COLOR_STYLES.slate
                )}
              >
                {label.name}
              </Badge>
            ))}

            {task.comment_count > 0 ? (
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <MessageSquare className="h-2.5 w-2.5" />
                {task.comment_count}
              </span>
            ) : null}

            {childSummary ? (
              <span className="text-[10px] text-slate-400">
                {childSummary.done}/{childSummary.total} subtasks
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {task.assigned_to ? (
        <span
          title={task.assigned_to.name}
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[9px] font-bold text-white"
        >
          {initialsOf(task.assigned_to.name)}
        </span>
      ) : null}

      {task.phase_label ? (
        <span className="mt-0.5 shrink-0 select-none rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
          {task.phase_label}
        </span>
      ) : null}

      <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 h-6 w-6 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
              aria-label="Task actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            {isChecklist ? (
              <>
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-400">
                  Priority
                </DropdownMenuLabel>
                <div className="flex gap-1 px-2 pb-1.5">
                  {[1, 2, 3, 4].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => onMutate(() => updateTask({ taskId: task.id, priority: level }))}
                      className={cn(
                        "flex-1 rounded border py-1 text-[10px] font-bold transition-colors",
                        PRIORITY_STYLES[level],
                        task.priority === level && "ring-1 ring-slate-900 ring-offset-1"
                      )}
                    >
                      P{level}
                    </button>
                  ))}
                </div>

                <DropdownMenuSeparator />
              </>
            ) : null}

            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-400">
              Due date
            </DropdownMenuLabel>
            <div className="flex items-center gap-1 px-2 pb-1.5">
              <Input
                type="date"
                defaultValue={toDateInputValue(task.due_at)}
                onChange={(event) => setDue(event.target.value)}
                className="h-7 flex-1 text-[11px]"
              />
              {task.due_at ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-slate-500"
                  onClick={() => setDue("")}
                >
                  Clear
                </Button>
              ) : null}
            </div>

            {isChecklist ? (
              <>
            <DropdownMenuSeparator />

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs">
                <UserIcon className="mr-2 h-3.5 w-3.5" />
                Assign
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  className="text-xs"
                  onSelect={() => onMutate(() => updateTask({ taskId: task.id, assignedToId: null }))}
                >
                  Unassigned
                </DropdownMenuItem>
                {members.map((member) => (
                  <DropdownMenuItem
                    key={member.id}
                    className="text-xs"
                    onSelect={() => onMutate(() => updateTask({ taskId: task.id, assignedToId: member.id }))}
                  >
                    {member.name}
                    {task.assigned_to?.id === member.id ? " ✓" : ""}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger className="text-xs">
                <Tag className="mr-2 h-3.5 w-3.5" />
                Label
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-52">
                {knownLabels.map((label) => (
                  <DropdownMenuItem
                    key={label.id}
                    className="text-xs"
                    onSelect={() =>
                      onMutate(() =>
                        attachTaskLabel({ taskId: task.id, name: label.name, color: label.color })
                      )
                    }
                  >
                    {label.name}
                  </DropdownMenuItem>
                ))}
                <div className="px-2 py-1.5">
                  <Input
                    placeholder="New label…"
                    className="h-7 text-[11px]"
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      const value = event.currentTarget.value.trim();
                      if (!value) return;
                      event.currentTarget.value = "";
                      onMutate(() => attachTaskLabel({ taskId: task.id, name: value }));
                    }}
                  />
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
              </>
            ) : null}
          </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

interface AddTarget {
  projectId: string;
  projectName: string;
  phases: Array<{
    phaseId: string;
    activeRevisionId?: string;
    phaseName: string;
    isProjectLevel?: boolean;
    isLocked?: boolean;
  }>;
}

interface TodayViewProps {
  groups: TaskFeedGroup[];
  addTargets: AddTarget[];
  currentUserId: string | null;
  members: ChecklistUserRef[];
  knownLabels: { id: string; name: string; color: string }[];
  initialSavedFilters: ChecklistFilterViewData[];
}

export function TodayView({
  groups,
  addTargets,
  currentUserId,
  members,
  knownLabels,
  initialSavedFilters,
}: TodayViewProps) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<ChecklistFilter>("all");
  const [showCompleted, setShowCompleted] = React.useState(false);
  const currentFilterQuery = React.useMemo(
    () => toChecklistFilterQuery(filter, showCompleted),
    [filter, showCompleted]
  );
  const applySavedFilter = React.useCallback((query: ChecklistFilterQuery) => {
    const next = fromChecklistFilterQuery(query);
    setFilter(next.filter);
    setShowCompleted(next.showCompleted);
  }, []);
  // Projects with nothing queued start collapsed — an empty queue is still
  // useful to see (it confirms the project exists), but it shouldn't take up
  // the same visual weight as a project with active work. The user can expand
  // it manually at any time; the state is not persisted across reloads.
  const [collapsed, setCollapsed] = React.useState<Set<string>>(
    () => new Set(groups.filter((g) => countOpen(g.tasks) === 0).map((g) => g.project_id))
  );
  const [collapsedTasks, setCollapsedTasks] = React.useState<Set<string>>(() => new Set());
  const [busyKey, setBusyKey] = React.useState<string | null>(null);

  const [data, setData] = React.useState(groups);
  React.useEffect(() => setData(groups), [groups]);

  // One clock for the whole render. Reading it per row would let two date
  // badges on the same screen disagree across a midnight boundary.
  const now = React.useMemo(() => new Date(), []);

  // Counts come from the flattened list, including subtasks: the tabs are
  // answering "how much work matches this", and a subtask is work.
  const allTasks = React.useMemo(
    () => data.flatMap((group) => group.tasks.flatMap((task) => [task, ...task.children])),
    [data]
  );

  const counts = React.useMemo(
    () => countChecklistFilters(allTasks, currentUserId, now),
    [allTasks, currentUserId, now]
  );

  const visibleGroups = React.useMemo(() => {
    return data
      .map((group) => {
        const matches = (task: UnifiedTask) =>
          applyChecklistFilter([task], filter, currentUserId, now).length > 0 &&
          (showCompleted ? task.is_checked : !task.is_checked);

        const tasks = group.tasks
          .map((task) => {
            const children = task.children.filter(matches);
            // A parent is kept when it matches OR when any of its children do —
            // dropping it would orphan the children and hide the context that
            // makes them make sense.
            if (!matches(task) && children.length === 0) return null;
            return { ...task, children };
          })
          .filter((task): task is UnifiedTask => task !== null);

        return { ...group, tasks };
      })
      // A project with nothing queued stays on screen under the default view —
      // that empty row IS the answer to "what's on my plate for this one". Once
      // a filter is on, the question changes to "what matches this", and a
      // project with no matches is noise, so it drops out.
      .filter((group) => group.tasks.length > 0 || (filter === "all" && !showCompleted));
  }, [data, filter, currentUserId, now, showCompleted]);

  const openTotal = React.useMemo(
    () => data.reduce((sum, group) => sum + countOpen(group.tasks), 0),
    [data]
  );

  const runMutation = React.useCallback(
    (run: () => Promise<unknown>) => {
      void (async () => {
        try {
          unwrapActionResult((await run()) as Awaited<ReturnType<typeof updateTask>>);
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Couldn't save that change");
        }
      })();
    },
    [router]
  );

  const handleToggle = React.useCallback(
    (task: UnifiedTask, checked: boolean) => {
      setBusyKey(task.key);

      // The parent's subtasks are cascaded server-side for checklist rows, so
      // the optimistic paint has to mirror that or the children flip back on
      // the next refresh.
      const affected = new Set<string>([task.key, ...task.children.map((c) => c.key)]);

      setData((prev) =>
        prev.map((group) => ({
          ...group,
          tasks: group.tasks.map((t) => ({
            ...t,
            is_checked: affected.has(t.key) ? checked : t.is_checked,
            children: t.children.map((c) => ({
              ...c,
              is_checked: affected.has(c.key) ? checked : c.is_checked,
            })),
          })),
        }))
      );

      void (async () => {
        try {
          // The one place `source` matters. Everything else about these two
          // kinds of row renders identically.
          if (task.source === "activity") {
            unwrapActionResult(await toggleActivityStatus({ activityId: task.id }));
          } else {
            unwrapActionResult(await toggleChecklist({ checklistId: task.id, isChecked: checked }));
          }
          router.refresh();
        } catch (error) {
          setData(groups);
          toast.error(error instanceof Error ? error.message : "Couldn't update the task");
        } finally {
          setBusyKey(null);
        }
      })();
    },
    [groups, router]
  );

  return (
    <div className="space-y-5">
      {/* Filters first: the point of the screen is to narrow, and a filter row
          below the list would be found only after scrolling past what it was
          meant to reduce. */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-4">
        {(Object.keys(FILTER_LABELS) as ChecklistFilter[]).map((key) => {
          const count = counts[key];
          const isActive = filter === key;
          // Empty tabs are hidden rather than greyed out. "Overdue 0" is a
          // fact nobody needs standing next to the tabs that do have work.
          if (count === 0 && key !== "all" && !isActive) return null;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-zinc-200 bg-white text-slate-500 hover:border-zinc-300"
              )}
            >
              {FILTER_LABELS[key]}
              <span className={cn("ml-1.5", isActive ? "text-slate-300" : "text-slate-400")}>{count}</span>
            </button>
          );
        })}

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <button
          type="button"
          onClick={() => setShowCompleted((v) => !v)}
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
            showCompleted
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-zinc-200 bg-white text-slate-500 hover:border-zinc-300"
          )}
        >
          {showCompleted ? "Completed" : "Open"}
          <span className={cn("ml-1.5", showCompleted ? "text-slate-300" : "text-slate-400")}>
            {showCompleted ? allTasks.filter((t) => t.is_checked).length : openTotal}
          </span>
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <SavedChecklistFilters
          initialViews={initialSavedFilters}
          currentQuery={currentFilterQuery}
          onApply={applySavedFilter}
        />

      </div>

      {visibleGroups.length === 0 ? (
        <p className="py-20 text-center font-sans text-xs italic text-slate-300">
          {showCompleted ? "Nothing completed yet." : "Nothing matches this filter."}
        </p>
      ) : (
        <div className="space-y-8">
          {visibleGroups.map((group) => {
            const isCollapsed = collapsed.has(group.project_id);
            const target = addTargets.find((t) => t.projectId === group.project_id);
            const groupOpen = countOpen(group.tasks);

            return (
              <section key={group.project_id}>
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.project_id)) next.delete(group.project_id);
                      else next.add(group.project_id);
                      return next;
                    })
                  }
                  className="group/header flex w-full items-center gap-3 border-b border-slate-200 pb-2 text-left"
                >
                  <ChevronRight
                    className={cn(
                      "h-3 w-3 shrink-0 text-slate-300 transition-transform group-hover/header:text-slate-600",
                      !isCollapsed && "rotate-90"
                    )}
                  />
                  <h3 className="min-w-0 flex-1 truncate font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-slate-900">
                    {group.project_name}
                  </h3>
                  {group.project_is_urgent ? (
                    <Badge
                      variant="outline"
                      className="shrink-0 border-red-200 bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-red-600"
                    >
                      Urgent
                    </Badge>
                  ) : null}
                  <span className="shrink-0 text-[10px] font-semibold text-slate-400">{groupOpen}</span>
                </button>

                {!isCollapsed ? (
                  <div className="mt-1.5 space-y-0.5">
                    {/* An empty queue is a result, not a missing section. Saying
                        so plainly is what makes "I hold this project and there
                        is nothing on it" distinguishable from "this project is
                        not mine" — the two used to look identical, because both
                        rendered nothing at all. */}
                    {group.tasks.length === 0 ? (
                      <p className="px-3 py-2 font-sans text-xs italic text-slate-300">
                        Nothing queued.
                      </p>
                    ) : null}

                    {group.tasks.map((task) => {
                      const childrenCollapsed = collapsedTasks.has(task.key);
                      const childSummary =
                        task.children.length > 0
                          ? {
                              done: task.children.filter((c) => c.is_checked).length,
                              total: task.children.length,
                            }
                          : null;

                      return (
                        <div key={task.key}>
                          <TaskRow
                            task={task}
                            depth={0}
                            now={now}
                            busy={busyKey === task.key}
                            members={members}
                            knownLabels={knownLabels}
                            expandable={task.children.length > 0}
                            expanded={!childrenCollapsed}
                            childSummary={childSummary}
                            onToggleExpand={() =>
                              setCollapsedTasks((prev) => {
                                const next = new Set(prev);
                                if (next.has(task.key)) next.delete(task.key);
                                else next.add(task.key);
                                return next;
                              })
                            }
                            onToggle={handleToggle}
                            onMutate={runMutation}
                          />

                          {!childrenCollapsed
                            ? task.children.map((child) => (
                                <TaskRow
                                  key={child.key}
                                  task={child}
                                  depth={1}
                                  now={now}
                                  busy={busyKey === child.key}
                                  members={members}
                                  knownLabels={knownLabels}
                                  expandable={false}
                                  expanded={false}
                                  childSummary={null}
                                  onToggleExpand={() => undefined}
                                  onToggle={handleToggle}
                                  onMutate={runMutation}
                                />
                              ))
                            : null}
                        </div>
                      );
                    })}

                    {!showCompleted && target ? (
                      <div className="pl-3 pt-1">
                        <TodayInlineAdd
                          phases={[
                            {
                              id: target.phases[0].phaseId,
                              name: target.phases[0].phaseName,
                              status: "IN_PROGRESS",
                              isProjectLevel: target.phases[0].isProjectLevel,
                              projectId: target.projectId,
                            },
                          ]}
                          allProjectPhases={target.phases.map((phase) => ({
                            id: phase.phaseId,
                            name: phase.phaseName,
                            revisionId: phase.activeRevisionId,
                            status: "IN_PROGRESS",
                            isProjectLevel: phase.isProjectLevel,
                            projectId: target.projectId,
                            isLocked: phase.isLocked,
                          }))}
                          mode="TODO"
                          buttonLabel="Add task…"
                          placeholder="Add task…"
                          className="opacity-50 transition-opacity hover:opacity-100"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
