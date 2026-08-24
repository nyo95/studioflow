"use client";

/**
 * MASTER DATA — sample request feed.
 *
 * The Overview's action surface. Aggregate counts tell staff nothing to do;
 * this list does. Open requests come oldest-first so the longest-waiting
 * designer sits at the top, and each row shows the wait in days because that
 * is the number that makes a queue legible.
 */

import * as React from "react";
import { Inbox, Search } from "lucide-react";
import { formatDateWithOptions } from "@/core/utilities/datetime";
import { normalizeSearchText } from "@/core/utilities/normalize";
import {
  Input, SectionCard,
  TableCard, TableCardBody, TableCardCell, TableCardHead, TableCardHeader, TableCardRow,
  UI_ENGINE_RADIUS_CONTROL, UI_ENGINE_TYPE_META,
} from "@/ui_engine";
import { cn } from "@/lib/utils";
import { SampleRequestDialog } from "./SampleRequestDialog";
import type { SampleRequestData } from "../types/sample-request";

const STATUS_META: Record<
  SampleRequestData["status"],
  { label: string; className: string }
> = {
  REQUESTED: { label: "Waiting", className: "bg-slate-100 text-slate-600" },
  IN_PROGRESS: { label: "In progress", className: "bg-amber-50 text-amber-700" },
  RECEIVED: { label: "Received", className: "bg-emerald-50 text-emerald-700" },
  UNAVAILABLE: { label: "Unavailable", className: "bg-rose-50 text-rose-700" },
};

function daysWaiting(from: Date | string) {
  return Math.max(0, Math.floor((Date.now() - new Date(from).getTime()) / 86_400_000));
}

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return formatDateWithOptions(value, { day: "numeric", month: "short" });
}

