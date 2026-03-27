"use client";

import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { useStablePathname } from "@/hooks/use-stable-pathname";

export function LayoutClient({ children }: { children: ReactNode }) {
  const pathname = useStablePathname();
  const isDashboardRoute =
    pathname !== "" &&
    (pathname === "/" ||
      pathname.startsWith("/projects/") ||
      pathname.startsWith("/settings"));

  return (
    <div className="flex min-h-screen flex-col">
      {children}
      {!isDashboardRoute ? (
        <footer className="mt-auto flex justify-center border-t border-zinc-50 bg-white py-4">
          <p className="select-none font-sans text-[10px] font-medium uppercase tracking-widest text-gray-500">
            copyright berkah.kurniawan@gmail.com 2026
          </p>
        </footer>
      ) : null}
      <Toaster position="bottom-right" richColors />
    </div>
  );
}
