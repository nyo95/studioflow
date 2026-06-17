const { PrismaClient } = require("../src/generated/prisma");
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require("dotenv");

dotenv.config();

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Preparing test data...");

  // Ensure PIC users exist
  const designer = await prisma.user.findFirst({ where: { role: "DIC" } });
  const drafter = await prisma.user.findFirst({ where: { role: "DRIC" } });

  if (!designer || !drafter) {
    throw new Error("DIC or DRIC user not found. Run seed first.");
  }

  // Create Project
  const project = await prisma.project.upsert({
    where: { project_code: "2025-429" },
    update: {},
    create: {
      project_code: "2025-429",
      name: "2025-429 Heloskin Cimanggu",
      pic_designer_id: designer.id,
      pic_drafter_id: drafter.id,
      core_project_type: "RETAIL",
      status_progress: "ACTIVE",
    }
  });
  console.log(`Project created/ensured: ${project.name}`);

  // Create SketchupProject
  const sketchupProject = await prisma.sketchupProject.upsert({
    where: { api_key: "sf_sk_YOUR_KEY" },
    update: {
      project_id: project.id,
      sketchup_model_name: "Test Project",
    },
    create: {
      project_id: project.id,
      sketchup_model_name: "Test Project",
      api_key: "sf_sk_YOUR_KEY",
    }
  });
  console.log(`SketchupProject created/ensured: api_key=sf_sk_YOUR_KEY, projectId=${sketchupProject.project_id}`);
}

main()
  .catch((e) => {
    console.error("Error preparing test data:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
