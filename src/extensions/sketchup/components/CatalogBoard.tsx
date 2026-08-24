"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Plus, Settings2, Trash2, MoreHorizontal, BookMarked, ArrowLeftRight, Check, X, GripVertical, LayoutTemplate } from "lucide-react";
import { createScheduleTemplateItemFromEntryAction } from "@/extensions/schedule/actions/schedule-template-item-actions";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/ui_engine";
import { formatDateWithOptions } from "@/core/utilities/datetime";
import { getCroppedImg } from "@/lib/utils/image-utils";
import { cn } from "@/lib/utils";
import { TEXT_SIZE_BADGE, UI_ENGINE_TYPE_BODY, UI_ENGINE_TYPE_META } from "@/ui_engine/tokens/typography";
import { uploadLibraryImage } from "@/extensions/library/lib/upload-client";
import {
  addCatalogItemFromReuseAction,
  addManualCatalogItemAction,
  applyDefaultScheduleTemplateAction,
  cleanupEmptyCatalogItemsAction,
  resetCatalogAction,
  deleteCatalogItemAction,
  saveCatalogItemToLibraryAction,
  searchReusableCatalogItemsAction,
  applyCatalogItemSwapsAction,
  updateManualCatalogItemAction,
  updateSketchupFFEAction,
  updateSketchupMaterialAction,
} from "../actions/sketchup-actions";
import type {
  CatalogFieldKey,
  CatalogItem,
  CatalogItemPatch,
  CatalogReuseItem,
} from "../actions/sketchup-actions";
import { resolveCategoryLabel, CANONICAL_CATEGORY_LABELS } from "@/extensions/schedule/lib/category-labels";
import { useAppConfirm } from "@/hooks/use-app-confirm";

const FIELD_DEFS: { key: CatalogFieldKey; label: string }[] = [
  { key: "type", label: "Type" },
  { key: "brand", label: "Brand" },
  { key: "item_no", label: "Item No" },
  { key: "qty", label: "Qty" },
  { key: "color", label: "Color" },
  { key: "size", label: "Size" },
  { key: "finish", label: "Finishing" },
  { key: "unit_cost", label: "Unit Cost" },
  { key: "location", label: "Location" },
  { key: "url", label: "URL" },
  { key: "notes", label: "Notes" },
];

const DEFAULT_FIELDS: Record<CatalogFieldKey, boolean> = {
  type: true,
  brand: true,
  item_no: false,
  qty: false,
  color: false,
  size: false,
  finish: false,
  unit_cost: false,
  location: false,
  url: false,
  notes: false,
};

// Fields shown by default on a card when it has no per-item override.
const DEFAULT_ENABLED: CatalogFieldKey[] = FIELD_DEFS.filter(({ key }) => DEFAULT_FIELDS[key]).map(({ key }) => key);
const PLACEHOLDERS = ["", "—", "N/A", "PENDING", "DRAFT", "GENERIC", "CUSTOM", "[RESERVED]", "MANUAL ITEM"];

function realName(name: string | null): string | null {
  const value = (name || "").trim();
  return value && !PLACEHOLDERS.includes(value.toUpperCase()) ? value : null;
}

function formatRp(value: number | null): string {
  if (value == null) return "—";
  return `Rp ${new Intl.NumberFormat("id-ID").format(value)}`;
}

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function sameFields(left: CatalogFieldKey[], right: CatalogFieldKey[]) {
  return FIELD_DEFS.every(({ key }) => left.includes(key) === right.includes(key));
}

function fieldValue(item: CatalogItem, field: CatalogFieldKey): string {
  if (field === "type") return item.type_label || "";
  if (field === "brand") return item.brand || "";
  if (field === "item_no") return item.item_no || "";
  if (field === "qty") return item.qty?.toString() || "";
  if (field === "color") return item.color || "";
  if (field === "size") return item.size || "";
  if (field === "finish") return item.finish || "";
  if (field === "unit_cost") return item.unit_cost?.toString() || "";
  if (field === "location") return item.location || "";
  if (field === "url") return item.url || "";
  return item.notes || "";
}

function optimisticPatch(field: CatalogFieldKey, value: string | number | null): Partial<CatalogItem> {
  if (field === "type") return { type_label: value as string | null };
  if (field === "brand") return { brand: value as string | null };
  if (field === "item_no") return { item_no: value as string | null };
  if (field === "qty") return { qty: value as number | null };
  if (field === "color") return { color: value as string | null };
  if (field === "size") return { size: value as string | null };
  if (field === "finish") return { finish: value as string | null };
  if (field === "unit_cost") return { unit_cost: value as number | null };
  if (field === "location") return { location: value as string | null };
  if (field === "url") return { url: value as string | null };
  return { notes: value as string | null };
}

// Card field key → server patch key (they differ only for location).
function patchKeyFor(field: CatalogFieldKey): keyof CatalogItemPatch {
  return field === "location" ? "location_notes" : field;
}

// Inline-edit controller passed to the module-level EditableValue/DetailRow.
// These components MUST live at module scope (not inside CatalogBoard): if they
// were defined in the render body, every keystroke would create a brand-new
// component type, forcing React to unmount+remount the <input> — which re-runs
// autoFocus and snaps the caret to the end of the text on each character.
type EditController = {
  canEdit: boolean;
  editing: { id: string; field: CatalogFieldKey } | null;
  editValue: string;
  setEditValue: (value: string) => void;
  setEditing: (value: { id: string; field: CatalogFieldKey } | null) => void;
  startEdit: (item: CatalogItem, field: CatalogFieldKey) => void;
  commitEdit: (item: CatalogItem, field: CatalogFieldKey) => void;
  cancelEditRef: React.MutableRefObject<boolean>;
};

type PendingCatalogSwap = {
  aItemId: string;
  bItemId: string;
  aEntryId: string;
  bEntryId: string;
  aCode: string;
  bCode: string;
};

function EditableValue({ item, field, ctrl }: { item: CatalogItem; field: CatalogFieldKey; ctrl: EditController }) {
  const { canEdit, editing, editValue, setEditValue, setEditing, startEdit, commitEdit, cancelEditRef } = ctrl;
  const active = editing?.id === item.id && editing.field === field;
  const display = field === "unit_cost"
    ? formatRp(item.unit_cost)
    : field === "qty"
      ? item.qty != null ? `${item.qty}${item.unit ? ` ${item.unit}` : ""}` : "—"
      : fieldValue(item, field) || "—";

  if (!active) {
    if (field === "url" && item.url) {
      const href = safeExternalUrl(item.url);
      return (
        <span className={cn("catalog-url-value", TEXT_SIZE_BADGE)}>
          {href
            ? <a href={href} target="_blank" rel="noreferrer" title={item.url}>{item.url}</a>
            : <span title={item.url}>{item.url}</span>}
          {canEdit && (
            <button type="button" onClick={() => startEdit(item, field)}>
              Modify
            </button>
          )}
        </span>
      );
    }
    if (!canEdit) {
      return <span className={field === "notes" ? "catalog-notes-value" : undefined} style={{ fontSize: ".6875rem", textAlign: field === "notes" ? "left" : "right", color: "var(--ui-text-primary)" }}>{display}</span>;
    }
    return (
      <span
        className={field === "notes" ? "catalog-editable catalog-notes-value" : "catalog-editable"}
        onClick={() => startEdit(item, field)}
        title="Click to edit"
      >
        {display}
      </span>
    );
  }

  const shared = {
    autoFocus: true,
    value: editValue,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setEditValue(event.target.value),
    onBlur: () => commitEdit(item, field),
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelEditRef.current = true;
        setEditing(null);
        event.currentTarget.blur();
      }
      if (event.key === "Enter" && (field !== "notes" || !event.shiftKey)) {
        event.preventDefault();
        event.currentTarget.blur();
      }
    },
    className: "catalog-inline-input",
  };

  return field === "notes"
    ? <textarea {...shared} rows={3} />
    : <input {...shared} type={field === "qty" || field === "unit_cost" ? "number" : field === "url" ? "url" : "text"} min={field === "qty" || field === "unit_cost" ? 0 : undefined} step="any" />;
}

function DetailRow({ item, field, label, ctrl }: { item: CatalogItem; field: CatalogFieldKey; label: string; ctrl: EditController }) {
  return (
    <div className={field === "notes" ? "catalog-detail-row catalog-notes-row" : "catalog-detail-row"}>
      <span className="catalog-detail-label">{label}</span>
      <EditableValue item={item} field={field} ctrl={ctrl} />
    </div>
  );
}

