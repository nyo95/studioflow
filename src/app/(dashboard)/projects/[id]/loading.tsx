import { PageSkeleton } from "@/components/shared/page-skeleton";

/**
 * The heaviest query in the app: phases, revisions, activities, checklists,
 * users and client in one round trip.
 */
export default function ProjectLoading() {
  return <PageSkeleton type="dashboard" />;
}
