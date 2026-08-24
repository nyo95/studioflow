"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import {
  CARD_PADDING_X,
  RADIUS_CARD,
  ROW_PADDING_Y,
  BORDER_COLOR,
  TEXT_SIZE_BADGE,
} from "@/ui_engine/tokens";

// Kelas-kelas ini dulu hidup di `ui_engine/tokens` (UI_ENGINE_PHASE_SECTION_*)
// dan pindah ke sini bersama komponennya (R5, PRD §36 — engine tidak boleh
// tahu domain Phase). Nilainya tidak berubah sama sekali.
const PHASE_SECTION_ITEM_CLASS = cn("overflow-hidden border bg-white", BORDER_COLOR, RADIUS_CARD);
const PHASE_SECTION_TRIGGER_CLASS = cn("group flex flex-1 items-start justify-between gap-4 transition-colors hover:bg-slate-50", CARD_PADDING_X, ROW_PADDING_Y);
const PHASE_SECTION_CONTENT_CLASS = cn("border-t", BORDER_COLOR, CARD_PADDING_X, ROW_PADDING_Y);
const PHASE_SECTION_BADGE_CLASS = cn("bg-white px-4 py-2 font-semibold uppercase tracking-[0.18em]", BORDER_COLOR, TEXT_SIZE_BADGE);

const PhaseSectionGroup = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Root ref={ref} className={cn("space-y-4", className)} {...props} />
));
PhaseSectionGroup.displayName = "PhaseSectionGroup";

const PhaseSectionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(PHASE_SECTION_ITEM_CLASS, className)}
    {...props}
  />
));
PhaseSectionItem.displayName = "PhaseSectionItem";

const PhaseSectionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(PHASE_SECTION_TRIGGER_CLASS, className)}
      {...props}
    >
      {children}
      <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
));
PhaseSectionTrigger.displayName = "PhaseSectionTrigger";

const PhaseSectionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content ref={ref} className="overflow-hidden" {...props}>
    <div className={cn(PHASE_SECTION_CONTENT_CLASS, className)}>{children}</div>
  </AccordionPrimitive.Content>
));
PhaseSectionContent.displayName = "PhaseSectionContent";

const PhaseSectionBadge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span ref={ref} className={cn("inline-flex items-center rounded-full border", PHASE_SECTION_BADGE_CLASS, className)} {...props} />
));
PhaseSectionBadge.displayName = "PhaseSectionBadge";

export {
  PhaseSectionBadge,
  PhaseSectionContent,
  PhaseSectionGroup,
  PhaseSectionItem,
  PhaseSectionTrigger,
};