export function SampleRequestPanel({
  openRequests: initialOpen,
  closedRequests: initialClosed,
  canManage,
}: {
  openRequests: SampleRequestData[];
  closedRequests: SampleRequestData[];
  canManage: boolean;
}) {
  const [openRequests, setOpenRequests] = React.useState(initialOpen);
  const [closedRequests, setClosedRequests] = React.useState(initialClosed);
  const [tab, setTab] = React.useState<"open" | "closed">("open");
  const [query, setQuery] = React.useState("");
  const [selected, setSelected] = React.useState<SampleRequestData | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const source = tab === "open" ? openRequests : closedRequests;

  const visible = React.useMemo(() => {
    const q = normalizeSearchText(query);
    if (!q) return source;
    return source.filter((r) =>
      [r.itemName, r.brandName, r.projectName, r.requestedByName]
        .filter(Boolean)
        .some((value) => normalizeSearchText(value).includes(q))
    );
  }, [source, query]);

  /**
   * A saved request may cross the open/closed boundary, so both lists are
   * reconciled rather than the current one patched in place — otherwise a
   * received request would linger in the open feed until a full reload.
   */
  const handleUpdated = (updated: SampleRequestData) => {
    const isOpen = updated.status === "REQUESTED" || updated.status === "IN_PROGRESS";
    setOpenRequests((prev) => {
      const without = prev.filter((r) => r.id !== updated.id);
      return isOpen
        ? [...without, updated].sort(
            (a, b) => new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
          )
        : without;
    });
    setClosedRequests((prev) => {
      const without = prev.filter((r) => r.id !== updated.id);
      return isOpen ? without : [updated, ...without];
    });
    setSelected(updated);
  };

  const openDialog = (row: SampleRequestData) => {
    setSelected(row);
    setDialogOpen(true);
  };

  const waitingCount = openRequests.filter((r) => r.status === "REQUESTED").length;
  const overdueCount = openRequests.filter((r) => daysWaiting(r.requestedAt) >= 7).length;

  return (
    <>
      <SectionCard padding="none" className="mb-6 overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ui-border-subtle)] px-[var(--ui-section-px)] py-4">
          <div>
            <h2 className="font-serif text-base font-semibold text-slate-950">
              Sample Requests
            </h2>
            <p className={cn("mt-0.5 text-slate-500", UI_ENGINE_TYPE_META)}>
              Material requests from StudioFlow designers. Open a row to contact
              the vendor, record a price, or receive the sample.
            </p>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex flex-col">
              <span className={cn("uppercase tracking-wide text-slate-400", UI_ENGINE_TYPE_META)}>
                Waiting
              </span>
              <span className="font-sans text-xl font-semibold tabular-nums text-slate-950">
                {waitingCount}
              </span>
            </div>
            <div className="flex flex-col">
              <span className={cn("uppercase tracking-wide text-slate-400", UI_ENGINE_TYPE_META)}>
                &gt; 7 days
              </span>
              <span
                className={cn(
                  "font-sans text-xl font-semibold tabular-nums",
                  overdueCount > 0 ? "text-rose-600" : "text-slate-950"
                )}
              >
                {overdueCount}
              </span>
            </div>
          </div>
        </div>

        {/* Tabs + search */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--ui-border-subtle)] px-[var(--ui-section-px)] py-3">
          <div className="flex gap-1">
            {([
              ["open", "Needs action", openRequests.length],
              ["closed", "History", closedRequests.length],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-[var(--ui-radius-control)] px-3 py-1.5 font-sans text-xs font-medium transition-colors",
                  tab === key
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                )}
              >
                {label}
                <span className="tabular-nums opacity-70">{count}</span>
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search material, brand, project…"
              className={cn("pl-9", UI_ENGINE_RADIUS_CONTROL)}
            />
          </div>
        </div>

        {/* Table */}
        <TableCard layout="auto" minWidth="var(--ui-sample-request-table-min-width)">
          <TableCardHeader>
            <TableCardHead style={{ width: "26%" }}>Material</TableCardHead>
            <TableCardHead style={{ width: "16%" }}>Brand</TableCardHead>
            <TableCardHead style={{ width: "18%" }}>Project</TableCardHead>
            <TableCardHead style={{ width: "14%" }}>Requested by</TableCardHead>
            <TableCardHead style={{ width: "10%" }}>Date</TableCardHead>
            <TableCardHead style={{ width: "8%" }}>Waiting</TableCardHead>
            <TableCardHead style={{ width: "8%" }}>Status</TableCardHead>
          </TableCardHeader>
          <TableCardBody>
            {visible.length === 0 ? (
              <TableCardRow>
                <TableCardCell colSpan={7}>
                  <div className="flex flex-col items-center gap-2 py-14 text-center">
                    <Inbox className="size-8 text-slate-300" />
                    <p className={cn("max-w-sm text-slate-400", UI_ENGINE_TYPE_META)}>
                      {query
                        ? "No requests match this search."
                        : tab === "open"
                          ? "No requests waiting. Every designer request has been actioned."
                          : "No completed requests yet."}
                    </p>
                  </div>
                </TableCardCell>
              </TableCardRow>
            ) : (
              visible.map((row) => {
                const status = STATUS_META[row.status];
                const waiting = daysWaiting(row.requestedAt);
                const isOpenRow = row.status === "REQUESTED" || row.status === "IN_PROGRESS";
                return (
                  <TableCardRow
                    key={row.id}
                    className="cursor-pointer hover:bg-slate-50"
                    onClick={() => openDialog(row)}
                  >
                    <TableCardCell>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium text-slate-950">{row.itemName}</span>
                        {row.areaLocation ? (
                          <span className={cn("truncate text-slate-400", UI_ENGINE_TYPE_META)}>
                            {row.areaLocation}
                          </span>
                        ) : null}
                      </div>
                    </TableCardCell>
                    <TableCardCell>
                      {row.brandName ? (
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-slate-700">{row.brandName}</span>
                          {row.companyName ? (
                            <span className={cn("truncate text-slate-400", UI_ENGINE_TYPE_META)}>
                              {row.companyName}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-amber-700" title="A request with no brand cannot be received as a sample">
                          Not provided
                        </span>
                      )}
                    </TableCardCell>
                    <TableCardCell className="truncate text-slate-500">{row.projectName}</TableCardCell>
                    <TableCardCell className="truncate text-slate-500">{row.requestedByName}</TableCardCell>
                    <TableCardCell className={cn("tabular-nums text-slate-500", UI_ENGINE_TYPE_META)}>
                      {fmtDate(row.requestedAt)}
                    </TableCardCell>
                    <TableCardCell>
                      {isOpenRow ? (
                        <span
                          className={cn(
                            "font-sans text-xs font-semibold tabular-nums",
                            waiting >= 7 ? "text-rose-600" : "text-slate-400"
                          )}
                        >
                          {waiting}d
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCardCell>
                    <TableCardCell>
                      <span
                        className={cn(
                          "inline-block whitespace-nowrap rounded-[var(--ui-radius-pill)] px-2 py-0.5 font-sans text-[10px] font-semibold",
                          status.className
                        )}
                      >
                        {status.label}
                      </span>
                    </TableCardCell>
                  </TableCardRow>
                );
              })
            )}
          </TableCardBody>
        </TableCard>
      </SectionCard>

      <SampleRequestDialog
        request={selected}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdated={handleUpdated}
        canManage={canManage}
      />
    </>
  );
}
