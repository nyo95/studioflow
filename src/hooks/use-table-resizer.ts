"use client";

import { useState, useCallback, useRef, useEffect } from "react";

/**
 * A hook to manage resizable table columns with persistence.
 * @param tableId Unique identifier for the table (used for localStorage key)
 * @param initialWidths Default widths for columns
 */
export function useTableResizer(tableId: string, initialWidths: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(initialWidths);

  // Load from localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`table-widths-${tableId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with initial widths to ensure all columns have a width
        setTimeout(() => setWidths((prev) => ({ ...prev, ...parsed })), 0);
      }
    } catch (e) {
      console.error("Failed to load table widths", e);
    }
  }, [tableId]);

  const resizingColumn = useRef<{ id: string; nextId?: string } | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);
  const startNextWidth = useRef<number>(0);
  const tableWidth = useRef<number>(0);

  const onResizeStart = useCallback((columnId: string, e: React.MouseEvent, nextColumnId?: string) => {
    resizingColumn.current = { id: columnId, nextId: nextColumnId };
    startX.current = e.clientX;
    startWidth.current = widths[columnId] || 10;
    if (nextColumnId) {
      startNextWidth.current = widths[nextColumnId] || 10;
    }
    
    const tableElement = (e.target as HTMLElement).closest("table");
    tableWidth.current = tableElement?.clientWidth || 1000;
    
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    
    // Stop event propagation to prevent sort triggers etc
    e.preventDefault();
    e.stopPropagation();
  }, [widths]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!resizingColumn.current) return;
      
      const { id, nextId } = resizingColumn.current;
      const deltaX = e.clientX - startX.current;
      // Convert delta pixel to percentage of table width
      const deltaPercent = (deltaX / tableWidth.current) * 100;
      
      const newWidth = Math.max(5, startWidth.current + deltaPercent);
      
      setWidths(prev => {
        const updates: Record<string, number> = { [id]: newWidth };
        
        // If a next column is provided, shrink it by the exact amount the current one grew
        // This ensures the total percentage remains 100% and the resize is perfectly 1:1 mapped to the mouse
        if (nextId) {
          const actualDelta = newWidth - startWidth.current;
          updates[nextId] = Math.max(5, startNextWidth.current - actualDelta);
        }
        
        return { ...prev, ...updates };
      });
    };

    const onMouseUp = () => {
      if (resizingColumn.current) {
        resizingColumn.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Save to localStorage when widths change (debounced or just on change)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(`table-widths-${tableId}`, JSON.stringify(widths));
    }
  }, [widths, tableId]);

  return { widths, onResizeStart };
}
