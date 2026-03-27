import * as React from "react";
import { cn } from "@/lib/utils";
import {
  UI_ENGINE_PAGE_HEADER_DESCRIPTION_CLASS,
  UI_ENGINE_PAGE_HEADER_TITLE_CLASS,
} from "@/ui_engine/tokens";

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
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            {eyebrow}
          </p>
        ) : null}
        <h1 className={cn(UI_ENGINE_PAGE_HEADER_TITLE_CLASS, titleClassName)}>
          {title}
        </h1>
        {description ? (
          <p
            className={cn(
              UI_ENGINE_PAGE_HEADER_DESCRIPTION_CLASS,
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
