"use client";

import * as React from "react";
import { BookmarkPlus, Check, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
  Label,
} from "@/ui_engine";
import {
  deleteChecklistFilterView,
  saveChecklistFilterView,
} from "@/actions/checklist-filter-actions";
import { useAppConfirm } from "@/hooks/use-app-confirm";
import {
  UnsavedChangesPrompt,
  useUnsavedChangesGuard,
} from "@/hooks/use-unsaved-changes-guard";
import { unwrapActionResult } from "@/lib/result";
import type {
  ChecklistFilterQuery,
  ChecklistFilterViewData,
} from "@/types/checklist";

export function SavedChecklistFilters({
  initialViews,
  currentQuery,
  onApply,
}: {
  initialViews: ChecklistFilterViewData[];
  currentQuery: ChecklistFilterQuery;
  onApply: (query: ChecklistFilterQuery) => void;
}) {
  const [views, setViews] = React.useState(initialViews);
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const { confirm, dialog: confirmDialog } = useAppConfirm();

  React.useEffect(() => setViews(initialViews), [initialViews]);

  const saveGuard = useUnsavedChangesGuard({
    open: saveOpen,
    value: { name },
    onOpenChange: setSaveOpen,
  });
  const markSaveFilterPristine = saveGuard.markPristine;

  React.useEffect(() => {
    if (!saveOpen) return;
    const next = { name: "" };
    setName(next.name);
    markSaveFilterPristine(next);
  }, [saveOpen, markSaveFilterPristine]);

  const save = async () => {
    const normalizedName = name.trim();
    if (!normalizedName) return;
    setBusyId("save");
    try {
      const saved = unwrapActionResult(
        await saveChecklistFilterView({ name: normalizedName, query: currentQuery })
      );
      setViews((current) => {
        const withoutOld = current.filter((view) => view.id !== saved.id);
        return [...withoutOld, saved].sort((a, b) => a.name.localeCompare(b.name));
      });
      toast.success("Filter saved");
      setName("");
      saveGuard.closeAfterSave();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save the filter");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (view: ChecklistFilterViewData) => {
    const confirmed = await confirm({
      title: "Delete saved filter?",
      description: `“${view.name}” will be removed from your personal filter list.`,
      confirmLabel: "Delete filter",
    });
    if (!confirmed) return;

    setBusyId(view.id);
    try {
      unwrapActionResult(await deleteChecklistFilterView({ filterId: view.id }));
      setViews((current) => current.filter((item) => item.id !== view.id));
      toast.success("Filter deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't delete the filter");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <BookmarkPlus className="size-[var(--ui-icon-size-sm)]" />
            Saved filters
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Personal filters</DropdownMenuLabel>
          {views.length === 0 ? (
            <DropdownMenuItem disabled>No saved filters yet</DropdownMenuItem>
          ) : (
            views.map((view) => (
              <DropdownMenuSub key={view.id}>
                <DropdownMenuSubTrigger>{view.name}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => onApply(view.query)}>
                    <Check className="size-[var(--ui-icon-size-sm)]" />
                    Apply
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={busyId === view.id}
                    onClick={() => void remove(view)}
                    className="text-[var(--ui-change-before)]"
                  >
                    <Trash2 className="size-[var(--ui-icon-size-sm)]" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => saveGuard.handleOpenChange(true)}>
            <BookmarkPlus className="size-[var(--ui-icon-size-sm)]" />
            Save current filter…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saveOpen} onOpenChange={saveGuard.handleOpenChange}>
        <DialogContent className="sm:max-w-[var(--ui-dialog-width-sm)]">
          <DialogHeader className="pr-[var(--ui-dialog-header-close-clearance)]">
            <DialogTitle>Save current filter</DialogTitle>
            <DialogDescription>
              Give this combination a name so you can return to it later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-[calc(var(--ui-section-gap)/2)]">
            <Label htmlFor="checklist-filter-name">Filter name</Label>
            <Input
              id="checklist-filter-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void save();
                }
              }}
              maxLength={80}
              autoFocus
              placeholder="e.g. My overdue tasks"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={!name.trim() || busyId === "save"}
            >
              Save filter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnsavedChangesPrompt
        guard={saveGuard}
        description="This filter name has not been saved. Closing now will discard it."
      />
      {confirmDialog}
    </>
  );
}
