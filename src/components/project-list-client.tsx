"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Prisma, Role } from "@/generated/prisma";
import { Palette, PenTool, Eye, Search, ArrowUpNarrowWide, ArrowDownWideNarrow } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DeleteProjectButton } from "@/components/delete-button";
import { getProjectProgress, formatPhaseName } from "@/lib/project-progress";
import { ClientBranding } from "@/components/client-branding";
import { 
  Heading, 
  TableCard, 
  TableCardHeader, 
  TableCardHead, 
  TableCardBody, 
  TableCardRow, 
  TableCardCell 
} from "@/ui_engine";
import { updateProjectPriority } from "@/app/actions";

type DashboardProject = Prisma.ProjectGetPayload<{
  select: {
    id: true;
    name: true;
    priority: true;
    client: {
      select: {
        id: true;
        name: true;
        logo_url: true;
      };
    };
    area: true;
    pic_designer_id: true;
    pic_drafter_id: true;
    designer: {
      select: {
        id: true;
        name: true;
        role: true;
      };
    };
    drafter: {
      select: {
        id: true;
        name: true;
        role: true;
      };
    };
    phases: {
      select: {
        id: true;
        name_enum: true;
        status_enum: true;
        order_index: true;
        revisions: {
          select: {
            major: true;
            minor: true;
          };
        };
      };
    };
  };
}>;

interface ProjectListClientProps {
  initialProjects: DashboardProject[];
  userId: string;
  userRole: Role;
}

