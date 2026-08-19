"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { addProjectActivity } from "@/actions/project-actions";
import { updateActivityContent, toggleActivityStatus, deleteActivity } from "@/actions/phase-actions";
import { unwrapActionResult } from "@/lib/result";
import { PhaseName } from "@/generated/prisma";
import { Badge, Button, Heading, Input, SectionCard } from "@/ui_engine";
import { formatPhaseName } from "@/lib/project-progress";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Edit3, Loader2, Plus, Trash2 } from "lucide-react";
import { PhaseHeartbeatActivity } from "@/types/common";
import { useAppConfirm } from "@/hooks/use-app-confirm";

export interface ProjectTasksCardProps {
  projectId: string;
  canEdit: boolean;
  projectTodoActivities?: PhaseHeartbeatActivity[];
  deferredActivities?: PhaseHeartbeatActivity[];
  phases?: {
    id: string;
    name_enum: PhaseName;
    order_index: number;
    status_enum: string;
  }[];
}

/**
 * PROJECT TASKS — tier 3 of the project page: what needs doing.
 *
 * ============================================================================
 * WHY THIS IS ITS OWN CARD
 * ============================================================================
 * These are real, actionable items: project-level todos that belong to no
 * phase, plus tasks deferred out of a phase to keep it moving. They used to be
 * buried at the bottom of a card headed "PROJECT METADATA", underneath the
 * client name and the area in square metres.
 *
 * Metadata is reference data you read once; tasks are work you act on. Filing
 * the second under the first buried the only part of that card anyone needed
 * daily. The two are now separate cards in separate tiers.
 *
 * Behaviour is unchanged — handlers and markup moved verbatim from the old
 * ProjectOverviewForm. The one known wart carried over is the raw
 * a browser-native confirmation on delete, which the UX audit flagged; replacing it with the
 * styled AlertDialog is deliberately left as its own change.
 */
