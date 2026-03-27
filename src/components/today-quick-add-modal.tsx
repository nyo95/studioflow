"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { addActivity } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ActivePhase {
  phaseId: string;
  activeRevisionId?: string; // Add this
  phaseName: string;
}

interface ActiveProject {
  projectId: string;
  projectName: string;
  phases: ActivePhase[];
}

interface TodayQuickAddModalProps {
  projects: ActiveProject[];
}

export function TodayQuickAddModal({ projects }: TodayQuickAddModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState("");
  const [taskName, setTaskName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedProject = projects.find((project) => project.projectId === selectedProjectId);
  const availablePhases = selectedProject?.phases ?? [];
  const selectedPhase = availablePhases.find((p) => p.phaseId === selectedPhaseId);

  function handleProjectChange(value: string) {
    setSelectedProjectId(value);
    setSelectedPhaseId("");
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    setSelectedProjectId("");
    setSelectedPhaseId("");
    setTaskName("");
    setError(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      handleClose();
      return;
    }

    setOpen(true);
  }

  function handleSubmit() {
    if (!selectedPhaseId) {
      setError("Please select a phase.");
      return;
    }

    if (!selectedPhase?.activeRevisionId) {
      setError("This phase has no active iteration.");
      return;
    }

    const trimmedTaskName = taskName.trim();
    if (!trimmedTaskName) {
      setError("Task name cannot be empty.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        // userId and userRole are retrieved via session on the server action getActorSession()
        await addActivity(selectedPhase.activeRevisionId!, trimmedTaskName, "TODO", "", "STAFF");
        router.refresh();
        handleClose();
      } catch (err) {
        console.error("Failed to add task:", err);
        setError("Failed to add task. You may not have permission for this phase.");
      }
    });
  }

  return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          className="h-10 rounded-md bg-slate-900 px-5 font-sans font-bold tracking-wide text-white shadow-sm hover:bg-slate-800"
          title="Quick Add Task"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </DialogTrigger>
      <DialogContent className="border-slate-200 bg-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl font-bold text-slate-900">
            Quick Add Task
          </DialogTitle>
          <p className="font-sans text-xs text-slate-400">
            Add a new todo to any active project phase iteration.
          </p>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-4">
          <div className="space-y-1.5">
            <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Project
            </label>
            <Select value={selectedProjectId} onValueChange={handleProjectChange}>
              <SelectTrigger className="h-10 border-slate-200 bg-slate-50 font-sans text-sm text-slate-700">
                <SelectValue placeholder="Select project..." />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.projectId} value={project.projectId}>
                    {project.projectName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Phase
            </label>
            <Select
              value={selectedPhaseId}
              onValueChange={(value) => {
                setSelectedPhaseId(value);
                setError(null);
              }}
              disabled={!selectedProjectId}
            >
              <SelectTrigger className="h-10 border-slate-200 bg-slate-50 font-sans text-sm text-slate-700 disabled:opacity-40">
                <SelectValue
                  placeholder={selectedProjectId ? "Select phase..." : "Select a project first"}
                />
              </SelectTrigger>
              <SelectContent>
                {availablePhases.map((phase) => (
                  <SelectItem key={phase.phaseId} value={phase.phaseId}>
                    {phase.phaseName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="font-sans text-[10px] font-bold uppercase tracking-widest text-slate-500">
              Todo Name
            </label>
            <input
              type="text"
              value={taskName}
              onChange={(event) => {
                setTaskName(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleSubmit();
                }
              }}
              placeholder="e.g. Update layout based on client notes..."
              disabled={isPending}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 font-sans text-sm text-slate-700 placeholder:text-slate-300 focus:border-slate-400 focus:outline-none disabled:opacity-50"
            />
          </div>

          {error ? <p className="text-xs font-medium text-rose-500">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={isPending}
              className="h-9 rounded-lg text-xs font-semibold uppercase tracking-widest text-slate-500"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending || !selectedPhaseId || !taskName.trim()}
              className="h-9 rounded-lg bg-slate-900 px-6 text-xs font-bold uppercase tracking-widest text-white hover:bg-slate-700 disabled:opacity-40"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Adding...
                </>
              ) : (
                "Add Todo"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
