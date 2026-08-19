import { PageSkeleton } from "@/components/shared/page-skeleton";

/**
 * The dashboard layout is `force-dynamic`, so every navigation waits on the
 * server. Without a skeleton nothing on screen changes between the click and
 * the render — the old page just sits there, which on a slow link is
 * indistinguishable from a hung app.
 */
export default function ProjectsLoading() {
  return <PageSkeleton type="list" />;
}
