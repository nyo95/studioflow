import { prisma } from "@/core/platform/db";
import { ProjectLayoutShell, ProjectLiveProvider } from "@/ui_engine";
import { ProjectChatSidebar } from "@/extensions/live-collaboration/components/project-chat-sidebar";
import { getProjectDiscussionSnapshot } from "@/lib/project-discussion";
import { getSession } from "@/lib/auth";
import { ErrorBoundary } from "@/components/shared/error-boundary";

export const generateStaticParams = async () => {
  // This layout will be populated with data from the page components
  return [];
};

export default async function ProjectLayout({
  children,
  params, // params is a Promise in Next.js App Router for dynamic routes
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  // Await the params to get the projectId
  const { id: projectId } = await params;

  // Fetch project and phases for the layout
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  const phases = await prisma.phase.findMany({
    where: { project_id: projectId },
    select: {
      id: true,
      name_enum: true,
      status_enum: true,
      _count: {
        select: {
          checklists: {
            where: { is_checked: false }
          }
        }
      }
    },
    orderBy: { order_index: "asc" },
  });

  const navPhaseItems = phases.map((phase) => ({
    id: phase.id,
    name_enum: phase.name_enum,
    label: phase.name_enum.replace("_", " "), // Simple label conversion
    status_enum: phase.status_enum,
    unfinishedTodoCount: phase._count.checklists,
  }));

  if (!project) {
    // Handle project not found
    const session = await getSession();
    return (
      <ProjectLayoutShell
        projectId={projectId}
        projectName="Project Not Found"
        phases={[]}
        userRole={session.role as string}
      >
        {children}
      </ProjectLayoutShell>
    );
  }

  const session = await getSession();
  const initialSnapshot = await getProjectDiscussionSnapshot(projectId);
  const liveCollaborationEnabled = process.env.NEXT_PUBLIC_ENABLE_LIVE_COLLABORATION !== "false";

  return (
    <ProjectLiveProvider projectId={projectId} initialSnapshot={initialSnapshot}>
      <ProjectLayoutShell
        projectId={project.id}
        projectName={project.name}
        phases={navPhaseItems}
        userRole={session.role as string}
        rightSidebar={
          session.userId && liveCollaborationEnabled ? (
            <ErrorBoundary name="Live Collaboration">
              <ProjectChatSidebar
                projectId={project.id}
                currentUserId={session.userId}
                currentUserName={session.user?.name || "User"}
                userRole={session.role as string}
              />
            </ErrorBoundary>
          ) : null
        }
      >
        {children}
      </ProjectLayoutShell>
    </ProjectLiveProvider>
  );
}
