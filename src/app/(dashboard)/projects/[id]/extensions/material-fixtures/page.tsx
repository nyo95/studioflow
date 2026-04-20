import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ProjectScheduleMain } from "@/extensions/schedule/components/ProjectScheduleMain";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { DashboardPageShell, PageBackLink, PageHeader } from "@/ui_engine";

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
    <DashboardPageShell>
      <PageBackLink />
      <PageHeader
        eyebrow="Project Extension"
        title="Material & Fixtures Schedule"
        description="Project-specific material selection, procurement sequencing, and schedule coordination."
      />
      <ErrorBoundary name="Schedule">
        <ProjectScheduleMain projectId={projectId} />
      </ErrorBoundary>
    </DashboardPageShell>
  );
}
