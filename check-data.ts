import { prisma } from "./src/lib/db";

async function main() {
  const project = await prisma.project.findFirst({
    include: {
      phases: {
        include: {
          checklists: true,
          cd_lists: true
        }
      }
    }
  });

  if (!project) {
    console.log("No projects found.");
    return;
  }

  console.log(`Project: ${project.name}`);
  for (const phase of project.phases) {
    console.log(`Phase: ${phase.name_enum}`);
    console.log(`- Checklists count: ${phase.checklists.length}`);
    console.log(`- CD Lists count: ${phase.cd_lists.length}`);
  }
}

main().catch(console.error);
