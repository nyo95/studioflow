/**
 * Shared body for every `not-found.tsx`.
 *
 * Ten pages call `notFound()` and there was no `not-found.tsx` anywhere, so all
 * ten landed on Next's default 404: unstyled, no navigation, no app name.
 *
 * A server component on purpose — nothing here is interactive, and keeping it
 * off the client means a 404 costs no JavaScript.
 */

import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/ui_engine";

interface RouteNotFoundProps {
  /** What was looked for. "This project", "This page". */
  subject?: string;
  /** Why it might be missing, in one sentence. */
  reason?: string;
  backHref?: string;
  backLabel?: string;
}

export function RouteNotFound({
  subject = "This page",
  reason = "It may have been moved or deleted, or the link may be wrong.",
  backHref = "/",
  backLabel = "Back to today",
}: RouteNotFoundProps) {
  return (
    <div className="mx-auto flex min-h-[420px] w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-slate-100 bg-slate-50">
        <Compass className="h-8 w-8 text-slate-300" />
      </div>

      <h1 className="mb-2 font-serif text-2xl text-slate-900">{subject} doesn&apos;t exist</h1>

      <p className="mb-8 font-sans text-sm leading-relaxed text-slate-500">{reason}</p>

      <Button asChild variant="default" className="h-10 px-5 font-sans text-xs">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}