export function ProjectTasksCard({
  projectId,
  canEdit,
  projectTodoActivities = [],
  deferredActivities = [],
  phases,
}: ProjectTasksCardProps) {
  const router = useRouter();
  const [todos, setTodos] = React.useState<PhaseHeartbeatActivity[]>(projectTodoActivities);
  const [newTodoText, setNewTodoText] = React.useState("");
  const [addingTodo, setAddingTodo] = React.useState(false);
  const [todoLoadingId, setTodoLoadingId] = React.useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = React.useState<string | null>(null);
  const [todoEditText, setTodoEditText] = React.useState("");
  const appConfirm = useAppConfirm();

  React.useEffect(() => {
    setTodos(projectTodoActivities);
  }, [projectTodoActivities]);

  async function handleAddTodo(e: React.FormEvent) {
    e.preventDefault();
    if (!newTodoText.trim() || !canEdit) return;

    setAddingTodo(true);
    try {
      const result = unwrapActionResult(await addProjectActivity({
        projectId,
        content: newTodoText.trim(),
      }));
      setTodos(prev => [...prev, result as unknown as PhaseHeartbeatActivity]);
      setNewTodoText("");
      router.refresh();
    } catch (err) {
      console.error("Failed to add project todo:", err);
    } finally {
      setAddingTodo(false);
    }
  }

  async function handleToggleTodo(id: string, currentStatus: string) {
    if (!canEdit) return;
    setTodoLoadingId(id);

    const nextStatus = currentStatus === "COMPLETED" || currentStatus === "DONE" ? "OPEN" : "COMPLETED";
    setTodos(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));

    try {
      unwrapActionResult(await toggleActivityStatus({ activityId: id }));
      router.refresh();
    } catch (err) {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, status: currentStatus } : t));
      console.error("Failed to toggle todo status:", err);
    } finally {
      setTodoLoadingId(null);
    }
  }

  async function handleDeleteTodo(id: string) {
    if (!canEdit) return;
    if (!(await appConfirm.confirm({
      title: "Delete this project task?",
      description: "This task will be permanently deleted.",
      confirmLabel: "Delete task",
    }))) return;
    setTodoLoadingId(id);

    setTodos(prev => prev.filter(t => t.id !== id));

    try {
      unwrapActionResult(await deleteActivity({ activityId: id }));
      router.refresh();
    } catch (err) {
      router.refresh();
      console.error("Failed to delete todo:", err);
    } finally {
      setTodoLoadingId(null);
    }
  }

  async function handleSaveEditTodo(id: string) {
    if (!canEdit || !todoEditText.trim()) return;
    setTodoLoadingId(id);

    setTodos(prev => prev.map(t => t.id === id ? { ...t, content: todoEditText.trim() } : t));

    try {
      unwrapActionResult(await updateActivityContent({ activityId: id, content: todoEditText.trim() }));
      setEditingTodoId(null);
      setTodoEditText("");
      router.refresh();
    } catch (err) {
      router.refresh();
      console.error("Failed to update todo content:", err);
    } finally {
      setTodoLoadingId(null);
    }
  }

  return (
    <SectionCard>
      {/* Project Todos Section */}
      <div>
        {/* Icon tile and explanatory subtitle removed. The tile was decoration;
            the subtitle ("General todo items not associated with any phase")
            said what the placeholder in the input already says. */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <Heading level={4}>Project Tasks</Heading>

          {canEdit && (
            <form onSubmit={handleAddTodo} className="flex gap-2 flex-1 md:max-w-xs">
              <Input
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="Add new project todo..."
                className="h-9 bg-white border-slate-200 focus-visible:ring-1 focus-visible:ring-slate-300 font-sans shadow-sm text-xs rounded-lg"
                disabled={addingTodo}
              />
              <Button 
                type="submit" 
                disabled={addingTodo || !newTodoText.trim()}
                className="h-9 bg-slate-900 hover:bg-slate-800 text-white font-sans text-xs font-semibold px-4 rounded-lg shadow-sm shrink-0"
              >
                {addingTodo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                Add
              </Button>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          {todos.map((todo) => (
            <div 
              key={todo.id}
              className={cn(
                "flex items-center justify-between p-4 rounded-xl transition-all duration-300 border",
                todo.status === "COMPLETED" || todo.status === "DONE"
                  ? "bg-slate-50/30 border-slate-100/80 opacity-60"
                  : "bg-slate-50/50 border-slate-100 hover:bg-white hover:shadow-sm"
              )}
            >
              <div className="flex items-center gap-3 flex-1 mr-4">
                <button
                  type="button"
                  onClick={() => handleToggleTodo(todo.id, todo.status)}
                  disabled={!canEdit || todoLoadingId === todo.id}
                  className={cn(
                    "shrink-0 transition-colors",
                    !canEdit ? "cursor-default" : "cursor-pointer"
                  )}
                >
                  {todo.status === "COMPLETED" || todo.status === "DONE" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300 hover:text-slate-500" />
                  )}
                </button>
                
                {editingTodoId === todo.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={todoEditText}
                      onChange={(e) => setTodoEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEditTodo(todo.id);
                        if (e.key === "Escape") setEditingTodoId(null);
                      }}
                      className="h-8 border-slate-200 text-sm py-1 flex-1 font-sans focus-visible:ring-1 focus-visible:ring-slate-300 bg-white"
                      autoFocus
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleSaveEditTodo(todo.id)}
                      className="h-8 bg-slate-900 text-white font-sans text-xs font-semibold px-3"
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingTodoId(null)}
                      className="h-8 text-xs text-slate-400 px-2 font-sans hover:text-slate-600"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <span 
                    onDoubleClick={() => {
                      if (canEdit) {
                        setEditingTodoId(todo.id);
                        setTodoEditText(todo.content);
                      }
                    }}
                    className={cn(
                      "text-sm font-sans text-slate-700 break-words",
                      (todo.status === "COMPLETED" || todo.status === "DONE") && "line-through opacity-60"
                    )}
                  >
                    {todo.content}
                  </span>
                )}
              </div>

              {canEdit && editingTodoId !== todo.id && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTodoId(todo.id);
                      setTodoEditText(todo.content);
                    }}
                    className="p-1 text-slate-300 hover:text-slate-600 transition-colors"
                    title="Edit task"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTodo(todo.id)}
                    disabled={todoLoadingId === todo.id}
                    className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                    title="Delete task"
                  >
                    {todoLoadingId === todo.id ? <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* One line. The second ("Use the input above to add a new task")
              narrated an input the user can already see. */}
          {todos.length === 0 && (
            <p className="py-6 text-center font-sans text-xs text-slate-400">No project tasks yet.</p>
          )}
        </div>
      </div>

      {/* Deferred Tasks Section */}
      {deferredActivities.length > 0 && (
        <div className="mt-12 pt-8 border-t border-slate-100">
          <Heading level={4} className="mb-6">Deferred</Heading>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {deferredActivities.map((activity) => {
              const originPhase = phases?.find(p => p.id === activity.phase_id);
              return (
                <div 
                  key={activity.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100 group hover:bg-white hover:shadow-md transition-all duration-300"
                >
                  <div className="flex items-center gap-3">
                    {activity.status === "DONE" || activity.status === "COMPLETED" ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-300 group-hover:text-amber-400 shrink-0 transition-colors" />
                    )}
                    <span className={cn(
                      "text-sm font-sans text-slate-700",
                      (activity.status === "DONE" || activity.status === "COMPLETED") && "line-through opacity-50"
                    )}>
                      {activity.content}
                    </span>
                  </div>
                  
                  {originPhase && (
                    <Badge variant="outline" className="text-[9px] bg-white border-slate-200 text-slate-400 font-bold px-2 py-0.5 whitespace-nowrap">
                      Phase {formatPhaseName(originPhase.name_enum)}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {appConfirm.dialog}
    </SectionCard>
  );
}
