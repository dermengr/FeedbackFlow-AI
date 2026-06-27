// Backfill Viewer roles: `npm run backfill:viewer`
// Assigns the "Viewer" role to every user who has no roles assigned.
// Safe to run multiple times (idempotent).
//
// Options:
//   --dry-run    Preview which users would be affected without writing anything.

import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { seedRolesAndPermissions } from "@/lib/roles";

const BATCH_SIZE = 500;

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // 1. Ensure the Viewer role exists with permissions
  let viewerRole = await prisma.role.findUnique({
    where: { name: "Viewer" },
    include: { permissions: { take: 1 } },
  });

  if (!viewerRole) {
    console.log("Viewer role not found. Seeding roles and permissions first…");
    await seedRolesAndPermissions();
    viewerRole = await prisma.role.findUnique({
      where: { name: "Viewer" },
      include: { permissions: { take: 1 } },
    });
  }

  if (!viewerRole) {
    console.error("Viewer role still not found after seeding. Aborting.");
    process.exit(1);
  }

  if (viewerRole.permissions.length === 0) {
    console.warn("Warning: Viewer role exists but has zero permissions.");
  }

  // 2. Find all users with no roles
  const usersWithoutRoles = await prisma.user.findMany({
    where: {
      roles: { none: {} },
    },
    select: { id: true, email: true },
    orderBy: { email: "asc" },
  });

  if (usersWithoutRoles.length === 0) {
    console.log("No users without roles found. Nothing to backfill.");
    return;
  }

  console.log(
    `${dryRun ? "[DRY RUN] Would assign" : "Assigning"} Viewer role to ${usersWithoutRoles.length} user(s):`
  );
  for (const u of usersWithoutRoles.slice(0, 20)) {
    console.log(`  - ${u.email}`);
  }
  if (usersWithoutRoles.length > 20) {
    console.log(`  … and ${usersWithoutRoles.length - 20} more`);
  }

  if (dryRun) {
    console.log("\nNo changes made (dry run).");
    return;
  }

  // 3. Bulk assign Viewer role in batches
  let totalCreated = 0;
  for (let i = 0; i < usersWithoutRoles.length; i += BATCH_SIZE) {
    const batch = usersWithoutRoles.slice(i, i + BATCH_SIZE);
    const result = await prisma.userRole.createMany({
      data: batch.map((u) => ({
        userId: u.id,
        roleId: viewerRole.id,
      })),
      skipDuplicates: true,
    });
    totalCreated += result.count;
    console.log(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}: assigned ${result.count}`);
  }

  console.log(`\nDone. Assigned Viewer role to ${totalCreated} user(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
