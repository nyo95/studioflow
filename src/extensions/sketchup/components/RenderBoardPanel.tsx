"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, ImagePlus, MoveHorizontal, X } from "lucide-react";
import { Button } from "@/ui_engine";
import { uploadLibraryImage } from "@/extensions/library/lib/upload-client";
import { DESIGN_SYSTEM_CONFIG } from "@/ui_engine/design-system.config";
import { useAppConfirm } from "@/hooks/use-app-confirm";
import {
  createRenderBoardAction,
  deleteRenderBoardAction,
  updateRenderBoardAction,
  addRenderAnnotationAction,
  updateRenderAnnotationAction,
  deleteRenderAnnotationAction,
  type RenderBoardView,
  type RenderAnnotationView,
  type ScheduleEntryOption,
} from "../actions/render-board-actions";

// Layout constants (percent of the board container). The image column is
// centred with equal label gutters; because the image element drives the
// container height, the vertical axis maps 1:1 (pin_y% === container y%), and
// the horizontal axis maps through the gutter offset — so every leader is drawn
// deterministically (print-stable, no runtime measurement).
const RENDER_BOARD_CONFIG = DESIGN_SYSTEM_CONFIG.renderBoard;
const SCREEN_LAYOUT = RENDER_BOARD_CONFIG.screen;
const PRINT_LAYOUT = RENDER_BOARD_CONFIG.print;

type Side = "left" | "right";
type RenderLayout = typeof SCREEN_LAYOUT;
type LabelView = {
  a: RenderAnnotationView;
  side: Side;
  labelY: number;
  pinCX: number;
  labelAnchorX: number;
};

function imageXToBoardX(pinX: number, layout: RenderLayout): number {
  const clampedX = Math.max(0, Math.min(100, pinX));
  return layout.gutterPercent + (clampedX / 100) * layout.imageWidthPercent;
}

function sideOf(a: RenderAnnotationView): Side {
  if (a.label_side === "left") return "left";
  if (a.label_side === "right") return "right";
  return a.pin_x < 50 ? "left" : "right";
}

function placeColumnLabels(
  items: RenderAnnotationView[],
  pitch: number
): Map<string, number> {
  const sorted = [...items].sort((a, b) => a.pin_y - b.pin_y);
  const placed = new Map<string, number>();
  if (sorted.length === 0) return placed;

  // Position one equal-pitch label block as close as possible to its pins,
  // then clamp the complete block inside the shared vertical safe area.
  const idealStart =
    sorted.reduce((sum, item, index) => sum + item.pin_y - index * pitch, 0) /
    sorted.length;
  const maxStart =
    RENDER_BOARD_CONFIG.labelSafeBottomPercent -
    (sorted.length - 1) * pitch;
  const clampedIdealStart = Math.max(
    RENDER_BOARD_CONFIG.labelSafeTopPercent,
    Math.min(maxStart, idealStart)
  );
  const minimumRise = RENDER_BOARD_CONFIG.leaderMinimumRisePercent;
  const candidateStarts = [
    clampedIdealStart,
    RENDER_BOARD_CONFIG.labelSafeTopPercent,
    maxStart,
    ...sorted.flatMap((item, index) => {
      const alignedStart = item.pin_y - index * pitch;
      return [alignedStart - minimumRise, alignedStart + minimumRise];
    }),
  ];
  const start =
    candidateStarts
      .filter(
        (candidate) =>
          candidate >= RENDER_BOARD_CONFIG.labelSafeTopPercent &&
          candidate <= maxStart &&
          sorted.every(
            (item, index) =>
              Math.abs(candidate + index * pitch - item.pin_y) >= minimumRise
          )
      )
      .sort(
        (a, b) =>
          Math.abs(a - idealStart) - Math.abs(b - idealStart)
      )[0] ?? clampedIdealStart;

  for (let index = 0; index < sorted.length; index++) {
    placed.set(sorted[index].id, start + index * pitch);
  }
  return placed;
}

