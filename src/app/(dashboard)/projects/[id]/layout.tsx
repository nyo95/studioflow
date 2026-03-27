import { NavInner } from "@/components/nav-inner";
import { prisma } from "@/lib/db";

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
    },
    orderBy: { order_index: "asc" },
  });

  const navPhaseItems = phases.map((phase) => ({
    id: phase.id,
    name_enum: phase.name_enum,
    label: phase.name_enum.replace("_", " "), // Simple label conversion
    status_enum: phase.status_enum,
  }));

  if (!project) {
    // Handle project not found - in a real app, we might redirect or show error
    // For now, we'll render the layout with default values
    return (
      <div className="flex min-h-full flex-1">
        <NavInner 
          projectId={projectId} 
          projectName="Project Not Found" 
          phases={[]} 
        />
        <main className="min-w-0 flex-1">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-1">
      <NavInner 
        projectId={project.id} 
        projectName={project.name} 
        phases={navPhaseItems} 
      />
      <main className="min-w-1 flex-1">
        {children}
      </main>
    </div>
  );
}
