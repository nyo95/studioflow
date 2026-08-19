"use client";

/**
 * The task list, shared by the phase view and the project overview (roadmap §C4).
 *
 * One component for both on purpose. Before this, the two surfaces rendered
 * checklist rows separately and had already drifted — different sort orders,
 * different empty states, and only one of them could toggle. Every field added
 * in §C would have had to be added twice.
 *
 * Root tasks and subtasks can be reordered inside their own sibling group.
 * Cross-parent drops are refused: reordering changes sequence, never hierarchy.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Badge,
  Button,
  Checkbox,
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
  UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import { cn } from "@/lib/utils";
import { unwrapActionResult } from "@/lib/result";
import {
  attachTaskLabel,
  createSubtask,
  deleteTask,
  detachTaskFromTemplate,
  detachTaskLabel,
  reorderTasks,
  updateTask,
} from "@/actions/checklist-actions";
import { toggleChecklist } from "@/actions/phase-actions";
import {
  applyChecklistFilter,
  buildChecklistTree,
  countChecklistFilters,
  reorderChecklistSiblings,
} from "@/lib/services/checklist-task";
import type {
  ChecklistFilter,
  ChecklistTask,
  ChecklistUserRef,
} from "@/types/checklist";
import {
  CalendarDays,
  ChevronRight,
  CornerDownRight,
  GripVertical,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Settings2,
  Tag,
  Trash2,
  Unlink,
  User as UserIcon,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

const FILTER_LABELS: Record<ChecklistFilter, string> = {
  all: "All",
  today: "Today",
  overdue: "Overdue",
  p1: "P1",
  mine: "Mine",
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "P1",
  2: "P2",
  3: "P3",
  4: "P4",
};

/** P4 has no colour: it is the absence of a priority, not a low one. */
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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Relative wording for the near dates and an absolute one beyond that.
 *
 * "in 3 days" stops being useful past about a week — at that point people
 * want the date itself, not arithmetic they have to undo.
 */
function formatDue(iso: string, now: Date): { text: string; tone: "overdue" | "today" | "soon" | "later" } {
  const due = startOfDay(new Date(iso));
  const today = startOfDay(now);
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) {
    return { text: days === -1 ? "Yesterday" : `${Math.abs(days)} days ago`, tone: "overdue" };
  }
  if (days === 0) return { text: "Today", tone: "today" };
  if (days === 1) return { text: "Tomorrow", tone: "soon" };
  if (days <= 7) return { text: `in ${days} days`, tone: "soon" };

  return {
    text: due.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    tone: "later",
  };
}

const DUE_TONE_STYLES: Record<string, string> = {
  overdue: "border-red-200 bg-red-50 text-red-700",
  today: "border-amber-200 bg-amber-50 text-amber-700",
  soon: "border-slate-200 bg-slate-50 text-slate-600",
  later: "border-slate-200 bg-slate-50 text-slate-500",
};

/** `<input type="date">` wants `YYYY-MM-DD` in local time, not a UTC ISO slice. */
function toDateInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

type SortableTaskControls = Pick<
  ReturnType<typeof useSortable>,
  "attributes" | "listeners" | "setActivatorNodeRef"
>;

function SortableTaskItem({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled: boolean;
  children: (controls: SortableTaskControls) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? "var(--ui-drag-source-opacity)" : undefined,
      }}
    >
      {children({ attributes, listeners, setActivatorNodeRef })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: ChecklistTask;
  depth: number;
  canEdit: boolean;
  members: ChecklistUserRef[];
  knownLabels: { id: string; name: string; color: string }[];
  now: Date;
  busy: boolean;
  expandable: boolean;
  expanded: boolean;
  childSummary: { done: number; total: number } | null;
  onToggleExpand: () => void;
  onToggle: (task: ChecklistTask, checked: boolean) => void;
  onMutate: (run: () => Promise<unknown>) => void;
  onAddSubtask: (parentId: string) => void;
  sortable?: SortableTaskControls;
  sortableDisabled?: boolean;
}

