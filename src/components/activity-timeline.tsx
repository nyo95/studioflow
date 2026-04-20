"use client";

import { useRelativeTime } from "@/hooks/use-hydration";
import { buildActivitySentence, formatActionLabel } from "@/lib/activity-copy";

interface ActivityTimelineEntry {
  id: string;
  action: string;
  entity_type: string;
  created_at: Date | string;
  user: {
    name: string | null;
  } | null;
}

function RelativeTime({ value }: { value: Date | string }) {
  const relative = useRelativeTime(value, true);
  const absolute = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
  return <span title={absolute}>{relative || absolute}</span>;
}

export function ActivityTimeline({ logs }: { logs: ActivityTimelineEntry[] }) {
  return (
    <div className="space-y-4">
      {logs.map((log) => (
        <div key={log.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="h-2.5 w-2.5 rounded-full bg-slate-900" />
            <div className="mt-2 h-full w-px bg-slate-200" />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              <RelativeTime value={log.created_at} />
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {buildActivitySentence({
                actorName: log.user?.name || "Sistem",
                action: log.action,
                entityType: log.entity_type,
              })}
            </p>
            <p className="mt-1 text-xs text-slate-500">{formatActionLabel(log.action)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
