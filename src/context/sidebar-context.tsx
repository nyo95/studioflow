"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SidebarContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((current) => !current), []);

  const value = useMemo(
    () => ({
      isOpen,
      open,
      close,
      toggle,
    }),
    [close, isOpen, open, toggle]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);

  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}
