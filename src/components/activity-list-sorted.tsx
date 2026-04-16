"use client";

import { useMemo } from "react";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Activity {
  id: string;
  content: string;
  status: string;
  mode: string;
  isUrgent?: boolean;
}

interface ActivityListSortedProps {
  activities: Activity[];
  renderItem: (activity: Activity) => React.ReactNode;
  emptyMessage?: string;
  className?: string;
}

export function ActivityListSorted({
  activities,
  renderItem,
  emptyMessage = "No activities yet.",
  className,
}: ActivityListSortedProps) {
  const isDone = (status: string) => status === "DONE" || status === "COMPLETED";

  const { ongoing, done } = useMemo(
    () => ({
      ongoing: activities.filter((activity) => !isDone(activity.status)),
      done: activities.filter((activity) => isDone(activity.status)),
    }),
    [activities]
  );

  if (activities.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-8 text-center justify-center text-sm text-slate-400">
        <CircleDashed className="h-4 w-4 shrink-0 text-slate-300" />
        <p className="text-xs font-medium text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      <Tabs defaultValue="ongoing" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-lg">
          <TabsTrigger 
            value="ongoing" 
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-slate-500 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]" />
              Ongoing ({ongoing.length})
            </div>
          </TabsTrigger>
          <TabsTrigger 
            value="completed" 
            className="text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-slate-500 data-[state=active]:bg-white data-[state=active]:text-emerald-600 data-[state=active]:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3" />
              Completed ({done.length})
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ongoing" className="mt-4 space-y-2">
          {ongoing.length > 0 ? (
            ongoing.map((activity) => <div key={activity.id}>{renderItem(activity)}</div>)
          ) : (
            <p className="px-1 py-4 text-center text-xs text-slate-400 italic">No ongoing activities.</p>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-2">
          {done.length > 0 ? (
            done.map((activity) => (
              <div key={activity.id} className="opacity-80 transition-opacity hover:opacity-100">
                {renderItem(activity)}
              </div>
            ))
          ) : (
            <p className="px-1 py-4 text-center text-xs text-slate-400 italic">No completed activities yet.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
