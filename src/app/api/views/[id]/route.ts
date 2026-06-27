import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/roles";
import { getRequestAuth, unauthorizedResponse, requirePermission } from "@/lib/request-auth";
import { deleteView } from "@/lib/views";

// DELETE /api/views/:id — delete a saved view owned by the current user
export async function DELETE(req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_VIEWS_WRITE);
  if (forbidden) return forbidden;
  try {
    await deleteView(params.id, auth.userId);
    return NextResponse.json({ ok: true });
  } catch {
    // View not found or not owned by the caller — both map to 404 to avoid
    // leaking the existence of other users' views.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
