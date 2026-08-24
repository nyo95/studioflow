"use client";

/**
 * The date view — Today and what is coming.
 *
 * Same rows as `/`, asked a different question. That page groups by project
 * ("what is on each of my projects"); this one groups by date ("what is due
 * when"). Both read the same query so they cannot disagree about what exists.
 *
 * Project name moves from a section heading to a chip on the row, because here
 * the day is the heading and the project is the detail — exactly the reverse.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDateWithOptions } from "@/core/utilities/datetime";
import { Badge, Button, Input } from "@/ui_engine";
import { cn } from "@/lib/utils";
import { unwrapActionResult } from "@/lib/result";
import { setActivityDueDate, toggleActivityStatus, toggleChecklist } from "@/actions/phase-actions";
import { updateTask } from "@/actions/checklist-actions";
import { bucketTasksByDate, type DateBucket } from "@/lib/services/task-feed";
import type { UnifiedTask } from "@/types/task-feed";
import { CalendarDays, Check, Loader2, MessageSquare } from "lucide-react";

const BUCKET_LABELS: Record<DateBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  tomorrow: "Tomorrow",
  this_week: "Next 7 days",
  later: "Later",
  undated: "No date",
};

/** Only `overdue` is a problem rather than a plan, so only it carries alarm. */
const BUCKET_TONES: Record<DateBucket, string> = {
  overdue: "text-red-600",
  today: "text-slate-900",
  tomorrow: "text-slate-900",
  this_week: "text-slate-500",
  later: "text-slate-400",
  undated: "text-slate-400",
};

