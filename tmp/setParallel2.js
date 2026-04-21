const { PrismaClient } = require('../src/generated/prisma');
const prisma = new PrismaClient();
(async () => {
  const phases = ['LAYOUT','DESIGN_3D','CD'];
  for (const name of phases) {
    await prisma.phase.updateMany({
      where: { name_enum: name },
      data: { allow_parallel: true }
    });
    console.log(`allow_parallel set for ${name}`);
  }
  await prisma.$disconnect();
})();
