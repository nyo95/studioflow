"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  addActivity, 
  updateActivityContent,
  toggleActivityStatus, 
  deleteActivity 
} from "@/app/actions";
import { Loader2, Plus, Trash2, CheckCircle2, Circle, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Role, PhaseName } from "@/generated/prisma";

interface Activity {
  id: string;
  content: string;
  mode: string;
  status: string;
}

interface ActivityManagerProps {
  revisionId: string;
  activities: Activity[];
  isLocked: boolean;
  phaseStatus: string;
  phaseName: PhaseName;
  userId: string;
  userRole: Role;
  canMutate: boolean;
}

export function ActivityManager({
  revisionId,
  activities,
  isLocked,
  phaseStatus,
  phaseName,
  userId,
  userRole,
  canMutate,
}: ActivityManagerProps) {
  const [newContent, setNewContent] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const router = useRouter();

  const targetMode: "TODO" | "FEEDBACK" = phaseStatus.startsWith("ON_REVIEW") ? "FEEDBACK" : "TODO";
  const isEditable = !isLocked && canMutate;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() || !isEditable) return;

    setLoading("adding");
    try {
      await addActivity(revisionId, newContent, targetMode, userId, userRole);
      setNewContent("");
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleToggle = async (id: string) => {
    if (!isEditable) return;
    setLoading(id);
    try {
      await toggleActivityStatus(id, userId, userRole);
      router.refresh();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isEditable) return;
    if (!confirm("Are you sure you want to delete this?")) return;
    setLoading(id);
    try {
      await deleteActivity(id, userId, userRole);
      router.refresh();
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
    try {
      await updateActivityContent(id, draftContent, userId, userRole);
      cancelEdit();
      router.refresh();
    } catch (error) {
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

      {/* Items List */}
      <div className="flex flex-col gap-2">
        {activities.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm italic font-sans border border-dashed border-zinc-200 rounded-lg">
            No activities yet.
          </div>
        ) : (
          activities.map((activity) => (
            <div 
              key={activity.id}
              className={cn(
                "group flex items-center justify-between p-3 rounded-md border transition-all",
                activity.status === "DONE" 
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
                    activity.status === "DONE" ? (
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
                    disabled={loading === `edit-${activity.id}`}
                  />
                ) : (
                  <span className={cn(
                    "text-sm font-sans",
                    activity.status === "DONE" && "line-through text-slate-500"
                  )}>
                    {activity.content}
                  </span>
                )}
              </div>

              {isEditable && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-colors">
                  {editingId === activity.id ? (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveEdit(activity.id)}
                        disabled={loading === `edit-${activity.id}`}
                        className="h-8 border-slate-200 text-xs"
                      >
                        {loading === `edit-${activity.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={cancelEdit}
                        className="h-8 text-xs text-slate-500"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => beginEdit(activity)}
                        className="h-8 px-2 text-xs text-slate-400 hover:text-slate-900"
                      >
                        Edit
                      </Button>
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
          ))
        )}
      </div>
    </div>
  );
}
