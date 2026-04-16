import "dotenv/config";
import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";
import console from "console";

async function main() {
  const email = "berkah.rad@gmail.com";
  // The user wrote "user = berkah.rad@gmail.com; password = user = berkah.rad@gmail.com"
  // Assuming password is "berkah.rad@gmail.com"
  const password = "berkah.rad@gmail.com";
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      password: hashedPassword,
    },
    create: {
      email,
      password: hashedPassword,
      name: "Berkah Rad",
      role: "ADMIN",
    },
  });

  console.log("Seed successful: User created/updated:", user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