export function CatalogBoard({
  projectId,
  projectName,
  year,
  materials,
  fixtures,
  canEdit = true,
  canDelete = true,
  canSaveToLibrary = false,
  canSyncSwap = false,
  codeManager,
}: {
  projectId: string;
  projectName: string;
  projectCode: string;
  location: string | null;
  year: number;
  materials: CatalogItem[];
  fixtures: CatalogItem[];
  canEdit?: boolean;
  canDelete?: boolean;
  canSaveToLibrary?: boolean;
  canSyncSwap?: boolean;
  codeManager?: React.ReactNode;
}) {
  const router = useRouter();
  const [materialItems, setMaterialItems] = React.useState(materials);
  const [fixtureItems, setFixtureItems] = React.useState(fixtures);
  const [fieldMenuId, setFieldMenuId] = React.useState<string | null>(null);
  const fieldMenuRef = React.useRef<HTMLDivElement | null>(null);
  const [adding, setAdding] = React.useState<"material" | "fixture" | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [savingLibId, setSavingLibId] = React.useState<string | null>(null);
  const [savingTemplateId, setSavingTemplateId] = React.useState<string | null>(null);
  const [bulkSwapEditing, setBulkSwapEditing] = React.useState(false);
  const [codeManagerOpen, setCodeManagerOpen] = React.useState(false);
  const [swapSourceId, setSwapSourceId] = React.useState<string | null>(null);
  const [pendingSwaps, setPendingSwaps] = React.useState<PendingCatalogSwap[]>([]);
  const [draggingItemId, setDraggingItemId] = React.useState<string | null>(null);
  const [dragTargetId, setDragTargetId] = React.useState<string | null>(null);
  const [applyingSwaps, setApplyingSwaps] = React.useState(false);
  const [cleaning, setCleaning] = React.useState(false);
  const [applyingTemplate, setApplyingTemplate] = React.useState(false);
  const [addCategory, setAddCategory] = React.useState<string>("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [addKind, setAddKind] = React.useState<"material" | "fixture">("material");
  const [addMode, setAddMode] = React.useState<"manual" | "reuse">("manual");
  const [fixtureCategoryDraft, setFixtureCategoryDraft] = React.useState("");
  const [reuseQuery, setReuseQuery] = React.useState("");
  const [reuseItems, setReuseItems] = React.useState<CatalogReuseItem[]>([]);
  const [selectedReuseOptionId, setSelectedReuseOptionId] = React.useState<string | null>(null);
  const [loadingReuse, setLoadingReuse] = React.useState(false);
  const [pendingFocusEntryId, setPendingFocusEntryId] = React.useState<string | null>(null);
  const appConfirm = useAppConfirm();
  const categoryStorageKey = `catalog_cats_${projectId}`;
  const [hiddenCategories, setHiddenCategories] = React.useState<Set<string>>(new Set());

  React.useEffect(() => setMaterialItems(materials), [materials]);
  React.useEffect(() => setFixtureItems(fixtures), [fixtures]);
  React.useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(categoryStorageKey) || "[]");
      if (Array.isArray(stored)) setHiddenCategories(new Set(stored));
    } catch {
      // New categories remain visible when storage cannot be read.
    }
  }, [categoryStorageKey]);

  // Dismiss the open "Card fields" popover on outside click or Escape. Clicks on
  // any card tool button are ignored so their own onClick handles toggling
  // (letting you switch the popover from one card to another).
  React.useEffect(() => {
    if (!fieldMenuId) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Element | null;
      if (!target) return;
      if (fieldMenuRef.current?.contains(target)) return;
      if (target.closest(".catalog-tool-btn")) return;
      setFieldMenuId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFieldMenuId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [fieldMenuId]);

  const allItems = React.useMemo(() => [...materialItems, ...fixtureItems], [materialItems, fixtureItems]);
  const pendingSwapByItemId = React.useMemo(() => {
    const previews = new Map<string, { nextCode: string; pair: PendingCatalogSwap }>();
    for (const swap of pendingSwaps) {
      previews.set(swap.aItemId, { nextCode: swap.bCode, pair: swap });
      previews.set(swap.bItemId, { nextCode: swap.aCode, pair: swap });
    }
    return previews;
  }, [pendingSwaps]);
  const pendingNeedsSketchupPull = React.useMemo(() => {
    const itemById = new Map(allItems.map((item) => [item.id, item]));
    return pendingSwaps.some((swap) =>
      itemById.get(swap.aItemId)?.source === "sketchup" ||
      itemById.get(swap.bItemId)?.source === "sketchup"
    );
  }, [allItems, pendingSwaps]);
  React.useEffect(() => {
    if (!pendingFocusEntryId) return;
    const target = document.getElementById(`catalog-entry-${pendingFocusEntryId}`);
    if (!target) return;
    target.scrollIntoView({ block: "center" });
    target.focus({ preventScroll: true });
    setPendingFocusEntryId(null);
  }, [allItems, pendingFocusEntryId]);

  const patchItem = React.useCallback((id: string, patch: Partial<CatalogItem>) => {
    setMaterialItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    setFixtureItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }, []);

  const revealCategory = React.useCallback((prefix?: string | null) => {
    const normalizedPrefix = prefix?.trim().toUpperCase();
    if (!normalizedPrefix) return;
    setHiddenCategories((current) => {
      if (!current.has(normalizedPrefix)) return current;
      const next = new Set(current);
      next.delete(normalizedPrefix);
      try {
        localStorage.setItem(categoryStorageKey, JSON.stringify([...next]));
      } catch {
        // Keep the category visible for the current session.
      }
      return next;
    });
  }, [categoryStorageKey]);

  const defaultEnabled = DEFAULT_ENABLED;
  const enabledFor = React.useCallback(
    (item: CatalogItem) => item.catalog_fields ?? defaultEnabled,
    [defaultEnabled]
  );

  const persistItem = React.useCallback(async (item: CatalogItem, patch: CatalogItemPatch) => {
    if (item.source === "schedule") {
      if (!item.option_id) return { error: "This schedule item has no editable option." };
      return updateManualCatalogItemAction(item.option_id, patch, projectId);
    }
    if (item.kind === "fixture") return updateSketchupFFEAction(item.id, patch, projectId);
    return updateSketchupMaterialAction(item.id, patch, projectId);
  }, [projectId]);

  const toggleItemField = async (item: CatalogItem, key: CatalogFieldKey) => {
    const current = enabledFor(item);
    const next = current.includes(key) ? current.filter((field) => field !== key) : [...current, key];
    const ordered = FIELD_DEFS.map(({ key: field }) => field).filter((field) => next.includes(field));
    const override = sameFields(ordered, defaultEnabled) ? null : ordered;
    patchItem(item.id, { catalog_fields: override });
    const result = await persistItem(item, { catalog_fields: override });
    if (result?.error) {
      toast.error(result.error);
      router.refresh();
    }
  };

  const [editing, setEditing] = React.useState<{ id: string; field: CatalogFieldKey } | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const cancelEditRef = React.useRef(false);

  const startEdit = (item: CatalogItem, field: CatalogFieldKey) => {
    cancelEditRef.current = false;
    setEditing({ id: item.id, field });
    setEditValue(fieldValue(item, field));
  };

  const commitEdit = async (item: CatalogItem, field: CatalogFieldKey) => {
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      return;
    }
    const trimmed = editValue.trim();
    let value: string | number | null = trimmed || null;
    if (field === "qty" || field === "unit_cost") {
      value = trimmed === "" ? null : Number(trimmed);
      if (value !== null && (!Number.isFinite(value) || value < 0)) {
        toast.error(`${field === "qty" ? "Qty" : "Unit Cost"} must be zero or a positive number.`);
        return;
      }
    }
    setEditing(null);
    patchItem(item.id, optimisticPatch(field, value));
    const result = await persistItem(item, { [patchKeyFor(field)]: value } as CatalogItemPatch);
    if (result?.error) {
      toast.error(result.error);
      router.refresh();
    }
  };

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [cropTargetId, setCropTargetId] = React.useState<string | null>(null);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedArea, setCroppedArea] = React.useState<Area | null>(null);
  const [saving, setSaving] = React.useState(false);

  const openPicker = (id: string) => {
    setCropTargetId(id);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const onFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
  };

  const saveCrop = async () => {
    const target = allItems.find((item) => item.id === cropTargetId);
    if (!cropSrc || !croppedArea || !target) return;
    setSaving(true);
    try {
      const blob = await getCroppedImg(cropSrc, croppedArea);
      if (!blob) throw new Error("Crop failed");
      const url = await uploadLibraryImage(blob, `covers/${Date.now()}-catalog.jpg`);
      const result = await persistItem(target, { image_url: url });
      if (result?.error) throw new Error(result.error);
      patchItem(target.id, { image_url: url });
      toast.success("Photo updated");
      setCropSrc(null);
      setCropTargetId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  const removeImage = async (item: CatalogItem) => {
    patchItem(item.id, { image_url: null });
    const result = await persistItem(item, { image_url: null });
    if (result?.error) {
      toast.error(result.error);
      router.refresh();
    }
  };

  const addItem = async (kind: "material" | "fixture", categoryPrefix?: string) => {
    setAdding(kind);
    const result = await addManualCatalogItemAction(projectId, kind, categoryPrefix ?? null);
    if (result?.error) {
      toast.error(result.error);
      setAdding(null);
      return false;
    } else {
      toast.success(`${kind === "material" ? "Material" : "Fixture"} added`);
      setPendingFocusEntryId("entryId" in result ? result.entryId : null);
      revealCategory("schedulePrefix" in result ? result.schedulePrefix : null);
      router.refresh();
    }
    setAdding(null);
    return true;
  };

  const addFromReuse = async () => {
    if (!selectedReuseOptionId) {
      toast.error("Choose a past item first.");
      return false;
    }
    setAdding(addKind);
    const result = await addCatalogItemFromReuseAction(projectId, selectedReuseOptionId);
    if (result?.error) {
      toast.error(result.error);
      setAdding(null);
      return false;
    }
    toast.success("Added from a past project.");
    setPendingFocusEntryId("entryId" in result ? result.entryId : null);
    revealCategory("schedulePrefix" in result ? result.schedulePrefix : null);
    setAdding(null);
    router.refresh();
    return true;
  };

  React.useEffect(() => {
    if (!addOpen || addMode !== "reuse") return;
    let cancelled = false;
    setLoadingReuse(true);
    const timer = window.setTimeout(async () => {
      const result = await searchReusableCatalogItemsAction(projectId, reuseQuery, addKind);
      if (cancelled) return;
      if (result.error) {
        setReuseItems([]);
        toast.error(result.error);
      } else {
        setReuseItems(result.items);
      }
      setLoadingReuse(false);
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [addKind, addMode, addOpen, reuseQuery, projectId]);

  React.useEffect(() => {
    setSelectedReuseOptionId(null);
    setReuseItems([]);
    setLoadingReuse(addOpen && addMode === "reuse");
  }, [addKind, addMode, addOpen]);

  const cleanupEmpties = async () => {
    if (!(await appConfirm.confirm({
      title: "Remove all empty placeholders?",
      description: "Items with no image, brand, type, or details will be removed. Items you have filled in will be kept.",
      confirmLabel: "Remove empty items",
    }))) return;
    setCleaning(true);
    const result = await cleanupEmptyCatalogItemsAction(projectId);
    if (result?.error) toast.error(result.error);
    else if (result.removed === 0) toast.success("No empty items to remove");
    else {
      toast.success(`Removed ${result.removed} empty item${result.removed === 1 ? "" : "s"}`);
      router.refresh();
    }
    setCleaning(false);
  };

  const applyDefaultTemplate = async () => {
    setApplyingTemplate(true);
    const result = await applyDefaultScheduleTemplateAction(projectId);
    if ("error" in result) {
      toast.error(result.error);
    } else if (result.noDefaultsConfigured) {
      toast.info("No default items or categories are configured. Set them up in Settings → Studio → Project Engine.");
    } else if ((result.createdItems?.length ?? 0) === 0 && result.createdCategories.length === 0) {
      toast.success("The schedule already matches the template. Nothing was added.");
    } else {
      const n = (result.createdItems?.length ?? 0) + result.createdCategories.length;
      toast.success(`Added ${n} default item${n === 1 ? "" : "s"}.`);
      router.refresh();
    }
    setApplyingTemplate(false);
  };

  const resetAll = async () => {
    if (!(await appConfirm.confirm({
      title: "Delete every Product Schedule item?",
      description: "This permanently deletes every card. SketchUp model files are not affected, and a fresh push from SketchUp will repopulate synced items.",
      confirmLabel: "Delete all items",
      requiredText: "DELETE ALL",
    }))) return;
    setCleaning(true);
    const result = await resetCatalogAction(projectId);
    if (result?.error) toast.error(result.error);
    else {
      toast.success(`Removed ${result.removed ?? 0} item(s). Schedule is empty.`);
      router.refresh();
    }
    setCleaning(false);
  };

  const startBulkSwapEdit = () => {
    setFieldMenuId(null);
    setEditing(null);
    setSwapSourceId(null);
    setPendingSwaps([]);
    setDraggingItemId(null);
    setDragTargetId(null);
    setBulkSwapEditing(true);
  };

  const cancelBulkSwapEdit = () => {
    if (applyingSwaps) return;
    setSwapSourceId(null);
    setPendingSwaps([]);
    setDraggingItemId(null);
    setDragTargetId(null);
    setBulkSwapEditing(false);
    toast.info("Code-swap draft discarded. StudioFlow was not changed.");
  };

  const canDraftSwapItem = (item: CatalogItem) =>
    Boolean(item.entry_id) &&
    (item.source === "schedule" || (item.kind === "material" && canSyncSwap));

  const getSwapDraftError = (source: CatalogItem, target: CatalogItem): string | null => {
    if (source.id === target.id) return "Drop onto a different card.";
    if (!source.entry_id || !target.entry_id) {
      return "Both cards must be linked to the Product Schedule.";
    }
    if (!canDraftSwapItem(source) || !canDraftSwapItem(target)) {
      return "This card can't be swapped from the browser.";
    }
    if (
      pendingSwaps.some(
        (swap) =>
          swap.aItemId === source.id ||
          swap.bItemId === source.id ||
          swap.aItemId === target.id ||
          swap.bItemId === target.id
      )
    ) {
      return "Each item can only be part of one pending swap.";
    }
    if (source.kind !== target.kind) {
      return "Materials and fixtures can't swap codes with each other.";
    }
    if (source.code.split("-")[0].toUpperCase() !== target.code.split("-")[0].toUpperCase()) {
      return "Items can only swap codes within the same category.";
    }
    if ((source.source === "sketchup") !== (target.source === "sketchup")) {
      return "A synced item can only swap with another synced item (or manual with manual).";
    }
    return null;
  };

  const addPendingSwap = (source: CatalogItem, target: CatalogItem) => {
    const error = getSwapDraftError(source, target);
    if (error) {
      toast.error(error);
      return false;
    }

    setPendingSwaps((current) => [
      ...current,
      {
        aItemId: source.id,
        bItemId: target.id,
        aEntryId: source.entry_id!,
        bEntryId: target.entry_id!,
        aCode: source.code,
        bCode: target.code,
      },
    ]);
    toast.success(`${source.code} ⇄ ${target.code} added to the browser draft.`);
    return true;
  };

  // Clicking the swap buttons remains the keyboard-accessible fallback for
  // the primary card-to-card drag interaction. Nothing is persisted until
  // the user reviews every red -> green preview and explicitly applies it.
  const handleSwapClick = (item: CatalogItem) => {
    if (!canDraftSwapItem(item)) {
      toast.error("This item isn't linked to a schedule entry yet — sync or edit it first.");
      return;
    }

    const pendingIndex = pendingSwaps.findIndex(
      (swap) => swap.aItemId === item.id || swap.bItemId === item.id
    );
    if (!swapSourceId && pendingIndex >= 0) {
      const removed = pendingSwaps[pendingIndex];
      setPendingSwaps((current) => current.filter((_, index) => index !== pendingIndex));
      toast.info(`${removed.aCode} ⇄ ${removed.bCode} removed from the draft.`);
      return;
    }

    if (!swapSourceId) {
      setSwapSourceId(item.id);
      toast.info(`Swap ${item.code} with another card in the same category. Esc cancels.`);
      return;
    }

    if (swapSourceId === item.id) {
      setSwapSourceId(null);
      return;
    }

    const source = allItems.find((candidate) => candidate.id === swapSourceId);
    if (!source?.entry_id) {
      setSwapSourceId(null);
      toast.error("The first item is no longer available. Choose it again.");
      return;
    }

    if (addPendingSwap(source, item)) setSwapSourceId(null);
  };

  const handleCardDragStart = (event: React.DragEvent<HTMLDivElement>, item: CatalogItem) => {
    if (
      !bulkSwapEditing ||
      applyingSwaps ||
      !canDraftSwapItem(item) ||
      pendingSwapByItemId.has(item.id)
    ) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-studioflow-catalog-item", item.id);
    event.dataTransfer.setData("text/plain", item.id);
    setSwapSourceId(null);
    setDraggingItemId(item.id);
    setDragTargetId(null);
  };

  const handleCardDragOver = (event: React.DragEvent<HTMLDivElement>, item: CatalogItem) => {
    if (!draggingItemId || draggingItemId === item.id) {
      setDragTargetId(null);
      return;
    }
    event.preventDefault();
    const source = allItems.find((candidate) => candidate.id === draggingItemId);
    event.dataTransfer.dropEffect = source && !getSwapDraftError(source, item) ? "move" : "none";
    setDragTargetId(item.id);
  };

  const handleCardDragLeave = (event: React.DragEvent<HTMLDivElement>, item: CatalogItem) => {
    const relatedTarget = event.relatedTarget as Node | null;
    if (relatedTarget && event.currentTarget.contains(relatedTarget)) return;
    if (dragTargetId === item.id) setDragTargetId(null);
  };

  const handleCardDrop = (event: React.DragEvent<HTMLDivElement>, target: CatalogItem) => {
    event.preventDefault();
    const sourceId =
      draggingItemId ||
      event.dataTransfer.getData("application/x-studioflow-catalog-item") ||
      event.dataTransfer.getData("text/plain");
    const source = allItems.find((candidate) => candidate.id === sourceId);
    if (!source) {
      toast.error("The dragged card is no longer available. Try again.");
    } else {
      addPendingSwap(source, target);
    }
    setDraggingItemId(null);
    setDragTargetId(null);
  };

  const handleCardDragEnd = () => {
    setDraggingItemId(null);
    setDragTargetId(null);
  };

  const applyPendingSwaps = async () => {
    if (pendingSwaps.length === 0) {
      toast.error("Add at least one swap before applying.");
      return;
    }

    setApplyingSwaps(true);
    const result = await applyCatalogItemSwapsAction(
      projectId,
      pendingSwaps.map((swap) => ({
        aEntryId: swap.aEntryId,
        bEntryId: swap.bEntryId,
      }))
    );

    if (!("success" in result) || !result.success) {
      toast.error(result.error || "Failed to apply the pending swaps.");
    } else {
      const appliedCount = result.applied ?? pendingSwaps.length;
      if (result.queued) {
        toast.success(
          `${appliedCount} swap${appliedCount === 1 ? "" : "s"} applied. Open SketchUp and Pull/Sync to execute the queued model-code changes.`
        );
      } else {
        toast.success(`${appliedCount} swap${appliedCount === 1 ? "" : "s"} applied.`);
      }
      setSwapSourceId(null);
      setPendingSwaps([]);
      setDraggingItemId(null);
      setDragTargetId(null);
      setBulkSwapEditing(false);
      router.refresh();
    }
    setApplyingSwaps(false);
  };

  React.useEffect(() => {
    if (!swapSourceId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSwapSourceId(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [swapSourceId]);

  const saveToLibrary = async (item: CatalogItem) => {
    if (!item.entry_id) {
      toast.error("This item isn't linked to a schedule entry yet.");
      return;
    }
    setSavingLibId(item.id);
    const result = await saveCatalogItemToLibraryAction(projectId, item.entry_id);
    if (result?.error) toast.error(result.error);
    else if (result?.reused) toast.success(`${item.code} is already in the Library — linked to it.`);
    else toast.success(`${item.code} saved to Library.`);
    setSavingLibId(null);
    router.refresh();
  };

  const saveAsTemplateItem = async (item: CatalogItem) => {
    if (!item.entry_id) return;
    setSavingTemplateId(item.id);
    try {
      const result = await createScheduleTemplateItemFromEntryAction(projectId, item.entry_id);
      if ("error" in result) toast.error(result.error);
      else toast.success(`${item.code} saved as a default item.`);
    } finally {
      setSavingTemplateId(null);
    }
  };

  const deleteItem = async (item: CatalogItem) => {
    if (!(await appConfirm.confirm({
      title: `Delete ${item.code}?`,
      description: "This removes the item from the catalog and Product Schedule.",
      confirmLabel: "Delete item",
    }))) return;
    setDeletingId(item.id);
    // optimistic removal
    setMaterialItems((current) => current.filter((entry) => entry.id !== item.id));
    setFixtureItems((current) => current.filter((entry) => entry.id !== item.id));
    const result = await deleteCatalogItemAction(projectId, {
      source: item.source,
      kind: item.kind,
      id: item.id,
      entryId: item.entry_id,
    });
    if (result?.error) {
      toast.error(result.error);
    } else if (result?.resyncRisk) {
      toast.success(`${item.code} deleted. Note: it may return on the next SketchUp sync if the material still exists there.`);
    } else {
      toast.success(`${item.code} deleted`);
    }
    setDeletingId(null);
    router.refresh();
  };
  const materialCategories = React.useMemo(() => {
    const groups = new Map<string, CatalogItem[]>();
    for (const item of materialItems) {
      const prefix = item.code.split("-")[0].toUpperCase();
      groups.set(prefix, [...(groups.get(prefix) ?? []), item]);
    }
    return Array.from(groups.entries()).sort((left, right) => left[0].localeCompare(right[0]));
  }, [materialItems]);

  // Category options for the "Add material" picker: existing board categories
  // first, then any canonical categories not yet present.
  const categoryOptions = React.useMemo(() => {
    const present = materialCategories.map(([prefix]) => prefix);
    const canonical = Object.keys(CANONICAL_CATEGORY_LABELS).filter((prefix) => !present.includes(prefix));
    return [...present, ...canonical.sort()];
  }, [materialCategories]);

  React.useEffect(() => {
    if (!addCategory && categoryOptions.length > 0) setAddCategory(categoryOptions[0]);
  }, [addCategory, categoryOptions]);

  const toggleCategory = (prefix: string) => {
    setHiddenCategories((current) => {
      const next = new Set(current);
      if (next.has(prefix)) next.delete(prefix);
      else next.add(prefix);
      try {
        localStorage.setItem(categoryStorageKey, JSON.stringify([...next]));
      } catch {
        // Keep the preference for the current session.
      }
      return next;
    });
  };

  const editCtrl: EditController = {
    canEdit: canEdit && !bulkSwapEditing,
    editing,
    editValue,
    setEditValue,
    setEditing,
    startEdit,
    commitEdit,
    cancelEditRef,
  };

  const renderCard = (item: CatalogItem) => {
    const visibleFields = enabledFor(item);
    const headline = realName(item.name);
    const menuOpen = fieldMenuId === item.id;
    const pendingPreview = pendingSwapByItemId.get(item.id) ?? null;
    const isSwapSource = swapSourceId === item.id;
    const isDragging = draggingItemId === item.id;
    const dragSource = draggingItemId
      ? allItems.find((candidate) => candidate.id === draggingItemId) ?? null
      : null;
    const isDragTarget = Boolean(dragSource && dragTargetId === item.id && !isDragging);
    const dragTargetError = isDragTarget && dragSource
      ? getSwapDraftError(dragSource, item)
      : null;
    const canDragCard =
      bulkSwapEditing &&
      !applyingSwaps &&
      canDraftSwapItem(item) &&
      !pendingPreview;
    return (
      <div
        key={`${item.source}:${item.id}`}
        id={item.entry_id ? `catalog-entry-${item.entry_id}` : undefined}
        tabIndex={item.entry_id ? -1 : undefined}
        draggable={canDragCard}
        onDragStart={(event) => handleCardDragStart(event, item)}
        onDragOver={(event) => handleCardDragOver(event, item)}
        onDragLeave={(event) => handleCardDragLeave(event, item)}
        onDrop={(event) => handleCardDrop(event, item)}
        onDragEnd={handleCardDragEnd}
        aria-grabbed={canDragCard ? isDragging : undefined}
        className={cn(
          "catalog-card",
          isSwapSource && "catalog-card-swap-armed",
          pendingPreview && "catalog-card-swap-pending",
          canDragCard && "catalog-card-swap-draggable",
          isDragging && "catalog-card-dragging",
          isDragTarget && !dragTargetError && "catalog-card-drop-valid",
          isDragTarget && dragTargetError && "catalog-card-drop-invalid"
        )}
      >
        {(canEdit || canDelete || canSaveToLibrary) && (
          <div className="no-print catalog-card-tools">
            {!bulkSwapEditing && canSaveToLibrary && (
              <button
                type="button"
                className="catalog-tool-btn catalog-tool-library"
                onClick={() => saveToLibrary(item)}
                disabled={savingLibId === item.id || !item.entry_id}
                aria-label={`Save ${item.code} to Library`}
                title="Save to Library"
              >
                <BookMarked aria-hidden="true" />
              </button>
            )}
            {!bulkSwapEditing && canSaveToLibrary && (
              <button
                type="button"
                className="catalog-tool-btn"
                onClick={() => saveAsTemplateItem(item)}
                disabled={savingTemplateId === item.id || !item.entry_id}
                aria-label={`Set ${item.code} as default template item`}
                title="Set as default item"
              >
                <LayoutTemplate aria-hidden="true" />
              </button>
            )}
            {bulkSwapEditing && canEdit && canDraftSwapItem(item) && (
              <button
                type="button"
                className={cn(
                  "catalog-tool-btn",
                  isSwapSource && "catalog-tool-swap-armed",
                  pendingPreview && "catalog-tool-swap-pending"
                )}
                onClick={() => handleSwapClick(item)}
                disabled={applyingSwaps || !item.entry_id}
                aria-label={
                  pendingPreview
                    ? `Remove pending swap for ${item.code}`
                    : isSwapSource
                      ? `Cancel ${item.code} selection`
                      : `Select ${item.code} for code swap`
                }
                title={
                  pendingPreview
                    ? `Remove ${pendingPreview.pair.aCode} ⇄ ${pendingPreview.pair.bCode} from draft`
                    : isSwapSource
                      ? "Cancel this selection"
                      : swapSourceId
                        ? "Use as swap partner"
                        : "Choose as first item"
                }
              >
                <ArrowLeftRight aria-hidden="true" />
              </button>
            )}
            {!bulkSwapEditing && canEdit && (
              <button
                type="button"
                className="catalog-tool-btn"
                onClick={() => setFieldMenuId(menuOpen ? null : item.id)}
                aria-label={`Choose fields for ${item.code}`}
                aria-expanded={menuOpen}
              >
                <Settings2 aria-hidden="true" />
              </button>
            )}
            {!bulkSwapEditing && canDelete && (
              <button
                type="button"
                className="catalog-tool-btn catalog-tool-delete"
                onClick={() => deleteItem(item)}
                disabled={deletingId === item.id}
                aria-label={`Delete ${item.code}`}
              >
                <Trash2 aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        {!bulkSwapEditing && canEdit && menuOpen && (
          <div className="no-print catalog-field-popover" ref={fieldMenuRef}>
            <span className="catalog-popover-title">Card fields</span>
            {FIELD_DEFS.map((definition) => (
              <label key={definition.key}>
                <input
                  type="checkbox"
                  checked={visibleFields.includes(definition.key)}
                  onChange={() => toggleItemField(item, definition.key)}
                />
                {definition.label}
              </label>
            ))}
            {item.catalog_fields && (
              <button type="button" onClick={() => toggleItemFieldInheritance(item)}>Use project default</button>
            )}
          </div>
        )}

        <div
          className="catalog-photo-hint"
          onClick={canEdit && !bulkSwapEditing ? () => openPicker(item.id) : undefined}
          style={canEdit ? undefined : { cursor: "default" }}
        >
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.image_url} alt={headline || item.code} draggable={false} />
          ) : (
            <span className="catalog-no-image">NO IMAGE</span>
          )}
          <span className={cn("catalog-code", pendingPreview && "catalog-code-pending")}>
            <span className={pendingPreview ? "catalog-code-before" : undefined}>{item.code}</span>
            {pendingPreview && (
              <>
                <span className="catalog-code-arrow" aria-hidden="true">→</span>
                <span className="catalog-code-after">{pendingPreview.nextCode}</span>
              </>
            )}
          </span>
          {canDragCard && (
            <span className={cn("no-print catalog-drag-label", UI_ENGINE_TYPE_META)}>
              <GripVertical aria-hidden="true" /> Drag to swap
            </span>
          )}
          {canEdit && !bulkSwapEditing && <span className="no-print catalog-photo-label">{item.image_url ? "Change photo" : "+ Add photo"}</span>}
          {canEdit && !bulkSwapEditing && item.image_url && (
            <button
              type="button"
              className="no-print catalog-remove"
              onClick={(event) => {
                event.stopPropagation();
                removeImage(item);
              }}
            >
              Remove
            </button>
          )}
        </div>

        {headline && <h3 className="catalog-card-title">{headline}</h3>}
        <div className="catalog-details">
          {FIELD_DEFS.map(({ key, label }) =>
            visibleFields.includes(key)
              ? <DetailRow key={key} item={item} field={key} label={label} ctrl={editCtrl} />
              : null
          )}
        </div>
      </div>
    );
  };

  const toggleItemFieldInheritance = async (item: CatalogItem) => {
    patchItem(item.id, { catalog_fields: null });
    const result = await persistItem(item, { catalog_fields: null });
    if (result?.error) {
      toast.error(result.error);
      router.refresh();
    }
  };

  const runningHeader = (pageNo?: number, total?: number) => (
    <div className="catalog-runhead">
      <span>{projectName}</span>
      <span>Catalog · {year}</span>
      <span>{pageNo && total ? `${pageNo} / ${total}` : ""}</span>
    </div>
  );

  const rail = (title: string) => (
    <div className="catalog-rail"><div>{title}</div></div>
  );

  const blocks: { title: string; items: CatalogItem[] }[] = [];
  if (fixtureItems.length > 0) blocks.push({ title: "Furniture Selection", items: fixtureItems });
  for (const [prefix, items] of materialCategories) {
    if (!hiddenCategories.has(prefix)) blocks.push({ title: resolveCategoryLabel(prefix, null), items });
  }

  const columns = 4;
  type CardRow = { title: string; items: CatalogItem[] };
  const rows: CardRow[] = [];
  for (const block of blocks) {
    for (let index = 0; index < block.items.length; index += columns) {
      rows.push({ title: block.title, items: block.items.slice(index, index + columns) });
    }
  }

  // Pagination: exactly one row (up to `columns` = 4 cards) per printed page.
  // Photos print in their tall portrait aspect (matching the on-screen viewer),
  // so a full row of 4 fills the A4-landscape page height on its own. One row
  // per page keeps every card whole — no height estimation, and no risk of a
  // row overflowing a `break-inside: avoid` sheet and leaving a blank page.
  const pageRows: CardRow[][] = rows.map((row) => [row]);

  const pages: { title: string; rows: CardRow[] }[][] = pageRows.map((rowsInPage) => {
    const groups: { title: string; rows: CardRow[] }[] = [];
    for (const row of rowsInPage) {
      const last = groups[groups.length - 1];
      if (last?.title === row.title) last.rows.push(row);
      else groups.push({ title: row.title, rows: [row] });
    }
    return groups;
  });

  return (
    <div>
      <style>{`
        .catalog-card{position:relative;display:flex;flex-direction:column;min-width:0;max-width:calc(var(--ui-container-max-width,1440px)/4)}
        .catalog-photo-hint{position:relative;margin-bottom:calc(var(--ui-section-gap)/1.4);aspect-ratio:4/5;background:var(--ui-canvas-bg);display:flex;align-items:center;justify-content:center;overflow:hidden;cursor:pointer}
        .catalog-photo-hint img{height:100%;width:100%;object-fit:cover}.catalog-no-image{font-size:.625rem;letter-spacing:.18em;color:var(--ui-text-tertiary)}
        .catalog-code{position:absolute;top:calc(var(--ui-section-gap)/2.5);right:calc(var(--ui-section-gap)/2.5);font-family:var(--font-mono,monospace);font-size:.6875rem;font-weight:700;color:var(--ui-text-primary);background:color-mix(in srgb,var(--ui-surface-bg) 90%,transparent);padding:calc(var(--ui-section-py)/10) calc(var(--ui-section-px)/3);border-radius:var(--ui-radius-action)}.catalog-code-pending{display:flex;align-items:center;gap:calc(var(--ui-section-gap)/4);border:var(--ui-border-width) solid var(--ui-change-after-border);background:var(--ui-surface-bg)}.catalog-code-before{color:var(--ui-change-before);text-decoration:line-through}.catalog-code-arrow{color:var(--ui-text-tertiary)}.catalog-code-after{color:var(--ui-change-after)}
        .catalog-photo-label,.catalog-remove{position:absolute;background:color-mix(in srgb,var(--ui-surface-bg) 90%,transparent);border-radius:var(--ui-radius-action);font-size:.625rem}.catalog-photo-label{left:calc(var(--ui-section-gap)/2.5);bottom:calc(var(--ui-section-gap)/2.5);padding:calc(var(--ui-section-py)/5) calc(var(--ui-section-px)/2);color:var(--ui-text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.1em;pointer-events:none;opacity:0}.catalog-remove{right:calc(var(--ui-section-gap)/2.5);bottom:calc(var(--ui-section-gap)/2.5);border:var(--ui-border-width) solid var(--ui-border-default);padding:calc(var(--ui-section-py)/10) calc(var(--ui-section-px)/3);color:var(--ui-change-before);cursor:pointer;opacity:0}
        .catalog-photo-hint:hover .catalog-photo-label,.catalog-photo-hint:hover .catalog-remove{opacity:1}.catalog-card-title{margin:0;font-family:var(--font-serif);font-size:.9375rem;font-weight:700;text-transform:uppercase;color:var(--ui-text-primary);line-height:1.2}.catalog-details{margin-top:calc(var(--ui-section-gap)/2.5)}
        .catalog-detail-row{display:flex;align-items:flex-start;justify-content:space-between;gap:calc(var(--ui-section-gap)/2);border-top:1px solid var(--ui-border-default);padding:calc(var(--ui-section-py)/4) 0}.catalog-notes-row{display:block}.catalog-detail-label{font-size:.5625rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ui-text-tertiary)}
        .catalog-editable{font-size:.6875rem;text-align:right;color:var(--ui-text-primary);cursor:text;border-bottom:1px dashed transparent;max-width:75%;overflow-wrap:anywhere;white-space:pre-wrap}.catalog-editable:hover{border-bottom-color:var(--ui-border-focus)}.catalog-notes-value{display:block;max-width:none;margin-top:calc(var(--ui-section-gap)/4);text-align:left;line-height:1.45}
        .catalog-url-value{display:flex;max-width:75%;align-items:center;justify-content:flex-end;gap:calc(var(--ui-section-gap)/4)}.catalog-url-value a{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ui-text-secondary);text-decoration:underline}.catalog-url-value button{border:0;background:transparent;color:var(--ui-text-tertiary);font:inherit;cursor:pointer}.catalog-url-value button:hover{color:var(--ui-text-primary)}
        .catalog-inline-input{font:inherit;font-size:.6875rem;color:var(--ui-text-primary);background:var(--ui-surface-bg);border:1px solid var(--ui-border-focus);border-radius:var(--ui-radius-action);padding:calc(var(--ui-section-py)/10) calc(var(--ui-section-px)/4);width:min(100%,9rem);text-align:right}.catalog-notes-row .catalog-inline-input{width:100%;margin-top:calc(var(--ui-section-gap)/4);text-align:left;resize:vertical}
        .catalog-card-tools{position:absolute;z-index:3;top:calc(var(--ui-section-gap)/2.5);left:calc(var(--ui-section-gap)/2.5);display:flex;gap:calc(var(--ui-section-gap)/4);opacity:0}.catalog-card:hover .catalog-card-tools,.catalog-card-tools:focus-within{opacity:1}
        .catalog-tool-btn{display:grid;place-items:center;width:calc(var(--ui-section-gap)*1.4);height:calc(var(--ui-section-gap)*1.4);border:var(--ui-border-width) solid var(--ui-border-default);border-radius:var(--ui-radius-action);background:var(--ui-surface-bg);color:var(--ui-text-secondary);cursor:pointer}.catalog-tool-btn svg{width:1em;height:1em}.catalog-tool-btn:disabled{opacity:.5;cursor:default}.catalog-tool-delete{color:var(--ui-change-before)}.catalog-tool-library{color:var(--ui-change-after)}.catalog-tool-swap-armed{color:var(--ui-change-pending);border-color:var(--ui-change-pending-border);background:var(--ui-change-pending-bg)}.catalog-tool-swap-pending{color:var(--ui-change-after);border-color:var(--ui-change-after-border);background:var(--ui-change-after-bg)}.catalog-card-swap-armed{outline:var(--ui-outline-width) solid var(--ui-change-pending);outline-offset:var(--ui-outline-offset)}.catalog-card-swap-pending{outline:var(--ui-outline-width) solid var(--ui-change-after);outline-offset:var(--ui-outline-offset)}.catalog-card-swap-armed .catalog-card-tools,.catalog-card-swap-pending .catalog-card-tools{opacity:1}
        .catalog-card-swap-draggable{cursor:grab;user-select:none}.catalog-card-swap-draggable .catalog-photo-hint{cursor:grab}.catalog-card-swap-draggable:active,.catalog-card-swap-draggable:active .catalog-photo-hint{cursor:grabbing}.catalog-card-dragging{outline:var(--ui-outline-width) solid var(--ui-change-pending);outline-offset:var(--ui-outline-offset);opacity:var(--ui-drag-source-opacity)}.catalog-card-drop-valid{outline:var(--ui-outline-width) solid var(--ui-change-after);outline-offset:var(--ui-outline-offset);background:var(--ui-change-after-bg)}.catalog-card-drop-invalid{outline:var(--ui-outline-width) solid var(--ui-change-before);outline-offset:var(--ui-outline-offset);background:var(--ui-change-before-bg)}.catalog-drag-label{position:absolute;left:calc(var(--ui-section-gap)/2.5);bottom:calc(var(--ui-section-gap)/2.5);display:inline-flex;align-items:center;gap:calc(var(--ui-section-gap)/5);border:var(--ui-border-width) solid var(--ui-change-pending-border);border-radius:var(--ui-radius-action);background:var(--ui-change-pending-bg);padding:calc(var(--ui-section-py)/8) calc(var(--ui-section-px)/3);color:var(--ui-change-pending);pointer-events:none}.catalog-drag-label svg{width:1em;height:1em}
        .catalog-field-popover{position:absolute;z-index:4;top:calc(var(--ui-section-gap)*2);left:calc(var(--ui-section-gap)/2.5);display:grid;gap:calc(var(--ui-section-gap)/4);min-width:10rem;padding:calc(var(--ui-section-py)/2);border:1px solid var(--ui-border-default);border-radius:var(--ui-radius-control);background:var(--ui-surface-bg);box-shadow:var(--ui-shadow-elevated);font-size:.6875rem;color:var(--ui-text-secondary)}.catalog-field-popover label{display:flex;align-items:center;gap:calc(var(--ui-section-gap)/3)}.catalog-field-popover button{border:0;border-top:1px solid var(--ui-border-subtle);padding-top:calc(var(--ui-section-py)/3);background:transparent;color:var(--ui-text-secondary);text-align:left;cursor:pointer}.catalog-popover-title{font-weight:700;color:var(--ui-text-primary)}
        .catalog-swap-draftbar{display:flex;flex-basis:100%;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:var(--ui-section-gap);border:var(--ui-border-width) solid var(--ui-change-pending-border);border-radius:var(--ui-radius-control);background:var(--ui-change-pending-bg);padding:calc(var(--ui-section-py)/2) calc(var(--ui-section-px)/2)}.catalog-swap-draftcopy{display:grid;gap:calc(var(--ui-section-gap)/4);min-width:0}.catalog-swap-drafttitle{color:var(--ui-change-pending)}.catalog-swap-draftmessage{color:var(--ui-text-secondary)}.catalog-swap-pullnote{color:var(--ui-change-pending)}.catalog-swap-pairs{display:flex;flex-wrap:wrap;gap:calc(var(--ui-section-gap)/4)}.catalog-swap-pair{display:inline-flex;align-items:center;gap:calc(var(--ui-section-gap)/4);border:var(--ui-border-width) solid var(--ui-border-default);border-radius:var(--ui-radius-pill);background:var(--ui-surface-bg);padding:calc(var(--ui-section-py)/8) calc(var(--ui-section-px)/3);font-family:var(--font-mono,monospace)}.catalog-swap-pair-before{color:var(--ui-change-before);text-decoration:line-through}.catalog-swap-pair-after{color:var(--ui-change-after)}.catalog-swap-actions{display:flex;flex-shrink:0;gap:calc(var(--ui-section-gap)/3);margin-left:auto}.catalog-swap-cancel{border-color:var(--ui-change-before-border);color:var(--ui-change-before)}.catalog-swap-apply{background:var(--ui-change-after);color:var(--ui-text-inverse)}.catalog-swap-apply:hover{background:color-mix(in srgb,var(--ui-change-after) var(--ui-change-hover-strength),black)}
        .catalog-runhead{display:flex;justify-content:space-between;font-size:.5625rem;letter-spacing:.12em;text-transform:uppercase;color:var(--ui-text-tertiary);padding-bottom:calc(var(--ui-section-py)/4);border-bottom:1px solid var(--ui-border-focus);margin-bottom:calc(var(--ui-section-gap)/1.1)}.catalog-rail{flex-shrink:0;width:calc(var(--ui-section-gap)*2);border-left:1px solid var(--ui-text-primary);display:flex;justify-content:center}.catalog-rail>div{writing-mode:vertical-rl;transform:rotate(180deg);font-size:.6875rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;white-space:nowrap}
        .catalog-sheet+.catalog-sheet{margin-top:calc(var(--ui-section-gap)*2.2);padding-top:calc(var(--ui-section-gap)*1.8);border-top:1px dashed var(--ui-border-default)}
        @media print{.catalog-sheet+.catalog-sheet{margin-top:0;padding-top:0;border-top:none}.catalog-card-tools,.catalog-field-popover{display:none!important}.catalog-code-pending{border:0;background:color-mix(in srgb,var(--ui-surface-bg) 90%,transparent)}.catalog-code-before{color:var(--ui-text-primary);text-decoration:none}.catalog-code-arrow,.catalog-code-after{display:none}}
      `}</style>

      {!canEdit && !canDelete && (
        <div className="no-print border-b border-slate-200 px-0 py-[calc(var(--ui-section-py)/2)] mb-[var(--ui-section-gap)] font-sans text-xs text-slate-400">
          View only — this schedule belongs to another designer&apos;s project.
        </div>
      )}
      {(canEdit || canDelete) && (
        <div className="no-print sticky top-[68px] z-[5] flex flex-wrap items-center gap-[calc(var(--ui-section-gap)/2.5)] border-b border-slate-200 bg-white px-0 py-[calc(var(--ui-section-py)/2)] mb-[var(--ui-section-gap)] shadow-[0_6px_8px_-8px_rgba(0,0,0,0.25)]">
          {canEdit && (
            <Button
              onClick={() => setAddOpen(true)}
              disabled={adding !== null || bulkSwapEditing}
              className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]"
            >
              <Plus aria-hidden="true" /> Add item
            </Button>
          )}

          {canEdit && (
            <Button
              variant="outline"
              onClick={applyDefaultTemplate}
              disabled={applyingTemplate || bulkSwapEditing}
              className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
              title="Add any default categories this project is missing"
            >
              <LayoutTemplate aria-hidden="true" /> {applyingTemplate ? "Applying…" : "Apply default template"}
            </Button>
          )}

          {canEdit && !bulkSwapEditing && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (codeManager) {
                  setCodeManagerOpen((current) => !current);
                  return;
                }
                startBulkSwapEdit();
              }}
              className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
            >
              <ArrowLeftRight aria-hidden="true" />
              {codeManager
                ? codeManagerOpen
                  ? "Hide code manager"
                  : "Manage codes"
                : "Bulk edit codes"}
            </Button>
          )}

          {materialCategories.length > 0 && (
            <div className="flex flex-wrap items-center gap-[calc(var(--ui-section-gap)/4)] border-l border-slate-200 pl-[calc(var(--ui-section-px)/2)]">
              {materialCategories.map(([prefix, items]) => {
                const hidden = hiddenCategories.has(prefix);
                return (
                  <button
                    key={prefix}
                    type="button"
                    onClick={() => toggleCategory(prefix)}
                    title={`${resolveCategoryLabel(prefix, null)} — ${hidden ? "hidden, click to show" : "shown, click to hide"}`}
                    className={`rounded-full border px-[calc(var(--ui-section-px)/2.2)] py-[calc(var(--ui-section-py)/8)] font-sans text-xs transition-colors ${
                      hidden
                        ? "border-slate-200 text-slate-400"
                        : "border-[var(--ui-border-focus)] bg-[var(--ui-canvas-bg)] text-slate-700"
                    }`}
                  >
                    {prefix} <span className={hidden ? "text-slate-300" : "text-slate-400"}>· {items.length}</span>
                  </button>
                );
              })}
            </div>
          )}

          <span className="font-sans text-xs text-slate-400">
            {canEdit
              ? bulkSwapEditing
                ? "Draft mode: drag a card onto another card in the same category. Nothing is saved until Apply."
                : "Hover a card to choose its fields or delete it."
              : "View only — you don't have edit access."}
          </span>

          {canDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="ml-auto rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
                  aria-label="More schedule actions"
                  disabled={cleaning || bulkSwapEditing}
                >
                  <MoreHorizontal aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={cleanupEmpties}>
                  <Trash2 className="mr-2 size-4" aria-hidden="true" /> Remove empty items
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={resetAll} variant="destructive">
                  <Trash2 className="mr-2 size-4" aria-hidden="true" /> Remove all
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {bulkSwapEditing && (
            <div className="catalog-swap-draftbar">
              <div className="catalog-swap-draftcopy">
                <span className={cn("catalog-swap-drafttitle", UI_ENGINE_TYPE_META)}>Browser draft · not saved</span>
                <span className={cn("catalog-swap-draftmessage", UI_ENGINE_TYPE_BODY)}>
                  {pendingSwaps.length === 0
                    ? swapSourceId
                      ? "First card selected. Choose its partner."
                      : "Drag a card onto its target. The swap button is available as a click or keyboard fallback."
                    : `${pendingSwaps.length} pending swap${pendingSwaps.length === 1 ? "" : "s"}. Old codes are red; proposed codes are green.`}
                </span>
                {pendingSwaps.length > 0 && (
                  <div className="catalog-swap-pairs" aria-label="Pending code swaps">
                    {pendingSwaps.map((swap) => (
                      <span className={cn("catalog-swap-pair", UI_ENGINE_TYPE_META)} key={`${swap.aEntryId}:${swap.bEntryId}`}>
                        <span className="catalog-swap-pair-before">{swap.aCode}</span>
                        <span aria-hidden="true">⇄</span>
                        <span className="catalog-swap-pair-after">{swap.bCode}</span>
                      </span>
                    ))}
                  </div>
                )}
                {pendingSwaps.length > 0 && (
                  <span className={cn("catalog-swap-pullnote", UI_ENGINE_TYPE_BODY)}>
                    Apply commits every reviewed swap to StudioFlow in one transaction
                    {pendingNeedsSketchupPull
                      ? " and queues the model-code changes for the next SketchUp Pull/Sync."
                      : "."}
                  </span>
                )}
              </div>
              <div className="catalog-swap-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelBulkSwapEdit}
                  disabled={applyingSwaps}
                  className="catalog-swap-cancel rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
                >
                  <X aria-hidden="true" /> Cancel edit
                </Button>
                <Button
                  type="button"
                  onClick={applyPendingSwaps}
                  disabled={
                    applyingSwaps ||
                    pendingSwaps.length === 0 ||
                    swapSourceId !== null ||
                    draggingItemId !== null
                  }
                  className="catalog-swap-apply rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
                >
                  <Check aria-hidden="true" />
                  {applyingSwaps
                    ? "Applying…"
                    : pendingNeedsSketchupPull
                      ? "Apply & queue pull"
                      : "Apply changes"}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {codeManager && (
        <div
          className="no-print mb-[var(--ui-section-gap)]"
          hidden={!codeManagerOpen}
          aria-hidden={!codeManagerOpen}
        >
          {codeManager}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="py-[calc(var(--ui-section-py)*4)] text-center text-slate-400">
          <p className="font-serif text-lg text-slate-600">Nothing to show</p>
          <p className="mt-[calc(var(--ui-section-gap)/4)] font-sans text-sm">Add an item here or sync it from SketchUp.</p>
        </div>
      ) : (
        <div className="catalog-board">
          {pages.map((groups, pageIndex) => (
            <div key={pageIndex} className="catalog-sheet">
              {runningHeader(pageIndex + 1, pages.length)}
              {groups.map((group, groupIndex) => (
                <div key={`${group.title}:${groupIndex}`} className="flex gap-[calc(var(--ui-section-gap)*.9)] mt-[var(--catalog-group-margin,0)]" style={{ "--catalog-group-margin": groupIndex === 0 ? "0" : "calc(var(--ui-section-gap)*1.5)" } as React.CSSProperties}>
                  {rail(group.title)}
                  <div className="flex-1 flex flex-col gap-[calc(var(--ui-section-gap)*1.2)]">
                    {group.rows.map((row, rowIndex) => (
                      <div key={rowIndex} className="grid grid-cols-4 gap-[calc(var(--ui-section-gap)*1.2)] items-start">
                        {row.items.map(renderCard)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <Dialog
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) {
            setFixtureCategoryDraft("");
            setAddMode("manual");
            setReuseQuery("");
            setReuseItems([]);
            setSelectedReuseOptionId(null);
            setLoadingReuse(false);
          }
        }}
      >
        <DialogContent size="lg" className="rounded-[var(--ui-radius-card,0.75rem)]">
          <DialogHeader>
            <DialogTitle>Add schedule item</DialogTitle>
            <DialogDescription>
              Create a project-local draft, or take an immutable snapshot from something already specced on another project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-[var(--ui-section-gap)] py-[calc(var(--ui-section-py)/2)]">
            <div className="grid gap-[var(--ui-section-gap)] sm:grid-cols-2">
              <div className="grid gap-[calc(var(--ui-section-gap)/4)]">
                <span className={UI_ENGINE_TYPE_META}>Source</span>
                <div className="flex flex-wrap gap-[calc(var(--ui-section-gap)/3)]" role="group" aria-label="Item source">
                  <Button
                    type="button"
                    size="sm"
                    variant={addMode === "manual" ? "default" : "outline"}
                    className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
                    onClick={() => setAddMode("manual")}
                  >
                    Create manually
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={addMode === "reuse" ? "default" : "outline"}
                    className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
                    onClick={() => setAddMode("reuse")}
                  >
                    From a past project
                  </Button>
                </div>
              </div>

              <div className="grid gap-[calc(var(--ui-section-gap)/4)]">
                <span className={UI_ENGINE_TYPE_META}>Item type</span>
                <div className="flex flex-wrap gap-[calc(var(--ui-section-gap)/3)]" role="group" aria-label="Item type">
                  <Button
                    type="button"
                    size="sm"
                    variant={addKind === "material" ? "default" : "outline"}
                    className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
                    onClick={() => setAddKind("material")}
                  >
                    Material
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={addKind === "fixture" ? "default" : "outline"}
                    className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
                    onClick={() => setAddKind("fixture")}
                  >
                    Fixture
                  </Button>
                </div>
              </div>
            </div>

            {addMode === "manual" && addKind === "material" ? (
              <div className="grid gap-[calc(var(--ui-section-gap)/2)] rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] border border-slate-200 bg-[var(--ui-canvas-bg)] p-[var(--ui-section-px)]">
                <span className={UI_ENGINE_TYPE_META}>Category</span>
                <select
                  aria-label="Material category"
                  value={addCategory}
                  onChange={(event) => setAddCategory(event.target.value)}
                  className={cn(
                    "rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] border border-slate-200 bg-white px-[calc(var(--ui-section-px)/3)] py-[calc(var(--ui-section-py)/6)]",
                    UI_ENGINE_TYPE_BODY
                  )}
                >
                  {categoryOptions.map((prefix) => (
                    <option key={prefix} value={prefix}>{prefix} · {resolveCategoryLabel(prefix, null)}</option>
                  ))}
                </select>
                <p className={UI_ENGINE_TYPE_BODY}>
                  The new draft stays inside this project. After creation, its card is revealed and brought into view for editing.
                </p>
              </div>
            ) : addMode === "manual" ? (
              <div className="grid gap-[calc(var(--ui-section-gap)/2)] rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] border border-slate-200 bg-[var(--ui-canvas-bg)] p-[var(--ui-section-px)]">
                <span className={UI_ENGINE_TYPE_META}>Category or code prefix (optional)</span>
                <input
                  aria-label="Fixture category or code prefix"
                  value={fixtureCategoryDraft}
                  onChange={(event) => setFixtureCategoryDraft(event.target.value)}
                  placeholder="For example Sofa, Lighting, or SF"
                  className={cn(
                    "rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] border border-slate-200 bg-white px-[calc(var(--ui-section-px)/3)] py-[calc(var(--ui-section-py)/6)]",
                    UI_ENGINE_TYPE_BODY
                  )}
                />
                <p className={UI_ENGINE_TYPE_BODY}>
                  The new draft stays inside this project. After creation, its card is revealed and brought into view for editing.
                </p>
              </div>
            ) : (
              <div className="grid gap-[calc(var(--ui-section-gap)/3)]">
                <label className="grid gap-[calc(var(--ui-section-gap)/4)]">
                  <span className={UI_ENGINE_TYPE_META}>Search past projects</span>
                  <input
                    autoFocus
                    value={reuseQuery}
                    onChange={(event) => setReuseQuery(event.target.value)}
                    placeholder="Product, brand, or color (2+ characters)"
                    className={cn(
                      "rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] border border-slate-200 bg-white px-[calc(var(--ui-section-px)/3)] py-[calc(var(--ui-section-py)/6)]",
                      UI_ENGINE_TYPE_BODY
                    )}
                  />
                </label>
                <div className="max-h-[calc(var(--ui-section-py)*14)] overflow-y-auto rounded-[var(--ui-radius-control,calc(var(--ui-radius-card,0.75rem)*0.66))] border border-slate-200">
                  {loadingReuse ? (
                    <p className={cn("p-[calc(var(--ui-section-px)/2)]", UI_ENGINE_TYPE_META)}>Searching past projects…</p>
                  ) : reuseItems.length === 0 ? (
                    <p className={cn("p-[calc(var(--ui-section-px)/2)]", UI_ENGINE_TYPE_META)}>
                      {reuseQuery.trim().length >= 2 ? (
                        <>
                          <span className="block">No matching items from past projects.</span>
                          <span className="block mt-1 opacity-70">
                            Pool terisi otomatis dari item yang sudah dispesifikasi di proyek mana pun.
                          </span>
                        </>
                      ) : (
                        "Type at least 2 characters to search what's been used on other projects."
                      )}
                    </p>
                  ) : (
                    reuseItems.map((item) => {
                      const lastUsed = formatDateWithOptions(item.lastUsedAt, {
                        locale: "en-GB",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      });
                      return (
                        <button
                          key={item.id}
                          type="button"
                          aria-pressed={selectedReuseOptionId === item.id}
                          onClick={() => setSelectedReuseOptionId(item.id)}
                          className={`flex w-full items-center gap-[calc(var(--ui-section-gap)/2)] border-b border-[var(--ui-border-subtle,rgb(241_245_249))] p-[calc(var(--ui-section-px)/2)] text-left last:border-b-0 ${
                            selectedReuseOptionId === item.id
                              ? "bg-[var(--ui-canvas-bg)]"
                              : "bg-white hover:bg-[var(--ui-canvas-bg)]"
                          }`}
                        >
                          <span className={cn(
                            "grid size-[calc(var(--ui-section-gap)*2)] shrink-0 place-items-center overflow-hidden rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] bg-[var(--ui-canvas-bg)]",
                            UI_ENGINE_TYPE_META
                          )}>
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={item.imageUrl} alt={item.productName ?? "Material"} className="size-full object-cover" />
                            ) : "NO IMAGE"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className={cn("block truncate font-semibold text-slate-950", UI_ENGINE_TYPE_BODY)}>
                              {item.productName ?? "(no product name)"}
                              {item.color ? ` - ${item.color}` : ""}
                              {item.brand ? ` ex. ${item.brand}` : ""}
                            </span>
                            <span className={cn("block truncate", UI_ENGINE_TYPE_META)}>
                              Used {item.usageCount}× · last {lastUsed}
                            </span>
                          </span>
                          {selectedReuseOptionId === item.id && <span className={UI_ENGINE_TYPE_META}>Selected</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)} disabled={adding !== null}>Cancel</Button>
            <Button
              onClick={async () => {
                const success = addMode === "reuse"
                  ? await addFromReuse()
                  : await addItem(addKind, addKind === "material" ? (addCategory || undefined) : (fixtureCategoryDraft.trim() || undefined));
                if (success) {
                  setAddOpen(false);
                  setFixtureCategoryDraft("");
                  setReuseQuery("");
                  setReuseItems([]);
                  setSelectedReuseOptionId(null);
                }
              }}
              disabled={
                adding !== null ||
                (addMode === "manual" && addKind === "material" && !addCategory) ||
                (addMode === "reuse" && !selectedReuseOptionId)
              }
              className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]"
            >
              {adding !== null ? "Adding…" : addMode === "reuse" ? "Add selected item" : "Create draft item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={onFile} className="hidden" />
      <Dialog open={!!cropSrc} onOpenChange={(open) => { if (!open) { setCropSrc(null); setCropTargetId(null); } }}>
        <DialogContent className="sm:max-w-[calc(var(--ui-container-max-width,1440px)/3)] p-0 overflow-hidden rounded-[var(--ui-radius-card,0.75rem)]">
          <DialogHeader className="p-[var(--ui-section-px)] bg-[var(--ui-action-bg)] text-[var(--ui-action-text)]"><DialogTitle className="text-base">Adjust photo</DialogTitle></DialogHeader>
          <div className="relative h-[calc(var(--ui-section-py)*19)] bg-[var(--ui-canvas-bg)]">
            {cropSrc && <Cropper image={cropSrc} crop={crop} zoom={zoom} minZoom={0.4} maxZoom={3} aspect={4 / 5} restrictPosition={false} objectFit="contain" onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, pixels) => setCroppedArea(pixels)} />}
          </div>
          <DialogFooter className="p-[calc(var(--ui-section-px)*.8)] border-t border-[var(--ui-border-subtle,rgb(241_245_249))] flex items-center justify-between gap-[calc(var(--ui-section-gap)*.8)]">
            <input type="range" min={0.4} max={3} step={0.05} value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="flex-1" />
            <div className="flex items-center gap-[calc(var(--ui-section-gap)*.4)]">
              <Button variant="ghost" onClick={() => { setCropSrc(null); setCropTargetId(null); }} disabled={saving}>Cancel</Button>
              <Button onClick={saveCrop} disabled={saving} className="bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)] rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]">{saving ? "Saving…" : "Save photo"}</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {appConfirm.dialog}
    </div>
  );
}
