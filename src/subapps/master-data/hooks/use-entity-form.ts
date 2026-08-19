"use client";

/**
 * useEntityForm — centralized state for entity CRUD dialogs.
 * ============================================================================
 * Replaces the isEditing / isSaving / editable / canSave pattern that was
 * written by hand 7+ times across BrandDialog, ProductDialog, PartyDialog,
 * SupplierDetailClient, etc.
 *
 * The hook owns:
 *  - isEditing  — whether the form is in edit mode
 *  - isSaving   — whether a save is in flight
 *  - isDeleting — whether a delete is in flight
 *  - editable   — shorthand: isEditing && canManage
 *  - canSave    — caller-provided predicate (e.g. Boolean(form.name.trim()))
 *
 * Usage:
 *   const { isEditing, isSaving, editable, canSave, startEdit, save, stopSave } =
 *     useEntityForm({
 *       mode,
 *       canManage,
 *       canSaveCheck: () => Boolean(form.brand_name.trim()),
 *     });
 *
 * See docs/CRUD-CONVENTIONS.md §useEntityForm.
 */

import * as React from "react";

export type EntityFormMode = "CREATE" | "EDIT" | "VIEW";

interface UseEntityFormOptions {
  /** Dialog/sheet mode — CREATE starts in edit, EDIT/VIEW follow canManage */
  mode: EntityFormMode;
  /** Whether the current user has permission to mutate this entity */
  canManage: boolean;
  /**
   * Predicate that returns true when the form is valid enough to save.
   * Called synchronously on each render so it always reflects current state.
   */
  canSaveCheck: () => boolean;
}

export interface UseEntityFormReturn {
  isEditing: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  /** isEditing && canManage — use this to conditionally render inputs vs ReadValue */
  editable: boolean;
  /** Result of canSaveCheck() — use to disable the save button */
  canSave: boolean;
  /** Enter edit mode */
  startEdit: () => void;
  /** Cancel edit mode (no-op in CREATE) */
  cancelEdit: () => void;
  /** Call at the start of a save async operation */
  startSave: () => void;
  /** Call at the end of a save async operation (success or error) */
  stopSave: () => void;
  /** Call at the start of a delete async operation */
  startDelete: () => void;
  /** Call at the end of a delete async operation (success or error) */
  stopDelete: () => void;
  /** Manually set isEditing (escape hatch for complex reset flows) */
  setIsEditing: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useEntityForm({
  mode,
  canManage,
  canSaveCheck,
}: UseEntityFormOptions): UseEntityFormReturn {
  const [isEditing, setIsEditing] = React.useState(
    mode === "CREATE" || (mode === "EDIT" && canManage)
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // Sync when mode or canManage changes (e.g. dialog reopened with different props)
  React.useEffect(() => {
    setIsEditing(mode === "CREATE" || (mode === "EDIT" && canManage));
  }, [mode, canManage]);

  const editable = isEditing && canManage;
  const canSave = canSaveCheck();

  return {
    isEditing,
    isSaving,
    isDeleting,
    editable,
    canSave,
    startEdit: () => setIsEditing(true),
    cancelEdit: () => {
      if (mode !== "CREATE") setIsEditing(false);
    },
    startSave: () => setIsSaving(true),
    stopSave: () => setIsSaving(false),
    startDelete: () => setIsDeleting(true),
    stopDelete: () => setIsDeleting(false),
    setIsEditing,
  };
}
