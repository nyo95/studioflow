"use client";

/**
 * Catch-all for everything under `(dashboard)`.
 *
 * This sits inside the dashboard layout, so the sidebar, header and search all
 * survive the error — the user is still somewhere, not stranded on a blank
 * page. Routes with a more specific story (a single project) add their own
 * boundary closer in; Next uses the nearest one.
 */

import { RouteError } from "@/components/shared/route-error";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError error={error} reset={reset} scope="this page" />;
}
