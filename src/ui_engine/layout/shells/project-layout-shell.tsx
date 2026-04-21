"use client";

import * as React from "react";
import { PanelLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavInner } from "@/components/nav-inner";
import { DESIGN_SYSTEM_CONFIG } from "@/ui_engine/design-system.config";

type PhaseItem = {
  id: string;
  name_enum: string;
  label: string;
  status_enum: string;
  unfinishedTodoCount?: number;
};

type ProjectLayoutShellProps = {
  projectId: string;
  projectName: string;
  phases: PhaseItem[];
  children: React.ReactNode;
  rightSidebar?: React.ReactNode;
};

const STORAGE_KEY = "ui.projectNav.collapsed";

export function ProjectLayoutShell({
  projectId,
  projectName,
  phases,
  children,
  rightSidebar,
}: ProjectLayoutShellProps) {
  const [isNavOpenMobile, setIsNavOpenMobile] = React.useState(false);
  const [isCollapsedDesktop, setIsCollapsedDesktop] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setIsCollapsedDesktop(true);
      if (stored === "0") setIsCollapsedDesktop(false);
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapsedDesktop = React.useCallback(() => {
    setIsCollapsedDesktop((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const closeMobile = React.useCallback(() => setIsNavOpenMobile(false), []);
  const openMobile = React.useCallback(() => setIsNavOpenMobile(true), []);

  return (
    <div className="flex min-h-full flex-1">
      {/* Desktop: inline project nav (collapsible) */}
      <aside
        className={cn("hidden lg:flex lg:flex-col")}
        style={{
          width: isCollapsedDesktop ? "78px" : DESIGN_SYSTEM_CONFIG.rails.innerWidth,
        }}
      >
        <NavInner
          projectId={projectId}
          projectName={projectName}
          phases={phases}
          collapsed={isCollapsedDesktop}
          onToggleCollapsed={toggleCollapsedDesktop}
        />
      </aside>

      {/* Mobile: project nav drawer */}
      <button
        type="button"
        onClick={openMobile}
        className="fixed bottom-6 left-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition-colors hover:bg-slate-50 lg:hidden"
        aria-label="Open project menu"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/20 transition lg:hidden",
          isNavOpenMobile ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeMobile}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(320px,calc(100vw-1.25rem))] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform duration-200 lg:hidden",
          isNavOpenMobile ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!isNavOpenMobile}
      >
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
            Project Menu
          </p>
          <button
            type="button"
            onClick={closeMobile}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close project menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <NavInner
          projectId={projectId}
          projectName={projectName}
          phases={phases}
          collapsed={false}
          onNavigate={closeMobile}
        />
      </aside>

      <main className="min-w-0 flex-1">{children}</main>

      {rightSidebar ?? null}
    </div>
  );
}

