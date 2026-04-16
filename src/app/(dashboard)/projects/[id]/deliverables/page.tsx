import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { DeliverablesTable, type DeliverablePhaseRow } from "@/components/deliverables-table";
import { DashboardPageShell, PageBackLink, PageHeader } from "@/ui_engine";

export default async function DeliverablesTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: projectId } = await params;
  const session = await getSession();

  const project = await prisma.project.findUnique({
    where: { id: projectId, deleted_at: null },
    select: {
      id: true,
      name: true,
      pic_designer_id: true,
      pic_drafter_id: true,
      phases: {
        orderBy: {
          order_index: "asc",
        },
        select: {
          id: true,
          name_enum: true,
          order_index: true,
          revisions: {
            orderBy: [
              { major: "desc" },
              { minor: "desc" },
            ],
            select: {
              id: true,
              major: true,
              minor: true,
              status_enum: true,
              files: {
                orderBy: {
                  created_at: "desc",
                },
                select: {
                  id: true,
                  file_name: true,
                  file_url: true,
                  link_url: true,
                  is_external: true,
                  created_at: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const rows: DeliverablePhaseRow[] = project.phases.map((phase) => {
    const currentRevision = phase.revisions[0] ?? null;
    const latestFileWithRevision = phase.revisions
      .flatMap((revision) =>
        revision.files.map((file) => ({
          ...file,
          revisionVersion: `v${revision.major}.${revision.minor}`,
        }))
      )
      .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())[0] ?? null;

    return {
      phaseId: phase.id,
      phaseName: phase.name_enum,
      currentRevision: currentRevision
        ? {
            id: currentRevision.id,
            version: `v${currentRevision.major}.${currentRevision.minor}`,
          }
        : null,
      latestFile: latestFileWithRevision
        ? {
            id: latestFileWithRevision.id,
            file_name: latestFileWithRevision.file_name,
            file_url: latestFileWithRevision.file_url,
            link_url: latestFileWithRevision.link_url,
            is_external: latestFileWithRevision.is_external,
            created_at: latestFileWithRevision.created_at,
            revision_version: latestFileWithRevision.revisionVersion,
          }
        : null,
      isAuthorized:
        session.role === "ADMIN" ||
        (phase.name_enum === "CD"
          ? session.userId === project.pic_drafter_id
          : session.userId === project.pic_designer_id),
    };
  });

  return (
    <DashboardPageShell>
        <PageBackLink />
        <PageHeader
          title="DELIVERABLES TRACKING"
          description={`Compliance dashboard for ${project.name}`}
        />
        <DeliverablesTable
          rows={rows}
          userId={session.userId}
          userRole={session.role}
        />
    </DashboardPageShell>
  );
}
