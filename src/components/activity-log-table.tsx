"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, EyeOff, RefreshCcw, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui_engine";
import { formatDateTime } from "@/core/utilities/datetime";
import { cn } from "@/lib/utils";
import { ActivityFilters, type ActivityFilterOption, type ActivityFilterState } from "@/components/activity-filters";
import { ActivityTimeline } from "@/components/activity-timeline";
import { UndoButton } from "@/components/undo-button";
import { useRelativeTime } from "@/hooks/use-hydration";
import { buildActivitySentence, formatActionLabel, humanizeEntityType } from "@/lib/activity-copy";

const UNDOABLE_ACTIONS = new Set([
  "ACTIVATE_PHASE",
  "SUBMIT_FOR_INTERNAL_REVIEW",
  "APPROVE_INTERNAL",
  "SUBMIT_FOR_CLIENT_REVIEW",
  "APPROVE_CLIENT_PHASE",
  "REJECT_PHASE_INTERNAL",
  "REJECT_PHASE_CLIENT",
  "REOPEN_PHASE",
  "COMPLETE_SUPERVISION_PHASE",
  "PROJECT_COMPLETED_MANUAL",
  "REVISION_OVERRIDE_ADMIN",
  "BYPASS_PHASE_TO_COMPLETED",
]);

interface ActivityLogEntry {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: Date | string;
  reverted_at: Date | string | null;
  user: {
    id?: string;
    name: string | null;
    role?: string | null;
    image: string | null;
  } | null;
  details: Record<string, unknown>;
}

interface ActivityLogTableProps {
  logs: ActivityLogEntry[];
  canUndo: boolean;
  filters: {
    users: ActivityFilterOption[];
    actions: ActivityFilterOption[];
    phases: ActivityFilterOption[];
  };
  initialFilterState: ActivityFilterState;
}

function detailsToText(details: Record<string, unknown>) {
  return Object.entries(details)
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join("\n");
}

function RelativeTime({ value }: { value: Date | string }) {
  const relative = useRelativeTime(value, true);
  const absolute = formatDateTime(value);
  return <span title={absolute}>{relative || absolute}</span>;
}

export function ActivityLogTable({
  logs,
  canUndo,
  filters,
  initialFilterState,
}: ActivityLogTableProps) {
  const router = useRouter();
  const [showTimeline, setShowTimeline] = useState(false);
  const [filterState, setFilterState] = useState(initialFilterState);

  useEffect(() => {
    const handle = setInterval(() => {
      router.refresh();
    }, 30000);

    return () => clearInterval(handle);
  }, [router]);

  const filteredLogs = useMemo(() => {
    const fromDate = filterState.dateFrom ? new Date(`${filterState.dateFrom}T00:00:00.000Z`) : null;
    const toDate = filterState.dateTo ? new Date(`${filterState.dateTo}T23:59:59.999Z`) : null;

    return logs.filter((log) => {
      const createdAt = new Date(log.created_at);
      const phaseId = typeof log.details.phase_id === "string" ? log.details.phase_id : null;

      if (filterState.userIds.length > 0 && (!log.user?.id || !filterState.userIds.includes(log.user.id))) return false;
      if (filterState.actions.length > 0 && !filterState.actions.includes(log.action)) return false;
      if (
        filterState.phaseIds.length > 0 &&
        !filterState.phaseIds.includes(String(phaseId ?? "")) &&
        !filterState.phaseIds.includes(log.entity_id)
      ) {
        return false;
      }
      if (fromDate && createdAt < fromDate) return false;
      if (toDate && createdAt > toDate) return false;
      return true;
    });
  }, [filterState, logs]);

  function exportCsv() {
    const header = ["Timestamp", "User", "Action", "Entity Type", "Entity ID", "Details"];
    const rows = filteredLogs.map((log) => [
      new Date(log.created_at).toISOString(),
      log.user?.name || "System",
      log.action,
      log.entity_type,
      log.entity_id,
      JSON.stringify(log.details),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `activity-center-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (logs.length === 0) {
    return <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm text-slate-500">No activity logs found yet.</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <ActivityFilters users={filters.users} actions={filters.actions} phases={filters.phases} value={filterState} onChange={setFilterState} />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.refresh()}>
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTimeline((current) => !current)}>
            {showTimeline ? <EyeOff className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
            {showTimeline ? "Table" : "Timeline"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {showTimeline ? (
        <ActivityTimeline logs={filteredLogs} />
      ) : (
        <div className="space-y-3 rounded-[var(--ui-radius-card,1.5rem)] border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
          {filteredLogs.map((log) => {
            const isReverted = Boolean(log.reverted_at);
            const detailsText = detailsToText(log.details);
            const allowUndo = canUndo && !isReverted && UNDOABLE_ACTIONS.has(log.action);
            const actorName = log.user?.name || "Sistem";
            const actorRole = log.user?.role || "SYSTEM";
            const summary = buildActivitySentence({
              actorName,
              action: log.action,
              entityType: log.entity_type,
            });

            return (
              <article
                key={log.id}
                className={cn(
                  "rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-colors",
                  isReverted && "border-amber-200 bg-amber-50/40",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <User className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">{actorName}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        {actorRole}
                      </span>
                      {isReverted ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Sudah dibatalkan
                        </span>
                      ) : null}
                    </div>

                    <p className="text-sm leading-relaxed text-slate-800">{summary}.</p>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-medium text-slate-600">
                        {formatActionLabel(log.action)}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
                        {humanizeEntityType(log.entity_type)}
                      </span>
                      <span className="truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-slate-500">
                        ID: {log.entity_id}
                      </span>
                      <span className="ml-auto text-slate-500">
                        <RelativeTime value={log.created_at} />
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <details>
                        <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-900">
                          {detailsText ? "Show technical detail" : "No extra detail"}
                        </summary>
                        {detailsText ? (
                          <pre className="mt-2 max-w-[560px] whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-[11px] text-slate-600">
                            {detailsText}
                          </pre>
                        ) : null}
                      </details>
                      {allowUndo ? (
                        <UndoButton logId={log.id} actionLabel={formatActionLabel(log.action)} />
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
