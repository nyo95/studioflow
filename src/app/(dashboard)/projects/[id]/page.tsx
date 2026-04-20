import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma";
import { canEditProjectMetadata } from "@/lib/permissions";
import { ProjectOverviewForm } from "@/components/project-overview-form";
import { ProjectChecklistOverview } from "@/components/project-checklist-overview";
import { DashboardPageShell, PageBackLink, PageHeader, StatusBadge, ActionSidebar, ActionSidebarSection } from "@/ui_engine";
import { getProjectProgress } from "@/lib/project-progress";
import { ProjectAdminActions } from "@/components/project-admin-actions";
import { PROJECT_MEMBER_FETCH_LIMIT } from "@/lib/constants";
// Removed ProjectScheduleMain as it's now a dedicated extension page

export const generateStaticParams = async () => {
  return [];
};

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id: projectId } = await params;
  const { tab: activeTab } = await searchParams;
  const { userId, role } = await getSession();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      status_progress: true,
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      area: true,
      opening_date: true,
      pic_designer_id: true,
      pic_drafter_id: true,
      designer: {
        select: {
          name: true,
        },
      },
      drafter: {
        select: {
          name: true,
        },
      },
      phases: {
        select: {
          id: true,
          name_enum: true,
          order_index: true,
          status_enum: true,
          revisions: {
            where: { status_enum: "ACTIVE" },
            select: {
              major: true,
              minor: true,
            },
            take: 1,
          },
        },
        orderBy: {
          order_index: "asc",
        },
      },
      activities: {
        where: { revision_id: null },
        select: {
          id: true,
          content: true,
          status: true,
          mode: true,
          phase_id: true,
          deferred_from_version: true
        }
      },
      checklists: {
        where: {
          phase_id: { equals: null },
        },
        include: {
          phase: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const globalChecklists = project.checklists.filter((item) => item.phase_id === null);

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: {
      name: "asc",
    },
    take: PROJECT_MEMBER_FETCH_LIMIT,
  });
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
    take: PROJECT_MEMBER_FETCH_LIMIT,
  });

  const designers = users.filter(
    (user) => user.role === Role.ADMIN || user.role === Role.DIC || user.role === Role.STAFF
  );
  const drafters = users.filter(
    (user) => user.role === Role.STAFF || user.role === Role.DRIC
  );

  const canEdit = canEditProjectMetadata(role as Role, userId, project.pic_designer_id);
  const openingDateDisplay = project.opening_date
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(project.opening_date)
    : "-";
  const openingDateInputValue = project.opening_date
    ? project.opening_date.toISOString().slice(0, 10)
    : "";

  return (
    <DashboardPageShell className="animate-in fade-in duration-700">
      <PageBackLink />
      <PageHeader
        title={project.name}
        description={`${project.client?.name || "No Client"} — ${project.area || "No area"} SQM`}
        meta={
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status_progress} />
            {project.opening_date && (
              <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                Opening {openingDateDisplay}
              </span>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ProjectOverviewForm
            project={{
              id: project.id,
              name: project.name,
              client: project.client,
              area: project.area,
              opening_date: project.opening_date,
              opening_date_display: openingDateDisplay,
              opening_date_input_value: openingDateInputValue,
              pic_designer_id: project.pic_designer_id,
              pic_drafter_id: project.pic_drafter_id,
              designer_name: project.designer.name,
              drafter_name: project.drafter.name,
            }}
            designers={designers}
            drafters={drafters}
            clients={clients}
            role={role as Role}
            canEdit={canEdit}
            currentProgress={getProjectProgress(project.phases)}
            phases={project.phases}
            deferredActivities={project.activities as React.ComponentProps<typeof ProjectOverviewForm>["deferredActivities"]}
          />
        </div>

        <ActionSidebar className="lg:col-span-1">
          {role === Role.ADMIN && (
            <ActionSidebarSection title="Project Flow Validation" subtitle="Admin Diagnostics">
              <ProjectAdminActions
                projectId={project.id}
                projectName={project.name}
                isCompleted={project.status_progress === "COMPLETED"}
              />
            </ActionSidebarSection>
          )}
          
          <ActionSidebarSection title="Global Checklist" subtitle="Cross-phase tasks">
            <ProjectChecklistOverview
              projectId={project.id}
              checklists={globalChecklists.map((item) => ({
                id: item.id,
                label: item.label,
                completed: item.is_checked,
                phase_id: item.phase_id,
              }))}
              canEdit={canEdit}
            />
          </ActionSidebarSection>
        </ActionSidebar>
      </div>
    </DashboardPageShell>
  );
}
