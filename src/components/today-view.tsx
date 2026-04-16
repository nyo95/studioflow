"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TodayTaskItem } from "@/components/today-task-item";
import { TodayInlineAdd } from "@/components/today-inline-add";
import { cn } from "@/lib/utils";

interface Task {
  id: string;
  content: string;
  status: string;
  mode: string;
  projectName: string;
  phaseName: string;
  isUrgent: boolean;
}

interface Phase {
  id: string;
  name: string;
  status: string;
  revisionId?: string;
  tasks: Task[];
}

interface Project {
  id: string;
  name: string;
  isUrgent: boolean;
  phases: Phase[];
}

interface TodayViewProps {
  projects: Project[];
}

type RenderItem = 
  | { type: "projectHeader"; id: string; projectId: string; name: string; isUrgent: boolean }
  | { type: "phaseHeader"; id: string; projectId: string; phaseName: string }
  | { type: "task"; id: string; projectId: string; activity: Task }
  | { 
      type: "inlineAdd"; 
      id: string; 
      projectId: string; 
      phase: { id: string; name: string; revisionId: string; status: string };
      mode: "TODO" | "FEEDBACK" 
    };

export function TodayView({ projects }: TodayViewProps) {
  const [activeTab, setActiveTab] = useState("open");
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());

  const toggleProject = (projectId: string) => {
    setCollapsedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const buildFlatList = (isDone: boolean) => {
    const list: RenderItem[] = [];

    projects.forEach((project) => {
      const projectPhases = project.phases.map(phase => ({
        ...phase,
        tasks: phase.tasks.filter(t => (t.status === "DONE" || t.status === "COMPLETED") === isDone)
      })).filter(phase => phase.tasks.length > 0);

      if (projectPhases.length === 0) return;

      // Project Header
      list.push({
        type: "projectHeader",
        id: `project-${project.id}`,
        projectId: project.id,
        name: project.name,
        isUrgent: project.isUrgent
      });

      if (!collapsedProjects.has(project.id)) {
        // Subtle Phase Headers and Tasks
        projectPhases.forEach((phase) => {
          // Phase Header
          list.push({
            type: "phaseHeader",
            id: `phase-${phase.id}`,
            projectId: project.id,
            phaseName: phase.name
          });

          // Tasks
          phase.tasks.forEach((task) => {
            list.push({
              type: "task",
              id: `task-${task.id}`,
              projectId: project.id,
              activity: task
            });
          });

          // Inline Add specifically for THIS phase
          if (!isDone && phase.revisionId) {
            list.push({
              type: "inlineAdd",
              id: `add-phase-${phase.id}`,
              projectId: project.id,
              phase: {
                  id: phase.id,
                  name: phase.name,
                  revisionId: phase.revisionId,
                  status: phase.status
              },
              mode: phase.status.startsWith("ON_REVIEW") ? "FEEDBACK" : "TODO"
            });
          }
        });
      }
    });

    return list;
  };

  const openList = buildFlatList(false);
  const doneList = buildFlatList(true);

  const renderFlatList = (items: RenderItem[]) => {
    return (
      <div className="flex flex-col animate-in fade-in duration-300">
        {items.map((item) => {
          switch (item.type) {
            case "projectHeader":
              const isCollapsed = collapsedProjects.has(item.projectId);
              return (
                <div 
                  key={item.id} 
                  className="mt-12 flex cursor-pointer items-center justify-between border-b border-slate-200 pb-2 first:mt-4 group/header select-none"
                  onClick={() => toggleProject(item.projectId)}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(
                        "h-2.5 w-2.5 transition-transform duration-200 text-slate-300 group-hover/header:text-slate-600",
                        !isCollapsed && "rotate-90"
                      )}
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                    <h3 className="flex items-center gap-2 font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-slate-900 transition-colors">
                      {item.name}
                      {item.isUrgent && (
                        <span className="flex items-center gap-1.5 ml-2">
                          <span className="text-red-600">â—</span>
                          <span className="text-red-600">URGENT</span>
                        </span>
                      )}
                    </h3>
                  </div>
                </div>
              );
            case "phaseHeader":
              return (
                <div key={item.id} className="mt-8 mb-2 pl-8 flex items-center gap-2 first:mt-2 animate-in fade-in duration-500">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {item.phaseName}
                  </span>
                  <div className="h-[1px] flex-1 bg-slate-50" />
                </div>
              );
            case "task":
              return (
                <div key={item.id} className="pl-8">
                  <TodayTaskItem
                    id={item.activity.id}
                    label={item.activity.content}
                    isChecked={item.activity.status === "DONE" || item.activity.status === "COMPLETED"}
                    mode={item.activity.mode}
                    isUrgent={item.activity.isUrgent}
                  />
                </div>
              );
            case "inlineAdd":
              return (
                <div key={item.id} className="pl-8 py-2">
                  <TodayInlineAdd
                    phases={[item.phase]}
                    mode={item.mode}
                    buttonLabel={`+ Add ${item.mode === "FEEDBACK" ? "feedback" : "todo"} to ${item.phase.name}...`}
                    placeholder={`+ Add ${item.mode === "FEEDBACK" ? "feedback" : "todo"} to ${item.phase.name}...`}
                    className="opacity-50 hover:opacity-100 transition-opacity"
                  />
                </div>
              );
            default:
              return null;
          }
        })}
      </div>
    );
  };

  return (
    <Tabs defaultValue="open" className="w-full" onValueChange={setActiveTab}>
      <TabsList className="mb-6 flex h-auto w-full justify-start gap-6 rounded-none border-b border-slate-100 bg-transparent p-0">
        <TabsTrigger 
          value="open" 
          className="rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 shadow-none transition-all data-[state=active]:border-slate-900 data-[state=active]:bg-transparent data-[state=active]:text-slate-900"
        >
          Open Tasks ({projects.reduce((acc, p) => acc + p.phases.reduce((acc2, ph) => acc2 + ph.tasks.filter(t => t.status !== "DONE" && t.status !== "COMPLETED").length, 0), 0)})
        </TabsTrigger>
        <TabsTrigger 
          value="done" 
          className="rounded-none border-b-2 border-transparent px-1 pb-3 pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 shadow-none transition-all data-[state=active]:border-slate-900 data-[state=active]:bg-transparent data-[state=active]:text-slate-900"
        >
          Completed
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="open" className="mt-0 focus-visible:ring-0">
        {openList.length > 0 ? (
          renderFlatList(openList)
        ) : (
          <p className="py-20 text-center font-sans text-xs text-slate-300 italic">No open tasks.</p>
        )}
      </TabsContent>
      
      <TabsContent value="done" className="mt-0 focus-visible:ring-0">
        {doneList.length > 0 ? (
          renderFlatList(doneList)
        ) : (
          <p className="py-20 text-center font-sans text-xs text-slate-300 italic">No completed tasks.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}

