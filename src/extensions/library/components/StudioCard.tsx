import * as React from "react";
import { SimpleCard, SimpleCardBody, SimpleCardHeader, SimpleCardTitle } from "@/ui_engine";
import { cn } from "@/lib/utils";

interface StudioCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  headerAction?: React.ReactNode;
}

export const StudioCard = React.forwardRef<HTMLDivElement, StudioCardProps>(
  ({ title, headerAction, children, className, ...props }, ref) => {
    return (
      <SimpleCard 
        ref={ref} 
        className={cn("bg-slate-50/40 border-slate-200/60 shadow-sm", className)} 
        {...props}
      >
        {title && (
          <SimpleCardHeader className="bg-transparent border-b-slate-100">
            <SimpleCardTitle className="font-serif text-lg font-medium text-slate-800">
              {title}
            </SimpleCardTitle>
            {headerAction}
          </SimpleCardHeader>
        )}
        <SimpleCardBody className="font-sans">
          {children}
        </SimpleCardBody>
      </SimpleCard>
    );
  }
);

StudioCard.displayName = "StudioCard";
