"use client";

/**
 * Boundary for one project's subtree.
 *
 * Separate from the dashboard-level one so a failure inside a project does not
 * take the project navigation with it: this renders inside
 * `projects/[id]/layout.tsx`, so the phase rail stays usable and the user can
 * step sideways into a phase that still loads.
 */

import { RouteError } from "@/components/shared/route-error";

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      scope="this project"
      backHref="/projects"
      backLabel="All projects"
    />
  );
}
