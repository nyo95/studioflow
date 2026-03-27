import { prisma } from "../src/lib/db";

async function main() {
  const usersCount = await prisma.user.count();
  const projectsCount = await prisma.project.count();
  console.log({ usersCount, projectsCount });
}

main().catch(console.error);
