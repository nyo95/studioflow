"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowRight,
  Check,
  GripVertical,
  LockKeyhole,
  Merge,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/ui_engine";
import { cn } from "@/lib/utils";
import { useAppConfirm } from "@/hooks/use-app-confirm";
import {
  TEXT_SIZE_BADGE,
  UI_ENGINE_TYPE_BODY,
  UI_ENGINE_TYPE_META,
} from "@/ui_engine/tokens/typography";
import {
  applyCatalogCodeOrderAction,
  queueSketchupMaterialMergeAction,
  type CatalogCodeManagerItem,
} from "../actions/sketchup-actions";

type CodePlan = {
  targetCodeByEntryId: Map<string, string>;
  error: string | null;
};

const CODE_PATTERN = /^([A-Z][A-Z0-9]*)-(\d+)$/;

function codeNumber(code: string) {
  const match = CODE_PATTERN.exec(code.trim().toUpperCase());
  return match ? Number(match[2]) : Number.MAX_SAFE_INTEGER;
}

function sameIds(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function planCodes(
  prefix: string,
  orderedItems: CatalogCodeManagerItem[],
  reservedEntryIds: ReadonlySet<string>
): CodePlan {
  const reservedNumbers = new Set<number>();
  for (const item of orderedItems) {
    if (!reservedEntryIds.has(item.entry_id)) continue;
    const number = codeNumber(item.code);
    if (
      number < 1 ||
      number > orderedItems.length ||
      reservedNumbers.has(number)
    ) {
      return {
        targetCodeByEntryId: new Map(),
        error: `${item.code} is reserved outside this group's normalized range. Unreserve it first.`,
      };
    }
    reservedNumbers.add(number);
  }

  const targetCodeByEntryId = new Map<string, string>();
  let nextNumber = 1;
  for (const item of orderedItems) {
    if (reservedEntryIds.has(item.entry_id)) {
      targetCodeByEntryId.set(item.entry_id, item.code);
      continue;
    }
    while (reservedNumbers.has(nextNumber)) nextNumber += 1;
    targetCodeByEntryId.set(item.entry_id, `${prefix}-${nextNumber}`);
    nextNumber += 1;
  }
  return { targetCodeByEntryId, error: null };
}

function SortableCodeRow({
  item,
  targetCode,
  reserved,
  disabled,
  canManageSketchup,
  onToggleReserved,
}: {
  item: CatalogCodeManagerItem;
  targetCode: string;
  reserved: boolean;
  disabled: boolean;
  canManageSketchup: boolean;
  onToggleReserved: (item: CatalogCodeManagerItem) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.entry_id,
    disabled: disabled || reserved,
  });
  const changed = item.code !== targetCode;
  const bridgePending = Boolean(item.bridge_code && item.bridge_code !== item.code);

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? "var(--ui-drag-source-opacity)" : undefined,
      }}
      className={cn(
        "catalog-code-row",
        changed && "catalog-code-row-changed",
        isDragging && "catalog-code-row-dragging"
      )}
    >
      <button
        type="button"
        className="catalog-code-grip"
        disabled={disabled || reserved}
        aria-label={`Reorder ${item.code}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" />
      </button>

      <div className="catalog-code-identity">
        <div className="catalog-code-preview">
          <span className={cn("catalog-code-current", changed && "catalog-code-current-changed")}>
            {item.code}
          </span>
          {changed && (
            <>
              <ArrowRight aria-hidden="true" />
              <span className="catalog-code-proposed">{targetCode}</span>
            </>
          )}
        </div>
        <span className={cn("catalog-code-description", UI_ENGINE_TYPE_BODY)}>
          {[item.brand, item.type_label].filter(Boolean).join(" / ") || "No material details"}
        </span>
        {bridgePending && (
          <span className={cn("catalog-code-bridge-state", UI_ENGINE_TYPE_META)}>
            SketchUp currently {item.bridge_code}
          </span>
        )}
      </div>

      {item.material_id ? (
        <button
          type="button"
          className={cn("catalog-code-reserve", reserved && "catalog-code-reserve-active")}
          disabled={disabled || !canManageSketchup}
          onClick={() => onToggleReserved(item)}
          aria-pressed={reserved}
          title="Reserved numbers stay fixed when this draft is applied."
        >
          <LockKeyhole aria-hidden="true" />
          {reserved ? "Reserved" : "Reserve"}
        </button>
      ) : (
        <span className={cn("catalog-code-local", UI_ENGINE_TYPE_META)}>Schedule only</span>
      )}
    </li>
  );
}

export function CatalogCodeManager({
  projectId,
  sketchupProjectId,
  items,
  pendingActionCount,
  canEdit,
  canManageSketchup,
}: {
  projectId: string;
  sketchupProjectId: string;
  items: CatalogCodeManagerItem[];
  pendingActionCount: number;
  canEdit: boolean;
  canManageSketchup: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [activePrefix, setActivePrefix] = React.useState("");
  const [localOrders, setLocalOrders] = React.useState<Record<string, string[]>>({});
  const [localReservations, setLocalReservations] = React.useState<Record<string, string[]>>({});
  const [sourceMaterialId, setSourceMaterialId] = React.useState("");
  const [targetMaterialId, setTargetMaterialId] = React.useState("");
  const appConfirm = useAppConfirm();
  const dndContextId = React.useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const itemsByPrefix = React.useMemo(() => {
    const groups = new Map<string, CatalogCodeManagerItem[]>();
    for (const item of items) {
      const group = groups.get(item.prefix) ?? [];
      group.push(item);
      groups.set(item.prefix, group);
    }
    for (const group of groups.values()) {
      group.sort(
        (left, right) =>
          codeNumber(left.code) - codeNumber(right.code) ||
          left.code.localeCompare(right.code)
      );
    }
    return groups;
  }, [items]);

  const prefixes = React.useMemo(
    () => [...itemsByPrefix.keys()].sort(),
    [itemsByPrefix]
  );
  const selectedPrefix = prefixes.includes(activePrefix)
    ? activePrefix
    : prefixes[0] ?? "";
  const baseItems = itemsByPrefix.get(selectedPrefix) ?? [];
  const itemByEntryId = new Map(baseItems.map((item) => [item.entry_id, item]));
  const requestedOrder = localOrders[selectedPrefix];
  const orderedItems =
    requestedOrder &&
    requestedOrder.length === baseItems.length &&
    requestedOrder.every((entryId) => itemByEntryId.has(entryId))
      ? requestedOrder.map((entryId) => itemByEntryId.get(entryId)!)
      : baseItems;
  const baseReservedIds = baseItems
    .filter((item) => item.is_reserved)
    .map((item) => item.entry_id);
  const reservedEntryIds = new Set(
    localReservations[selectedPrefix] ?? baseReservedIds
  );
  const activePlan = planCodes(selectedPrefix, orderedItems, reservedEntryIds);
  const isLocked = !canEdit || isPending || pendingActionCount > 0;
  const activeGroupNeedsSketchupAdmin = baseItems.some((item) => item.material_id);
  const isActiveGroupLocked =
    isLocked || (!canManageSketchup && activeGroupNeedsSketchupAdmin);
  const allGroupsNeedSketchupAdmin = items.some((item) => item.material_id);

  const groupPayload = (prefix: string) => {
    const groupItems = itemsByPrefix.get(prefix) ?? [];
    const groupItemById = new Map(groupItems.map((item) => [item.entry_id, item]));
    const orderIds = localOrders[prefix] ?? groupItems.map((item) => item.entry_id);
    const validOrderIds = orderIds.filter((entryId) => groupItemById.has(entryId));
    const reservedIds =
      localReservations[prefix] ??
      groupItems.filter((item) => item.is_reserved).map((item) => item.entry_id);
    return {
      prefix,
      orderedEntryIds: validOrderIds,
      reservedEntryIds: reservedIds,
    };
  };

  const hasLocalGroupDraft = (prefix: string) => {
    const groupItems = itemsByPrefix.get(prefix) ?? [];
    const groupBaseOrder = groupItems.map((item) => item.entry_id);
    const groupOrder = localOrders[prefix] ?? groupBaseOrder;
    const groupBaseReserved = groupItems
      .filter((item) => item.is_reserved)
      .map((item) => item.entry_id)
      .sort();
    const groupReserved = (
      localReservations[prefix] ?? groupBaseReserved
    ).slice().sort();
    return (
      !sameIds(groupBaseOrder, groupOrder) ||
      !sameIds(groupBaseReserved, groupReserved)
    );
  };

  const hasGroupWork = (prefix: string) => {
    const groupItems = itemsByPrefix.get(prefix) ?? [];
    const groupBaseOrder = groupItems.map((item) => item.entry_id);
    const groupOrder = localOrders[prefix] ?? groupBaseOrder;
    const groupBaseReserved = groupItems
      .filter((item) => item.is_reserved)
      .map((item) => item.entry_id)
      .sort();
    const groupReserved = (
      localReservations[prefix] ?? groupBaseReserved
    ).slice().sort();
    const groupItemById = new Map(groupItems.map((item) => [item.entry_id, item]));
    const groupPlan = planCodes(
      prefix,
      groupOrder.map((entryId) => groupItemById.get(entryId)!).filter(Boolean),
      new Set(groupReserved)
    );
    const hasCodeChange = groupItems.some(
      (item) =>
        groupPlan.targetCodeByEntryId.get(item.entry_id) &&
        groupPlan.targetCodeByEntryId.get(item.entry_id) !== item.code
    );
    const hasBridgeMismatch = groupItems.some(
      (item) => item.bridge_code && item.bridge_code !== item.code
    );
    return hasLocalGroupDraft(prefix) || hasCodeChange || hasBridgeMismatch;
  };

  const localDraftPrefixes = prefixes.filter(hasLocalGroupDraft);

  const setPrefix = (prefix: string) => {
    setActivePrefix(prefix);
    setSourceMaterialId("");
    setTargetMaterialId("");
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (isActiveGroupLocked || !over || active.id === over.id) return;
    const oldIndex = orderedItems.findIndex((item) => item.entry_id === active.id);
    const newIndex = orderedItems.findIndex((item) => item.entry_id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const movedItems = arrayMove(orderedItems, oldIndex, newIndex);
    setLocalOrders((current) => ({
      ...current,
      [selectedPrefix]: movedItems.map((item) => item.entry_id),
    }));
  };

  const toggleReserved = (item: CatalogCodeManagerItem) => {
    if (!item.material_id || !canManageSketchup || isLocked) return;
    const next = new Set(reservedEntryIds);
    if (next.has(item.entry_id)) next.delete(item.entry_id);
    else next.add(item.entry_id);
    setLocalReservations((current) => ({
      ...current,
      [selectedPrefix]: [...next],
    }));
  };

  const cancelPrefixDraft = () => {
    setLocalOrders((current) => {
      const next = { ...current };
      delete next[selectedPrefix];
      return next;
    });
    setLocalReservations((current) => {
      const next = { ...current };
      delete next[selectedPrefix];
      return next;
    });
    setSourceMaterialId("");
    setTargetMaterialId("");
    toast.info(`${selectedPrefix} browser draft discarded. StudioFlow was not changed.`);
  };

  const cancelAllDrafts = () => {
    setLocalOrders({});
    setLocalReservations({});
    setSourceMaterialId("");
    setTargetMaterialId("");
    toast.info("All code drafts were discarded. StudioFlow was not changed.");
  };

  const applyPrefixes = (prefixesToApply: string[]) => {
    if (isLocked || prefixesToApply.length === 0) return;
    if (
      !canManageSketchup &&
      prefixesToApply.some((prefix) =>
        (itemsByPrefix.get(prefix) ?? []).some((item) => item.material_id)
      )
    ) {
      toast.error(
        "Only the plugin admin can change a group linked to a SketchUp model."
      );
      return;
    }
    const invalidPlan = prefixesToApply
      .map((prefix) => {
        const payload = groupPayload(prefix);
        const groupItemById = new Map(
          (itemsByPrefix.get(prefix) ?? []).map((item) => [item.entry_id, item])
        );
        return planCodes(
          prefix,
          payload.orderedEntryIds.map((entryId) => groupItemById.get(entryId)!).filter(Boolean),
          new Set(payload.reservedEntryIds)
        ).error;
      })
      .find(Boolean);
    if (invalidPlan) {
      toast.error(invalidPlan);
      return;
    }

    startTransition(async () => {
      const result = await applyCatalogCodeOrderAction(
        projectId,
        prefixesToApply.map(groupPayload)
      );
      if (!("success" in result) || !result.success) {
        toast.error(result.error || "The reviewed code order could not be applied.");
        return;
      }
      const appliedParts = [
        `${result.changedEntries} code change${result.changedEntries === 1 ? "" : "s"}`,
      ];
      if (result.reservationChanges > 0) {
        appliedParts.push(
          `${result.reservationChanges} reservation change${result.reservationChanges === 1 ? "" : "s"}`
        );
      }
      toast.success(
        result.queued
          ? `${appliedParts.join(" and ")} applied; SketchUp updates are queued for the next Pull/Sync.`
          : `${appliedParts.join(" and ")} applied.`
      );
      setLocalOrders((current) => {
        const next = { ...current };
        prefixesToApply.forEach((prefix) => delete next[prefix]);
        return next;
      });
      setLocalReservations((current) => {
        const next = { ...current };
        prefixesToApply.forEach((prefix) => delete next[prefix]);
        return next;
      });
      router.refresh();
    });
  };

  const syncedItems = orderedItems.filter((item) => item.material_id);
  const handleMerge = async () => {
    if (!sketchupProjectId || !sourceMaterialId || !targetMaterialId) return;
    const source = syncedItems.find((item) => item.material_id === sourceMaterialId);
    const target = syncedItems.find((item) => item.material_id === targetMaterialId);
    if (!source || !target) return;
    if (!(await appConfirm.confirm({
      title: `Queue merge ${source.bridge_code || source.code} → ${target.bridge_code || target.code}?`,
      description: "The source material will be replaced in the SketchUp model on the next Pull/Sync.",
      confirmLabel: "Queue merge",
    }))) return;
    startTransition(async () => {
      const result = await queueSketchupMaterialMergeAction({
        projectId,
        sketchupProjectId,
        sourceMaterialId,
        targetMaterialId,
      });
      if (!result.success) {
        toast.error(result.error || "The SketchUp merge could not be queued.");
        return;
      }
      toast.success("SketchUp merge queued for the next Pull/Sync.");
      setSourceMaterialId("");
      setTargetMaterialId("");
      router.refresh();
    });
  };

  return (
    <section className="catalog-code-manager">
      <style>{`
        .catalog-code-manager{overflow:hidden;border:var(--ui-border-width) solid var(--ui-border-default);border-radius:var(--ui-radius-card);background:var(--ui-surface-bg);box-shadow:var(--ui-shadow-card)}
        .catalog-code-manager svg{width:var(--ui-icon-size-sm);height:var(--ui-icon-size-sm)}
        .catalog-code-manager-head{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:var(--ui-section-gap);border-bottom:var(--ui-border-width) solid var(--ui-border-default);background:var(--ui-canvas-bg);padding:var(--ui-section-py) var(--ui-section-px)}
        .catalog-code-manager-title{margin:calc(var(--ui-section-gap)/5) 0 0;font-family:var(--font-serif);color:var(--ui-text-primary)}
        .catalog-code-manager-copy{margin-top:calc(var(--ui-section-gap)/4);max-width:var(--ui-copy-max-width);color:var(--ui-text-secondary)}
        .catalog-code-manager-actions{display:flex;flex-wrap:wrap;gap:calc(var(--ui-section-gap)/3)}
        .catalog-code-pending{display:flex;align-items:flex-start;gap:calc(var(--ui-section-gap)/3);border-bottom:var(--ui-border-width) solid var(--ui-change-pending-border);background:var(--ui-change-pending-bg);padding:calc(var(--ui-section-py)/2) var(--ui-section-px);color:var(--ui-change-pending)}
        .catalog-code-manager-body{padding:var(--ui-section-py) var(--ui-section-px)}
        .catalog-code-tabs{display:flex;flex-wrap:wrap;gap:calc(var(--ui-section-gap)/3);margin-bottom:var(--ui-section-gap)}
        .catalog-code-tab{border:var(--ui-border-width) solid var(--ui-border-default);border-radius:var(--ui-radius-action);background:var(--ui-surface-bg);padding:calc(var(--ui-section-py)/3) calc(var(--ui-section-px)/2);color:var(--ui-text-secondary);font-family:var(--font-mono,monospace);font-weight:700;cursor:pointer}
        .catalog-code-tab-active{border-color:var(--ui-action-bg);background:var(--ui-action-bg);color:var(--ui-action-text)}.catalog-code-tab-state{margin-left:calc(var(--ui-section-gap)/4);color:var(--ui-change-pending)}
        .catalog-code-layout{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,var(--ui-code-manager-column-min)),1fr));gap:var(--ui-section-gap);align-items:start}
        .catalog-code-list{overflow:hidden;border:var(--ui-border-width) solid var(--ui-border-default);border-radius:var(--ui-radius-control)}
        .catalog-code-list-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:calc(var(--ui-section-gap)/2);background:var(--ui-canvas-bg);padding:calc(var(--ui-section-py)/2) var(--ui-section-px)}
        .catalog-code-list-actions{display:flex;gap:calc(var(--ui-section-gap)/3)}
        .catalog-code-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:calc(var(--ui-section-gap)/2);border-top:var(--ui-border-width) solid var(--ui-border-subtle);background:var(--ui-surface-bg);padding:calc(var(--ui-section-py)/2) var(--ui-section-px)}
        .catalog-code-row-changed{background:var(--ui-change-after-bg)}.catalog-code-row-dragging{outline:var(--ui-outline-width) solid var(--ui-change-pending);outline-offset:calc(var(--ui-outline-offset)*-1)}
        .catalog-code-grip{display:grid;place-items:center;border:0;background:transparent;color:var(--ui-text-tertiary);cursor:grab}.catalog-code-grip:active{cursor:grabbing}.catalog-code-grip:disabled{cursor:not-allowed;opacity:var(--ui-disabled-opacity)}
        .catalog-code-identity{display:grid;gap:calc(var(--ui-section-gap)/5);min-width:0}.catalog-code-preview{display:flex;align-items:center;gap:calc(var(--ui-section-gap)/3);font-family:var(--font-mono,monospace);font-weight:700}.catalog-code-preview svg{color:var(--ui-text-tertiary)}.catalog-code-current{color:var(--ui-text-primary)}.catalog-code-current-changed{color:var(--ui-change-before);text-decoration:line-through}.catalog-code-proposed{color:var(--ui-change-after)}.catalog-code-description{overflow:hidden;color:var(--ui-text-secondary);text-overflow:ellipsis;white-space:nowrap}.catalog-code-bridge-state{color:var(--ui-change-pending)}
        .catalog-code-reserve{display:inline-flex;align-items:center;gap:calc(var(--ui-section-gap)/4);border:var(--ui-border-width) solid var(--ui-border-default);border-radius:var(--ui-radius-action);background:var(--ui-surface-bg);padding:calc(var(--ui-section-py)/3) calc(var(--ui-section-px)/2);color:var(--ui-text-secondary);cursor:pointer}.catalog-code-reserve-active{border-color:var(--ui-change-pending-border);background:var(--ui-change-pending-bg);color:var(--ui-change-pending)}.catalog-code-reserve:disabled{cursor:not-allowed;opacity:var(--ui-disabled-opacity)}.catalog-code-local{color:var(--ui-text-tertiary)}
        .catalog-code-merge{border:var(--ui-border-width) solid var(--ui-border-default);border-radius:var(--ui-radius-control);background:var(--ui-canvas-bg);padding:var(--ui-section-py) var(--ui-section-px)}.catalog-code-merge-title{display:flex;align-items:center;gap:calc(var(--ui-section-gap)/3);color:var(--ui-text-primary);font-weight:700}.catalog-code-merge-copy{margin-top:calc(var(--ui-section-gap)/4);color:var(--ui-text-secondary)}.catalog-code-merge label{display:grid;gap:calc(var(--ui-section-gap)/4);margin-top:calc(var(--ui-section-gap)/2);color:var(--ui-text-secondary)}.catalog-code-merge select{width:100%;border:var(--ui-border-width) solid var(--ui-border-default);border-radius:var(--ui-radius-action);background:var(--ui-surface-bg);padding:calc(var(--ui-section-py)/2) calc(var(--ui-section-px)/2);color:var(--ui-text-primary)}
        .catalog-code-error{margin-top:calc(var(--ui-section-gap)/3);color:var(--ui-change-before)}
        @media print{.catalog-code-manager{display:none}}
      `}</style>

      <div className="catalog-code-manager-head">
        <div>
          <span className={cn(UI_ENGINE_TYPE_META, "text-slate-400")}>
            Product Schedule codes
          </span>
          <h2 className="catalog-code-manager-title">Code Manager</h2>
          <p className={cn("catalog-code-manager-copy", UI_ENGINE_TYPE_BODY)}>
            Reorder the full category as a browser draft. Apply updates the Product Schedule first;
            linked model renames are then queued for SketchUp Pull/Sync.
          </p>
        </div>
        <div className="catalog-code-manager-actions">
          {localDraftPrefixes.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={cancelAllDrafts}
              disabled={isPending}
              className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
            >
              <RotateCcw aria-hidden="true" /> Cancel all drafts
            </Button>
          )}
          <Button
            type="button"
            onClick={() => applyPrefixes(prefixes)}
            disabled={
              isLocked ||
              prefixes.length === 0 ||
              (!canManageSketchup && allGroupsNeedSketchupAdmin)
            }
            className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
          >
            <RefreshCw aria-hidden="true" /> Normalize all groups
          </Button>
        </div>
      </div>

      {pendingActionCount > 0 && (
        <div className={cn("catalog-code-pending", UI_ENGINE_TYPE_BODY)}>
          <RefreshCw aria-hidden="true" />
          <span>
            {pendingActionCount} bridge action{pendingActionCount === 1 ? " is" : "s are"} waiting
            for SketchUp Pull/Sync. New code edits are locked until the plugin confirms them.
          </span>
        </div>
      )}

      {prefixes.length === 0 ? (
        <div className="catalog-code-manager-body">
          <p className={UI_ENGINE_TYPE_BODY}>No material schedule codes are available yet.</p>
        </div>
      ) : (
        <div className="catalog-code-manager-body">
          <div className="catalog-code-tabs">
            {prefixes.map((prefix) => (
              <button
                key={prefix}
                type="button"
                onClick={() => setPrefix(prefix)}
                className={cn(
                  "catalog-code-tab",
                  selectedPrefix === prefix && "catalog-code-tab-active"
                )}
              >
                {prefix}
                {hasGroupWork(prefix) && (
                  <span className="catalog-code-tab-state" aria-label="Has pending code work">
                    •
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="catalog-code-layout">
            <div className="catalog-code-list">
              <div className="catalog-code-list-head">
                <div>
                  <strong>{selectedPrefix} sequence</strong>
                  <p className={cn(UI_ENGINE_TYPE_BODY, "text-slate-500")}>
                    Drag rows to define their next codes. Reserve is draft-only until Apply.
                  </p>
                </div>
                <div className="catalog-code-list-actions">
                  {hasLocalGroupDraft(selectedPrefix) && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={cancelPrefixDraft}
                      disabled={isPending}
                      className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
                    >
                      <RotateCcw aria-hidden="true" /> Cancel
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={() => applyPrefixes([selectedPrefix])}
                    disabled={
                      isActiveGroupLocked ||
                      !hasGroupWork(selectedPrefix) ||
                      Boolean(activePlan.error)
                    }
                    className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
                  >
                    <Check aria-hidden="true" /> Apply group
                  </Button>
                </div>
              </div>
              {activePlan.error && (
                <p className={cn("catalog-code-error", UI_ENGINE_TYPE_BODY)}>
                  {activePlan.error}
                </p>
              )}
              <DndContext
                id={dndContextId}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={orderedItems.map((item) => item.entry_id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul>
                    {orderedItems.map((item) => (
                      <SortableCodeRow
                        key={item.entry_id}
                        item={item}
                        targetCode={
                          activePlan.targetCodeByEntryId.get(item.entry_id) ?? item.code
                        }
                        reserved={reservedEntryIds.has(item.entry_id)}
                        disabled={isActiveGroupLocked}
                        canManageSketchup={canManageSketchup}
                        onToggleReserved={toggleReserved}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>

            <aside className="catalog-code-merge">
              <div className="catalog-code-merge-title">
                <Merge aria-hidden="true" />
                <span>Merge duplicate material</span>
              </div>
              <p className={cn("catalog-code-merge-copy", UI_ENGINE_TYPE_BODY)}>
                SketchUp-only: replace a source material with the target during the next Pull/Sync.
              </p>

              <label className={TEXT_SIZE_BADGE}>
                Source to replace
                <select
                  value={sourceMaterialId}
                  disabled={isLocked || !canManageSketchup}
                  onChange={(event) => setSourceMaterialId(event.target.value)}
                >
                  <option value="">Choose synced material</option>
                  {syncedItems.map((item) => (
                    <option
                      key={item.material_id}
                      value={item.material_id!}
                      disabled={reservedEntryIds.has(item.entry_id)}
                    >
                      {item.bridge_code || item.code}
                      {reservedEntryIds.has(item.entry_id) ? " (reserved)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className={TEXT_SIZE_BADGE}>
                Target to keep
                <select
                  value={targetMaterialId}
                  disabled={isLocked || !canManageSketchup}
                  onChange={(event) => setTargetMaterialId(event.target.value)}
                >
                  <option value="">Choose synced material</option>
                  {syncedItems.map((item) => (
                    <option
                      key={item.material_id}
                      value={item.material_id!}
                      disabled={item.material_id === sourceMaterialId}
                    >
                      {item.bridge_code || item.code}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                type="button"
                variant="outline"
                onClick={handleMerge}
                disabled={
                  isLocked ||
                  !canManageSketchup ||
                  !sourceMaterialId ||
                  !targetMaterialId
                }
                className="mt-[calc(var(--ui-section-gap)/2)] w-full rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
              >
                <Merge aria-hidden="true" /> Queue SketchUp merge
              </Button>
            </aside>
          </div>
        </div>
      )}
      {appConfirm.dialog}
    </section>
  );
}
