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
      id: "00000000-0000-4000-8000-000000000001",
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
      id: "00000000-0000-4000-8000-000000000002",
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
      id: "00000000-0000-4000-8000-000000000003",
      email: drafterEmail,
      name: "Drafter Rad",
      password: drafterPassword,
      role: "DRIC",
    },
  });
  console.log(`✅ Created/Ensured Drafter user: ${drafter.email} (Password: drafter123)`);

  // 4. Create Staff
  const staffEmail = "staff.rad@gmail.com";
  const staffPassword = await bcrypt.hash("staff123", 10);
  const staff = await prisma.user.upsert({
    where: { email: staffEmail },
    update: { password: staffPassword },
    create: {
      id: "00000000-0000-4000-8000-000000000004",
      email: staffEmail,
      name: "Staff Rad",
      password: staffPassword,
      role: "STAFF",
    },
  });
  console.log(`✅ Created/Ensured Staff user: ${staff.email} (Password: staff123)`);

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

