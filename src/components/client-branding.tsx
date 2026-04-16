/* eslint-disable @next/next/no-img-element */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ClientBrandingProps {
  name?: string | null;
  logoUrl?: string | null;
  fallback?: "text" | "avatar";
  showName?: boolean;
  className?: string;
  imageClassName?: string;
  avatarClassName?: string;
  nameClassName?: string;
}

export function ClientBranding({
  name,
  logoUrl,
  fallback = "text",
  showName = false,
  className,
  imageClassName,
  avatarClassName,
  nameClassName,
}: ClientBrandingProps) {
  const label = name?.trim() || "Unknown Client";
  const initials = getClientInitials(label);

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {logoUrl ? (
        <div className="flex min-h-10 items-center">
          {/* Remote branding URLs are user-managed, so a plain img avoids next/image host config coupling. */}
          <img
            src={logoUrl}
            alt={`${label} logo`}
            className={cn("max-h-10 w-auto object-contain", imageClassName)}
          />
        </div>
      ) : fallback === "avatar" ? (
        <Avatar className={cn("h-10 w-10 rounded-2xl border border-slate-200 bg-white", avatarClassName)}>
          <AvatarFallback className="rounded-2xl bg-slate-100 font-sans text-xs font-bold uppercase tracking-[0.18em] text-slate-700">
            {initials}
          </AvatarFallback>
        </Avatar>
      ) : (
        <span className={cn("font-sans text-sm font-semibold text-slate-900", nameClassName)}>{label}</span>
      )}

      {showName && logoUrl ? (
        <span className={cn("font-sans text-sm font-medium text-slate-700", nameClassName)}>{label}</span>
      ) : null}
    </div>
  );
}

export function getClientInitials(name?: string | null) {
  const normalized = name?.trim();
  if (!normalized) return "--";

  const parts = normalized.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "--";
}

