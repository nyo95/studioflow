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

export function NavInner({ projectId, projectName = "Project Name", phases = [] }: NavInnerProps) {
  const pathname = useStablePathname();
  const [isOpenPhases, setIsOpenPhases] = React.useState(true);
  const [isOpenExtensions, setIsOpenExtensions] = React.useState(true);

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
      className="min-h-full bg-white border-r border-zinc-100 flex flex-col py-6 px-4"
      style={{ width: DESIGN_SYSTEM_CONFIG.rails.innerWidth }}
    >
      <div className="mb-6 px-2">
        <Heading level={6} variant="uiMeta">Project</Heading>
        <h2 
          className={cn(
            DESIGN_SYSTEM_CONFIG.typography.h4.family,
            "text-sm font-semibold text-slate-900 mt-1 line-clamp-2 leading-tight"
          )}
          title={projectName}
        >
          {projectName}
        </h2>
      </div>

      <nav className="flex-1 space-y-8 overflow-y-auto pr-2 scrollbar-none">
        {/* GROUP: GENERAL */}
        <div>
          <Heading level={6} variant="uiMeta" className="mb-3 px-2">Project</Heading>
          <ul className="flex flex-col gap-1">
            <li>
              <Link
                href={projectId ? `/projects/${projectId}` : "#"}
                className={cn(
                  "flex items-center px-3 py-2 text-sm transition-all duration-200 border-l-2 rounded-r-lg",
                  projectId && pathname === `/projects/${projectId}`
                    ? "bg-slate-50 text-slate-900 font-semibold border-slate-900"
                    : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 border-transparent"
                )}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Overview
              </Link>
            </li>
          </ul>
        </div>

        {/* GROUP: PHASES */}
        <div>
          <button 
            onClick={() => setIsOpenPhases(!isOpenPhases)}
            className="w-full flex items-center justify-between mb-3 px-2 group"
          >
            <Heading level={6} variant="uiMeta">PHASES</Heading>
            <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", !isOpenPhases && "-rotate-90")} />
          </button>
          
          {isOpenPhases && (
            <ul className="flex flex-col gap-1">
              {items.map((phase) => {
                const isActive = projectId ? pathname.includes(`/projects/${projectId}/phases/${phase.id}`) : false;
                
                return (
                  <li key={phase.id}>
                    <Link
                      href={projectId ? `/projects/${projectId}/phases/${phase.id}` : "#"}
                      className={cn(
                        "flex items-center px-3 py-2 text-sm transition-all duration-200 border-l-2 rounded-r-lg",
                        isActive
                          ? "bg-slate-50 text-slate-900 font-semibold border-slate-900"
                          : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 border-transparent"
                      )}
                    >
                      {PHASE_ICONS[phase.name_enum] || <Info className="w-4 h-4 mr-2" />}
                      <span className="truncate flex-1">{formatPhaseLabel(phase.name_enum, phase.label)}</span>
                      {phase.unfinishedTodoCount && phase.unfinishedTodoCount > 0 ? (
                        <div className="flex items-center ml-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600"></span>
                          </span>
                        </div>
                      ) : null}
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
            className="w-full flex items-center justify-between mb-3 px-2 group"
          >
            <Heading level={6} variant="uiMeta">EXTENSIONS</Heading>
            <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", !isOpenExtensions && "-rotate-90")} />
          </button>

          {isOpenExtensions && (
            <ul className="flex flex-col gap-1">
              <li>
                <Link 
                  href={projectId ? `/projects/${projectId}/deliverables` : "#"} 
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-sans transition-all duration-200 border-l-2 rounded-r-lg",
                    pathname.endsWith("/deliverables")
                      ? "bg-slate-50 text-slate-900 font-semibold border-slate-900"
                      : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 border-transparent"
                  )}
                >
                  <FolderCheck className="w-4 h-4 mr-2" />
                  Deliverables
                </Link>
              </li>
              <li>
                <Link 
                  href={projectId ? `/projects/${projectId}/extensions/material-fixtures` : "#"} 
                  className={cn(
                    "flex items-center px-3 py-2 text-sm font-sans transition-all duration-200 border-l-2 rounded-r-lg",
                    pathname.includes(`/projects/${projectId}/extensions/material-fixtures`)
                      ? "bg-slate-50 text-slate-900 font-semibold border-slate-900"
                      : "text-slate-600 hover:bg-slate-100/50 hover:text-slate-900 border-transparent"
                  )}
                >
                  <ShoppingBag className="w-4 h-4 mr-2" />
                  Material & Fixtures
                </Link>
              </li>
            </ul>
          )}
        </div>
      </nav>
    </div>
  );
}