const PRIORITY_STYLES: Record<number, string> = {
  1: "border-red-200 bg-red-50 text-red-700",
  2: "border-amber-200 bg-amber-50 text-amber-700",
  3: "border-sky-200 bg-sky-50 text-sky-700",
  4: "border-slate-200 bg-slate-50 text-slate-400",
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * The exact date, spelled out.
 *
 * Deliberately not "in 3 days" here — the bucket heading already says roughly
 * when, so repeating it relatively adds nothing. The reader who has scrolled to
 * a day wants to know which day.
 */
function formatExactDue(iso: string, now: Date) {
  const due = startOfDay(new Date(iso));
  const sameYear = due.getFullYear() === now.getFullYear();
  return formatDateWithOptions(due, {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
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

interface UpcomingViewProps {
  tasks: UnifiedTask[];
  currentUserId: string | null;
}

export function UpcomingView({ tasks, currentUserId }: UpcomingViewProps) {
  const router = useRouter();
  const [busyKey, setBusyKey] = React.useState<string | null>(null);
  const [mineOnly, setMineOnly] = React.useState(false);
  const [showUndated, setShowUndated] = React.useState(false);

  const [data, setData] = React.useState(tasks);
  React.useEffect(() => setData(tasks), [tasks]);

  // One clock for the whole render, so two rows cannot land in different
  // buckets because they were measured either side of midnight.
  const now = React.useMemo(() => new Date(), []);

  const visible = React.useMemo(() => {
    const open = data.filter((task) => !task.is_checked);
    return mineOnly && currentUserId
      ? open.filter((task) => task.assigned_to?.id === currentUserId)
      : open;
  }, [data, mineOnly, currentUserId]);

  const buckets = React.useMemo(() => {
    const all = bucketTasksByDate(visible, now);
    // "No date" is the largest bucket in a studio that has not built the habit
    // yet, so it stays behind a toggle. Hiding it outright would be worse — a
    // date view that silently omits work is one nobody trusts.
    return showUndated ? all : all.filter((group) => group.bucket !== "undated");
  }, [visible, now, showUndated]);

  const undatedCount = React.useMemo(
    () => visible.filter((task) => !task.due_at).length,
    [visible]
  );

  const setDue = React.useCallback(
    (task: UnifiedTask, value: string) => {
      const dueAt = value ? new Date(`${value}T00:00:00`) : null;
      void (async () => {
        try {
          // Unwrapped inside each branch, not around a ternary: the two
          // actions return different payloads, and a union of them satisfies
          // neither overload.
          if (task.source === "checklist") {
            unwrapActionResult(await updateTask({ taskId: task.id, dueAt }));
          } else {
            unwrapActionResult(await setActivityDueDate({ activityId: task.id, dueAt }));
          }
          router.refresh();
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Couldn't change the date");
        }
      })();
    },
    [router]
  );

  const handleToggle = React.useCallback(
    (task: UnifiedTask) => {
      setBusyKey(task.key);
      setData((prev) =>
        prev.map((t) => (t.key === task.key ? { ...t, is_checked: !t.is_checked } : t))
      );

      void (async () => {
        try {
          if (task.source === "activity") {
            unwrapActionResult(await toggleActivityStatus({ activityId: task.id }));
          } else {
            unwrapActionResult(
              await toggleChecklist({ checklistId: task.id, isChecked: !task.is_checked })
            );
          }
          router.refresh();
        } catch (error) {
          setData(tasks);
          toast.error(error instanceof Error ? error.message : "Couldn't update the task");
        } finally {
          setBusyKey(null);
        }
      })();
    },
    [router, tasks]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-4">
        <button
          type="button"
          onClick={() => setMineOnly((v) => !v)}
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
            mineOnly
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-zinc-200 bg-white text-slate-500 hover:border-zinc-300"
          )}
        >
          Assigned to me
        </button>

        <button
          type="button"
          onClick={() => setShowUndated((v) => !v)}
          className={cn(
            "rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors",
            showUndated
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-zinc-200 bg-white text-slate-500 hover:border-zinc-300"
          )}
        >
          No date
          <span className={cn("ml-1.5", showUndated ? "text-slate-300" : "text-slate-400")}>
            {undatedCount}
          </span>
        </button>
      </div>

      {buckets.length === 0 ? (
        <div className="space-y-2 py-16 text-center">
          <p className="font-sans text-xs text-slate-400">Nothing scheduled.</p>
          <p className="font-sans text-[11px] text-slate-300">
            Give a task a due date and it shows up here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {buckets.map((group) => (
            <section key={group.bucket}>
              <div className="flex items-center gap-3 border-b border-slate-200 pb-2">
                <h3
                  className={cn(
                    "font-sans text-[11px] font-bold uppercase tracking-[0.22em]",
                    BUCKET_TONES[group.bucket]
                  )}
                >
                  {BUCKET_LABELS[group.bucket]}
                </h3>
                <div className="h-px flex-1 bg-transparent" />
                <span className="text-[10px] font-semibold text-slate-400">{group.tasks.length}</span>
              </div>

              <div className="mt-1.5 space-y-0.5">
                {group.tasks.map((task) => (
                  <div
                    key={task.key}
                    className="group flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggle(task)}
                      disabled={busyKey === task.key}
                      aria-label={task.label}
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"
                    >
                      {busyKey === task.key ? (
                        <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                      ) : task.mode === "FEEDBACK" ? (
                        <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-300 bg-white transition-all group-hover:border-slate-500">
                          {task.is_checked ? <Check className="h-2.5 w-2.5" /> : null}
                        </span>
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <span className="block font-sans text-[13px] leading-5 text-slate-800">
                        {task.label}
                      </span>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* Project is a chip here, not a heading: on a date view
                            the day is the frame and the project is the detail. */}
                        <Link
                          href={`/projects/${task.project_id}`}
                          className="text-[10px] font-medium text-slate-400 underline-offset-2 hover:text-slate-700 hover:underline"
                        >
                          {task.project_name}
                        </Link>

                        {task.phase_label ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            {task.phase_label}
                          </span>
                        ) : null}

                        {task.priority !== 4 ? (
                          <Badge
                            variant="outline"
                            className={cn("h-5 px-1.5 text-[10px] font-bold", PRIORITY_STYLES[task.priority])}
                          >
                            P{task.priority}
                          </Badge>
                        ) : null}

                        {task.due_at ? (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400">
                            <CalendarDays className="h-2.5 w-2.5" />
                            {formatExactDue(task.due_at, now)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {task.assigned_to ? (
                      <span
                        title={task.assigned_to.name}
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[9px] font-bold text-white"
                      >
                        {initialsOf(task.assigned_to.name)}
                      </span>
                    ) : null}

                    {/* Rescheduling is the one edit this screen is for, so the
                        date input sits on the row rather than behind a menu. */}
                    <Input
                      type="date"
                      defaultValue={toDateInputValue(task.due_at)}
                      onChange={(event) => setDue(task, event.target.value)}
                      aria-label={`Due date for ${task.label}`}
                      className="mt-0.5 h-7 w-[132px] shrink-0 border-transparent bg-transparent text-[11px] opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100"
                    />
                    {task.due_at ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDue(task, "")}
                        className="mt-0.5 h-7 shrink-0 px-2 text-[10px] text-slate-400 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
