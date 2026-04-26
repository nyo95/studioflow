import React from "react";
import { TableCardHead } from "@/ui_engine";

interface ScheduleTableHeaderProps {
  isFixture?: boolean;
  widths: Record<string, number>;
  onResizeStart: (columnId: string, e: React.MouseEvent) => void;
}

export function ScheduleTableHeader({ isFixture = false, widths, onResizeStart }: ScheduleTableHeaderProps) {
  return (
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr>
        <TableCardHead 
          style={{ width: widths.code }}
          onResizeStart={(e) => onResizeStart("code", e)}
          className="px-5 py-4"
        >
          Code
        </TableCardHead>
        <TableCardHead 
          style={{ width: widths.details }}
          onResizeStart={(e) => onResizeStart("details", e)}
          className="px-5 py-4"
        >
          Product Details
        </TableCardHead>
        <TableCardHead 
          style={{ width: widths.location }}
          onResizeStart={(e) => onResizeStart("location", e)}
          className="px-5 py-4"
        >
          Location
        </TableCardHead>
        {isFixture && (
          <TableCardHead 
            style={{ width: widths.qty }}
            onResizeStart={(e) => onResizeStart("qty", e)}
            className="px-5 py-4 text-center"
            align="center"
          >
            Qty
          </TableCardHead>
        )}
        <TableCardHead 
          style={{ width: widths.actions }}
          className="px-5 py-4 text-right"
          align="right"
        >
          Actions
        </TableCardHead>
      </tr>
    </thead>
  );
}
