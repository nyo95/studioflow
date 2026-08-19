"use client";

import Link from "next/link";
import { AlertTriangle, ExternalLink, FileText, Link as LinkIcon } from "lucide-react";
import { Role } from "@/generated/prisma";
import { DeliverableUploadDialog } from "@/components/deliverable-upload-dialog";
import { Badge } from "@/ui_engine";
import { cn } from "@/lib/utils";
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui_engine";
import { 
  TableCard, 
  TableCardHeader, 
  TableCardHead, 
  TableCardBody, 
  TableCardRow, 
  TableCardCell,
  Heading
} from "@/ui_engine";
import { useTableResizer } from "@/hooks/use-table-resizer";

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
  projectId: string;
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
  projectId,
  rows,
  userId,
  userRole,
}: DeliverablesTableProps) {
  const { widths, onResizeStart } = useTableResizer("deliverables-table", {
    phase: 14,
    revision: 18,
    file: 30,
    type: 12,
    date: 12,
    action: 14,
  });

  const headerContent = (
    <div className="flex w-full items-start justify-between gap-6 py-2">
      <div>
        <Heading variant="uiMeta" level={4} className="opacity-40">Compliance Dashboard</Heading>
        <Heading level={2} className="mt-2">Phase Deliverable Compliance</Heading>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Exactly one row per phase. Each row compares the latest uploaded deliverable against the current revision baseline.
        </p>
      </div>

    </div>
  );

  return (
    <TableCard header={headerContent} layout="fixed" minWidth="760px">
      <TableCardHeader>
        <TableCardHead 
          style={{ width: `${widths.phase}%` }}
          onResizeStart={(e) => onResizeStart("phase", e, "revision")}
        >
          Phase
        </TableCardHead>
        <TableCardHead 
          style={{ width: `${widths.revision}%` }}
          onResizeStart={(e) => onResizeStart("revision", e, "file")}
        >
          Current Revision
        </TableCardHead>
        <TableCardHead 
          style={{ width: `${widths.file}%` }}
          onResizeStart={(e) => onResizeStart("file", e, "type")}
        >
          File / Deliverable
        </TableCardHead>
        <TableCardHead 
          style={{ width: `${widths.type}%` }}
          onResizeStart={(e) => onResizeStart("type", e, "date")}
        >
          Type
        </TableCardHead>
        <TableCardHead 
          style={{ width: `${widths.date}%` }}
          onResizeStart={(e) => onResizeStart("date", e, "action")}
        >
          Uploaded Date
        </TableCardHead>
        <TableCardHead 
          style={{ width: `${widths.action}%` }}
          className="align-right"
        >
          Action
        </TableCardHead>
      </TableCardHeader>
      <TableCardBody>
        {rows.length === 0 ? (
          <TableCardRow>
            <TableCardCell colSpan={6} className="py-20 text-center text-slate-400 italic">
              No phases found for this project.
            </TableCardCell>
          </TableCardRow>
        ) : (
          rows.map((row) => {
            const isOutdated =
              row.latestFile !== null &&
              row.currentRevision !== null &&
              row.latestFile.revision_version !== row.currentRevision.version;
            
            return (
              <TableCardRow 
                key={row.phaseId}
                className={cn(isOutdated && "bg-amber-50/40 hover:bg-amber-50/60")}
              >
                <TableCardCell>
                  <div className="flex flex-col">
                    <span className="font-sans text-sm font-bold uppercase tracking-[0.14em] text-slate-900">
                      {formatPhaseName(row.phaseName)}
                    </span>
                    <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Compliance Row
                    </span>
                  </div>
                </TableCardCell>
                <TableCardCell>
                  {(() => {
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
                  })()}
                </TableCardCell>
                <TableCardCell>
                  {!row.latestFile ? (
                    <div className="flex items-center gap-3 text-slate-400">
                      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2">
                        <FileText className="h-4 w-4" />
                      </div>
                      <span className="text-sm italic">No file uploaded</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 max-w-full overflow-hidden">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-500 shrink-0">
                        {row.latestFile.is_external ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <p className="truncate text-sm font-semibold text-slate-900 leading-tight">
                          {row.latestFile.file_name}
                        </p>
                        {(row.latestFile.is_external ? row.latestFile.link_url : row.latestFile.file_url) && (
                          <Link
                            href={(row.latestFile.is_external ? row.latestFile.link_url : row.latestFile.file_url)!}
                            target="_blank"
                            className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Open
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </TableCardCell>
                <TableCardCell>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                    {row.latestFile ? (row.latestFile.is_external ? "URL" : "File") : "-"}
                  </Badge>
                </TableCardCell>
                <TableCardCell>
                  <span className="text-xs text-slate-600">
                    {formatUploadedDate(row.latestFile?.created_at ?? null)}
                  </span>
                </TableCardCell>
                <TableCardCell align="right">
                  {(() => {
                    if (!row.isAuthorized) {
                      return <span className="text-xs font-medium text-slate-400">No access</span>;
                    }

                    if (!row.currentRevision) {
                      return <span className="text-xs font-medium text-slate-400">No revision</span>;
                    }

                    return (
                      <DeliverableUploadDialog
                        projectId={projectId}
                        phaseId={row.phaseId}
                        revisionId={row.currentRevision.id}
                        userId={userId}
                        userRole={userRole}
                        canMutate={row.isAuthorized}
                        phaseLabel={formatPhaseName(row.phaseName)}
                        revisionLabel={row.currentRevision.version}
                        triggerLabel={row.latestFile ? "Update" : "Upload"}
                        className={cn(
                          "h-8 px-4 text-[10px] font-black uppercase tracking-widest transition-all shadow-none",
                          isOutdated 
                            ? "border-amber-300 bg-amber-50/50 text-amber-700 hover:bg-amber-500 hover:text-white" 
                            : "border-slate-200 text-slate-500 hover:bg-slate-900 hover:text-white"
                        )}
                      />
                    );
                  })()}
                </TableCardCell>
              </TableCardRow>
            );
          })
        )}
      </TableCardBody>
    </TableCard>
  );
}
