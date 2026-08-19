"use client";

import { useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { undoAction } from "@/actions/audit-actions";
import { unwrapActionResult } from "@/lib/result";
import { Button } from "@/ui_engine";
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

interface UndoButtonProps {
  logId: string;
  actionLabel: string;
  disabled?: boolean;
}

export function UndoButton({ logId, actionLabel, disabled = false }: UndoButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleUndo() {
    startTransition(async () => {
      try {
        unwrapActionResult(await undoAction({ logId }));
        toast.success("Action reverted.");
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : "Failed to revert action.");
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || isPending}
          className="h-8 text-amber-600 hover:text-amber-800 hover:bg-amber-100/50"
        >
          {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
          Undo
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Undo this action?</AlertDialogTitle>
          <AlertDialogDescription>
            This will attempt to revert <strong>{actionLabel}</strong> using the audit trail.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleUndo} className="bg-amber-600 text-white hover:bg-amber-700">
            Confirm Undo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
