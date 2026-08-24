import { notFound } from "next/navigation";
import { prisma } from "@/core/platform/db";
import { getSession } from "@/lib/auth";
import { getProjectMembershipOrThrow } from "@/core/rbac/permissions";
import { DetailTemplate, PageBackLink, PageHeader } from "@/ui_engine";
import { MomEditor } from "@/extensions/mom/components/mom-editor";

export default async function ProjectMomEditorPage({
  params,
}: {
  params: Promise<{ id: string; momId: string }>;
}) {
  const { id: projectId, momId } = await params;
  const session = await getSession();

  await getProjectMembershipOrThrow(prisma as never, projectId, session.userId, session.role);

  const document = await prisma.projectMomDocument.findUnique({
    where: { id: momId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          client: {
            select: {
              name: true,
            },
          },
        },
      },
      mom_items: {
        orderBy: { sort_order: "asc" },
        include: {
          mom_points: {
            orderBy: { sort_order: "asc" },
          },
          mom_images: {
            orderBy: { sort_order: "asc" },
          },
        },
      },
    },
  });

  if (!document || document.project_id !== projectId) notFound();

  return (
    <DetailTemplate
      header={
        <>
          <PageBackLink />
          <PageHeader
            title={document.mom_topic}
            description={`${document.project.name}${document.project.client?.name ? ` • ${document.project.client.name}` : ""}`}
          />
        </>
      }
      content={
        <MomEditor
          projectId={projectId}
          projectName={document.project.name}
          clientName={document.project.client?.name ?? null}
          document={{
            id: document.id,
            mom_topic: document.mom_topic,
            mom_date: document.mom_date.toISOString(),
            mom_venue: document.mom_venue,
            mom_attendees: document.mom_attendees,
            mom_prepared_by_name: document.mom_prepared_by_name,
            mom_items: document.mom_items.map((item) => ({
              id: item.id,
              sort_order: item.sort_order,
              is_text_only: item.is_text_only,
              list_style: item.list_style,
              mom_points: item.mom_points.map((point) => ({
                id: point.id,
                sort_order: point.sort_order,
                text: point.text,
                style: point.style,
              })),
              mom_images: item.mom_images.map((image) => ({
                id: image.id,
                sort_order: image.sort_order,
                file_url: image.file_url,
              })),
            })),
          }}
        />
      }
    />
  );
}
