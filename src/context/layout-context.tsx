"use client";

import React, { createContext, useContext, ReactNode } from "react";

interface LayoutContextValue {
  navOuter?: ReactNode;
  navInner?: ReactNode;
}

const LayoutContext = createContext<LayoutContextValue | undefined>(undefined);

export function LayoutProvider({ children, navOuter, navInner }: { children: ReactNode; navOuter?: ReactNode; navInner?: ReactNode }) {
  return (
    <LayoutContext.Provider value={{ navOuter, navInner }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout() {
  const context = useContext(LayoutContext);
  if (context === undefined) {
    throw new Error("useLayout must be used within a LayoutProvider");
  }
  return context;
}