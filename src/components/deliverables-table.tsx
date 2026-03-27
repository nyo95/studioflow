"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink, FileText, Link as LinkIcon, UploadCloud } from "lucide-react";
import { Role } from "@/generated/prisma";
import { DeliverableUploadDialog } from "@/components/deliverable-upload-dialog";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { cn } from "@/lib/utils";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface DeliverablePhaseRow {
  phaseId: string;
  phaseName: string;
  currentRevision: {
    id: string;
    version: string;
  } | null;
  latestFile: {
    id: string;
    file_name: string;
    file_url: string;
    link_url: string | null;
    is_external: boolean;
    created_at: Date;
    revision_version: string;
  } | null;
  isAuthorized: boolean;
}

interface DeliverablesTableProps {
  rows: DeliverablePhaseRow[];
  userId: string;
  userRole: Role;
}

function formatPhaseName(phaseName: string) {
  return phaseName.replace(/_/g, " ");
}

function formatRevisionLabel(version: string | null) {
  return version ? `Rev. ${version.slice(1)}` : "No revision";
}

function formatUploadedDate(date: Date | null) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function DeliverablesTable({
  rows,
  userId,
  userRole,
}: DeliverablesTableProps) {
  const columns: Array<DataTableColumn<DeliverablePhaseRow>> = [
    {
      id: "phase",
      header: <span className="font-sans text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Phase</span>,
      className: "w-[14%] pb-3",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-serif text-sm font-bold uppercase tracking-[0.14em] text-slate-900">
            {formatPhaseName(row.phaseName)}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Compliance Row
          </span>
        </div>
      ),
    },
    {
      id: "currentRevision",
      header: <span className="font-sans text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Current Revision</span>,
      className: "w-[18%] pb-3",
      cell: (row) => {
        const isOutdated =
          row.latestFile !== null &&
          row.currentRevision !== null &&
          row.latestFile.revision_version !== row.currentRevision.version;

        if (isOutdated && row.currentRevision) {
          return (
            <div className="flex items-center gap-1.5 flex-nowrap">
              <Badge variant="outline" className="border-slate-200 bg-white font-mono text-[10px] text-slate-400 px-1.5 py-0">
                {formatRevisionLabel(row.latestFile!.revision_version)}
              </Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500 animate-pulse cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Outdated</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className="text-slate-300">→</span>
              <Badge variant="outline" className="border-amber-200 bg-amber-50 font-mono text-[10px] font-bold text-amber-800 px-1.5 py-0">
                {formatRevisionLabel(row.currentRevision.version)}
              </Badge>
            </div>
          );
        }

        return (
          <Badge variant="outline" className="border-slate-200 bg-white font-mono text-[11px] text-slate-700">
            {formatRevisionLabel(row.currentRevision?.version ?? null)}
          </Badge>
        );
      },
    },
    {
      id: "file",
      header: <span className="font-sans text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">File / Deliverable</span>,
      className: "w-[30%] pb-3",
      cell: (row) => {
        if (!row.latestFile) {
          return (
            <div className="flex items-center gap-3 text-slate-400">
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2">
                <FileText className="h-4 w-4" />
              </div>
              <span className="text-sm italic">No file uploaded</span>
            </div>
          );
        }

        const href = row.latestFile.is_external ? row.latestFile.link_url : row.latestFile.file_url;

        return (
          <div className="flex items-center gap-3 max-w-full overflow-hidden">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 shrink-0">
              {row.latestFile.is_external ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex flex-col">
              <p className="truncate text-sm font-semibold text-slate-900 leading-tight">
                {row.latestFile.file_name}
              </p>
              {href && (
                <Link
                  href={href}
                  target="_blank"
                  className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open
                </Link>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "type",
      header: <span className="font-sans text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Type</span>,
      className: "w-[12%] pb-3",
      cell: (row) => (
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
          {row.latestFile ? (row.latestFile.is_external ? "URL" : "File") : "-"}
        </Badge>
      ),
    },
    {
      id: "uploadedDate",
      header: <span className="font-sans text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Uploaded Date</span>,
      className: "w-[12%] pb-3",
      sortValue: (row) => row.latestFile?.created_at.getTime() ?? Number.NEGATIVE_INFINITY,
      cell: (row) => (
        <span className="text-xs text-slate-600">
          {formatUploadedDate(row.latestFile?.created_at ?? null)}
        </span>
      ),
    },
    {
      id: "action",
      header: <span className="font-sans text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 text-right w-full block">Action</span>,
      className: "w-[14%] pb-3 text-right",
      cell: (row) => {
        const isOutdated =
          row.latestFile !== null &&
          row.currentRevision !== null &&
          row.latestFile.revision_version !== row.currentRevision.version;

        if (!row.isAuthorized) {
          return <span className="text-xs font-medium text-slate-400">No access</span>;
        }

        if (!row.currentRevision) {
          return <span className="text-xs font-medium text-slate-400">No revision</span>;
        }

        return (
          <DeliverableUploadDialog
            revisionId={row.currentRevision.id}
            userId={userId}
            userRole={userRole}
            canMutate={row.isAuthorized}
            phaseLabel={formatPhaseName(row.phaseName)}
            revisionLabel={row.currentRevision.version}
            triggerLabel={row.latestFile ? (isOutdated ? "Update" : "Update") : "Upload"}
            className={cn(
              "h-8 px-4 text-[10px] font-black uppercase tracking-widest transition-all",
              isOutdated 
                ? "border-amber-300 bg-amber-50/50 text-amber-700 hover:bg-amber-500 hover:text-white hover:border-solid shadow-[0_2px_10px_-4px_rgba(245,158,11,0.2)]" 
                : "border-slate-200 text-slate-500 hover:bg-slate-900 hover:text-white"
            )}
          />
        );
      },
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(255,255,255,1))] px-6 py-5">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Compliance Dashboard</p>
            <h2 className="mt-2 font-serif text-2xl font-bold text-slate-950">Phase Deliverable Compliance</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Exactly one row per phase. Each row compares the latest uploaded deliverable against the current revision baseline.
            </p>
          </div>
          <div className="hidden rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right lg:block">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Rows</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UploadCloud className="h-4 w-4 text-slate-400" />
              {rows.length} phases monitored
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.phaseId}
          getRowClassName={(row) => {
            const isOutdated =
              row.latestFile !== null &&
              row.currentRevision !== null &&
              row.latestFile.revision_version !== row.currentRevision.version;
            
            return isOutdated ? "bg-amber-50/40 hover:bg-amber-50/60 transition-colors" : "";
          }}
          emptyMessage="No phases found for this project."
        />
      </div>
    </section>
  );
}
