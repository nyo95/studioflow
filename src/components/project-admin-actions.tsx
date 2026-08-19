"use client";

import { useTransition } from "react";
import { Button } from "@/ui_engine";
import { completeProject } from "@/actions/project-actions";
import { CheckCircle2, Loader2 } from "lucide-react";
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
} from "@/ui_engine";

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
    // No wrapper card, icon tile, heading or divider. This component renders a
    // single button and already sits inside an ActionSidebarSection titled
    // "Admin"; the old chrome nested a card in a card and labelled the same
    // thing three times ("Admin Diagnostics" / "Admin Actions" / "Manual
    // project lifecycle management").
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
  );
}