function placeLabels(items: RenderAnnotationView[]): Map<string, number> {
  const left = items.filter((item) => sideOf(item) === "left");
  const right = items.filter((item) => sideOf(item) === "right");
  const maxColumnCount = Math.max(left.length, right.length);
  const safeHeight =
    RENDER_BOARD_CONFIG.labelSafeBottomPercent -
    RENDER_BOARD_CONFIG.labelSafeTopPercent;
  const pitch =
    maxColumnCount <= 1
      ? RENDER_BOARD_CONFIG.labelPitchPercent
      : Math.min(
          RENDER_BOARD_CONFIG.labelPitchPercent,
          safeHeight / (maxColumnCount - 1)
        );
  return new Map([
    ...placeColumnLabels(left, pitch),
    ...placeColumnLabels(right, pitch),
  ]);
}

function buildLabelViews(
  annotations: RenderAnnotationView[],
  layout: RenderLayout
): LabelView[] {
  const labelPositions = placeLabels(annotations);
  return annotations.map((a) => {
    const side = sideOf(a);
    const labelY = labelPositions.get(a.id) ?? a.pin_y;
    const pinCX = imageXToBoardX(a.pin_x, layout);
    const edgeX =
      side === "left"
        ? layout.gutterPercent
        : layout.gutterPercent + layout.imageWidthPercent;
    const labelAnchorX =
      side === "left"
        ? edgeX - RENDER_BOARD_CONFIG.labelInnerGapPercent
        : edgeX + RENDER_BOARD_CONFIG.labelInnerGapPercent;
    return { a, side, labelY, pinCX, labelAnchorX };
  });
}

function leaderPath(
  view: LabelView,
  imageRatio: number | null,
  layout: RenderLayout
) {
  const boardRatio =
    (imageRatio ?? RENDER_BOARD_CONFIG.fallbackImageRatio) /
    (layout.imageWidthPercent / 100);
  const verticalDelta = view.a.pin_y - view.labelY;
  const angleRadians =
    (RENDER_BOARD_CONFIG.leaderAngleDegrees * Math.PI) / 180;
  const diagonalRun =
    Math.abs(verticalDelta) / (Math.tan(angleRadians) * boardRatio);

  // The shelf absorbs the variable distance to the label. Only the final
  // segment is diagonal, so every callout reaches its pin at the same physical
  // angle even though the SVG uses percentage coordinates.
  const unconstrainedKnee =
    view.side === "left"
      ? view.pinCX - diagonalRun
      : view.pinCX + diagonalRun;
  const kneeX =
    view.side === "left"
      ? Math.max(view.labelAnchorX, Math.min(view.pinCX, unconstrainedKnee))
      : Math.min(view.labelAnchorX, Math.max(view.pinCX, unconstrainedKnee));

  return `M ${view.labelAnchorX} ${view.labelY} L ${kneeX} ${view.labelY} L ${view.pinCX} ${view.a.pin_y}`;
}

function boardAspectRatio(
  imageRatio: number | null,
  layout: RenderLayout
): number | undefined {
  if (!imageRatio) return undefined;
  return imageRatio / (layout.imageWidthPercent / 100);
}

async function measureRatio(url: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : undefined);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

