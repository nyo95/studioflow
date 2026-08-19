/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const phases = ['LAYOUT','DESIGN_3D','CD'];
  for (const name of phases) {
    await prisma.phase.updateMany({
      where: { name_enum: name },
      data: { allow_parallel: true }
    });
    console.log(`Set allow_parallel true for ${name}`);
  }
  await prisma.$disconnect();
})();
