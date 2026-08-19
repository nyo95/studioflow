"use client";

/**
 * Shared body for every `error.tsx` in the app.
 *
 * Before this, StudioFlow had no error boundary at all — only Master Data did.
 * A throw anywhere under `(dashboard)` fell through to Next's default screen,
 * which in production is a bare "Application error" page: no app name, no way
 * back, no retry.
 *
 * Deliberately NOT shown to the user: `error.message`. Prisma failures put
 * column and table names in there, and a stack in production tells the reader
 * nothing they can act on. The digest is shown instead — it is the handle that
 * ties this screen to a server log line.
 */

import Link from "next/link";
import { AlertCircle, Home, RefreshCcw } from "lucide-react";
import { Button } from "@/ui_engine";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** What failed, in the user's terms. "this project", "the project list". */
  scope?: string;
  /** Where "back" goes. Defaults to the dashboard. */
  backHref?: string;
  backLabel?: string;
}

export function RouteError({
  error,
  reset,
  scope = "this page",
  backHref = "/",
  backLabel = "Back to today",
}: RouteErrorProps) {
  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-rose-100 bg-rose-50">
        <AlertCircle className="h-8 w-8 text-rose-500" />
      </div>

      <h1 className="mb-2 font-serif text-2xl text-slate-900">Something went wrong</h1>

      <p className="mb-8 font-sans text-sm leading-relaxed text-slate-500">
        We couldn&apos;t load {scope}. Nothing was changed — your data is as you left it.
        Try again, and if it keeps happening, send the reference below.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset} variant="default" className="h-10 px-5 font-sans text-xs">
          <RefreshCcw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button asChild variant="outline" className="h-10 px-5 font-sans text-xs">
          <Link href={backHref}>
            <Home className="mr-2 h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
      </div>

      {error.digest ? (
        <p className="mt-8 select-all font-mono text-[10px] uppercase tracking-widest text-slate-300">
          Ref {error.digest}
        </p>
      ) : null}
    </div>
  );
}