export function RenderBoardPanel({
  projectId,
  boards,
  entryOptions,
  canEdit,
}: {
  projectId: string;
  boards: RenderBoardView[];
  entryOptions: ScheduleEntryOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [activeId, setActiveId] = React.useState<string | null>(boards[0]?.id ?? null);
  const [selectedPin, setSelectedPin] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const appConfirm = useAppConfirm();
  const panelRef = React.useRef<HTMLDivElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const imageRef = React.useRef<HTMLImageElement>(null);
  const lensRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ id: string; rect: DOMRect } | null>(null);

  React.useEffect(() => {
    if (!activeId && boards[0]) setActiveId(boards[0].id);
    if (activeId && !boards.some((b) => b.id === activeId)) setActiveId(boards[0]?.id ?? null);
  }, [boards, activeId]);

  const board = boards.find((b) => b.id === activeId) ?? null;
  const entryById = React.useMemo(() => new Map(entryOptions.map((o) => [o.entry_id, o])), [entryOptions]);

  const hidePointingLens = () => {
    if (lensRef.current) lensRef.current.dataset.visible = "false";
  };

  const onPanelPointerDown = (
    event: React.PointerEvent<HTMLDivElement>
  ) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (
      target.closest(
        "button, select, input, .render-photo, .render-pin, .render-label, .render-link-tools"
      )
    ) {
      return;
    }
    setSelectedPin(null);
    hidePointingLens();
  };

  const showPointingLens = (
    clientX: number,
    clientY: number,
    sourceRect?: DOMRect
  ) => {
    const lens = lensRef.current;
    const rect = sourceRect ?? imageRef.current?.getBoundingClientRect();
    if (!lens || !rect) return;

    const x = Math.max(
      0,
      Math.min(100, ((clientX - rect.left) / rect.width) * 100)
    );
    const y = Math.max(
      0,
      Math.min(100, ((clientY - rect.top) / rect.height) * 100)
    );
    const lensSize = lens.getBoundingClientRect().width;
    const zoom = RENDER_BOARD_CONFIG.pointingZoom;

    lens.style.left = `${imageXToBoardX(x, SCREEN_LAYOUT)}%`;
    lens.style.top = `${y}%`;
    lens.style.backgroundSize = `${rect.width * zoom}px ${rect.height * zoom}px`;
    lens.style.backgroundPosition = `${
      lensSize / 2 - (x / 100) * rect.width * zoom
    }px ${lensSize / 2 - (y / 100) * rect.height * zoom}px`;
    lens.dataset.placement =
      y < RENDER_BOARD_CONFIG.pointingLensFlipPercent ? "below" : "above";
    lens.dataset.visible = "true";
  };

  React.useEffect(() => {
    if (!selectedPin) return;
    const clearSelectionOutsidePanel = (event: PointerEvent) => {
      const panel = panelRef.current;
      const target = event.target;
      if (!panel || !(target instanceof Node) || panel.contains(target)) return;
      setSelectedPin(null);
      if (lensRef.current) lensRef.current.dataset.visible = "false";
    };
    document.addEventListener("pointerdown", clearSelectionOutsidePanel);
    return () =>
      document.removeEventListener("pointerdown", clearSelectionOutsidePanel);
  }, [selectedPin]);

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadLibraryImage(file, `renders/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`);
      const ratio = await measureRatio(url);
      const result = await createRenderBoardAction(projectId, { imageUrl: url, imageRatio: ratio });
      if (result?.error) toast.error(result.error);
      else {
        toast.success("Render board added");
        setActiveId(result.boardId ?? null);
        router.refresh();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const addPinAt = async (clientX: number, clientY: number) => {
    if (!board || !imageRef.current) return;
    setSelectedPin(null);
    hidePointingLens();
    const rect = imageRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    const result = await addRenderAnnotationAction(projectId, board.id, { x, y, entryId: null });
    if (result?.error) toast.error(result.error);
    else {
      setSelectedPin(result.annotationId ?? null);
      router.refresh();
    }
  };

  const setAnnotationEntry = async (annotationId: string, entryId: string | null) => {
    const result = await updateRenderAnnotationAction(projectId, annotationId, { entryId });
    if (result?.error) toast.error(result.error);
    else router.refresh();
  };

  const cycleSide = async (a: RenderAnnotationView) => {
    const next = a.label_side === "auto" ? "left" : a.label_side === "left" ? "right" : "auto";
    const result = await updateRenderAnnotationAction(projectId, a.id, { side: next as "auto" | "left" | "right" });
    if (result?.error) toast.error(result.error);
    else router.refresh();
  };

  const removePin = async (annotationId: string) => {
    const result = await deleteRenderAnnotationAction(projectId, annotationId);
    if (result?.error) toast.error(result.error);
    else {
      setSelectedPin(null);
      router.refresh();
    }
  };

  const removeBoard = async () => {
    if (!board) return;
    if (!(await appConfirm.confirm({
      title: "Delete this render board?",
      description: "The board and its annotations will be deleted. The render image itself is not affected.",
      confirmLabel: "Delete board",
    }))) return;
    const result = await deleteRenderBoardAction(projectId, board.id);
    if (result?.error) toast.error(result.error);
    else {
      toast.success("Render board deleted");
      router.refresh();
    }
  };

  const renameBoard = async () => {
    if (!board) return;
    const title = window.prompt("Board title", board.title);
    if (title == null) return;
    const result = await updateRenderBoardAction(projectId, board.id, { title });
    if (result?.error) toast.error(result.error);
    else router.refresh();
  };

  // Pin drag (edit mode).
  const onPinPointerDown = (event: React.PointerEvent, annotationId: string) => {
    if (!canEdit || !imageRef.current) return;
    event.stopPropagation();
    event.preventDefault();
    setSelectedPin(annotationId);
    dragRef.current = { id: annotationId, rect: imageRef.current.getBoundingClientRect() };
    showPointingLens(event.clientX, event.clientY, dragRef.current.rect);
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };
  const onPinPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Live-move is optimistic-free; we persist on pointer-up to avoid spamming.
    const x = Math.max(
      0,
      Math.min(100, ((event.clientX - drag.rect.left) / drag.rect.width) * 100)
    );
    const y = Math.max(
      0,
      Math.min(100, ((event.clientY - drag.rect.top) / drag.rect.height) * 100)
    );
    const el = document.getElementById(`pin-${drag.id}`);
    if (el) {
      el.style.left = `${imageXToBoardX(x, SCREEN_LAYOUT)}%`;
      el.style.top = `${y}%`;
    }
    const leader = document.getElementById(`leader-${drag.id}`);
    const leaderView = screenLabelViews.find((view) => view.a.id === drag.id);
    if (leader && leaderView && board) {
      leader.setAttribute(
        "d",
        leaderPath(
          {
            ...leaderView,
            a: { ...leaderView.a, pin_x: x, pin_y: y },
            pinCX: imageXToBoardX(x, SCREEN_LAYOUT),
          },
          board.image_ratio,
          SCREEN_LAYOUT
        )
      );
    }
    showPointingLens(event.clientX, event.clientY, drag.rect);
  };
  const onPinPointerUp = async (event: React.PointerEvent) => {
    const drag = dragRef.current;
    dragRef.current = null;
    hidePointingLens();
    if (!drag) return;
    const x = Math.max(0, Math.min(100, ((event.clientX - drag.rect.left) / drag.rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - drag.rect.top) / drag.rect.height) * 100));
    const result = await updateRenderAnnotationAction(projectId, drag.id, { x, y });
    if (result?.error) toast.error(result.error);
    router.refresh();
  };
  const onPinPointerCancel = () => {
    dragRef.current = null;
    hidePointingLens();
  };

  if (boards.length === 0) {
    return (
      <div className="py-[calc(var(--ui-section-py)*3)] text-center">
        <p className="font-serif text-lg text-slate-600">No render boards yet</p>
        <p className="mt-1 font-sans text-sm text-slate-400">
          Upload one of your renders, then drop pins that point to Product Schedule codes.
        </p>
        {canEdit && (
          <div className="mt-4">
            <Button onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] bg-[var(--ui-action-bg)] text-[var(--ui-action-text)] hover:bg-[var(--ui-action-hover)]">
              <ImagePlus aria-hidden="true" /> {busy ? "Uploading…" : "Upload a render"}
            </Button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
      </div>
    );
  }

  const screenAnnotations = board
    ? board.annotations.filter((annotation) => annotation.entry_id)
    : [];
  const screenLabelViews = buildLabelViews(screenAnnotations, SCREEN_LAYOUT);
  const printAnnotations = board
    ? board.annotations.filter((annotation) => annotation.entry_id)
    : [];
  const printLabelViews = buildLabelViews(printAnnotations, PRINT_LAYOUT);
  const selectedAnnotation =
    board?.annotations.find((annotation) => annotation.id === selectedPin) ??
    null;

  return (
    <div
      ref={panelRef}
      className="render-panel"
      onPointerDown={onPanelPointerDown}
    >
      <style>{`
        .render-panel{--rp-accent:var(--ui-render-accent)}
        .render-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:calc(var(--ui-section-gap)/2);border-bottom:var(--ui-border-width) solid var(--ui-border-default);padding-bottom:calc(var(--ui-section-py)/2);margin-bottom:var(--ui-section-gap)}
        .render-tab{font-size:var(--ui-render-label-code-size);font-weight:600;padding:calc(var(--ui-section-py)/6) calc(var(--ui-section-px)/2.2);border:var(--ui-border-width) solid var(--ui-border-default);border-radius:var(--ui-radius-pill);color:var(--ui-text-secondary);background:transparent;cursor:pointer;white-space:nowrap}
        .render-tab[data-active="true"]{border-color:var(--ui-border-focus);background:var(--ui-canvas-bg);color:var(--ui-text-primary)}
        .render-board{position:relative;width:100%;background:var(--ui-surface-bg)}
        .render-board-screen img.render-photo{display:block;margin:0 auto;width:${SCREEN_LAYOUT.imageWidthPercent}%;height:auto;user-select:none}
        .render-svg{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;shape-rendering:geometricPrecision}
        .render-svg path{fill:none;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke}
        .render-svg .lead{stroke:var(--rp-accent);stroke-width:var(--ui-render-leader-stroke);opacity:var(--ui-render-leader-opacity)}
        .render-pin{position:absolute;display:grid;place-items:center;width:var(--ui-render-pin-hit-size);height:var(--ui-render-pin-hit-size);transform:translate(-50%,-50%);border:0;border-radius:var(--ui-radius-pill);background:transparent;box-shadow:none;cursor:${canEdit ? "grab" : "default"};z-index:3}
        .render-pin::after{content:"";width:var(--ui-render-pin-size);height:var(--ui-render-pin-size);border-radius:var(--ui-radius-pill);background:var(--rp-accent)}
        .render-label{position:absolute;transform:translateY(-50%);z-index:2}
        .render-board-screen .render-label{width:${SCREEN_LAYOUT.gutterPercent - RENDER_BOARD_CONFIG.labelInnerGapPercent - RENDER_BOARD_CONFIG.labelTextGapPercent}%;max-height:calc(var(--ui-section-gap)*2.4);overflow:hidden}
        .render-label[data-side="left"]{left:0}
        .render-label[data-side="right"]{right:0}
        .render-label[data-side="left"] .code{width:100%;text-align:right}
        .render-label[data-side="right"] .code{width:100%;text-align:left}
        .render-label .code{font-family:var(--font-mono,monospace);font-size:var(--ui-render-label-code-size);font-weight:700;color:var(--ui-text-primary);letter-spacing:var(--ui-render-label-code-tracking)}
        .render-label.editable{cursor:pointer}
        .render-hint{font-size:var(--ui-render-label-code-size);color:var(--ui-text-tertiary)}
        .render-zoom-lens{position:absolute;width:var(--ui-render-lens-size);height:var(--ui-render-lens-size);z-index:7;overflow:hidden;border:var(--ui-render-lens-border) solid var(--ui-text-primary);border-radius:var(--ui-radius-pill);background-color:var(--ui-surface-bg);background-repeat:no-repeat;box-shadow:var(--ui-shadow-elevated);opacity:0;visibility:hidden;pointer-events:none}
        .render-zoom-lens[data-visible="true"]{opacity:1;visibility:visible}
        .render-zoom-lens[data-placement="above"]{transform:translate(-50%,calc(-100% - var(--ui-render-lens-offset)))}
        .render-zoom-lens[data-placement="below"]{transform:translate(-50%,var(--ui-render-lens-offset))}
        .render-zoom-lens::before,.render-zoom-lens::after{content:"";position:absolute;left:50%;top:50%;z-index:2;background:var(--ui-text-primary);transform:translate(-50%,-50%)}
        .render-zoom-lens::before{width:var(--ui-render-lens-crosshair-size);height:var(--ui-render-lens-crosshair-stroke)}
        .render-zoom-lens::after{width:var(--ui-render-lens-crosshair-stroke);height:var(--ui-render-lens-crosshair-size)}
        .render-link-tools{display:flex;flex-wrap:wrap;align-items:center;gap:var(--ui-render-tool-gap);margin-left:auto;min-width:0}
        .render-link-tools select{width:var(--ui-render-tool-select-width);max-width:100%;font-size:var(--ui-render-label-code-size);border:var(--ui-border-width) solid var(--ui-border-default);border-radius:var(--ui-radius-action);padding:calc(var(--ui-section-py)/5) calc(var(--ui-section-px)/3);background:var(--ui-surface-bg);color:var(--ui-text-primary)}
        .render-print-sheet{display:none}
        @media print{
          .no-print,.render-toolbar{display:none!important}
          .render-board-screen{display:none!important}
          .render-print-sheet{display:grid!important;width:var(--ui-render-print-page-width);height:var(--ui-render-print-page-height);box-sizing:border-box;grid-template-rows:auto minmax(0,1fr);gap:var(--ui-render-print-heading-gap);padding:var(--ui-render-print-padding-y) var(--ui-render-print-padding-x);break-inside:avoid;page-break-inside:avoid;background:var(--ui-surface-bg)}
          .render-print-heading{align-self:start;border-bottom:var(--ui-border-width) solid var(--ui-border-default);padding-bottom:calc(var(--ui-render-print-heading-gap)/2)}
          .render-print-kicker{font-family:var(--font-sans);font-size:var(--ui-render-print-meta-size);font-weight:700;letter-spacing:var(--ui-render-print-kicker-tracking);text-transform:uppercase;color:var(--ui-text-tertiary)}
          .render-print-title{margin:0;font-family:var(--font-serif);font-size:var(--ui-render-print-heading-size);font-weight:700;color:var(--ui-text-primary)}
          .render-print-artwork{align-self:center}
          .render-board-print img.render-photo{display:block;margin:0 auto;width:${PRINT_LAYOUT.imageWidthPercent}%;height:auto;user-select:none}
          .render-board-print .render-label{width:${PRINT_LAYOUT.gutterPercent - RENDER_BOARD_CONFIG.labelInnerGapPercent - RENDER_BOARD_CONFIG.labelTextGapPercent}%}
          .render-board-print .render-label .code{font-size:var(--ui-render-print-code-size)}
          .render-print-dot{position:absolute;width:var(--ui-render-pin-print-size);height:var(--ui-render-pin-print-size);transform:translate(-50%,-50%);border-radius:var(--ui-radius-pill);background:var(--rp-accent);z-index:3}
        }
      `}</style>

      <div className="no-print render-toolbar">
        {boards.map((b) => (
          <button key={b.id} type="button" className="render-tab" data-active={b.id === activeId} onClick={() => { hidePointingLens(); setActiveId(b.id); setSelectedPin(null); }}>
            {b.title}
          </button>
        ))}
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy} className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]">
              <Plus aria-hidden="true" /> {busy ? "Uploading…" : "New board"}
            </Button>
            {board && (
              <>
                <Button variant="outline" size="sm" onClick={renameBoard} className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]">Rename</Button>
                <Button variant="outline" size="sm" onClick={removeBoard} className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] border-red-200 text-red-600 hover:bg-red-50"><Trash2 aria-hidden="true" /> Delete board</Button>
                {selectedAnnotation ? (
                  <div className="render-link-tools">
                    <select
                      aria-label="Link selected pin to a schedule code"
                      value={selectedAnnotation.entry_id ?? ""}
                      onChange={(event) =>
                        setAnnotationEntry(
                          selectedAnnotation.id,
                          event.target.value || null
                        )
                      }
                    >
                      <option value="">— link a schedule code —</option>
                      {entryOptions.map((option) => (
                        <option key={option.entry_id} value={option.entry_id}>
                          {option.code}
                          {option.name
                            ? ` · ${option.name}`
                            : option.type_label
                              ? ` · ${option.type_label}`
                              : ""}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => cycleSide(selectedAnnotation)}
                      className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] text-xs"
                    >
                      <MoveHorizontal aria-hidden="true" />
                      {selectedAnnotation.label_side}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removePin(selectedAnnotation.id)}
                      className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))] border-red-200 text-red-600 hover:bg-red-50"
                      aria-label="Delete selected pin"
                      title="Delete selected pin"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPin(null)}
                      className="rounded-[var(--ui-radius-action,calc(var(--ui-radius-card,0.75rem)*0.33))]"
                      aria-label="Close pin tools"
                      title="Close pin tools"
                    >
                      <X aria-hidden="true" />
                    </Button>
                  </div>
                ) : (
                  <span className="render-hint ml-auto">
                    Click the render to drop a pin · drag pins to move · click a
                    pin to link a code.
                  </span>
                )}
              </>
            )}
          </>
        )}
        {!canEdit && <span className="render-hint ml-auto">View only.</span>}
      </div>

      {board && (
        <div
          className="render-board render-board-screen"
          style={{ aspectRatio: boardAspectRatio(board.image_ratio, SCREEN_LAYOUT) }}
          onPointerMove={onPinPointerMove}
          onPointerUp={onPinPointerUp}
          onPointerCancel={onPinPointerCancel}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src={board.image_url}
            alt={board.title}
            className="render-photo"
            draggable={false}
            onClick={canEdit ? (e) => addPinAt(e.clientX, e.clientY) : undefined}
            onPointerMove={
              canEdit
                ? (e) => showPointingLens(e.clientX, e.clientY)
                : undefined
            }
            onPointerLeave={
              canEdit
                ? () => {
                    if (!dragRef.current) hidePointingLens();
                  }
                : undefined
            }
            style={{ cursor: canEdit ? "crosshair" : "default" }}
          />

          <svg className="render-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {screenLabelViews.map((view) => (
              <path
                key={view.a.id}
                id={`leader-${view.a.id}`}
                className="lead"
                d={leaderPath(view, board.image_ratio, SCREEN_LAYOUT)}
              />
            ))}
          </svg>

          {/* Labels */}
          {screenLabelViews.map(({ a, side, labelY }) => {
            const code = a.code ?? (a.entry_id ? entryById.get(a.entry_id)?.code : null);
            if (!code) return null;
            return (
              <div
                key={`label-${a.id}`}
                className={canEdit ? "render-label editable" : "render-label"}
                data-side={side}
                style={{ top: `${labelY}%` }}
                onClick={canEdit ? () => setSelectedPin(a.id) : undefined}
              >
                <div className="code">{code}</div>
              </div>
            );
          })}

          {/* Pins (edit interaction) */}
          {board.annotations.map((a) => (
            <div
              key={`pin-${a.id}`}
              id={`pin-${a.id}`}
              className="render-pin"
              style={{ left: `${imageXToBoardX(a.pin_x, SCREEN_LAYOUT)}%`, top: `${a.pin_y}%` }}
              onPointerDown={(e) => onPinPointerDown(e, a.id)}
              onClick={(e) => { e.stopPropagation(); if (canEdit) setSelectedPin(a.id); }}
            />
          ))}

          {canEdit && (
            <div
              ref={lensRef}
              className="no-print render-zoom-lens"
              data-visible="false"
              data-placement="above"
              style={{
                backgroundImage: `url(${JSON.stringify(board.image_url)})`,
              }}
              aria-hidden="true"
            />
          )}
        </div>
      )}

      {board && (
        <section className="render-print-sheet">
          <div className="render-print-heading">
            <div className="render-print-kicker">Render Board</div>
            <h2 className="render-print-title">{board.title}</h2>
          </div>
          <div className="render-print-artwork">
            <div
              className="render-board render-board-print"
              style={{ aspectRatio: boardAspectRatio(board.image_ratio, PRINT_LAYOUT) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={board.image_url}
                alt=""
                className="render-photo"
                draggable={false}
              />

              <svg className="render-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                {printLabelViews.map((view) => (
                  <path
                    key={view.a.id}
                    className="lead"
                    d={leaderPath(view, board.image_ratio, PRINT_LAYOUT)}
                  />
                ))}
              </svg>

              {printLabelViews.map(({ a, side, labelY }) => {
                const code = a.code ?? (a.entry_id ? entryById.get(a.entry_id)?.code : null);
                if (!code) return null;
                return (
                  <div
                    key={`print-label-${a.id}`}
                    className="render-label"
                    data-side={side}
                    style={{ top: `${labelY}%` }}
                  >
                    <div className="code">{code}</div>
                  </div>
                );
              })}

              {printAnnotations.map((annotation) => (
                <div
                  key={`print-dot-${annotation.id}`}
                  className="render-print-dot"
                  style={{
                    left: `${imageXToBoardX(annotation.pin_x, PRINT_LAYOUT)}%`,
                    top: `${annotation.pin_y}%`,
                  }}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <input ref={fileRef} type="file" accept="image/*" onChange={onUpload} className="hidden" />
      {appConfirm.dialog}
    </div>
  );
}
