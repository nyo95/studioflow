"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { completeProject } from "@/actions/project-actions";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { unwrapActionResult } from "@/lib/result";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ProjectAdminActionsProps {
  projectId: string;
  projectName: string;
  isCompleted: boolean;
}

export function ProjectAdminActions({
  projectId,
  projectName,
  isCompleted,
}: ProjectAdminActionsProps) {
  const [isPending, startTransition] = useTransition();

  const handleComplete = () => {
    startTransition(async () => {
      try {
        unwrapActionResult(await completeProject({ projectId }));
        toast.success(`Project "${projectName}" marked as completed.`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to complete project.";
        toast.error(message);
      }
    });
  };

  if (isCompleted) return null;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-900">Admin Actions</h4>
          <p className="text-xs text-slate-500">Manual project lifecycle management.</p>
        </div>
      </div>

      <div className="h-px w-full bg-slate-100" />

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button 
            variant="outline" 
            className="w-full justify-start border-emerald-100 bg-emerald-50/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            disabled={isPending}
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            Mark Project as Completed
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will set the project status to <strong>COMPLETED</strong>. 
              This action is intended for manual administrative closure when all phases are finished.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleComplete}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              Confirm Completion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
