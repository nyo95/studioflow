import * as React from "react";
import { DashboardTemplate, Skeleton } from "@/ui_engine";
import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  type?: "list" | "grid" | "form" | "dashboard";
  className?: string;
}

export function PageSkeleton({ type = "dashboard", className }: PageSkeletonProps) {
  return (
    <DashboardTemplate
      className={cn("animate-in fade-in duration-500", className)}
      content={
        <div className="space-y-10">
        {/* Header Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>

        {type === "grid" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 mt-12">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="aspect-square w-full rounded-[var(--ui-radius-card)]" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ))}
          </div>
        )}

        {type === "list" && (
          <div className="space-y-4 mt-12">
            <div className="flex items-center justify-between mb-8">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-32" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-[var(--ui-radius-control)]" />
            ))}
          </div>
        )}

        {type === "dashboard" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
            <div className="lg:col-span-2 space-y-8">
              <Skeleton className="h-64 w-full rounded-[var(--ui-radius-card)]" />
              <div className="grid grid-cols-2 gap-6">
                 <Skeleton className="h-40 w-full rounded-[var(--ui-radius-card)]" />
                 <Skeleton className="h-40 w-full rounded-[var(--ui-radius-card)]" />
              </div>
            </div>
            <div className="space-y-6">
              <Skeleton className="h-96 w-full rounded-[var(--ui-radius-card)]" />
              <Skeleton className="h-48 w-full rounded-[var(--ui-radius-card)]" />
            </div>
          </div>
        )}
        </div>
      }
    />
  );
}
