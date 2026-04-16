const { PrismaClient } = require("../src/generated/prisma");
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require("bcryptjs");

const connectionString = 'postgresql://postgres:password@localhost:5432/studioflow?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding users...");

  // Password for both is 'password123'
  const hashedPassword = await bcrypt.hash("password123", 10);

  // 1. Create Admin / Designer
  const admin = await prisma.user.upsert({
    where: { email: "berkah.rad@gmail.com" },
    update: {},
    create: {
      email: "berkah.rad@gmail.com",
      name: "Admin Rad",
      password: hashedPassword,
      role: "ADMIN",
    },
  });
  console.log(`Created/Ensured Admin user: ${admin.email}`);

  // 2. Create Drafter
  const drafter = await prisma.user.upsert({
    where: { email: "drafter.rad@gmail.com" },
    update: {},
    create: {
      email: "drafter.rad@gmail.com",
      name: "Drafter Rad",
      password: hashedPassword,
      role: "DRIC",
    },
  });
  console.log(`Created/Ensured Drafter user: ${drafter.email}`);

  // 3. Cleanup existing projects to start fresh
  console.log("Cleaning up old projects...");
  await prisma.project.deleteMany({});

  // 3. Seed Projects from Screenshot
  const projectsData = [
    { id: "e1e1e1e1-e1e1-4e11-8e11-e1e1e1e1e1e1", name: "2025-412-Shoes Area Yogya Tasikmalaya", start: "2025-07-07", opening: null, status: "ACTIVE" },
    { id: "e2e2e2e2-e2e2-4e22-8e22-e2e2e2e2e2e2", name: "2025-429-Heloskin Cimanggu", start: "2026-01-28", opening: null, status: "ACTIVE" },
    { id: "e3e3e3e3-e3e3-4e33-8e33-e3e3e3e3e3e3", name: "2026-472-Sociolla SBZ The Breeze BSD", start: "2025-12-09", opening: "2026-05-11", status: "ACTIVE" },
    { id: "e4e4e4e4-e4e4-4e44-8e44-e4e4e4e4e4e4", name: "2026-473-SPF Booth ARCH.ID", start: "2025-12-24", opening: "2026-04-22", status: "ACTIVE" },
    { id: "e5e5e5e5-e5e5-4e55-8e55-e5e5e5e5e5e5", name: "2026-474-Sociolla SBW R1", start: "2026-01-27", opening: "2026-04-08", status: "ACTIVE" },
    { id: "e6e6e6e6-e6e6-4e66-8e66-e6e6e6e6e6e6", name: "2026-483-Sociolla SPZ PI", start: "2025-06-16", opening: "2026-06-17", status: "ACTIVE" },
  ];

  console.log("Seeding projects...");
  for (const data of projectsData) {
    const project = await prisma.project.upsert({
      where: { id: data.id },
      update: {
        name: data.name,
        pic_designer_id: admin.id,
        pic_drafter_id: drafter.id,
        opening_date: data.opening ? new Date(data.opening) : null,
      },
      create: {
        id: data.id,
        name: data.name,
        pic_designer_id: admin.id,
        pic_drafter_id: drafter.id,
        opening_date: data.opening ? new Date(data.opening) : null,
        project_type: "RETAIL",
      },
    });
    console.log(`Created Project: ${project.name} (ID: ${project.id})`);

    // 4. Create Phases for each project (Bootstrap logic)
    const PHASE_ORDER = [
      { name: "MOODBOARD", index: 1 },
      { name: "LAYOUT", index: 2 },
      { name: "DESIGN_3D", index: 3 },
      { name: "CD", index: 4 },
      { name: "SUPERVISION", index: 5 },
    ];

    for (const p of PHASE_ORDER) {
      // Generate valid UUIDs using a deterministic approach that satisfies Zod
      // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (V4 format)
      const phaseId = `${project.id.substring(0, 8)}-${p.index}000-4000-8000-${project.id.substring(24)}`;
      const revId = `${project.id.substring(0, 8)}-${p.index}001-4001-8001-${project.id.substring(24)}`;

      const phase = await prisma.phase.upsert({
        where: { id: phaseId },
        update: {},
        create: {
          id: phaseId,
          project_id: project.id,
          name_enum: p.name,
          status_enum: p.index === 1 ? "IN_PROGRESS" : "PENDING",
          order_index: p.index,
          is_locked: false,
        },
      });
      
      // Create initial revision for the first phase
      if (p.index === 1) {
        await prisma.revision.upsert({
          where: { id: revId },
          update: {},
          create: {
            id: revId,
            phase_id: phase.id,
            major: 1,
            minor: 0,
            status_enum: "ACTIVE",
          },
        });
      }
    }
    console.log(`  -> Phases bootstrapped for ${project.name}`);
  }

  console.log("Seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