export function ProjectListClient({ initialProjects, userId, userRole }: ProjectListClientProps) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState<boolean>(userRole === Role.ADMIN);
  const [sortColumnId, setSortColumnId] = useState<string | null>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const filteredProjects = useMemo(() => {
    return initialProjects.filter((project) => {
      const normalizedSearch = search.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        project.name.toLowerCase().includes(normalizedSearch) ||
        (project.client?.name || "").toLowerCase().includes(normalizedSearch);

      const isOwner = userId !== "" && (
        project.pic_designer_id === userId || project.pic_drafter_id === userId
      );
      const matchesOwnership = showAll || isOwner;

      return matchesSearch && matchesOwnership;
    });
  }, [initialProjects, search, showAll, userId]);

  const sortedData = useMemo(() => {
    if (!sortColumnId) return filteredProjects;

    return [...filteredProjects].sort((leftRow, rightRow) => {
      // 1. Priority Super-Sort: URGENT always on top
      const priorityOrder: Record<string, number> = { URGENT: 0, NORMAL: 1, LOW: 2 };
      const leftPrio = priorityOrder[leftRow.priority] ?? 1;
      const rightPrio = priorityOrder[rightRow.priority] ?? 1;

      if (leftPrio !== rightPrio) return leftPrio - rightPrio;

      // 2. Column-based Sort (if priorities are equal)
      if (!sortColumnId) return 0;

      let left: any;
      let right: any;

      if (sortColumnId === "name") {
        left = leftRow.name;
        right = rightRow.name;
      } else if (sortColumnId === "client") {
        left = leftRow.client?.name || "";
        right = rightRow.client?.name || "";
      } else if (sortColumnId === "area") {
        left = leftRow.area ?? Number.POSITIVE_INFINITY;
        right = rightRow.area ?? Number.POSITIVE_INFINITY;
      }

      if (left === right) return 0;
      if (left == null) return 1;
      if (right == null) return -1;

      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [filteredProjects, sortColumnId, sortDirection]);

  function handleSort(columnId: string) {
    if (sortColumnId === columnId) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumnId(columnId);
      setSortDirection("asc");
    }
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-4">
        {/* Toggle: My Projects / All Projects */}
        <div className="flex bg-slate-100 p-1 rounded-[var(--ui-radius-card,8px)] w-fit">
          <button 
            onClick={() => setShowAll(false)}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold rounded-[calc(var(--ui-radius-card,8px)*0.75)] transition-all", 
              !showAll ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            My Projects
          </button>
          <button 
            onClick={() => setShowAll(true)}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold rounded-[calc(var(--ui-radius-card,8px)*0.75)] transition-all", 
              showAll ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            All Projects
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm flex items-center border-b border-slate-200 focus-within:border-slate-400 transition-colors">
          <Search className="absolute left-0 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search project name or client..." 
            className="pl-7 bg-transparent border-none shadow-none focus-visible:ring-0 rounded-none h-10 placeholder:text-slate-400 placeholder:font-light font-sans text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="w-full">
        <TableCard>
          <TableCardHeader>
            <TableCardHead 
              className="w-[30%]" 
              onClick={() => handleSort("name")}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <div className="flex items-center gap-1.5">
                PROJECT NAME
                {sortColumnId === "name" && (
                  sortDirection === "asc" ? <ArrowUpNarrowWide className="h-3.5 w-3.5 text-slate-400" /> : <ArrowDownWideNarrow className="h-3.5 w-3.5 text-slate-400" />
                )}
              </div>
            </TableCardHead>
            <TableCardHead 
              className="w-[18%]"
              onClick={() => handleSort("client")}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <div className="flex items-center gap-1.5">
                CLIENT
                {sortColumnId === "client" && (
                  sortDirection === "asc" ? <ArrowUpNarrowWide className="h-3.5 w-3.5 text-slate-400" /> : <ArrowDownWideNarrow className="h-3.5 w-3.5 text-slate-400" />
                )}
              </div>
            </TableCardHead>
            <TableCardHead 
              className="w-[10%]"
              onClick={() => handleSort("area")}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              <div className="flex items-center gap-1.5">
                LUAS
                {sortColumnId === "area" && (
                  sortDirection === "asc" ? <ArrowUpNarrowWide className="h-3.5 w-3.5 text-slate-400" /> : <ArrowDownWideNarrow className="h-3.5 w-3.5 text-slate-400" />
                )}
              </div>
            </TableCardHead>
            <TableCardHead className="w-[12%] text-center">
              <div className="flex justify-center">
                <Palette className="h-4 w-4 text-slate-400" />
              </div>
            </TableCardHead>
            <TableCardHead className="w-[12%] text-center">
              <div className="flex justify-center">
                <PenTool className="h-4 w-4 text-slate-400" />
              </div>
            </TableCardHead>
            <TableCardHead className="w-[18%]">PROGRESS</TableCardHead>
            <TableCardHead className="w-16 text-right"></TableCardHead>
          </TableCardHeader>
          <TableCardBody>
            {sortedData.length === 0 ? (
              <TableCardRow>
                <TableCardCell colSpan={7} className="py-12 text-center font-sans text-slate-500">
                  No projects found matching your criteria.
                </TableCardCell>
              </TableCardRow>
            ) : (
              sortedData.map((project) => {
                const progress = getProjectProgress(project.phases);
                const isUrgent = project.priority === "URGENT";
                
                return (
                  <TableCardRow 
                    key={project.id} 
                    className={cn(
                      "group",
                      isUrgent && "bg-rose-50/30 border-l-4 border-red-400"
                    )}
                  >
                    <TableCardCell>
                      <Link href={`/projects/${project.id}`} className="font-sans font-medium text-slate-900 hover:text-indigo-600 transition-colors">
                        {project.name}
                      </Link>
                    </TableCardCell>
                    <TableCardCell>
                      {project.client ? (
                        <ClientBranding
                          name={project.client.name}
                          logoUrl={project.client.logo_url}
                          fallback="text"
                          imageClassName="max-h-8"
                        />
                      ) : (
                        <span className="font-sans font-normal text-slate-400">-</span>
                      )}
                    </TableCardCell>
                    <TableCardCell>
                      <span className="font-sans font-normal text-slate-600">
                        {project.area !== null && project.area !== undefined ? `${project.area} sqm` : "-"}
                      </span>
                    </TableCardCell>
                    <TableCardCell align="center">
                      <span className="font-sans font-normal text-slate-600">
                        {project.designer.name.replace(/\s*\([^)]*\)/g, "")}
                      </span>
                    </TableCardCell>
                    <TableCardCell align="center">
                      <span className="font-sans font-normal text-slate-600">
                        {project.drafter.name.replace(/\s*\([^)]*\)/g, "")}
                      </span>
                    </TableCardCell>
                    <TableCardCell>
                      {progress.type === 'IN_PROGRESS' && (
                        <div className="flex flex-wrap items-center gap-2">
                          {progress.phases.map((p, idx) => (
                            <Badge 
                              key={idx}
                              variant="outline" 
                              className="bg-indigo-50 border-indigo-200 text-indigo-700 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md"
                            >
                              {formatPhaseName(p.name)} <span className="ml-1 opacity-60">v{p.major}.{p.minor}</span>
                            </Badge>
                          ))}
                        </div>
                      )}
                      {progress.type === 'READY_FOR' && (
                        <Badge 
                          variant="outline" 
                          className="bg-amber-50 border-amber-200 text-amber-700 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md"
                        >
                          READY FOR {formatPhaseName(progress.nextPhaseName)}
                        </Badge>
                      )}
                      {(progress.type as string) === 'PROJECT_DONE' && (
                        <Badge 
                          variant="outline" 
                          className="bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md"
                        >
                          PROJECT DONE ✓
                        </Badge>
                      )}
                    </TableCardCell>
                    <TableCardCell align="right">
                      <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                        <Link
                          href={`/projects/${project.id}`}
                          className="rounded-md p-2 text-slate-400 transition-all duration-200 hover:bg-zinc-100 hover:text-slate-900"
                          title="View Detail"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        {userRole === Role.ADMIN && (
                          <>
                            <select
                              value={project.priority}
                              onChange={(e) => {
                                updateProjectPriority(project.id, e.target.value);
                              }}
                              className="rounded-md px-2 py-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-700 transition-all duration-200 hover:border-slate-300 focus:border-slate-400 focus:outline-none"
                              title="Set project priority"
                            >
                              <option value="URGENT">URGENT</option>
                              <option value="NORMAL">NORMAL</option>
                              <option value="LOW">LOW</option>
                            </select>
                            <DeleteProjectButton projectId={project.id} userRole={userRole} />
                          </>
                        )}
                      </div>
                    </TableCardCell>
                  </TableCardRow>
                );
              })
            )}
          </TableCardBody>
        </TableCard>
      </div>
    </div>
  );
}
