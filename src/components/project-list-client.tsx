"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Prisma, Role } from "@/generated/prisma";
import { isAdminLevel } from "@/core/rbac/rbac";
import {
  Palette,
  PenTool,
  Eye,
  Search,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Input,
  Badge,
  Button,
  TableCard,
  TableCardHeader,
  TableCardHead,
  TableCardBody,
  TableCardRow,
  TableCardCell,
  SimpleCard,
  SimpleCardBody,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui_engine";
import { getProjectProgress, formatPhaseName } from "@/lib/project-progress";
import { ClientBranding } from "@/components/client-branding";
import { updateProjectPriority, deleteProject } from "@/actions/project-actions";
import { unwrapActionResult } from "@/lib/result";
import { useTableResizer } from "@/hooks/use-table-resizer";

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
  const [showAll, setShowAll] = useState<boolean>(isAdminLevel(userRole));
  const [sortColumnId, setSortColumnId] = useState<string | null>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Column widths, rebalanced 2026-08-10.
  //
  // PROGRESS was 18% and holding the widest content on the row — two phase
  // badges that each carry a name, a version, and sometimes a review state.
  // At that width they overflowed into the actions cell, which is the overlap
  // visible in the screenshots. Designer and Drafter were 12% each for one
  // short name apiece; folding them into a single TEAM column pays for the
  // extra 14% that PROGRESS needed.
  //
  // The resizer persists user overrides under this key, so anyone who had
  // already dragged these columns keeps their own layout.
  const { widths, onResizeStart } = useTableResizer("project-list-v2", {
    name: 27,
    client: 14,
    area: 8,
    team: 15,
    progress: 30,
    actions: 6,
  }); // Total: 100%

  // Memoize progress calculation to avoid expensive array sorting/copying on every render
  const projectProgressMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getProjectProgress>>();
    for (const project of initialProjects) {
      map.set(project.id, getProjectProgress(project.phases));
    }
    return map;
  }, [initialProjects]);

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

      let left: string | number = "";
      let right: string | number = "";

      if (sortColumnId === "name") {
        left = leftRow.name;
        right = rightRow.name;
      } else if (sortColumnId === "client") {
        left = leftRow.client?.name || "";
        right = rightRow.client?.name || "";
      } else if (sortColumnId === "area") {
        left = leftRow.area ?? Number.POSITIVE_INFINITY;
        right = rightRow.area ?? Number.POSITIVE_INFINITY;
      } else {
        return 0;
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

      {/* Desktop / wide-viewport table. Hidden below md — the stacked card
          list further down covers narrow viewports instead of letting
          table-fixed columns squeeze until their contents collide. See
          PLAN-AUDIT-ROADMAP-2026Q3.md §1.2 A3 / §2.4 R4. */}
      <div className="hidden w-full md:block">
        <TableCard layout="fixed" minWidth="920px">
          <TableCardHeader>
            <TableCardHead 
              style={{ width: `${widths.name}%`, cursor: 'pointer', userSelect: 'none' }} 
              onClick={() => handleSort("name")}
              onResizeStart={(e) => onResizeStart("name", e, "client")}
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="truncate">PROJECT NAME</span>
                {sortColumnId === "name" && (
                  sortDirection === "asc" ? <ArrowUpNarrowWide className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> : <ArrowDownWideNarrow className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                )}
              </div>
            </TableCardHead>
            <TableCardHead 
              style={{ width: `${widths.client}%`, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort("client")}
              onResizeStart={(e) => onResizeStart("client", e, "area")}
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="truncate">CLIENT</span>
                {sortColumnId === "client" && (
                  sortDirection === "asc" ? <ArrowUpNarrowWide className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> : <ArrowDownWideNarrow className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                )}
              </div>
            </TableCardHead>
            <TableCardHead 
              style={{ width: `${widths.area}%`, cursor: 'pointer', userSelect: 'none' }}
              onClick={() => handleSort("area")}
              onResizeStart={(e) => onResizeStart("area", e, "designer")}
            >
              <div className="flex items-center gap-1.5 overflow-hidden">
                <span className="truncate">LUAS</span>
                {sortColumnId === "area" && (
                  sortDirection === "asc" ? <ArrowUpNarrowWide className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> : <ArrowDownWideNarrow className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                )}
              </div>
            </TableCardHead>
            {/* Designer and Drafter used to be two columns headed by a bare
                palette and pen icon. Nothing on screen said which was which,
                and the tooltip only appeared on hover — so the two names read
                as interchangeable. One labelled column, two labelled rows. */}
            <TableCardHead
              style={{ width: `${widths.team}%` }}
              onResizeStart={(e) => onResizeStart("team", e, "progress")}
            >
              TIM
            </TableCardHead>
            <TableCardHead
              style={{ width: `${widths.progress}%` }}
              onResizeStart={(e) => onResizeStart("progress", e, "actions")}
            >
              PROGRESS
            </TableCardHead>
            <TableCardHead
              style={{ width: `${widths.actions}%` }}
              className="text-right"
            ></TableCardHead>
          </TableCardHeader>
          <TableCardBody>
            {sortedData.length === 0 ? (
              <TableCardRow>
                <TableCardCell colSpan={6} className="py-12 text-center font-sans text-slate-500">
                  No projects found matching your criteria.
                </TableCardCell>
              </TableCardRow>
            ) : (
              sortedData.map((project) => {
                const progress = projectProgressMap.get(project.id)!;
                const isUrgent = project.priority === "URGENT";
                
                return (
                  <TableCardRow
                    key={project.id}
                    className={cn(isUrgent && "bg-rose-50/30 border-l-4 border-red-400")}
                  >
                    <TableCardCell className="overflow-hidden">
                      {/* Priority moved out of the row and into the menu, so
                          it needs to stay readable at a glance. Only the two
                          non-default values get a chip — a NORMAL badge on
                          every row is noise that hides the URGENT ones. */}
                      <div className="flex min-w-0 items-center gap-2">
                        <Link
                          href={`/projects/${project.id}`}
                          className="min-w-0 flex-1 truncate font-sans font-medium text-slate-900 transition-colors hover:text-indigo-600"
                        >
                          {project.name}
                        </Link>
                        <PriorityChip priority={project.priority} />
                      </div>
                    </TableCardCell>
                    <TableCardCell className="overflow-hidden">
                      {project.client ? (
                        <div className="truncate">
                          <ClientBranding
                            name={project.client.name}
                            logoUrl={project.client.logo_url}
                            fallback="text"
                            imageClassName="max-h-8"
                          />
                        </div>
                      ) : (
                        <span className="font-sans font-normal text-slate-400">-</span>
                      )}
                    </TableCardCell>
                    <TableCardCell>
                      <span className="font-sans font-normal text-slate-600">
                        {project.area !== null && project.area !== undefined ? `${project.area} sqm` : "-"}
                      </span>
                    </TableCardCell>
                    <TableCardCell className="overflow-hidden">
                      <TeamCell designer={project.designer.name} drafter={project.drafter.name} />
                    </TableCardCell>
                    <TableCardCell className="overflow-hidden">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <ProjectProgressBadges progress={progress} />
                      </div>
                    </TableCardCell>
                    <TableCardCell align="right">
                      {/* One menu instead of three always-visible controls.
                          Delete used to sit in every row at full opacity — the
                          most destructive action on the page, one stray click
                          away, next to a link people click all day. */}
                      <RowActions
                        projectId={project.id}
                        priority={project.priority}
                        userRole={userRole}
                      />
                    </TableCardCell>
                  </TableCardRow>
                );
              })
            )}
          </TableCardBody>
        </TableCard>
      </div>

      {/* Mobile / narrow-viewport stacked cards. Table columns can't shrink
          meaningfully below ~920px without content collisions, so below md
          we switch to one card per project instead. See
          PLAN-AUDIT-ROADMAP-2026Q3.md §1.2 A3 / §2.4 R4. */}
      <div className="flex flex-col gap-3 md:hidden">
        {sortedData.length === 0 ? (
          <p className="py-12 text-center font-sans text-sm text-slate-500">
            No projects found matching your criteria.
          </p>
        ) : (
          sortedData.map((project) => {
            const progress = projectProgressMap.get(project.id)!;
            const isUrgent = project.priority === "URGENT";

            return (
              <SimpleCard
                key={project.id}
                className={cn(isUrgent && "border-l-4 border-l-red-400 bg-rose-50/30")}
              >
                <SimpleCardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="min-w-0 flex-1 font-sans font-medium text-slate-900 transition-colors hover:text-indigo-600"
                    >
                      <span className="block truncate">{project.name}</span>
                    </Link>
                    <PriorityChip priority={project.priority} />
                    <RowActions
                      projectId={project.id}
                      priority={project.priority}
                      userRole={userRole}
                    />
                  </div>

                  {project.client ? (
                    <ClientBranding
                      name={project.client.name}
                      logoUrl={project.client.logo_url}
                      fallback="text"
                      imageClassName="max-h-6"
                    />
                  ) : (
                    <span className="font-sans text-sm text-slate-400">No client</span>
                  )}

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Palette className="h-3 w-3 text-slate-300" />
                      {shortName(project.designer.name)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <PenTool className="h-3 w-3 text-slate-300" />
                      {shortName(project.drafter.name)}
                    </span>
                    {project.area !== null && project.area !== undefined && (
                      <span>{project.area} sqm</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <ProjectProgressBadges progress={progress} />
                  </div>
                </SimpleCardBody>
              </SimpleCard>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Strips the trailing "(Role)" suffix carried by every user name. */
function shortName(name: string) {
  return name.replace(/\s*\([^)]*\)/g, "").trim();
}

/**
 * Priority, shown only when it is not the default.
 *
 * A chip on every row would compete with the phase badges for attention and
 * make URGENT harder to spot, not easier — which defeats the point of marking
 * anything urgent at all.
 */
function PriorityChip({ priority }: { priority: DashboardProject["priority"] }) {
  if (priority === "NORMAL") return null;

  const isUrgent = priority === "URGENT";
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
        isUrgent
          ? "border-red-200 bg-red-50 text-red-600"
          : "border-slate-200 bg-slate-50 text-slate-400"
      )}
    >
      {isUrgent ? "Urgent" : "Low"}
    </Badge>
  );
}

/**
 * Designer and drafter in one column, each on its own labelled line.
 *
 * They used to be two columns headed by a bare palette and pen icon. Two names
 * sat side by side with nothing on screen saying which was which, and between
 * them they took 24% of the table width to show about twelve characters.
 */
function TeamCell({ designer, drafter }: { designer: string; drafter: string }) {
  return (
    <div className="min-w-0 space-y-0.5 font-sans text-xs">
      <div className="flex min-w-0 items-center gap-1.5" title={`Designer: ${shortName(designer)}`}>
        <Palette className="h-3 w-3 shrink-0 text-slate-300" />
        <span className="truncate text-slate-600">{shortName(designer)}</span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5" title={`Drafter: ${shortName(drafter)}`}>
        <PenTool className="h-3 w-3 shrink-0 text-slate-300" />
        <span className="truncate text-slate-500">{shortName(drafter)}</span>
      </div>
    </div>
  );
}

/**
 * Per-row menu: open, set priority, delete.
 *
 * The delete dialog is a sibling of the menu rather than a child of a menu
 * item. A Radix dropdown unmounts its content on select, and an AlertDialog
 * mounted inside it would be torn down in the same tick it opened — the
 * confirmation would flash and vanish. Opening it from component state instead
 * keeps it alive after the menu closes.
 */
function RowActions({
  projectId,
  priority,
  userRole,
}: {
  projectId: string;
  priority: DashboardProject["priority"];
  userRole: Role;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isAdmin = isAdminLevel(userRole);

  const priorities: DashboardProject["priority"][] = ["URGENT", "NORMAL", "LOW"];

  return (
    <div className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:bg-zinc-100 hover:text-slate-900"
            aria-label="Project actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem asChild className="text-xs">
            <Link href={`/projects/${projectId}`}>
              <Eye className="mr-2 h-3.5 w-3.5" />
              Open project
            </Link>
          </DropdownMenuItem>

          {isAdmin ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-slate-400">
                Priority
              </DropdownMenuLabel>
              {priorities.map((level) => (
                <DropdownMenuItem
                  key={level}
                  className="text-xs"
                  onSelect={() => {
                    if (level === priority) return;
                    startTransition(async () => {
                      try {
                        unwrapActionResult(
                          await updateProjectPriority({ projectId, priority: level })
                        );
                        router.refresh();
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Couldn't change priority"
                        );
                      }
                    });
                  }}
                >
                  {level}
                  {level === priority ? " ✓" : ""}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs text-red-600 focus:text-red-600"
                onSelect={(event) => {
                  // Let the menu finish closing before the dialog mounts;
                  // otherwise focus lands nowhere and the dialog opens blurred.
                  event.preventDefault();
                  setTimeout(() => setConfirmOpen(true), 0);
                }}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete project
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="font-sans">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Every phase, revision, schedule and task belonging
              to this project is deleted with it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={(event) => {
                event.preventDefault();
                startTransition(async () => {
                  try {
                    unwrapActionResult(await deleteProject({ projectId }));
                    setConfirmOpen(false);
                    router.refresh();
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : "Couldn't delete the project"
                    );
                  }
                });
              }}
            >
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Renders the phase-progress badges for one project row. Shared between the
 * desktop table cell and the mobile card so the two layouts can't drift out
 * of sync with each other.
 */
function ProjectProgressBadges({ progress }: { progress: ReturnType<typeof getProjectProgress> }) {
  if (progress.type === 'IN_PROGRESS') {
    return (
      <>
        {progress.phases.slice(0, 2).map((p, idx) => {
          // The review state is what kept overflowing: "DESIGN 3D V10.0" plus
          // "ON CLIENT REVIEW" in one pill is wider than any sane column. It
          // becomes its own badge, so the pair wraps to a second line instead
          // of one pill growing past the cell.
          const review =
            p.status_enum === 'ON_REVIEW_INTERNAL'
              ? { text: 'ON INTERNAL REVIEW', tone: 'border-indigo-200 bg-indigo-50 text-indigo-600' }
              : p.status_enum === 'ON_REVIEW_CLIENT'
                ? { text: 'ON CLIENT REVIEW', tone: 'border-orange-200 bg-orange-50 text-orange-600' }
                : p.status_enum === 'APPROVED_INTERNAL'
                  ? { text: 'APPROVED INTERNAL', tone: 'border-emerald-200 bg-emerald-50 text-emerald-600' }
                  : null;

          return (
            <span key={idx} className="flex min-w-0 max-w-full items-center gap-1">
              {/* `min-w-0` + `!shrink` undo the `w-fit shrink-0` in the Badge
                  base class. Without them the pill keeps its intrinsic width
                  in a flex row and spills into the next cell — which is the
                  overlap that survived the earlier fix in
                  PLAN-AUDIT-ROADMAP-2026Q3.md §1.2 A3, because `max-w-full`
                  alone cannot shrink a `shrink-0` box. */}
              <Badge
                variant="outline"
                title={`${formatPhaseName(p.name)} v${p.major}.${p.minor}${review ? ` — ${review.text}` : ''}`}
                className="min-w-0 !shrink rounded-md border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700"
              >
                <span className="truncate">
                  {formatPhaseName(p.name)} <span className="opacity-60">v{p.major}.{p.minor}</span>
                </span>
              </Badge>
              {review ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "min-w-0 !shrink rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide",
                    review.tone
                  )}
                >
                  <span className="truncate">{review.text}</span>
                </Badge>
              ) : null}
            </span>
          );
        })}
        {progress.phases.length > 2 && (
          <Badge variant="outline" className="shrink-0 rounded-md border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">
            +{progress.phases.length - 2}
          </Badge>
        )}
      </>
    );
  }

  if (progress.type === 'READY_FOR') {
    return (
      <Badge
        variant="outline"
        className="max-w-full truncate bg-amber-50 border-amber-200 text-amber-700 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md"
      >
        READY FOR {formatPhaseName(progress.nextPhaseName)}
      </Badge>
    );
  }

  if (progress.type === 'PROJECT_DONE') {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-50 border-emerald-200 text-emerald-700 text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-md"
      >
        PROJECT DONE ✓
      </Badge>
    );
  }

  // NO_PHASES
  return <span className="text-xs italic text-slate-400">No phases</span>;
}
