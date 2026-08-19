"use client";

import * as React from "react";
import { PanelLeft, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NavInner } from "@/components/nav-inner";

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
  userRole?: string;
};

const STORAGE_KEY = "ui.projectNav.collapsed";

export function ProjectLayoutShell({
  projectId,
  projectName,
  phases,
  children,
  rightSidebar,
  userRole,
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
      {/* Desktop: project nav, PINNED.
          =====================================================================
          WHY `fixed` AND NOT `sticky`
          =====================================================================
          This was `lg:sticky lg:top-0` and it did not hold — the panel scrolled
          away with the page. So does ActionSidebar's own `lg:sticky lg:top-8`
          elsewhere on the project page, which is the tell: sticky is not
          resolving against the scroll container anywhere in this shell, not
          just here. Rather than keep guessing at which ancestor breaks it,
          this pins to the viewport, which cannot be defeated by an ancestor's
          overflow, transform or animation.
          =====================================================================
          GEOMETRY — this reproduces the previous layout exactly
          =====================================================================
          `left-[78px]` is the width of the fixed NavOuter rail in
          src/app/(dashboard)/layout.tsx, which also pads `main` by the same
          `lg:pl-[78px]`. `top-14` clears the fixed 3.5rem TopHeader.
          The sibling spacer below keeps the flex row's first column, so page
          content still starts to the right of the panel instead of sliding
          underneath it.
          If the rail width changes, both numbers move together. */}
      <div
        className="hidden shrink-0 lg:block"
        style={{ width: isCollapsedDesktop ? "78px" : "256px" }}
        aria-hidden
      />

      <aside
        className="hidden lg:fixed lg:left-[78px] lg:top-14 lg:bottom-0 lg:z-20 lg:flex lg:flex-col"
        style={{
          width: isCollapsedDesktop ? "78px" : "256px",
        }}
      >
        <NavInner
          projectId={projectId}
          projectName={projectName}
          phases={phases}
          collapsed={isCollapsedDesktop}
          onToggleCollapsed={toggleCollapsedDesktop}
          userRole={userRole}
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
          userRole={userRole}
        />
      </aside>

      <main className="min-w-0 flex-1">{children}</main>

      {rightSidebar ?? null}
    </div>
  );
}

