import * as React from "react";
import { cn } from "@/lib/utils";
import { DESIGN_SYSTEM_CONFIG } from "../design-system.config";

interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  tracking?: "tight" | "normal" | "wide" | "widest" | string;
  variant?: "default" | "uiMeta";
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ level, tracking, variant, className, children, ...props }, ref) => {
    const Tag = `h${level}` as const;
    
    // Resolve variant style
    const style = variant === "uiMeta" 
      ? DESIGN_SYSTEM_CONFIG.typography.uiMeta 
      : DESIGN_SYSTEM_CONFIG.typography[`h${level}` as keyof typeof DESIGN_SYSTEM_CONFIG.typography];
    
    // Resolve tracking
    const trackingClass = tracking 
      ? (tracking.startsWith("tracking-") ? tracking : `tracking-${tracking}`) 
      : style.tracking;

    return (
      <Tag
        ref={ref}
        className={cn(
          style.family,
          style.size,
          style.weight,
          style.color,
          trackingClass,
          "leading-tight",
          variant === "uiMeta" || ("uppercase" in style && style.uppercase) ? "uppercase" : "",
          className
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);

Heading.displayName = "Heading";
