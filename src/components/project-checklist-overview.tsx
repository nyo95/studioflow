"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toggleChecklist, syncProjectChecklists } from "@/app/actions";
import { cn } from "@/lib/utils";
import { CheckCircle2, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Heading } from "@/ui_engine";

interface ChecklistItem {
  id: string;
  label: string;
  completed: boolean;
  phase_id: string | null;
}

interface ProjectChecklistOverviewProps {
  projectId: string;
  checklists: ChecklistItem[];
  canEdit: boolean;
}

export function ProjectChecklistOverview({
  projectId,
  checklists,
  canEdit,
}: ProjectChecklistOverviewProps) {
  const router = useRouter();

  // Sort checklists to keep UI stable
  const sortedChecklists = [...checklists].sort((a, b) => a.label.localeCompare(b.label));

  React.useEffect(() => {
    // We keep the sync logic to ensure global templates are loaded
    syncProjectChecklists(projectId).then(() => {
      router.refresh();
    }).catch(console.error);
  }, [projectId, router]);

  async function handleToggle(id: string, current: boolean) {
    if (!canEdit) return;
    try {
      await toggleChecklist(id, !current);
      router.refresh();
    } catch (error) {
      console.error("Failed to toggle checklist:", error);
    }
  }

  return (
    <Card className="border-slate-200 bg-white shadow-sm overflow-hidden rounded-lg">
      <div className="border-b border-slate-100 bg-slate-50/30 p-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Heading level={4}>Project-Wide Items</Heading>
            <Heading variant="uiMeta" level={6} className="opacity-80">
              Global Checklist
            </Heading>
          </div>
        </div>
      </div>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          {sortedChecklists.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <div className="mb-3 rounded-full bg-slate-50 p-3 text-slate-300">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-slate-600">No global project checklists configured.</p>
              <p className="text-xs text-slate-400 mt-1">Global items appear here when added to the Project Engine templates.</p>
            </div>
          ) : (
            sortedChecklists.map((item) => (
              <div
                key={item.id}
                onClick={() => handleToggle(item.id, item.completed)}
                className={cn(
                  "group flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-slate-50",
                  !canEdit && "pointer-events-none opacity-80"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-md border transition-all",
                      item.completed
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white group-hover:border-slate-400"
                    )}
                  >
                    {item.completed && <Check className="h-3.5 w-3.5" />}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium transition-all",
                      item.completed ? "text-slate-400 line-through" : "text-slate-700"
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
