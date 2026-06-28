import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserRoles, ROLES, type RoleName } from "@/lib/roles";
import { RoleManager } from "@/components/RoleManager";
import { PageShell, PageHeader, PageSection } from "@/components/PageShell";

export const dynamic = "force-dynamic";

async function getUsersWithRoles() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true },
    orderBy: { email: "asc" },
  });
  const enriched = await Promise.all(
    users.map(async (u) => ({
      ...u,
      roles: await getUserRoles(u.id),
    }))
  );
  return enriched;
}

async function getAllRoles() {
  return prisma.role.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });
}

export default async function RolesAdminPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string })?.id;

  if (!userId) redirect("/login");

  const userRoles = userId ? await getUserRoles(userId) : [];
  if (!userRoles.includes("Admin")) {
    redirect("/dashboard");
  }

  const [users, roles] = await Promise.all([getUsersWithRoles(), getAllRoles()]);

  return (
    <PageShell className="space-y-6">
      <PageHeader
        title="Role Management"
        description="Assign roles to users. Each user can have multiple roles."
      />

      <PageSection>
        <RoleManager users={users} roles={roles} allRoleNames={ROLES as unknown as string[]} />
      </PageSection>
    </PageShell>
  );
}
