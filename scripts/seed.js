/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("../src/generated/prisma");
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const bcrypt = require("bcryptjs");
const dotenv = require("dotenv");

// Load environment variables from .env
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres?schema=public';
console.log(`Using connection string: ${connectionString}`);

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting database seeding...");

  // 1. Create Admin
  const adminEmail = "berkah.rad@gmail.com";
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: adminPassword },
    create: {
      email: adminEmail,
      name: "Admin Rad",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log(`✅ Created/Ensured Admin user: ${admin.email} (Password: admin123)`);

  // 2. Create DIC (Designer)
  const dicEmail = "dic.rad@gmail.com";
  const dicPassword = await bcrypt.hash("designer123", 10);
  const dic = await prisma.user.upsert({
    where: { email: dicEmail },
    update: { password: dicPassword },
    create: {
      email: dicEmail,
      name: "Designer DIC",
      password: dicPassword,
      role: "DIC",
    },
  });
  console.log(`✅ Created/Ensured DIC user: ${dic.email} (Password: designer123)`);

  // 3. Create Drafter
  const drafterEmail = "drafter.rad@gmail.com";
  const drafterPassword = await bcrypt.hash("drafter123", 10);
  const drafter = await prisma.user.upsert({
    where: { email: drafterEmail },
    update: { password: drafterPassword },
    create: {
      email: drafterEmail,
      name: "Drafter Rad",
      password: drafterPassword,
      role: "DRIC",
    },
  });
  console.log(`✅ Created/Ensured Drafter user: ${drafter.email} (Password: drafter123)`);


  // 4. Cleanup existing projects to start fresh
  console.log("Cleaning up old projects...");
  await prisma.project.deleteMany({});

  // 5. Seed Projects
  const projectsData = [
    { id: "e1e1e1e1-e1e1-4e11-8e11-e1e1e1e1e1e1", name: "2025-412-Shoes Area Yogya Tasikmalaya", start: "2025-07-07", opening: null, status: "ACTIVE" },
    { id: "e2e2e2e2-e2e2-4e22-8e22-e2e2e2e2e2e2", name: "2025-429-Heloskin Cimanggu", start: "2026-01-28", opening: null, status: "ACTIVE" },
    { id: "e3e3e3e3-e3e3-4e33-8e33-e3e3e3e3e3e3", name: "2026-472-Sociolla SBZ The Breeze BSD", start: "2025-12-09", opening: "2026-05-11", status: "ACTIVE" },
    { id: "e4e4e4e4-e4e4-4e44-8e44-e4e4e4e4e4e4", name: "2026-473-SPF Booth ARCH.ID", start: "2025-12-24", opening: "2026-04-22", status: "ACTIVE" },
    { id: "e5e5e5e5-e5e5-4e55-8e55-e5e5e5e5e5e5", name: "2026-474-Sociolla SBW R1", start: "2026-01-27", opening: "2026-04-08", status: "ACTIVE" },
    { id: "e6e6e6e6-e6e6-4e66-8e66-e6e6e6e6e6e6", name: "2026-483-Sociolla SPZ PI", start: "2025-06-16", opening: "2026-06-17", status: "ACTIVE" },
  ];

  console.log("Seeding projects and bootstrapping phases...");
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
        core_project_type: "RETAIL",
      },
    });

    const PHASE_ORDER = [
      { name: "MOODBOARD", index: 1 },
      { name: "LAYOUT", index: 2 },
      { name: "DESIGN_3D", index: 3 },
      { name: "CD", index: 4 },
      { name: "SUPERVISION", index: 5 },
    ];

    for (const p of PHASE_ORDER) {
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
  }

  console.log("✅ Seeding finished successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end(); // Ensure the pool is closed
  });

