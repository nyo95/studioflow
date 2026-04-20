"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";
import {
  UI_ENGINE_PHASE_SECTION_BADGE_CLASS,
  UI_ENGINE_PHASE_SECTION_CONTENT_CLASS,
  UI_ENGINE_PHASE_SECTION_ITEM_CLASS,
  UI_ENGINE_PHASE_SECTION_TRIGGER_CLASS,
} from "@/ui_engine/tokens";

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
    className={cn(UI_ENGINE_PHASE_SECTION_ITEM_CLASS, className)}
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
      className={cn(UI_ENGINE_PHASE_SECTION_TRIGGER_CLASS, className)}
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
    <div className={cn(UI_ENGINE_PHASE_SECTION_CONTENT_CLASS, className)}>{children}</div>
  </AccordionPrimitive.Content>
));
PhaseSectionContent.displayName = "PhaseSectionContent";

const PhaseSectionBadge = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span ref={ref} className={cn("inline-flex items-center rounded-full border", UI_ENGINE_PHASE_SECTION_BADGE_CLASS, className)} {...props} />
));
PhaseSectionBadge.displayName = "PhaseSectionBadge";

export {
  PhaseSectionBadge,
  PhaseSectionContent,
  PhaseSectionGroup,
  PhaseSectionItem,
  PhaseSectionTrigger,
};
