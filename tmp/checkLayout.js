const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const phase = await prisma.phase.findFirst({ where: { name_enum: 'LAYOUT' } });
  console.log('LAYOUT phase:', phase);
  await prisma.$disconnect();
})();
