import * as React from "react";
import { cn } from "@/lib/utils";
import { Heading } from "@/ui_engine/components/heading";
import { DESIGN_SYSTEM_CONFIG } from "@/ui_engine/design-system.config";

interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  divider?: boolean;
  meta?: React.ReactNode;
  titleClassName?: string;
  descriptionClassName?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  divider = true,
  meta,
  titleClassName,
  descriptionClassName,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-10 flex items-start justify-between gap-4",
        divider && "border-b border-slate-200 pb-6",
        className
      )}
      {...props}
    >
      <div>
        {eyebrow ? (
          <Heading level={6} variant="uiMeta" className="mb-1">
            {eyebrow}
          </Heading>
        ) : null}
        <Heading 
          level={1} 
          className={cn("select-none", titleClassName)}
        >
          {title}
        </Heading>
        {description ? (
          <p
            className={cn(
              DESIGN_SYSTEM_CONFIG.typography.body.family,
              DESIGN_SYSTEM_CONFIG.typography.body.size,
              DESIGN_SYSTEM_CONFIG.typography.body.color,
              "mt-1.5 font-light",
              descriptionClassName
            )}
          >
            {description}
          </p>
        ) : null}
        {meta ? <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>

      {action ? <div className="flex-shrink-0 pt-1">{action}</div> : null}
    </header>
  );
}
