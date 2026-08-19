import { PageSkeleton } from "@/components/shared/page-skeleton";

/**
 * Phase view: the project query plus the heartbeat snapshot.
 */
export default function PhaseLoading() {
  return <PageSkeleton type="dashboard" />;
}
