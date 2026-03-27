import { prisma } from "./src/lib/db";

async function main() {
  console.log("Checking Prisma Models...");
  console.log("Prisma properties:", Object.keys(prisma));
  
  const phase = await prisma.phase.findFirst({
    include: {
      revisions: true,
      checklists: true,
      cd_lists: true,
    }
  });
  
  console.log("Phase Relations found:", phase ? Object.keys(phase) : "No Phase found");
}

main().catch(console.error);
