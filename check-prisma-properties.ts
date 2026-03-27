import { prisma } from "./src/lib/db";

async function check() {
  console.log("Prisma keys:", Object.keys(prisma));
  // @ts-ignore
  console.log("Prisma comment property:", prisma.comment);
}

check().catch(console.error);
