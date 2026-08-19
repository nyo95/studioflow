import { prisma } from "@/core/platform/db";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ProjectListClient } from "@/components/project-list-client";
import { getSession } from "@/lib/auth";
import { eligibleDesigners, eligibleDrafters } from "@/core/rbac/project-pic";
import { DashboardPageShell, PageHeader } from "@/ui_engine";
import { DEFAULT_PAGINATION_LIMIT } from "@/lib/constants";
import { SYSTEM_CONFIG_ID } from "@/core/rbac/permissions";
import { isAdminLevel } from "@/core/rbac/rbac";

export default async function ProjectsPage() {
  const { userId, role } = await getSession();
  const systemConfig = await prisma.systemConfig.findUnique({
    where: { id: SYSTEM_CONFIG_ID },
    select: { is_auto_naming_enabled: true },
  });

  const projects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      priority: true,
      client: {
        select: {
          id: true,
          name: true,
          logo_url: true,
        },
      },
      area: true,
      pic_designer_id: true,
      pic_drafter_id: true,
      designer: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      drafter: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      phases: {
        select: {
          id: true,
          name_enum: true,
          status_enum: true,
          order_index: true,
        },
        orderBy: {
          order_index: "asc",
        },
      },
    },
    orderBy: [
      { priority: "asc" },
      { name: "asc" },
    ],
  });

  const phaseIds = projects.flatMap((project) => project.phases.map((phase) => phase.id));

  const [users, revisions, allClients] = await Promise.all([
    prisma.user.findMany({
      where: { deleted_at: null },
      select: {
        id: true,
        name: true,
        role: true,
      },
      orderBy: {
        name: "asc",
      },
      take: DEFAULT_PAGINATION_LIMIT,
    }),
    phaseIds.length > 0
      ? prisma.revision.findMany({
          where: {
            phase_id: { in: phaseIds },
          },
          select: {
            phase_id: true,
            major: true,
            minor: true,
          },
          orderBy: [{ phase_id: "asc" }, { major: "desc" }, { minor: "desc" }],
        })
      : Promise.resolve([]),
    prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" }
    })
  ]);

  const latestRevisionByPhaseId = new Map<string, Array<{ major: number; minor: number }>>();
  for (const revision of revisions) {
    if (!latestRevisionByPhaseId.has(revision.phase_id)) {
      latestRevisionByPhaseId.set(revision.phase_id, [{ major: revision.major, minor: revision.minor }]);
    }
  }

  const projectsWithLatestRevision = projects.map((project) => ({
    ...project,
    phases: project.phases.map((phase) => ({
      ...phase,
      revisions: latestRevisionByPhaseId.get(phase.id) ?? [],
    })),
  }));

  // Designer seat: DIC plus admin-level roles (owner, 2026-08-10). Drafter
  // seat: DRIC only. See core/rbac/project-pic.ts. No incumbent to preserve
  // here — this list feeds the "new project" dialog.
  const designers = eligibleDesigners(users);
  const drafters = eligibleDrafters(users);

  return (
    <DashboardPageShell>
      <PageHeader
        title="Projects"
        description="Monitor and manage all studio projects in one place."
        action={
          isAdminLevel(role) ? (
            <CreateProjectDialog
              designers={designers}
              drafters={drafters}
              clients={allClients}
              isAutoNamingEnabled={systemConfig?.is_auto_naming_enabled ?? true}
            />
          ) : null
        }
      />

      <ProjectListClient
        initialProjects={projectsWithLatestRevision}
        userId={userId}
        userRole={role}
      />
    </DashboardPageShell>
  );
}
