/**
 * DeleteConfirmDialog — reusable delete-confirmation AlertDialog.
 *
 * Replaces the boilerplate AlertDialog block repeated across BrandDetailClient,
 * SupplierDetailClient, PartyDialog, etc.
 *
 * Usage:
 *   const [deleteTarget, setDeleteTarget] = React.useState<MyRow | null>(null);
 *   const [deleting, setDeleting] = React.useState(false);
 *
 *   <DeleteConfirmDialog
 *     open={!!deleteTarget}
 *     onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}
 *     title="Delete contact?"
 *     description={`${deleteTarget?.name} will be permanently removed.`}
 *     loading={deleting}
 *     onConfirm={handleDelete}
 *   />
 *
 * Rule: Always use this instead of inlining AlertDialog markup.
 * See docs/CRUD-CONVENTIONS.md §DeleteConfirmDialog.
 */
import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui_engine";
import { Loader2 } from "lucide-react";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dialog title, e.g. "Delete contact?" */
  title?: string;
  /** Body text describing what will be deleted */
  description?: React.ReactNode;
  /** Show loading spinner on the confirm button while async delete is in progress */
  loading?: boolean;
  /** Called when the user confirms deletion */
  onConfirm: () => void;
  /** Confirm button label (default: "Delete") */
  confirmLabel?: string;
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title = "Delete item?",
  description,
  loading = false,
  onConfirm,
  confirmLabel = "Delete",
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={loading}
            variant="destructive"
          >
            {loading ? (
              <Loader2 className="animate-spin" />
            ) : null}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
