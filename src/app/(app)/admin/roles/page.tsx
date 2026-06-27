import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserRoles, ROLES, type RoleName } from "@/lib/roles";
import { RoleManager } from "@/components/RoleManager";

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Role Management</h1>
        <p className="text-sm text-slate-500">
          Assign roles to users. Each user can have multiple roles.
        </p>
      </div>

      <RoleManager users={users} roles={roles} allRoleNames={ROLES as unknown as string[]} />
    </div>
  );
}
