import { NextResponse } from "next/server";
import { getRequestAuth, unauthorizedResponse, forbiddenResponse, requirePermission } from "@/lib/request-auth";
import { PERMISSIONS } from "@/lib/roles";
import { getUserRoles } from "@/lib/roles";
import { listAllAuditEvents } from "@/lib/audit";

// GET /api/admin/audit - paginated list of all audit events. Admin only.
export async function GET(req: Request) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const forbidden = requirePermission(auth, PERMISSIONS.PAGE_ADMIN);
  if (forbidden) return forbidden;

  const callerRoles = await getUserRoles(auth.userId);
  if (!callerRoles.includes("Admin")) {
    return forbiddenResponse("Admin access required");
  }

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(url.searchParams.get("pageSize") ?? 20) || 20)
  );

  try {
    const result = await listAllAuditEvents(page, pageSize);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to load audit events", detail: (err as Error).message },
      { status: 500 }
    );
  }
}
