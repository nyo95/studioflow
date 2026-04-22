"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useStablePathname } from "@/hooks/use-stable-pathname";
import { DESIGN_SYSTEM_CONFIG } from "@/ui_engine/design-system.config";
import { Heading } from "@/ui_engine/components/heading";
import { 
  ChevronDown, 
  LayoutDashboard, 
  Palette, 
  Grid, 
  Box, 
  PenTool, 
  HardHat, 
  FolderCheck, 
  ShoppingBag,
  Info 
} from "lucide-react";

interface PhaseItem {
  id: string;
  name_enum: string;
  label: string;
  status_enum: string;
  unfinishedTodoCount?: number;
}

interface NavInnerProps {
  projectId?: string;
  projectName?: string;
  phases?: PhaseItem[];
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}

const PHASE_ICONS: Record<string, React.ReactNode> = {
  MOODBOARD: <Palette className="w-4 h-4 mr-2" />,
  LAYOUT: <Grid className="w-4 h-4 mr-2" />,
  DESIGN_3D: <Box className="w-4 h-4 mr-2" />,
  CD: <PenTool className="w-4 h-4 mr-2" />,
  SUPERVISION: <HardHat className="w-4 h-4 mr-2" />,
};

const PHASE_LABELS: Record<string, string> = {
  MOODBOARD: "Moodboard",
  LAYOUT: "Layout 2D",
  DESIGN_3D: "Design 3D",
  CD: "Construction Drawings",
  SUPERVISION: "Supervision",
};

function formatPhaseLabel(name_enum: string, fallback: string) {
  return PHASE_LABELS[name_enum] || fallback;
}