function TaskRow({
  task,
  depth,
  canEdit,
  members,
  knownLabels,
  now,
  busy,
  expandable,
  expanded,
  childSummary,
  onToggleExpand,
  onToggle,
  onMutate,
  onAddSubtask,
  sortable,
  sortableDisabled = false,
}: TaskRowProps) {
  const due = task.due_at ? formatDue(task.due_at, now) : null;
  const isTemplateRow = task.template_id !== null;

  // Inline rename — click the title, it becomes an input, Enter/blur saves,
  // Esc cancels. `updateTask` already accepted `label` before this (used by
  // the priority/due-date/assign controls in the row menu), but nothing in
  // the UI ever called it with a new label, so renaming a task was only
  // possible by deleting and re-adding it. Local state instead of a prop:
  // one row editing does not need to be known by its siblings.
  const [editingLabel, setEditingLabel] = React.useState(false);
  const [labelDraft, setLabelDraft] = React.useState(task.label);

  // Stay in sync with the server value while NOT editing — e.g. another
  // session renamed the same task and a poll/refresh brought the new label
  // in. Skipped while editing so an in-flight refresh cannot yank text out
  // from under someone mid-keystroke.
  //
  // `editingLabel` is intentionally OMITTED from the dep array. Including it
  // would fire the effect the moment commitLabelEdit calls setEditingLabel(false),
  // resetting labelDraft to the old task.label before router.refresh() arrives
  // and overwriting the optimistic value the user just saved. We only want to
  // pull in the server value when task.label itself changes (i.e. after the
  // refresh completes or another session renamed the task).
  React.useEffect(() => {
    if (!editingLabel) setLabelDraft(task.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.label]);

  const commitLabelEdit = () => {
    setEditingLabel(false);
    const trimmed = labelDraft.trim();
    // Empty or unchanged: revert quietly rather than round-tripping a no-op
    // or rejecting a blank title with a toast — the person just clicked away.
    if (!trimmed || trimmed === task.label) {
      setLabelDraft(task.label);
      return;
    }
    onMutate(() => updateTask({ taskId: task.id, label: trimmed }));
  };

  return (
    <div
      className={cn(
        "group flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors",
        task.is_checked
          ? "border-slate-100 bg-slate-50 text-slate-400"
          : "border-zinc-200 bg-white hover:border-zinc-300",
        depth > 0 && "ml-6 border-dashed"
      )}
    >
      {sortable ? (
        <Button
          ref={sortable.setActivatorNodeRef}
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={sortableDisabled}
          style={{ touchAction: "none" }}
          {...sortable.attributes}
          {...sortable.listeners}
          aria-label={`Reorder ${task.label}`}
          className="shrink-0 cursor-grab text-[var(--ui-text-tertiary)] active:cursor-grabbing"
        >
          <GripVertical aria-hidden="true" className="size-[var(--ui-icon-size-sm)]" />
        </Button>
      ) : null}

      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
        ) : (
          <Checkbox
            checked={task.is_checked}
            disabled={!canEdit}
            aria-label={task.label}
            onCheckedChange={(checked) => onToggle(task, checked === true)}
            className="rounded-sm data-[state=checked]:border-slate-900 data-[state=checked]:bg-slate-900"
          />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start gap-2">
          {expandable ? (
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse subtasks" : "Expand subtasks"}
              className="mt-0.5 shrink-0 text-slate-400 transition-colors hover:text-slate-700"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")} />
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
              className="h-6 flex-1 px-1.5 py-0 font-sans text-xs font-medium leading-relaxed"
            />
          ) : (
            <span
              role={canEdit ? "button" : undefined}
              tabIndex={canEdit ? 0 : undefined}
              onClick={() => {
                if (!canEdit) return;
                setEditingLabel(true);
              }}
              onKeyDown={(event) => {
                if (!canEdit) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setEditingLabel(true);
                }
              }}
              className={cn(
                "flex-1 rounded font-sans text-xs font-medium leading-relaxed",
                task.is_checked && "line-through",
                canEdit && "cursor-text hover:bg-slate-100"
              )}
            >
              {labelDraft}
            </span>
          )}
        </div>

        {/* Metadata strip. Rendered only when there is something in it, so an
            untouched task stays a single quiet line. */}
        {due ||
        task.priority !== 4 ||
        task.assigned_to ||
        task.labels.length > 0 ||
        task.comment_count > 0 ||
        childSummary ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {task.priority !== 4 ? (
              <Badge variant="outline" className={cn("h-5 px-1.5 text-[10px] font-bold", PRIORITY_STYLES[task.priority])}>
                {PRIORITY_LABELS[task.priority]}
              </Badge>
            ) : null}

            {due ? (
              <Badge
                variant="outline"
                className={cn(
                  "h-5 gap-1 px-1.5 text-[10px] font-medium",
                  // A done task never reads as overdue: a completed item with a
                  // past date is not a problem, and colouring it red trains
                  // people to ignore the colour.
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
                  "h-5 gap-1 px-1.5 text-[10px] font-medium",
                  LABEL_COLOR_STYLES[label.color] ?? LABEL_COLOR_STYLES.slate
                )}
              >
                {label.name}
                {canEdit ? (
                  <button
                    type="button"
                    aria-label={`Remove label ${label.name}`}
                    className="opacity-0 transition-opacity group-hover:opacity-60 hover:!opacity-100"
                    onClick={() =>
                      onMutate(() => detachTaskLabel({ taskId: task.id, labelId: label.id }))
                    }
                  >
                    ×
                  </button>
                ) : null}
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

      {canEdit ? (
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
                  {PRIORITY_LABELS[level]}
                </button>
              ))}
            </div>

            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-400">
              Due date
            </DropdownMenuLabel>
            <div className="flex items-center gap-1 px-2 pb-1.5">
              {/* Date only, no time. Nothing writes a time component, so a time
                  picker here would promise precision the data does not carry. */}
              <Input
                type="date"
                defaultValue={toDateInputValue(task.due_at)}
                onChange={(event) => {
                  const value = event.target.value;
                  onMutate(() =>
                    updateTask({ taskId: task.id, dueAt: value ? new Date(`${value}T00:00:00`) : null })
                  );
                }}
                className="h-7 flex-1 text-[11px]"
              />
              {task.due_at ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[10px] text-slate-500"
                  onClick={() => onMutate(() => updateTask({ taskId: task.id, dueAt: null }))}
                >
                  Clear
                </Button>
              ) : null}
            </div>

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
                {knownLabels.length > 0 ? (
                  knownLabels.map((label) => (
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
                  ))
                ) : null}
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

            {depth === 0 ? (
              <DropdownMenuItem className="text-xs" onSelect={() => onAddSubtask(task.id)}>
                <CornerDownRight className="mr-2 h-3.5 w-3.5" />
                Add subtask
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator />

            {/* A template row cannot be deleted outright: it would come back on
                the next sync and read as a bug. Detaching first is the honest
                path — it turns the row into a plain task that deleting removes
                for good. */}
            {isTemplateRow ? (
              <DropdownMenuItem
                className="text-xs"
                onSelect={() => onMutate(() => detachTaskFromTemplate({ taskId: task.id }))}
              >
                <Unlink className="mr-2 h-3.5 w-3.5" />
                Detach from template
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                className="text-xs text-red-600 focus:text-red-600"
                onSelect={() => onMutate(() => deleteTask({ taskId: task.id }))}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export interface TaskListProps {
  tasks: ChecklistTask[];
  projectId: string;
  canEdit: boolean;
  currentUserId: string | null;
  members: ChecklistUserRef[];
  knownLabels?: { id: string; name: string; color: string }[];
  /** Lets the phase view keep its live provider in step with a local toggle. */
  onToggleOptimistic?: (taskId: string, isChecked: boolean) => void;
  /** Called after any successful write, for callers that poll. */
  onAfterMutate?: () => void;
  emptyMessage?: string;
  /**
   * Where an admin goes to add a checklist item. Rendered in the empty state so
   * "where do these come from?" is answered at the moment it is asked.
   */
  settingsHref?: string | null;
}

export function TaskList({
  tasks,
  projectId,
  canEdit,
  currentUserId,
  members,
  knownLabels = [],
  onToggleOptimistic,
  onAfterMutate,
  emptyMessage = "No checklist items yet.",
  settingsHref = null,
}: TaskListProps) {
  const router = useRouter();
  const [filter, setFilter] = React.useState<ChecklistFilter>("all");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
  const [subtaskParent, setSubtaskParent] = React.useState<string | null>(null);
  const [subtaskDraft, setSubtaskDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [reordering, setReordering] = React.useState(false);
  const dndContextId = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Local mirror so a toggle paints immediately instead of waiting for the
  // round trip. Re-synced whenever the server data changes underneath.
  const [items, setItems] = React.useState(tasks);
  React.useEffect(() => setItems(tasks), [tasks]);

  // One clock per render pass. Reading `new Date()` inside each row would let
  // two badges on the same screen disagree across a midnight boundary.
  const now = React.useMemo(() => new Date(), []);

  const counts = React.useMemo(
    () => countChecklistFilters(items, currentUserId, now),
    [items, currentUserId, now]
  );

  const tree = React.useMemo(() => {
    const filtered = applyChecklistFilter(items, filter, currentUserId, now);
    return buildChecklistTree(filtered);
  }, [items, filter, currentUserId, now]);

  const runMutation = React.useCallback(
    (run: () => Promise<unknown>) => {
      setPending(true);
      void (async () => {
        try {
          unwrapActionResult((await run()) as Awaited<ReturnType<typeof updateTask>>);
          router.refresh();
          onAfterMutate?.();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Couldn't save that change");
        } finally {
          setPending(false);
        }
      })();
    },
    [router, onAfterMutate]
  );

  const handleToggle = React.useCallback(
    (task: ChecklistTask, checked: boolean) => {
      if (!canEdit) return;

      setBusyId(task.id);

      // The server cascades a root toggle to its subtasks in one statement, so
      // this is one request. The optimistic paint has to mirror that cascade
      // exactly — otherwise the subtask rows would flip back the moment the
      // next poll arrives carrying the server's version.
      const affected = new Set<string>([task.id]);
      if (task.parent_id === null) {
        for (const item of items) {
          if (item.parent_id === task.id) affected.add(item.id);
        }
      }

      setItems((prev) =>
        prev.map((item) => (affected.has(item.id) ? { ...item, is_checked: checked } : item))
      );
      affected.forEach((id) => onToggleOptimistic?.(id, checked));

      void (async () => {
        try {
          unwrapActionResult(await toggleChecklist({ checklistId: task.id, isChecked: checked }));
          router.refresh();
          onAfterMutate?.();
        } catch (error) {
          setItems(tasks);
          affected.forEach((id) => onToggleOptimistic?.(id, !checked));
          toast.error(error instanceof Error ? error.message : "Couldn't update the task");
        } finally {
          setBusyId(null);
        }
      })();
    },
    [canEdit, items, tasks, onToggleOptimistic, onAfterMutate, router]
  );

  const submitSubtask = React.useCallback(() => {
    const label = subtaskDraft.trim();
    if (!label || !subtaskParent || pending) return;
    setSubtaskDraft("");
    const parentId = subtaskParent;
    setSubtaskParent(null);
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.delete(parentId);
      return next;
    });
    runMutation(() => createSubtask({ projectId, parentId, label }));
  }, [subtaskDraft, subtaskParent, pending, projectId, runMutation]);

  const showReorder = canEdit && filter === "all";
  const canReorder = showReorder && !pending && !reordering;
  const siblingCounts = React.useMemo(() => {
    const countsByGroup = new Map<string, number>();
    for (const task of items) {
      const key = `${task.project_id}::${task.phase_id ?? "GLOBAL"}::${task.parent_id ?? "ROOT"}`;
      countsByGroup.set(key, (countsByGroup.get(key) ?? 0) + 1);
    }
    return countsByGroup;
  }, [items]);
  const shouldShowDragTask = React.useCallback(
    (task: ChecklistTask) => {
      if (!showReorder) return false;
      const key = `${task.project_id}::${task.phase_id ?? "GLOBAL"}::${task.parent_id ?? "ROOT"}`;
      return (siblingCounts.get(key) ?? 0) > 1;
    },
    [showReorder, siblingCounts]
  );

  const handleDragEnd = React.useCallback(({ active, over }: DragEndEvent) => {
    if (!canReorder || !over) return;
    const previousItems = items;
    const reordered = reorderChecklistSiblings(items, String(active.id), String(over.id));
    if (!reordered) return;

    setItems(reordered.items);
    setReordering(true);
    void (async () => {
      try {
        unwrapActionResult(await reorderTasks({ taskIds: reordered.taskIds }));
        router.refresh();
        onAfterMutate?.();
      } catch (error) {
        setItems(previousItems);
        toast.error(error instanceof Error ? error.message : "Task order could not be saved");
      } finally {
        setReordering(false);
      }
    })();
  }, [canReorder, items, onAfterMutate, router]);

  return (
    <div className="space-y-3">
      {/* Filter tabs. Written as code rather than stored as rows — see
          roadmap §C2 for why saved filters were deferred rather than dropped. */}
      <div className="flex flex-wrap items-center gap-1">
        {(Object.keys(FILTER_LABELS) as ChecklistFilter[]).map((key) => {
          const count = counts[key];
          const isActive = filter === key;
          // A tab that would show nothing is hidden rather than disabled —
          // except "All", which anchors the row.
          if (count === 0 && key !== "all" && !isActive) return null;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                isActive
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-zinc-200 bg-white text-slate-500 hover:border-zinc-300"
              )}
            >
              {FILTER_LABELS[key]}
              <span className={cn("ml-1", isActive ? "text-slate-300" : "text-slate-400")}>{count}</span>
            </button>
          );
        })}
        {canEdit && filter !== "all" && items.length > 1 ? (
          <span className={cn("ml-auto text-[var(--ui-text-tertiary)]", UI_ENGINE_TYPE_META)}>
            Switch to All to reorder tasks.
          </span>
        ) : null}
      </div>

      {tree.length === 0 ? (
        <div className="space-y-2 py-6 text-center">
          <p className="font-sans text-xs text-slate-400">
            {filter === "all" ? emptyMessage : "Nothing matches this filter."}
          </p>
          {/* Where these come from, said at the moment somebody wonders. The
              link is admin-only because Studio settings is admin-only — showing
              it to everyone would send most people to a redirect. */}
          {filter === "all" && settingsHref ? (
            <Link
              href={settingsHref}
              className="inline-flex items-center gap-1 font-sans text-[11px] font-medium text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline"
            >
              <Settings2 className="h-3 w-3" />
              Manage checklist templates
            </Link>
          ) : null}
        </div>
      ) : (
        <DndContext
          id={dndContextId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={tree.map((node) => node.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {tree.map((node) => {
                const isCollapsed = collapsed.has(node.id);
                const childSummary =
                  node.children.length > 0
                    ? { done: node.children.filter((c) => c.is_checked).length, total: node.children.length }
                    : null;
                const rootDraggable = shouldShowDragTask(node);

                return (
                  <SortableTaskItem key={node.id} id={node.id} disabled={!rootDraggable || !canReorder}>
                    {(rootSortable) => (
                      <div className="space-y-1.5">
                        <TaskRow
                          task={node}
                          depth={0}
                          canEdit={canEdit}
                          members={members}
                          knownLabels={knownLabels}
                          now={now}
                          busy={busyId === node.id}
                          expandable={node.children.length > 0}
                          expanded={!isCollapsed}
                          childSummary={childSummary}
                          onToggleExpand={() =>
                            setCollapsed((prev) => {
                              const next = new Set(prev);
                              if (next.has(node.id)) next.delete(node.id);
                              else next.add(node.id);
                              return next;
                            })
                          }
                          onToggle={handleToggle}
                          onMutate={runMutation}
                          onAddSubtask={(parentId) => {
                            setSubtaskParent(parentId);
                            setSubtaskDraft("");
                          }}
                          sortable={rootDraggable ? rootSortable : undefined}
                          sortableDisabled={!canReorder}
                        />

                        {!isCollapsed && node.children.length > 0 ? (
                          <SortableContext
                            items={node.children.map((child) => child.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            <div className="space-y-1.5">
                              {node.children.map((child) => {
                                const childDraggable = shouldShowDragTask(child);
                                return (
                                  <SortableTaskItem
                                    key={child.id}
                                    id={child.id}
                                    disabled={!childDraggable || !canReorder}
                                  >
                                    {(childSortable) => (
                                      <TaskRow
                                        task={child}
                                        depth={1}
                                        canEdit={canEdit}
                                        members={members}
                                        knownLabels={knownLabels}
                                        now={now}
                                        busy={busyId === child.id}
                                        expandable={false}
                                        expanded={false}
                                        childSummary={null}
                                        onToggleExpand={() => undefined}
                                        onToggle={handleToggle}
                                        onMutate={runMutation}
                                        onAddSubtask={() => undefined}
                                        sortable={childDraggable ? childSortable : undefined}
                                        sortableDisabled={!canReorder}
                                      />
                                    )}
                                  </SortableTaskItem>
                                );
                              })}
                            </div>
                          </SortableContext>
                        ) : null}

                        {subtaskParent === node.id ? (
                          <div className="ml-6 flex items-center gap-2">
                            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                            <Input
                              autoFocus
                              value={subtaskDraft}
                              onChange={(event) => setSubtaskDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  submitSubtask();
                                }
                                if (event.key === "Escape") setSubtaskParent(null);
                              }}
                              onBlur={() => {
                                if (!subtaskDraft.trim()) setSubtaskParent(null);
                              }}
                              placeholder="New subtask…"
                              className="h-8 text-xs"
                            />
                          </div>
                        ) : null}
                      </div>
                    )}
                  </SortableTaskItem>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* No quick-add here on purpose.
          A checklist item is a requirement: defined once by an admin in Studio
          settings and generated into every project. An add box on this card
          would let the same phase demand different things in different
          projects, and the template would stop describing what it claims to.
          Adding a subtask under an existing item is still allowed — see the row
          menu, and `checklist-service.ts` for why that is a different thing. */}
    </div>
  );
}
