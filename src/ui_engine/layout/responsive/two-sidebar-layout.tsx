"use client";

import React, { ReactNode, useState } from "react";
import { useResponsive } from "@/ui_engine/responsive/responsive-context";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

interface TwoSidebarLayoutProps {
  navOuter?: ReactNode;
  navInner?: ReactNode;
  topbar?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}

/**
 * TwoSidebarLayout
 * A responsive layout component that manages a 2-tier sidebar system.
 * Desktop: Static 2-sidebar layout
 * Tablet: Static 2-sidebar (compact)
 * Mobile: Drawer-based navigation
 */
export function TwoSidebarLayout({
  navOuter,
  navInner,
  topbar,
  children,
  className,
  footer,
}: TwoSidebarLayoutProps) {
  const { isMobile, sidebarLayout, shouldShowNavInner, isDrawerOpen, setDrawerOpen } = useResponsive();

  // During SSR, isMobile is undefined, so we render nothing to avoid hydration mismatch.
  if (isMobile === undefined) {
    return null;
  }

  // Mobile View
  if (isMobile === true) {
    return (
      <div className={cn("relative flex h-screen w-full flex-col overflow-hidden", className)}>
        {/* Mobile Topbar */}
        <header className="flex h-14 w-full items-center border-b border-slate-100 bg-white px-4">
          <button 
            onClick={() => setDrawerOpen(true)}
            className="mr-4 p-2 text-slate-500 hover:text-slate-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          {topbar}
        </header>

        {/* Mobile Drawer */}
        <Sheet open={isDrawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="left" className="p-0 w-[280px]">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation Menu</SheetTitle>
              <SheetDescription>Main navigation and secondary options</SheetDescription>
            </SheetHeader>
            <div className="flex h-full w-full">
              {/* Unified Mobile Sidebar */}
              <div className="flex w-16 flex-col border-r border-slate-100 bg-slate-50">
                {navOuter}
              </div>
              <div className="flex flex-1 flex-col bg-white">
                {navInner}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Mobile Content */}
        <main className="flex-1 overflow-auto bg-slate-50/50">
          {children}
        </main>
        {footer && (
          <footer className="flex flex-shrink-0 justify-center border-t py-4 border-slate-200 bg-white text-slate-500">
            {footer}
          </footer>
        )}
      </div>
    );
  }

  // Desktop/Tablet View
  return (
    <div className={cn("relative flex h-screen w-full overflow-hidden", className)}>
      {/* Static NavOuter (64px) */}
      <aside className="w-16 flex-shrink-0 border-r border-slate-100 bg-slate-50">
        {navOuter}
      </aside>

      {/* Static NavInner (256px) - shown if needed */}
      {shouldShowNavInner && (
        <aside className="w-64 flex-shrink-0 border-r border-slate-100 bg-white">
          {navInner}
        </aside>
      )}

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {topbar && (
          <header className="flex h-16 w-full items-center border-b border-slate-100 bg-white px-6">
            {topbar}
          </header>
        )}
        <main className="flex-1 overflow-auto bg-slate-50/50">
          {children}
        </main>
        {footer && (
          <footer className="flex flex-shrink-0 justify-center border-t py-4 border-slate-200 bg-white text-slate-500">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
