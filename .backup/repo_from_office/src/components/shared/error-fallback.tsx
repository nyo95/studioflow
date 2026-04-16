"use client";

import { Button } from "@/components/ui/button";

interface ErrorFallbackProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorFallback({
  title = "Something went wrong",
  message = "An unexpected error occurred in this section.",
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center">
      <p className="font-lora text-xl text-slate-900">{title}</p>
      <p className="mt-2 font-inter text-sm text-slate-500">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          onClick={onRetry}
          variant="outline"
          className="mt-4 rounded-xl border-slate-200 text-xs font-bold uppercase tracking-widest"
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}