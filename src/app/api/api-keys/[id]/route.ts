import { NextResponse } from "next/server";
import {
  getRequestAuth,
  unauthorizedResponse,
} from "@/lib/request-auth";
import { deleteApiKey } from "@/lib/api-keys";

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getRequestAuth(req);
  if (!auth) return unauthorizedResponse();

  const deleted = await deleteApiKey(params.id, auth.userId);
  if (!deleted) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}