import { NextResponse } from "next/server";
import { PERMISSIONS } from "@/lib/roles";
import { 
  getRequestAuth,
  unauthorizedResponse,
 requirePermission, } from "@/lib/request-auth";
import { deleteApiKey } from "@/lib/api-keys";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();
  const forbidden = requirePermission(auth, PERMISSIONS.API_API_KEYS_WRITE);
  if (forbidden) return forbidden;

  const deleted = await deleteApiKey(params.id, auth.userId);
  if (!deleted) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}