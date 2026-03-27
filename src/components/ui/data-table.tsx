"use client";

import * as React from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<TData> {
  id: string;
  header: React.ReactNode;
  className?: string;
  cell: (row: TData) => React.ReactNode;
  sortValue?: (row: TData) => string | number | null | undefined;
}

interface DataTableProps<TData> {
  columns: Array<DataTableColumn<TData>>;
  data: TData[];
  emptyMessage?: string;
  getRowId: (row: TData) => string;
  rowClassName?: string;
  getRowClassName?: (row: TData) => string;
  initialSortColumnId?: string;
  initialSortDirection?: "asc" | "desc";
}

export function DataTable<TData>({
  columns,
  data,
  emptyMessage = "No records found.",
  getRowId,
  rowClassName,
  getRowClassName,
  initialSortColumnId,
  initialSortDirection = "asc",
}: DataTableProps<TData>) {
  const [sortColumnId, setSortColumnId] = React.useState<string | null>(initialSortColumnId ?? null);
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(initialSortDirection);

  const sortedData = React.useMemo(() => {
    if (!sortColumnId) return data;

    const column = columns.find((item) => item.id === sortColumnId);
    if (!column?.sortValue) return data;

    return [...data].sort((leftRow, rightRow) => {
      const left = column.sortValue?.(leftRow);
      const right = column.sortValue?.(rightRow);

      if (left == null && right == null) return 0;
      if (left == null) return 1;
      if (right == null) return -1;

      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [columns, data, sortColumnId, sortDirection]);

  function handleSort(columnId: string) {
    setSortColumnId((currentColumnId) => {
      if (currentColumnId === columnId) {
        setSortDirection((currentDirection) => (currentDirection === "asc" ? "desc" : "asc"));
        return currentColumnId;
      }

      setSortDirection("asc");
      return columnId;
    });
  }

  return (
    <Table className="border-separate border-spacing-y-3">
      <TableHeader className="select-none">
        <TableRow className="hover:bg-transparent [&>th]:border-b [&>th]:border-zinc-100">
          {columns.map((column) => (
            <TableHead key={column.id} className={column.className}>
              {column.sortValue ? (
                <button
                  type="button"
                  onClick={() => handleSort(column.id)}
                  className="inline-flex items-center gap-1.5 text-left"
                >
                  <span>{column.header}</span>
                  {sortColumnId === column.id ? (
                    sortDirection === "asc" ? (
                      <ArrowUpNarrowWide className="h-3.5 w-3.5 text-slate-400" />
                    ) : (
                      <ArrowDownWideNarrow className="h-3.5 w-3.5 text-slate-400" />
                    )
                  ) : null}
                </button>
              ) : (
                column.header
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedData.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columns.length} className="py-12 text-center font-sans text-slate-500">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          sortedData.map((row) => (
            <TableRow
              key={getRowId(row)}
              className={cn(
                "group bg-white transition-colors hover:bg-zinc-50/50 [&>td]:border-y [&>td]:border-zinc-200/60 [&>td:first-child]:rounded-l-[4px] [&>td:first-child]:border-l [&>td:last-child]:rounded-r-[4px] [&>td:last-child]:border-r",
                rowClassName,
                getRowClassName?.(row)
              )}
            >
              {columns.map((column) => (
                <TableCell key={column.id}>{column.cell(row)}</TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
