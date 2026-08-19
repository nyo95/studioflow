import { RouteNotFound } from "@/components/shared/route-not-found";

export default function ProjectNotFound() {
  return (
    <RouteNotFound
      subject="This project"
      reason="It may have been deleted, or the link may point at an old ID."
      backHref="/projects"
      backLabel="All projects"
    />
  );
}
