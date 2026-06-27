import { NextResponse } from "next/server";
import { getRequestAuth, unauthorizedResponse, forbiddenResponse, requirePermission } from "@/lib/request-auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/roles";
import { getUserRoles } from "@/lib/roles";

export async function POST(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const forbidden = requirePermission(auth, PERMISSIONS.PAGE_ADMIN);
  if (forbidden) return forbidden;

  const callerRoles = await getUserRoles(auth.userId);
  if (!callerRoles.includes("Admin")) {
    return forbiddenResponse("Admin access required");
  }

  const body = await req.json().catch(() => ({}));
  const { userId, roleName } = body as { userId?: string; roleName?: string };

  if (!userId || !roleName) {
    return NextResponse.json({ error: "userId and roleName required" }, { status: 400 });
  }

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  await prisma.userRole.deleteMany({
    where: { userId, roleId: role.id },
  });

  return NextResponse.json({ success: true });
}
