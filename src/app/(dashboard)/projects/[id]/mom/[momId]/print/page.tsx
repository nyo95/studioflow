import { notFound } from "next/navigation";
import { prisma } from "@/core/platform/db";
import { getSession } from "@/lib/auth";
import { getProjectMembershipOrThrow } from "@/core/rbac/permissions";
import { MomPrintView } from "@/extensions/mom/components/mom-print-view";
import { PrintButton } from "@/extensions/sketchup/components/PrintButton";

export default async function ProjectMomPrintPage({
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
    <div className="min-h-screen bg-slate-100 print:bg-white">
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 print:hidden">
        <div>
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">MOM Print</p>
          <h1 className="font-serif text-lg font-bold text-slate-950">{document.mom_topic}</h1>
        </div>
        <PrintButton />
      </div>
      <MomPrintView
        projectName={document.project.name}
        clientName={document.project.client?.name ?? null}
        document={{
          mom_topic: document.mom_topic,
          mom_date: document.mom_date.toISOString(),
          mom_venue: document.mom_venue,
          mom_attendees: document.mom_attendees,
          mom_prepared_by_name: document.mom_prepared_by_name,
          mom_items: document.mom_items.map((item) => ({
            id: item.id,
            is_text_only: item.is_text_only,
            list_style: item.list_style,
            mom_points: item.mom_points.map((point) => ({
              id: point.id,
              text: point.text,
            })),
            mom_images: item.mom_images.map((image) => ({
              id: image.id,
              sort_order: image.sort_order,
              file_url: image.file_url,
            })),
          })),
        }}
      />
    </div>
  );
}