export function NavInner({
  projectId,
  projectName = "Project Name",
  phases = [],
  collapsed = false,
  onToggleCollapsed,
  onNavigate,
}: NavInnerProps) {
  const pathname = useStablePathname();
  const [isOpenPhases, setIsOpenPhases] = React.useState(true);
  const [isOpenExtensions, setIsOpenExtensions] = React.useState(true);

  function handleNavigate() {
    onNavigate?.();
  }

  // Typical phases if not provided
  const defaultPhases: PhaseItem[] = [
    { id: "1", name_enum: "MOODBOARD", label: "Moodboard", status_enum: "IN_PROGRESS" },
    { id: "2", name_enum: "LAYOUT", label: "Layout Plan", status_enum: "PENDING" },
    { id: "3", name_enum: "DESIGN_3D", label: "3D Design", status_enum: "PENDING" },
    { id: "4", name_enum: "CD", label: "Construction Doc", status_enum: "PENDING" },
    { id: "5", name_enum: "SUPERVISION", label: "Supervision", status_enum: "PENDING" },
  ];

  const items = phases.length > 0 ? phases : defaultPhases;

  return (
    <div
      className={cn(
        "min-h-full bg-white border-r border-slate-200 flex flex-col py-6",
        collapsed ? "px-2" : "px-4"
      )}
      style={{ width: "100%" }}
    >
      <div className={cn("mb-6", collapsed ? "px-0" : "px-2")}>
        <div className={cn("flex items-start justify-between gap-3", collapsed && "justify-center")}>
          {collapsed ? null : (
            <div className="min-w-0">
              <Heading level={6} variant="uiMeta">
                Project
              </Heading>
              <h2
                className={cn(
                  DESIGN_SYSTEM_CONFIG.typography.h4.family,
                  "mt-1 line-clamp-2 text-sm font-semibold leading-tight text-slate-950"
                )}
                title={projectName}
              >
                {projectName}
              </h2>
            </div>
          )}

          {onToggleCollapsed ? (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900",
                collapsed && "h-10 w-10"
              )}
              aria-label={collapsed ? "Expand project sidebar" : "Collapse project sidebar"}
              title={collapsed ? "Expand" : "Collapse"}
            >
              <ChevronDown className={cn("h-4 w-4", collapsed ? "rotate-90" : "-rotate-90")} />
            </button>
          ) : null}
        </div>
      </div>

      <nav className={cn("flex-1 space-y-8 overflow-y-auto scrollbar-none", collapsed ? "pr-0" : "pr-2")}>
        {/* GROUP: GENERAL */}
        <div>
          {collapsed ? null : (
            <Heading level={6} variant="uiMeta" className="mb-3 px-2">
              Project
            </Heading>
          )}
          <ul className="flex flex-col gap-1">
            <li>
              <Link
                href={projectId ? `/projects/${projectId}` : "#"}
                onClick={handleNavigate}
                className={cn(
                  "flex items-center text-sm transition-colors duration-150 border-l-2 rounded-r-lg",
                  collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                  projectId && pathname === `/projects/${projectId}`
                    ? "bg-slate-50 text-slate-900 font-semibold border-slate-900"
                    : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 border-transparent"
                )}
                title="Overview"
              >
                <LayoutDashboard className={cn("h-4 w-4", collapsed ? "" : "mr-2")} />
                {collapsed ? null : "Overview"}
              </Link>
            </li>
          </ul>
        </div>

        {/* GROUP: PHASES */}
        <div>
          <button 
            onClick={() => setIsOpenPhases(!isOpenPhases)}
            className={cn(
              "w-full flex items-center justify-between mb-3 group",
              collapsed ? "px-0 justify-center" : "px-2"
            )}
            title="Phases"
          >
            {collapsed ? null : <Heading level={6} variant="uiMeta">PHASES</Heading>}
            <ChevronDown
              className={cn(
                "w-3 h-3 transition-transform duration-200",
                !isOpenPhases && "-rotate-90",
                collapsed && "hidden"
              )}
            />
          </button>
          
          {isOpenPhases && (
            <ul className="flex flex-col gap-1">
              {items.map((phase) => {
                const isActive = projectId ? pathname.includes(`/projects/${projectId}/phases/${phase.id}`) : false;
                
                return (
                  <li key={phase.id}>
                    <Link
                      href={projectId ? `/projects/${projectId}/phases/${phase.id}` : "#"}
                      onClick={handleNavigate}
                      className={cn(
                        "flex items-center text-sm transition-colors duration-150 border-l-2 rounded-r-lg",
                        collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                        isActive
                          ? "bg-slate-50 text-slate-900 font-semibold border-slate-900"
                          : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 border-transparent"
                      )}
                      title={formatPhaseLabel(phase.name_enum, phase.label)}
                    >
                      {PHASE_ICONS[phase.name_enum] || (
                        <Info className={cn("w-4 h-4", collapsed ? "" : "mr-2")} />
                      )}
                      {collapsed ? null : (
                        <>
                          <span className="truncate flex-1">{formatPhaseLabel(phase.name_enum, phase.label)}</span>
                          {phase.unfinishedTodoCount && phase.unfinishedTodoCount > 0 ? (
                            <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-indigo-600" />
                          ) : null}
                        </>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* GROUP: EXTENSIONS */}
        <div>
          <button 
            onClick={() => setIsOpenExtensions(!isOpenExtensions)}
            className={cn(
              "w-full flex items-center justify-between mb-3 group",
              collapsed ? "px-0 justify-center" : "px-2"
            )}
            title="Extensions"
          >
            {collapsed ? null : <Heading level={6} variant="uiMeta">EXTENSIONS</Heading>}
            <ChevronDown
              className={cn(
                "w-3 h-3 transition-transform duration-200",
                !isOpenExtensions && "-rotate-90",
                collapsed && "hidden"
              )}
            />
          </button>

          {isOpenExtensions && (
            <ul className="flex flex-col gap-1">
              <li>
                <Link 
                  href={projectId ? `/projects/${projectId}/deliverables` : "#"} 
                  onClick={handleNavigate}
                  className={cn(
                    "flex items-center text-sm font-sans transition-colors duration-150 border-l-2 rounded-r-lg",
                    collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                    pathname.endsWith("/deliverables")
                      ? "bg-slate-50 text-slate-900 font-semibold border-slate-900"
                      : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 border-transparent"
                  )}
                  title="Deliverables"
                >
                  <FolderCheck className={cn("w-4 h-4", collapsed ? "" : "mr-2")} />
                  {collapsed ? null : "Deliverables"}
                </Link>
              </li>
              <li>
                <Link 
                  href={projectId ? `/projects/${projectId}/extensions/product-catalog` : "#"} 
                  onClick={handleNavigate}
                  className={cn(
                    "flex items-center text-sm font-sans transition-colors duration-150 border-l-2 rounded-r-lg",
                    collapsed ? "justify-center px-0 py-2.5" : "px-3 py-2",
                    pathname.includes(`/projects/${projectId}/extensions/product-catalog`)
                      ? "bg-slate-50 text-slate-900 font-semibold border-slate-900"
                      : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 border-transparent"
                  )}
                  title="Product & Fixtures"
                >
                  <ShoppingBag className={cn("w-4 h-4", collapsed ? "" : "mr-2")} />
                  {collapsed ? null : "Product Schedule"}
                </Link>
              </li>
            </ul>
          )}
        </div>
      </nav>
    </div>
  );
}
