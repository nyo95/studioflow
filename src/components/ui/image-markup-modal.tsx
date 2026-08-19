"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { X, Undo, Trash2, Check, Minus, Type, Pen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ImageMarkupModalProps {
  imageSrc: string;
  onClose: () => void;
  onSave: (file: File) => void;
  title?: string;
  confirmLabel?: string;
}

type Tool = "pen" | "line" | "text";

const BRUSH_COLORS = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Yellow", value: "#eab308" },
  { name: "Green", value: "#22c55e" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Black", value: "#0f172a" },
  { name: "White", value: "#ffffff" },
];

const BRUSH_SIZES = [
  { label: "S", value: 3 },
  { label: "M", value: 6 },
  { label: "L", value: 12 },
];

const TOOLS: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: "pen", icon: Pen, label: "Pen (Free draw)" },
  { id: "line", icon: Minus, label: "Straight Line (hold Shift while drawing)" },
  { id: "text", icon: Type, label: "Text" },
];

function getCanvasCoords(
  e: React.PointerEvent<HTMLCanvasElement>,
  canvas: HTMLCanvasElement
) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

export function ImageMarkupModal({
  imageSrc,
  onClose,
  onSave,
  title = "Annotate Image",
  confirmLabel = "Save",
}: ImageMarkupModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState("#ef4444");
  const [brushSize, setBrushSize] = useState(6);
  const [activeTool, setActiveTool] = useState<Tool>("pen");
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const lineStartRef = useRef<{ x: number; y: number } | null>(null);
  const [textInput, setTextInput] = useState<{
    x: number;
    y: number;
    canvasX: number;
    canvasY: number;
    value: string;
  } | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;
    img.onload = () => {
      imageRef.current = img;
      setImgLoaded(true);
    };
    img.onerror = () => {
      toast.error("Failed to load image");
      onClose();
    };
  }, [imageSrc, onClose]);

  useEffect(() => {
    if (!imgLoaded || !imageRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = imageRef.current;
    const maxWidth = Math.min(window.innerWidth * 0.85, 960);
    const maxHeight = Math.min(window.innerHeight * 0.6, 560);

    let width = img.width;
    let height = img.height;

    if (width > maxWidth) {
      height = (maxWidth / width) * height;
      width = maxWidth;
    }
    if (height > maxHeight) {
      width = (maxHeight / height) * width;
      height = maxHeight;
    }

    canvas.width = Math.round(width);
    canvas.height = Math.round(height);

    if (overlay) {
      overlay.width = canvas.width;
      overlay.height = canvas.height;
    }

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }, [imgLoaded]);

  useEffect(() => {
    if (textInput) {
      setTimeout(() => textAreaRef.current?.focus(), 50);
    }
  }, [textInput]);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasCoords(e, canvas);

    if (activeTool === "text") {
      const rect = canvas.getBoundingClientRect();
      setTextInput({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        canvasX: x,
        canvasY: y,
        value: "",
      });
      return;
    }

    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-19), snapshot]);
    setIsDrawing(true);

    if (activeTool === "line") {
      lineStartRef.current = { x, y };
    } else {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }, [activeTool]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { x, y } = getCanvasCoords(e, canvas);

    if (activeTool === "line" && lineStartRef.current) {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;
      const oCtx = overlay.getContext("2d");
      if (!oCtx) return;

      oCtx.clearRect(0, 0, overlay.width, overlay.height);
      oCtx.beginPath();

      let endX = x;
      let endY = y;

      if (e.shiftKey) {
        const dx = x - lineStartRef.current.x;
        const dy = y - lineStartRef.current.y;
        const angle = Math.atan2(dy, dx);
        const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.sqrt(dx * dx + dy * dy);
        endX = lineStartRef.current.x + Math.cos(snapped) * dist;
        endY = lineStartRef.current.y + Math.sin(snapped) * dist;
      }

      oCtx.moveTo(lineStartRef.current.x, lineStartRef.current.y);
      oCtx.lineTo(endX, endY);
      oCtx.strokeStyle = color;
      oCtx.lineWidth = brushSize;
      oCtx.lineCap = "round";
      oCtx.stroke();
    } else if (activeTool === "pen") {
      ctx.lineTo(x, y);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }, [isDrawing, activeTool, color, brushSize]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (activeTool === "line" && lineStartRef.current) {
      const { x, y } = getCanvasCoords(e, canvas);
      let endX = x;
      let endY = y;

      if (e.shiftKey) {
        const dx = x - lineStartRef.current.x;
        const dy = y - lineStartRef.current.y;
        const angle = Math.atan2(dy, dx);
        const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
        const dist = Math.sqrt(dx * dx + dy * dy);
        endX = lineStartRef.current.x + Math.cos(snapped) * dist;
        endY = lineStartRef.current.y + Math.sin(snapped) * dist;
      }

      ctx.beginPath();
      ctx.moveTo(lineStartRef.current.x, lineStartRef.current.y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.stroke();

      if (overlay) {
        const oCtx = overlay.getContext("2d");
        oCtx?.clearRect(0, 0, overlay.width, overlay.height);
      }
      lineStartRef.current = null;
    }

    setIsDrawing(false);
  }, [isDrawing, activeTool, color, brushSize]);

  const commitText = useCallback(() => {
    if (!textInput || !textInput.value.trim()) {
      setTextInput(null);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-19), snapshot]);

    const fontSize = Math.max(brushSize * 3, 14);
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 3;

    const lines = textInput.value.split("\n");
    lines.forEach((line, i) => {
      ctx.fillText(line, textInput.canvasX, textInput.canvasY + i * (fontSize * 1.3));
    });

    ctx.shadowBlur = 0;
    setTextInput(null);
  }, [textInput, brushSize, color]);

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const prev = [...history];
    const last = prev.pop();
    if (last) {
      ctx.putImageData(last, 0, 0);
      setHistory(prev);
    }
  }, [history]);

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory((prev) => [...prev.slice(-19), snap]);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);
  }, []);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (blob) => {
        if (blob) {
          onSave(new File([blob], `image_annotated_${Date.now()}.png`, { type: "image/png" }));
        } else {
          toast.error("Failed to generate annotated image");
        }
      },
      "image/png",
      0.95
    );
  }, [onSave]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (textInput) return;
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [textInput, handleSave, onClose, handleUndo]);

  const canvasStyle = activeTool === "text" ? "cursor-text" : "cursor-crosshair";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-[var(--ui-radius-card)] border border-[var(--ui-border-default)] bg-white shadow-[var(--ui-shadow-elevated)]">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--ui-border-subtle)] bg-slate-50 px-5">
          <div className="flex items-center gap-2">
            <h3 className="font-serif text-sm font-bold text-slate-900">{title}</h3>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Draw on Image</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--ui-radius-action)] text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center bg-slate-100/50 p-6">
          {!imgLoaded ? (
            <div className="flex flex-col items-center gap-2 text-slate-400">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-800" />
              <p className="font-sans text-xs">Loading image editor...</p>
            </div>
          ) : (
            <div className="relative max-h-full max-w-full overflow-hidden rounded-[var(--ui-radius-control)] border border-[var(--ui-border-default)] bg-white shadow-[var(--ui-shadow-card)]">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                className={`block max-w-full touch-none select-none ${canvasStyle}`}
              />
              <canvas
                ref={overlayCanvasRef}
                className="pointer-events-none absolute inset-0"
              />
              {textInput && (
                <textarea
                  ref={textAreaRef}
                  value={textInput.value}
                  onChange={(e) => setTextInput((t) => (t ? { ...t, value: e.target.value } : null))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      commitText();
                    } else if (e.key === "Escape") {
                      setTextInput(null);
                    }
                  }}
                  onBlur={commitText}
                  style={{
                    position: "absolute",
                    left: textInput.x,
                    top: textInput.y,
                    color,
                    fontSize: `${Math.max(brushSize * 3, 14)}px`,
                    fontWeight: "bold",
                    background: "transparent",
                    border: `1.5px dashed ${color}`,
                    outline: "none",
                    resize: "none",
                    minWidth: "80px",
                    maxWidth: "300px",
                    lineHeight: "1.3",
                    padding: "2px 4px",
                    borderRadius: "2px",
                  }}
                  placeholder="Type here..."
                  rows={2}
                />
              )}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-[var(--ui-border-subtle)] bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-[var(--ui-radius-control)] bg-slate-200/50 p-0.5">
              {TOOLS.map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => {
                    setActiveTool(tool.id);
                    setTextInput(null);
                  }}
                  className={`flex h-7 w-8 items-center justify-center rounded-[var(--ui-radius-action)] transition-colors ${
                    activeTool === tool.id ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"
                  }`}
                  title={tool.label}
                >
                  <tool.icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-1.5">
              {BRUSH_COLORS.map((brushColor) => (
                <button
                  key={brushColor.value}
                  onClick={() => setColor(brushColor.value)}
                  style={{ backgroundColor: brushColor.value }}
                  className="group relative flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 shadow-sm transition-transform hover:scale-110 active:scale-95"
                  title={brushColor.name}
                >
                  {color === brushColor.value && (
                    <Check
                      className={`h-3.5 w-3.5 ${
                        brushColor.value === "#ffffff" || brushColor.value === "#eab308" ? "text-slate-900" : "text-white"
                      }`}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-slate-200" />

            <div className="flex items-center gap-1 rounded-[var(--ui-radius-control)] bg-slate-200/50 p-0.5">
              {BRUSH_SIZES.map((size) => (
                <button
                  key={size.value}
                  onClick={() => setBrushSize(size.value)}
                  className={`flex h-6 w-8 items-center justify-center rounded-[var(--ui-radius-action)] text-[10px] font-bold transition-colors ${
                    brushSize === size.value ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  {size.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleUndo}
              disabled={history.length === 0}
              className="h-8 gap-1.5 border border-[var(--ui-border-default)] text-xs text-slate-600"
            >
              <Undo className="h-3.5 w-3.5" />
              Undo
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="h-8 gap-1.5 border border-[var(--ui-border-default)] text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>

            <div className="h-6 w-px bg-slate-200" />

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleSave}
              disabled={!imgLoaded}
              className="h-8 gap-1.5 bg-slate-900 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Check className="h-3.5 w-3.5" />
              {confirmLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
