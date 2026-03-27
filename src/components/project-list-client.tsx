"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Prisma, Role } from "@/generated/prisma";
import { Palette, PenTool, Eye, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DeleteProjectButton } from "@/components/delete-button";
import { DataTable, DataTableColumn } from "@/components/ui/data-table";
import { getProjectProgress, formatPhaseName } from "@/lib/project-progress";
import { ClientBranding } from "@/components/client-branding";

type DashboardProject = Prisma.ProjectGetPayload<{
  select: {
    id: true;
    name: true;
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

  const filteredProjects = initialProjects.filter((project) => {
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

  const columns = useMemo<Array<DataTableColumn<DashboardProject>>>(() => [
    {
      id: "name",
      header: <span className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">PROJECT NAME</span>,
      className: "w-[30%] pb-4",
      sortValue: (project) => project.name,
      cell: (project) => (
        <Link href={`/projects/${project.id}`} className="font-sans font-medium text-slate-800 hover:underline">
          {project.name}
        </Link>
      ),
    },
    {
      id: "client",
      header: <span className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">CLIENT</span>,
      className: "w-[18%] pb-4",
      sortValue: (project) => project.client?.name || "",
      cell: (project) => (
        project.client ? (
          <ClientBranding
            name={project.client.name}
            logoUrl={project.client.logo_url}
            fallback="text"
            imageClassName="max-h-10"
          />
        ) : (
          <span className="font-sans font-normal text-slate-600">-</span>
        )
      ),
    },
    {
      id: "area",
      header: <span className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">LUAS</span>,
      className: "w-[10%] pb-4",
      sortValue: (project) => project.area ?? Number.POSITIVE_INFINITY,
      cell: (project) => (
        <span className="font-sans font-normal text-slate-600">
          {project.area !== null && project.area !== undefined ? `${project.area} sqm` : "-"}
        </span>
      ),
    },
    {
      id: "designer",
      header: (
        <div className="flex justify-center">
          <button type="button" title="PIC Designer" className="mx-auto flex items-center justify-center border-0 bg-transparent p-0 outline-none cursor-help">
            <Palette className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      ),
      className: "min-w-[150px] w-[12%] pb-4 text-center",
      cell: (project) => (
        <span className="block min-w-[150px] text-center font-sans font-normal text-slate-600">
          {project.designer.name.replace(/\s*\([^)]*\)/g, "")}
        </span>
      ),
    },
    {
      id: "drafter",
      header: (
        <div className="flex justify-center">
          <button type="button" title="PIC Drafter" className="mx-auto flex items-center justify-center border-0 bg-transparent p-0 outline-none cursor-help">
            <PenTool className="h-4 w-4 text-slate-400" />
          </button>
        </div>
      ),
      className: "min-w-[150px] w-[12%] pb-4 text-center",
      cell: (project) => (
        <span className="block min-w-[150px] text-center font-sans font-normal text-slate-600">
          {project.drafter.name.replace(/\s*\([^)]*\)/g, "")}
        </span>
      ),
    },
    {
      id: "progress",
      header: <span className="font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">PROGRESS</span>,
      className: "w-[18%] pb-4",
      cell: (project) => {
        const progress = getProjectProgress(project.phases);

        if (progress.type === 'IN_PROGRESS') {
          return (
            <div className="flex flex-wrap items-center gap-2">
              {progress.phases.map((p, idx: number) => (
                <Badge 
                  key={idx}
                  variant="outline" 
                  className="bg-indigo-50 border-indigo-200 text-indigo-700 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md"
                >
                  {formatPhaseName(p.name)} <span className="ml-1 opacity-60">v{p.major}.{p.minor}</span>
                </Badge>
              ))}
            </div>
          );
        }

        if (progress.type === 'READY_FOR') {
          return (
            <Badge 
              variant="outline" 
              className="bg-amber-50 border-amber-200 text-amber-700 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md"
            >
              READY FOR {formatPhaseName(progress.nextPhaseName)}
            </Badge>
          );
        }

        return (
          <Badge 
            variant="outline" 
            className="bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md"
          >
            PROJECT DONE ✓
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: "",
      className: "w-16 pb-4 text-right",
      cell: (project) => (
        <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <Link
            href={`/projects/${project.id}`}
            className="rounded-md p-2 text-slate-400 transition-all duration-200 hover:bg-zinc-100 hover:text-slate-900"
            title="View Detail"
          >
            <Eye className="h-4 w-4" />
          </Link>
          {userRole === Role.ADMIN ? (
            <DeleteProjectButton projectId={project.id} userRole={userRole} />
          ) : null}
        </div>
      ),
    },
  ], [userRole]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 pb-4">
        {/* Toggle: My Projects / All Projects */}
        <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
          <button 
            onClick={() => setShowAll(false)}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold rounded-md transition-all", 
              !showAll ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            My Projects
          </button>
          <button 
            onClick={() => setShowAll(true)}
            className={cn(
              "px-4 py-1.5 text-xs font-semibold rounded-md transition-all", 
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
        <DataTable
          columns={columns}
          data={filteredProjects}
          getRowId={(project) => project.id}
          emptyMessage="No projects found matching your criteria."
          initialSortColumnId="name"
        />
      </div>
    </div>
  );
}
