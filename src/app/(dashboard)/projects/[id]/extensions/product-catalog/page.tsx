import { notFound } from "next/navigation";
import { prisma } from "@/core/platform/db";
import { getSession } from "@/lib/auth";
import { ProjectScheduleMain } from "@/extensions/schedule/components/ProjectScheduleMain";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { DashboardPageShell, PageBackLink, PageHeader } from "@/ui_engine";

interface ProductCatalogPageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductCatalogPage({ params }: ProductCatalogPageProps) {
  if (process.env.NEXT_PUBLIC_ENABLE_MATERIAL_FIXTURES === "false") {
    notFound();
  }

  const { id: projectId } = await params;
  const session = await getSession();
  const userRole = session?.role || "STAFF";

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
    <DashboardPageShell className="animate-in fade-in duration-700">
      <PageBackLink />
      <ErrorBoundary name="Schedule">
        <ProjectScheduleMain projectId={projectId} userRole={userRole} />
      </ErrorBoundary>
    </DashboardPageShell>
  );
}
