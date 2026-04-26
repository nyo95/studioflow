"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  addActivity, 
  updateActivityContent,
  toggleActivityStatus, 
  deleteActivity,
  deferActivity
} from "@/actions/phase-actions";
import { Loader2, Plus, Trash2, CheckCircle2, Circle, MessageSquare, ArrowRightCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Role, PhaseName } from "@/generated/prisma";
import { usePhaseLive, Activity } from "@/ui_engine";
import { unwrapActionResult } from "@/lib/result";
import { ActivityListSorted } from "@/components/activity-list-sorted";

interface ActivityManagerProps {
  revisionId: string;
  isLocked: boolean;
  phaseStatus: string;
  phaseName: PhaseName;
  userId: string;
  userRole: Role;
  canMutate: boolean;
}

export function ActivityManager({
  revisionId,
  isLocked,
  phaseStatus,
  phaseName,
  canMutate,
}: ActivityManagerProps) {
  const { activities: contextActivities, syncNow } = usePhaseLive();
  const [internalActivities, setInternalActivities] = useState(contextActivities);
  const isDoneStatus = (status: string) => status === "DONE" || status === "COMPLETED";
  
  // Sync internal state with Provider whenever Provider data changes
  useEffect(() => {
    setInternalActivities(contextActivities);
  }, [contextActivities]);

  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");

  const targetMode: "TODO" | "FEEDBACK" = phaseStatus.startsWith("ON_REVIEW") ? "FEEDBACK" : "TODO";
  const isEditable = !isLocked && canMutate;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || !isEditable) return;

    setLoading("adding");
    try {
      unwrapActionResult(await addActivity({ revisionId, content: newContent, mode: targetMode }));
      setNewContent("");
      // Trigger sync for immediate reflection
      void syncNow();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleToggle = async (id: string) => {
    if (!isEditable) return;
    setLoading(id);
    
    // Optimistic Toggle
    setInternalActivities(prev =>
      prev.map((a) =>
        a.id === id ? { ...a, status: isDoneStatus(a.status) ? "OPEN" : "COMPLETED" } : a
      )
    );

    try {
      unwrapActionResult(await toggleActivityStatus({ activityId: id }));
      void syncNow();
    } catch (error) {
      setInternalActivities(contextActivities);
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isEditable) return;
    if (!confirm("Are you sure you want to delete this?")) return;
    setLoading(id);
    
    // Optimistic Delete
    setInternalActivities(prev => prev.filter(a => a.id !== id));

    try {
      unwrapActionResult(await deleteActivity({ activityId: id }));
      void syncNow();
    } catch (error) {
      setInternalActivities(contextActivities);
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleDefer = async (id: string) => {
    if (loading) return;
    if (!confirm("Move this task to project scope? It will no longer block this phase submission.")) return;
    setLoading(`defer-${id}`);
    
    try {
      unwrapActionResult(await deferActivity({ activityId: id }));
      void syncNow();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const beginEdit = (activity: Activity) => {
    setEditingId(activity.id);
    setDraftContent(activity.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftContent("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!isEditable || !draftContent.trim()) return;
    setLoading(`edit-${id}`);
    
    // Optimistic Update
    setInternalActivities(prev => prev.map(a => a.id === id ? { ...a, content: draftContent } : a));

    try {
      unwrapActionResult(await updateActivityContent({ activityId: id, content: draftContent }));
      cancelEdit();
      void syncNow();
    } catch (error) {
      setInternalActivities(contextActivities);
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Add Form */}
      {isEditable && (
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={`Add new ${targetMode.toLowerCase()} for ${phaseName.toLowerCase().replace(/_/g, " ")}...`}
            className="flex-1 bg-white border-zinc-200 focus-visible:ring-1 focus-visible:ring-slate-300 font-sans shadow-sm"
            disabled={loading === "adding"}
          />
          <Button 
            type="submit" 
            disabled={loading === "adding" || !newContent.trim()}
            className="bg-slate-900 hover:bg-slate-800 text-white font-sans font-medium px-5"
          >
            {loading === "adding" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
            Add
          </Button>
        </form>
      )}

      {/* Sorted Iteration Activities */}
      <ActivityListSorted
        activities={internalActivities}
        emptyMessage={`No discussed items for ${phaseName.toLowerCase().replace(/_/g, " ")} yet.`}
        renderItem={(activity) => (
          <div 
            key={activity.id}
            className={cn(
              "group flex items-center justify-between p-3 rounded-md border transition-all",
              isDoneStatus(activity.status)
                ? "bg-zinc-50 border-zinc-100 opacity-60" 
                : "bg-white border-zinc-200 shadow-sm hover:border-zinc-300"
            )}
          >
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleToggle(activity.id)}
                disabled={isLocked || loading === activity.id}
                className={cn(
                  "transition-colors",
                  !isEditable ? "cursor-default" : "cursor-pointer"
                )}
              >
                {activity.mode === "TODO" ? (
                  isDoneStatus(activity.status) ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
                  )
                ) : (
                  <MessageSquare className="w-4 h-4 mt-0.5 text-amber-500" />
                )}
              </button>
              {editingId === activity.id ? (
                <Input
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  className="h-8 min-w-[280px] border-slate-200"
                  autoFocus
                  disabled={loading === `edit-${activity.id}`}
                />
              ) : (
                <span className={cn(
                  "text-sm font-sans",
                  isDoneStatus(activity.status) && "line-through text-slate-500"
                )}>
                  {activity.content}
                </span>
              )}
            </div>

            {isEditable && (
              <div className={cn(
                "flex items-center gap-1 transition-opacity",
                editingId === activity.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}>
                {editingId === activity.id ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaveEdit(activity.id)}
                      className="h-8 border-zinc-200 text-xs px-2"
                    >
                      {loading === `edit-${activity.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={cancelEdit}
                      className="h-8 text-xs text-slate-500 px-2"
                    >
                      Cancel
                    </Button>
                  </>
                ) : (
                  <>
                    {activity.mode === "TODO" && isEditable && (
                      <button
                        type="button"
                        onClick={() => handleDefer(activity.id)}
                        disabled={loading === `defer-${activity.id}`}
                        title="Defer to project level"
                        className="p-1 text-slate-300 hover:text-slate-900 transition-colors"
                      >
                        {loading === `defer-${activity.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightCircle className="w-4 h-4" />}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(activity.id)}
                      disabled={loading === activity.id}
                      className="p-1 text-slate-300 hover:text-red-600 transition-colors"
                    >
                      {loading === activity.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      />

    </div>
  );
}
