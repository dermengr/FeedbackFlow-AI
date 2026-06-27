// Seed admin user: `npm run seed:admin`
// Creates the default roles/permissions and an admin user so there's
// always someone who can manage roles through the UI.
//
// Configure via env vars (defaults shown):
//   ADMIN_EMAIL=admin@feedbackflow.dev
//   ADMIN_PASSWORD=admin123
//   ADMIN_NAME=Admin

import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { seedRolesAndPermissions } from "@/lib/roles";

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@feedbackflow.dev").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const name = process.env.ADMIN_NAME ?? "Admin";

  // 1. Seed roles and permissions
  await seedRolesAndPermissions();
  console.log("Seeded roles and permissions.");

  // 2. Upsert admin user
  const hashedPassword = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name },
    create: { email, hashedPassword, name },
  });
  console.log(`Admin user ready: ${user.email}`);

  // 3. Assign Admin role if not already assigned
  const adminRole = await prisma.role.findUnique({
    where: { name: "Admin" },
    select: { id: true },
  });

  if (!adminRole) {
    console.error("Admin role not found after seeding. Aborting.");
    process.exit(1);
  }

  const existingUserRole = await prisma.userRole.findUnique({
    where: { userId_roleId: { userId: user.id, roleId: adminRole.id } },
  });

  if (!existingUserRole) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: adminRole.id },
    });
    console.log("Assigned Admin role.");
  } else {
    console.log("Admin role already assigned.");
  }

  console.log("\nSeed complete. Log in with:");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
