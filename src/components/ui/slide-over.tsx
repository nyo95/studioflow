"use client";

import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type SlideOverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function SlideOver({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: SlideOverProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full border-slate-200 bg-white p-0 sm:max-w-xl"
      >
        <SheetHeader className="border-b border-slate-200 px-6 py-5">
          <SheetTitle className="font-serif text-2xl font-bold text-slate-900">
            {title}
          </SheetTitle>
          {description ? (
            <SheetDescription className="font-sans text-sm text-slate-500">
              {description}
            </SheetDescription>
          ) : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>

        {footer ? (
          <div className="border-t border-slate-200 px-6 py-4">{footer}</div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

