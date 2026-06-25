import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteView } from "@/lib/views";

// DELETE /api/views/:id — delete a saved view owned by the current user
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await deleteView(params.id, session.user.id);
    return NextResponse.json({ ok: true });
  } catch {
    // View not found or not owned by the caller — both map to 404 to avoid
    // leaking the existence of other users' views.
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
