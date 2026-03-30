"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { BREAKPOINTS, Breakpoint } from "./responsive-config";

interface ResponsiveContextValue {
  isMobile: boolean | undefined;      // < 768px
  isTablet: boolean | undefined;      // 768px - 1023px
  isDesktop: boolean | undefined;     // ≥ 1024px
  currentBreakpoint: Breakpoint | undefined;
  sidebarLayout: 'drawer' | 'static' | undefined;
  shouldShowNavInner: boolean | undefined;
  // Drawer state for mobile
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
}

const ResponsiveContext = createContext<ResponsiveContextValue | undefined>(undefined);

export function ResponsiveProvider({ children }: { children: ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [responsiveState, setResponsiveState] = useState<{
    isMobile: boolean | undefined;
    isTablet: boolean | undefined;
    isDesktop: boolean | undefined;
    currentBreakpoint: Breakpoint | undefined;
    sidebarLayout: 'drawer' | 'static' | undefined;
    shouldShowNavInner: boolean | undefined;
  }>({
    isMobile: undefined,
    isTablet: undefined,
    isDesktop: undefined,
    currentBreakpoint: undefined,
    sidebarLayout: undefined,
    shouldShowNavInner: undefined,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      
      let breakpoint: Breakpoint = 'mobile';
      if (width >= BREAKPOINTS.desktop) breakpoint = 'desktop';
      else if (width >= BREAKPOINTS.tablet) breakpoint = 'tablet';

      setResponsiveState({
        isMobile: breakpoint === 'mobile',
        isTablet: breakpoint === 'tablet',
        isDesktop: breakpoint === 'desktop',
        currentBreakpoint: breakpoint,
        sidebarLayout: breakpoint === 'mobile' ? 'drawer' : 'static',
        shouldShowNavInner: breakpoint !== 'mobile',
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const value = React.useMemo(() => ({
    ...responsiveState,
    isDrawerOpen,
    setDrawerOpen: setIsDrawerOpen,
    toggleDrawer: () => setIsDrawerOpen(prev => !prev),
  }), [responsiveState, isDrawerOpen]);

  return (
    <ResponsiveContext.Provider value={value}>
      {children}
    </ResponsiveContext.Provider>
  );
}

export function useResponsive() {
  const context = useContext(ResponsiveContext);
  if (context === undefined) {
    throw new Error("useResponsive must be used within a ResponsiveProvider");
  }
  return context;
}
