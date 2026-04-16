import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectScheduleMain } from "@/extensions/schedule/components/ProjectScheduleMain";
import { ErrorBoundary } from "@/components/shared/error-boundary";

interface MaterialFixturesPageProps {
  params: Promise<{ id: string }>;
}

export default async function MaterialFixturesPage({ params }: MaterialFixturesPageProps) {
  if (process.env.NEXT_PUBLIC_ENABLE_MATERIAL_FIXTURES === "false") {
    notFound();
  }

  const { id: projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="w-full px-6 py-8">
      <ErrorBoundary name="Schedule">
        <ProjectScheduleMain projectId={projectId} />
      </ErrorBoundary>
    </div>
  );
}
