import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Heading } from "./heading";

export interface ActionSidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function ActionSidebar({ className, children, ...props }: ActionSidebarProps) {
  return (
    <aside
      className={cn(
        "w-full lg:w-[280px] xl:w-[320px] shrink-0 lg:sticky lg:top-8 flex flex-col gap-6 animate-in fade-in slide-in-from-left-4 duration-700",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  );
}

export interface ActionSidebarSectionProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function ActionSidebarSection({
  className,
  title,
  subtitle,
  children,
  ...props
}: ActionSidebarSectionProps) {
  return (
    <Card className={cn("border-slate-200 bg-white shadow-sm overflow-hidden rounded-[var(--ui-radius-card,1rem)]", className)} {...props}>
      <div className="border-b border-slate-100 bg-slate-50/30 p-5 pb-3">
        <div className="space-y-1">
          <Heading level={4}>{title}</Heading>
          {subtitle && (
            <Heading variant="uiMeta" level={6} className="opacity-80">
              {subtitle}
            </Heading>
          )}
        </div>
      </div>
      <CardContent className="p-5 space-y-5">
        {children}
      </CardContent>
    </Card>
  );
}

export interface ActionSidebarItemProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  children: React.ReactNode;
}

export function ActionSidebarItem({
  className,
  label,
  children,
  ...props
}: ActionSidebarItemProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)} {...props}>
      <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-inter">
        {label}
      </h2>
      {children}
    </div>
  );
}
