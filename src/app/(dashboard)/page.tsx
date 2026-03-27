import { prisma } from "@/lib/db";
import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ProjectListClient } from "@/components/project-list-client";
import { getSession } from "@/lib/auth";
import { Role } from "@/generated/prisma";
import { DashboardPageShell, PageHeader } from "@/ui_engine";

export default async function DashboardPage() {
  const { userId, role } = await getSession();
  const [systemConfig] = await prisma.$queryRaw<Array<{ is_auto_naming_enabled: boolean }>>`
    SELECT "is_auto_naming_enabled"
    FROM "SystemConfig"
    WHERE "id" = 'default'
    LIMIT 1
  `;

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
          revisions: {
            select: {
              major: true,
              minor: true,
            },
            orderBy: [
              { major: "desc" },
              { minor: "desc" },
            ],
            take: 1,
          },
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

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const designers = users.filter(
    (user) => user.role === Role.ADMIN || user.role === Role.DIC || user.role === Role.STAFF
  );
  const drafters = users.filter(
    (user) => user.role === Role.STAFF || user.role === Role.DRIC
  );

  return (
    <DashboardPageShell>
      <PageHeader
        title="DASHBOARD"
        description="Monitor and manage all studio projects in one place."
        action={
          role === Role.ADMIN ? (
            <CreateProjectDialog
              designers={designers}
              drafters={drafters}
              isAutoNamingEnabled={systemConfig?.is_auto_naming_enabled ?? true}
            />
          ) : null
        }
      />

      <ProjectListClient
        initialProjects={projects}
        userId={userId}
        userRole={role}
      />
    </DashboardPageShell>
  );
}
