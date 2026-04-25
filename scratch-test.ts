import { PrismaClient } from "./src/generated/prisma";

const prisma = new PrismaClient();

async function test() {
  try {
    const entries = await prisma.projectScheduleEntry.findMany({
      where: {
        project_id: "test",
      },
      include: {
        options: {
          orderBy: { option_label: "asc" },
          include: { 
            product_catalog: {
              include: {
                product_requests: true
              }
            } 
          },
        },
        prefix_ref: true,
      },
    });
    console.log("Success:", entries.length);
  } catch (err: any) {
    console.error("Error:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

test();
