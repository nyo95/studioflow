"use client";

import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  UI_ENGINE_PROJECT_SECTION_CARD_CLASS,
  UI_ENGINE_PROJECT_SECTION_CONTENT_CLASS,
  UI_ENGINE_PROJECT_SECTION_GROUP_CLASS,
  UI_ENGINE_PROJECT_SECTION_HEADER_CLASS,
  UI_ENGINE_PROJECT_SECTION_TRIGGER_CLASS,
} from "@/ui_engine/tokens";
import { SimpleCardHeader } from "@/ui_engine/primitives/simple-card";

const ProjectSectionGroup = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Root
    ref={ref}
    className={cn(UI_ENGINE_PROJECT_SECTION_GROUP_CLASS, className)}
    {...props}
  />
));
ProjectSectionGroup.displayName = "ProjectSectionGroup";

const ProjectSectionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn(UI_ENGINE_PROJECT_SECTION_CARD_CLASS, className)}
    {...props}
  />
));
ProjectSectionItem.displayName = "ProjectSectionItem";

type ProjectSectionTriggerProps = React.ComponentPropsWithoutRef<
  typeof AccordionPrimitive.Trigger
> & {
  headerClassName?: string;
};

const ProjectSectionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  ProjectSectionTriggerProps
>(({ className, headerClassName, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <SimpleCardHeader
      className={cn("w-full", UI_ENGINE_PROJECT_SECTION_HEADER_CLASS, headerClassName)}
    >
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(UI_ENGINE_PROJECT_SECTION_TRIGGER_CLASS, className)}
        {...props}
      >
        <div className="flex items-start justify-between gap-6">
          {children}
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </div>
      </AccordionPrimitive.Trigger>
    </SimpleCardHeader>
  </AccordionPrimitive.Header>
));
ProjectSectionTrigger.displayName = "ProjectSectionTrigger";

const ProjectSectionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className={cn(UI_ENGINE_PROJECT_SECTION_CONTENT_CLASS, className)}
    {...props}
  >
    {children}
  </AccordionPrimitive.Content>
));
ProjectSectionContent.displayName = "ProjectSectionContent";

export {
  ProjectSectionContent,
  ProjectSectionGroup,
  ProjectSectionItem,
  ProjectSectionTrigger,
};
