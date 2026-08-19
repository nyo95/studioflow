import { notFound } from "next/navigation";
import { prisma } from "@/core/platform/db";
import { getSession } from "@/lib/auth";
import { getProjectMembershipOrThrow } from "@/core/rbac/permissions";
import { DashboardPageShell, PageBackLink, PageHeader } from "@/ui_engine";
import { MomDocumentList } from "@/extensions/mom/components/mom-document-list";

export default async function ProjectMomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const session = await getSession();

  await getProjectMembershipOrThrow(
    prisma as never,
    projectId,
    session.userId,
    session.role
  );

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      client: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!project) notFound();

  const momDocuments = await prisma.projectMomDocument.findMany({
    where: { project_id: projectId },
    orderBy: [{ mom_date: "desc" }, { updated_at: "desc" }],
    select: {
      id: true,
      mom_topic: true,
      mom_date: true,
      mom_venue: true,
      updated_at: true,
    },
  });

  return (
    <DashboardPageShell>
      <PageBackLink />
      <PageHeader
        title="MOM Reports"
        description={`${project.name}${project.client?.name ? ` - ${project.client.name}` : ""}`}
      />
      <MomDocumentList
        projectId={project.id}
        documents={momDocuments.map((document) => ({
          id: document.id,
          mom_topic: document.mom_topic,
          mom_date: document.mom_date.toISOString(),
          mom_venue: document.mom_venue,
          updated_at: document.updated_at.toISOString(),
        }))}
      />
    </DashboardPageShell>
  );
}
